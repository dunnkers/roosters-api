var mongojs = require('mongojs'),
	RSVP = require('rsvp'),
	_ = require('lodash'),
	format = require('util').format;

var db_url = process.env.OPENSHIFT_MONGODB_DB_URL || '';
var db_name = process.env.OPENSHIFT_APP_NAME || 'api';
var connectionString = db_url + db_name;

var db;
var colls = {};

/**
 * Creates a collection if not existant, otherwise loads it.
 * @param  {Object} collection Name of collection to load.
 * @return {Number}          Count of documents in the collection
 */
exports.loadCollection = function (collection) {
	return new RSVP.Promise(function (resolve, reject) {
		db = db || mongojs(connectionString);
		colls[collection] = db.collection(collection);
		colls[collection].count(function (err, count) {
			if (err) {
				reject(err);
			}
			resolve(count);
		});
	});
};

exports.addModels = function (collection, models) {
	var stats = { inserted: 0, updated: 0 };
	var i = 0;

	function recurse () {
		var model = models[i];

		return new RSVP.Promise(function (resolve, reject) {
			colls[collection].findAndModify({
				query: { _id: model._id },
				update: _.assign(model.updateQuery(), {
					$setOnInsert: {
						dateCreated: new Date()
					}
				}),
				upsert: true
			}, function (err, doc, lastErrorObject) {
				if (err) {
					reject(err);
				}
				if (doc && lastErrorObject.updatedExisting) {
					resolve(ifUpdated(model, doc));
				}else {
					if (doc) {
						stats.inserted ++;
					}
					i ++;
					resolve(i < models.length ? recurse() : stats);
				}
			});
		});
	}

	function ifUpdated (model, oldDoc) {
		return exports.findOne(collection, model._id).then(function (newDoc) {
			if (_.isEqual(oldDoc, newDoc)) {
				return;
			}
			stats.updated ++;

			var updateQuery = {
				$set: {lastModified: new Date()},
				$push: {}
			};
			_.forIn(model.updateQuery().$addToSet, function (value, key) {
				if (oldDoc[key].length != newDoc[key].length) {
					updateQuery.$push[key + 'LastModified'] = new Date();
				}
			});

			return new RSVP.Promise(function (resolve, reject) {
				colls[collection].update({ _id: model._id }, 
					updateQuery, {}, function (err) {
					if (err) {
						reject(err);
					}
					resolve();
				});
			});
		}).then(function () {
			i ++;
			return i < models.length ? recurse() : stats;
		});
	}
	
	return models.length ? recurse() : stats;
}

exports.findAll = function (collection) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].find({}, function (err, docs) {
			if (err) {
				reject(err);
			}
			resolve(docs);
		});
	});
};

exports.findOne = function (collection, unique) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].findOne({ _id: unique }, function (err, doc) {
			if (err) {
				reject(err);
			}
			resolve(doc);
		});
	});
};

exports.removeOldModels = function (collection, models) {
	return new RSVP.Promise(function (resolve, reject) {
		if (!models.length) {
			console.error('Cannot remove old models! - no models');
			resolve(0);
			return;
		}
		colls[collection].find({}, function (err, docs) {
			if (err) {
				reject(err);
			}
			var toRemove = _.difference(_.pluck(docs, '_id'), _.pluck(models, '_id'));
			colls[collection].remove({ _id: { $in: toRemove }}, function (err) {
				if (err) {
					reject(err);
				}
				resolve(toRemove.length);
			});
		});
	});
};

exports.setScheduleRelations = function (collection) {
	return exports.findAll(collection).then(function (docs) {
		return RSVP.all(docs.map(function (doc) {
			var lastIndex = doc.timetable.length - 1;

			return RSVP.all(doc.timetable[lastIndex].map(function (day, i) {
				return day.map(function (hour, j) {
					var query = {};
					query._id = {$ne: doc._id};
					query[format('timetable.%s.%s.%s.hourBetween', lastIndex, i, j)] = true;

					return new RSVP.Promise(function (resolve, reject) {
						colls[collection].find(query, function (err, docs) {
							console.log('resolving; ', {
								lastIndex: lastIndex, i: i, j: j, students: _.pluck(docs, '_id')
							});
							resolve({
								lastIndex: lastIndex, i: i, j: j, students: _.pluck(docs, '_id')
							});
						});
					});
				});
			})).then(function (results) {
				console.log('got all for doc ', doc._id);
			});
		}));
	}).then(function (docs) {
		docs.forEach(function (doc) {
			doc.forEach(function (wut) {
				console.log('WUT ', wut);
			});
		});
	});
	/*//doc.timetable[lastIndex][i][j].students = _.pluck(docs, '_id');
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].find({}).forEach(function (err, doc) {
			if (!doc) {
				resolve();
				return;
			}
			var promises = [];

			var lastIndex = doc.timetable.length - 1;
			doc.timetable[lastIndex].forEach(function (day, i) {
				day.forEach(function (hour, j) {
					var query = {};
					query._id = {$ne: doc._id};
					query[format('timetable.%s.%s.%s.hourBetween', lastIndex, i, j)] = true;

					promises.push(new RSVP.Promise(function (resolve, reject) {
						colls[collection].find(query, function (err, docs) {
							doc.timetable[lastIndex][i][j].students = _.pluck(docs, '_id');
						});
					}));
				});
			});
			RSVP.all(promises).then();

			// when complete, run 1 update.
			console.log(doc.timetable[lastIndex]);
		});
	});*/
}

exports.close = function () {
	delete colls;
	db.close();
};

// share adapter code with REST API.