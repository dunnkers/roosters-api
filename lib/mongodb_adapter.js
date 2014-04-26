var mongojs = require('mongojs'),
	RSVP = require('rsvp'),
	_ = require('lodash'),
	format = require('util').format;

var db_url = process.env.OPENSHIFT_MONGODB_DB_URL || '',
	db_name = process.env.OPENSHIFT_APP_NAME || 'api',
	connectionString = db_url + db_name,
	db,
	colls = {};

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
			var query = { $set: { lastModified: new Date() } };

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

exports.archiveOldModels = function (collection, models) {
	return exports.findAll(collection).then(function (docs) {
		var toRemove = _.difference(_.pluck(docs, '_id'), _.pluck(models, '_id'));
		if (!(toRemove.length && models && models.length)) {
			return 0;
		}
		var query = { _id: { $in: toRemove }};
		var archive = collection + 'Archive';
		return exports.find(collection, query).then(function (docs) {
			return exports.loadCollection(archive).then(function () {
				docs = docs.map(function (doc) {
					return _.assign(doc, { dateRemoved: new Date() });
				});
				return exports.insert(archive, docs).then(function () {
					return exports.remove(collection, query).then(function () {
						return toRemove.length;
					});
				});
			});
		});
	});
};

exports.resolveSchedule = function (collection, timetable) {
	return RSVP.all(timetable.map(function (day, i) {
		return RSVP.all(day.map(function (hour, j) {
			var query = {};
			query[format('timetable.0.%s.%s.between', i, j)] = true;
			return exports.find(collection, query).then(function (docs) {
				return _.pluck(docs, '_id');
			});
		}));
	}));
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
		colls[collection].findOne(unique ? { _id: unique } : {}, function (err, doc) {
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

exports.remove = function (collection, query) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].remove(query, function (err) {
			if (err) {
				reject(err);
			}
			resolve();
		});
	});
};

exports.insert = function (collection, doc) {
	return new RSVP.Promise(function (resolve, reject) {
		colls[collection].insert(doc, function (err, doc) {
			if (err) {
				reject(err);
			}
			resolve(doc);
		});
	});
};