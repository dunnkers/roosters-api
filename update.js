var RSVP = require('rsvp'),
	_ = require('lodash'),
	async = require('async'),
	log4js = require('log4js'),
	log = log4js.getLogger('update'),
	stream = process.stdout;

// scraper, connection and models
var scraper = require('./app/scraper'),
	db = require('./app/connection'),
	models = require('./app/initializers/models'),
	flow = require('./app/utils/flow-control');

function sum (a, b) {
	return a + b;
}

function numberAffected (results) {
	return _.reduce(_.pluck(results, 'numberAffected'), sum) || 0;
}

var queue, schedules = [];

db.connect().then(function () {
	log.info('Updating items...');
	return flow.asyncMap(models.items, function (Item) {
		return scraper.getItems(Item.modelName).then(function (items) {
			return RSVP.all(items.map(function (item) {
				// -> item is serialized here.
				return Item.upsert(new Item(item));
			}));
		}).then(function (items) {
			var updated = numberAffected(items);
			log.debug('Updated %d [%s]', updated, Item.modelName);
			return updated;
		});
	}).catch(function (err) {
		log.error('Failed to update items -', err);
	});
}).then(function (items) {
	log.info('Updated %d items.', _.reduce(items, sum) || 0);

	return models.Grade.aggregation();
}).then(function (grades) {
	log.info('Aggregated %d grades.', numberAffected(grades));

	stream.write('\n');
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
			log.debug('Updated %d of %d lessons for %s [%s]',
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

		return Item.find().exec()
		.then(function (items) {
			// items = [Student|...]
			// execute http requests with a max concurrency of 5
			return flow.asyncMap(items, function (item) {
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
			log.debug('Downloaded %d schedules [%s]', updated, Item.modelName);

			return updated;
		});
	})).catch(function (err) {
		log.error('Failed to download schedules -', err);
	});
}).then(function (schedules) {
	log.info('Downloaded %d schedules.', _.reduce(schedules, sum) || 0);

	stream.write('\n');
	log.info('Updating schedules...');
	return flow.drain(queue);
}).then(function () {
	log.info('Updated %d schedules!', numberAffected(schedules));

	return models.Cluster.aggregation();
}).then(function (clusters) {
	log.info('Aggregated %d clusters.', numberAffected(clusters));

	return models.Lesson.aggregateAudience();
}).then(function (lessons) {
	log.info('Aggregated %d lesson audiences.', numberAffected(lessons));

	db.close();
}, function (err) {
	log.fatal('Oops, something went wrong! –', err);

	db.close();
});
