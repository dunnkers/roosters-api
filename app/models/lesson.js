var util = require('util'),
	// deps
	mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema,
	RSVP = require('rsvp'),
	_ = require('lodash'),
	flow = require('../utils/flow-control');

// ember-runtime string.js w - http://bit.ly/1krJteU
function w (str) {
	return str.split(/\s+/);
}

/**
 * Removes falsy values off an object.
 */
function clean (object) {
	return _.pick(object, function (value) {
		return value;
	});
}

function AbstractSchema () {
	Schema.apply(this, arguments);

	/** note on subIndex and sibling
	 * Both subIndex and sibling are proven not to be consistent across items.
	 * -> new strategy involves recreating subindexes
	 */
	this.add({
		// positioning
		day: Number,
		index: Number,
		// states
		empty: Boolean,
		between: Boolean,
		reserved: Boolean,

		// lesson-specific serialization
		room: { type: String, ref: 'Room', populate: false },
		teacher: { type: String, ref: 'Teacher', populate: false },
		group: { type: String, ref: 'Group', populate: false },
		subject: String,
		cluster: { type: String, ref: 'Cluster', populate: false },

		audience: { type: String, ref: 'Audience' },

		// a lesson belongs to multiple schedules (many-to-many)
		schedules: [ { type: Schema.Types.ObjectId, ref: 'Schedule' } ]
	});

	// fields that determine a unique lesson. these are used to query.
	this.options.fields = [ 'day', 'index',
						'empty', 'between', 'reserved',
						'room', 'teacher', 'subject' ];
	this.options.select = '-__v -createdAt -updatedAt -schedules';

	// do not send schedules if a cluster or group is defined
	if (!this.options.toJSON) this.options.toJSON = {};

	// delete schedules in document transformation. note this is only effective
	// if Lesson.schedules is -not- populated. else the models are attached anyway.
	this.options.toJSON.transformation = function (doc) {
		if (doc.schedules && (doc.cluster || doc.group)) {
			delete doc.schedules;
		}
	};

	// discriminator options - http://bit.ly/1knmNlG
	this.options.collection = 'lessons';
	this.options.discriminatorKey = 'lessonType';

	/**
	 * Serializes raw lessons. Detects distinctions, validates- and splits lessons.
	 * @param  {Array} lessons Array of raw lessons with content and origins.
	 * @return {Promise}         A promise containing an array of lessons as a result.
	 */
	this.statics.serialize = function (lessons) {
		// items
		var Group = this.model('Group'),
			Room = this.model('Room'),
			Teacher = this.model('Teacher');

		return RSVP.hash({
			cluster: Group.find().distinct('grade').exec(), // clusters
			group: Group.find().distinct('_id').exec(),
			room: Room.find().distinct('_id').exec(),
			teacher: Teacher.find().distinct('_id').exec()
		}).then(function (items) {
			var result = _.transform(lessons, function (res, lesson) {
				// if empty or reserved we don't have to parse.
				if (lesson.empty || lesson.reserved) return res.push(lesson);

				var type = lesson.origin ? lesson.origin.type : '';

				/* uncertainties */
				lesson.content = _.transform(lesson.content, function (res, str, key) {
					if (str.slice(-1) === '*') {
						str = str.replace(/\*$/, '');

						// only take student and group uncertainties seriously, delete others.
						if (type === 'Student' || type === 'Group') {
							res[key] = str;
						}
					} else {
						res[key] = str;
					}
				});

				/* DETECT */
				var found = {};

				// should leave subject
				lesson.content = _.pick(lesson.content, function (value) {
					// loop all items
					return _.isEmpty(_.filter(items, function (distinctions, key) {
						// check if value is one of them
						return distinctions.filter(function (distinction) {
							if (_.contains(value, distinction)) {
								found[key] = value;

								return true;
							}
						}).length > 0;
					}));
				});

				// set subject if only one property left
				if (_.keys(lesson.content).length === 1) {
					found.subject = _.first(_.values(lesson.content));

					delete lesson.content;
				}

				/* VALIDATE */
				// meeting. e.g. `Inv`, `Acht1` or `team1` lessons.
				var meeting = found.teacher && !(found.group || found.cluster);
				if (type === 'Room' && meeting) delete found.teacher;

				// converge into group if both found
				if (found.group && found.cluster) delete found.cluster;

				// if empty, return
				if (_.isEmpty(found)) return res.push(lesson);

				/* SPLIT */
				// split fields and combine/zip them.
				var zipped = _.zip(_.mapValues(found, w));

				// re-assemble as an object
				zipped = zipped.map(function (zip) {
					return _.zipObject(_.keys(found), zip);
				});
				// remove falsy values
				zipped = zipped.map(clean);
				// assign to lesson
				zipped = zipped.map(function (zip) {
					// sibling would be attached here
					return _.assign(_.cloneDeep(lesson), zip);
				});
				// push to result
				zipped.forEach(function (zip) {
					res.push(zip);
				});
			});
			return result;
		});
	};

	this.statics.aggregateAudience = function () {
		var Schedule = this.model('Schedule'),
				Item = this.model('Item'),
				Audience = this.model('Audience');

		var ne = { $exists: false },
				query = { cluster: ne, group: ne };

		return this.find(query).exec().then(function (lessons) {
			// ABSTRACT AWAY THIS FROM CLUSTER AGGR. LOGIC!
			// THIS IS COPY!!!
			// populate schedules
			return Schedule.populate(lessons, { path: 'schedules', select: 'items' });
		}).then(function (lessons) {
			// populate items
			return RSVP.all(lessons.map(function (lesson) {
				var items = _.uniq(_.flatten(_.pluck(lesson.schedules, 'items')));

				var audience = new Audience({
					items: items
				});

				return Audience.upsert(audience).then(function (result) {
					lesson.audience = result.product._id;

					return lesson;
				});
			}));
		}).then(function (lessons) {
			return flow.asyncMap(lessons, function (lesson) {
				return lesson.promisedSave();
			});
		});
	};
}
util.inherits(AbstractSchema, Schema);

mongoose.model('Lesson', new AbstractSchema());
module.exports = AbstractSchema;
