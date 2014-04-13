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
	function ifUpdated (model, oldDoc) {
		return exports.findOne(collection, model._id).then(function (newDoc) {
			if (_.isEqual(oldDoc, newDoc)) {
				return;
			}
			var query = { $set: {lastModified: new Date()} };

			_.forIn(model.updateQuery().$addToSet, function (value, key) {
				if (oldDoc[key].length != newDoc[key].length) {
					newDoc[key].unshift(newDoc[key].pop());
					query.$set[key] = newDoc[key];

					var modified = key + 'Modified';
					newDoc[modified].unshift(new Date());
					query.$set[modified] = newDoc[modified];
				}
			});

			return exports.update(collection, model._id, query).then(function () {
				return 'updated';
			});
		});
	}

	return RSVP.all(models.map(function (model) {
		return new RSVP.Promise(function (resolve, reject) {
			colls[collection].findAndModify({
				query: { _id: model._id },
				update: model.updateQuery(),
				upsert: true
			}, function (err, doc, lastErrorObject) {
				if (err) {
					reject(err);
				}
				if (doc && lastErrorObject.updatedExisting) {
					resolve(ifUpdated(model, doc));
				}else {
					resolve(doc ? 'inserted' : null);
				}
			});
		});
	})).then(function (values) {
		return _.countBy(values);
	});
};

exports.removeOldModels = function (collection, models) {
	return exports.findAll(collection).then(function (docs) {
		models = models && models.length ? models : docs;
		var toRemove = _.difference(_.pluck(docs, '_id'), _.pluck(models, '_id'));
		colls[collection].remove({ _id: { $in: toRemove }}, function (err) {
			if (err) {
				reject(err);
			}
			resolve(toRemove.length);
		});
	});
};

exports.resolveScheduleRelations = function (collection, docs) {
	return RSVP.all(docs.map(function (doc) {
		return exports.resolveScheduleRelation(collection, doc);
	}));
};

exports.resolveScheduleRelation = function (collection, doc) {
	return RSVP.all(_.flatten(_.first(doc.timetable).map(function (day, i) {
		return day.map(function (hour, j) {
			var query = {};
			query._id = {$ne: doc._id};
			query[format('timetable.0.%s.%s.between', i, j)] = true;

			return exports.find(collection, query).then(function (docs) {
				var students = _.pluck(docs, '_id');
				if (students.length) {
					_.first(doc.timetable)[i][j].students = students;
				}
			});
		});
	}))).then(function () {
		return doc;
	});
}

exports.close = function () {
	delete colls;
	db.close();
};

exports.find = function (collection, query) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].find(query, function (err, docs) {
			if (err) {
				reject(err);
			}
			resolve(docs);
		});
	});
};

exports.findAll = function (collection) {
	return exports.find(collection, {});
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

exports.update = function (collection, unique, query) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].update({ _id: unique }, query, {}, function (err) {
			if (err) {
				reject(err);
			}
			resolve();
		});
	});
};