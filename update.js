var print = require('util').print,
	// deps
	RSVP = require('rsvp'),
	_ = require('lodash'),
	async = require('async'),
	log4js = require('log4js'),
	log = log4js.getLogger('update');

log4js.configure({
	appenders: [ { type: "console", layout: { type: "basic" } } ], replaceConsole: true
});

// scraper, connection and models
var scraper = require('./app/scraper'),
	db = require('./app/connection'),
	models = require('./app/initializers/models');

function sum (one, two) {
	return one + two;
}

function numberAffected (results) {
	return _.reduce(_.pluck(results, 'numberAffected'), sum) || 0;
}

/**
 * Promised async mapping. Supports limited parallel and
 * serial when no limit is given.
 * @param  {Array} arr     Array to map.
 * @param  {Promise} promise Promise to invoke with every item.
 * @param  {Number} limit   Limit of parallel executions. If not given serial.
 * @return {Promise}         Promise resolving when all items are done.
 */
function asyncMap (arr, promise, limit) {
	return new RSVP.Promise(function (resolve, reject) {
		async.mapLimit(arr, limit || 1, function (item, callback) {
			promise(item).then(function (res) {
				callback(null, res);
			}, function (err) {
				callback(err);
			});
		}, function (err, results) {
			if (err) reject(err);

			resolve(results);
		});
	});
}

function drain (queue) {
	return new RSVP.Promise(function (resolve, reject) {
		if (queue.running() || !queue.idle()) {
			log.trace('Processing %d tasks in queue...', queue.length());
			queue.drain = function () {
				resolve();
			};
		}else {
			resolve();
		}
	});
}

var queue, schedules = [];

db.connect().then(function () {
	log.info('Updating items...');
	return RSVP.all(models.items.map(function (Item) {
		return scraper.getItems(Item.modelName).then(function (items) {
			return RSVP.all(items.map(function (item) {
				// -> item is serialized here.
				return Item.upsert(new Item(item));
			}));
		}).then(function (items) {
			var updated = numberAffected(items);
			log.info('Updated %d [%s]', updated, Item.modelName);
			return updated;
		});
	})).catch(function (err) {
		log.error('Failed to update items -', err);
	});
}).then(function (items) {
	log.info('Updated %d items.', _.reduce(items, sum) || 0);

	return models.Item.aggregateGrades();
}).then(function (grades) {
	log.info('Aggregated %d grades.', numberAffected(grades));

	print('\n');
	log.info('Downloading schedules...');

	// store a schedule
	queue = async.queue(function (task, callback) {
		var item = task.item;

		RSVP.all(task.lessons.map(function (lesson) {
			return models.Lesson.upsert(lesson);
		})).catch(function (err) {
			if (err.name === 'VersionError') log.error('Concurrency issues!');
			log.error('Failed to insert lessons for %d -', item._id, err);
		}).then(function (lessons) {
			log.trace('Updated %d of %d lessons for %s [%s]', 
				numberAffected(lessons), lessons.length, item._id, item.type);

			return models.Schedule.upsert(new models.Schedule({
				lessons: _.pluck(lessons, 'product')
			}));
		}).then(function (schedule) {
			schedules.push(schedule);
			
			// set generated schedule id
			item.schedule = schedule.product._id;
			return item.promisedSave();
		}).then(function () {
			callback();
		}, function (err) {
			log.error('Failed to insert schedule for %d -', item._id, err);
		});
	}, 1);


	return RSVP.all(models.items.map(function (Item) {
		var ItemLesson = models[Item.modelName + 'Lesson'];

		// Item = Student|Teacher|Room|Group
		// "10971", "Hofe", "11381", "13769", "11051", "11322"
		// "13769", "12993", "14445", "14445", "14495", "11467", "14339", "12702", "11466", "12343"
		return Item.find({ _id: { $in: [ "032", "13769", "10971", "Lafh", "11051" ] } }).exec()
		.then(function (items) {
			// items = [Student|...]
			// execute http requests with a max concurrency of 5
			return asyncMap(items, function (item) {
				return scraper.getLessons(Item.modelName, item.toObject())
				// for some reason, when using `.then(Lesson.x)` it doesn't  work.
				.then(function (lessons) {
					return ItemLesson.serialize(lessons);
				}).then(function (lessons) {
					var task = {
						item: item,
						lessons: lessons.map(function (lesson) {
							// create new lesson and cast to general lesson
							return new models.Lesson(new ItemLesson(lesson));
						})
					};
					queue.push(task);

					return task.lessons.length;
				});
			}, 5);
		// first parse lessons - then store the schedule.
		}).then(function (schedules) {
			var updated = schedules.length;
			log.trace('Downloaded %d schedules [%s]', updated, Item.modelName);

			return updated;
		});
	})).catch(function (err) {
		log.error('Failed to download schedules -', err);
	});
}).then(function (schedules) {
	log.info('Downloaded %d schedules.', _.reduce(schedules, sum) || 0);

	print('\n');
	log.info('Updating schedules...');
	return drain(queue);
}).then(function () {
	log.info('Updated %d schedules!', numberAffected(schedules));

	return models.Cluster.aggregation();
}).then(function (clusters) {
	log.info('Aggregated %d clusters.', numberAffected(clusters));

	db.close();
}, function (err) {
	log.error('Oops, something went wrong! –', err);

	db.close();
});