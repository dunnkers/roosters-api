var util = require('util'),
	// deps
	mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema,
	RSVP = require('rsvp'),
	_ = require('lodash');

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
		room: { type: String, ref: 'Room', populate: 'sideload' },
		teacher: { type: String, ref: 'Teacher', populate: 'sideload' },
		group: { type: String, ref: 'Group', populate: 'sideload' },
		subject: String,
		cluster: { type: String, ref: 'Cluster', populate: 'sideload' },

		// a lesson belongs to multiple schedules (many-to-many)
		schedules: [ { type: Schema.Types.ObjectId, ref: 'Schedule' } ]
	});

	// fields that determine a unique lesson. these are used to query.
	this.options.fields = [ 'day', 'index', 
						'empty', 'between', 'reserved',
						'room', 'teacher', 'subject' ];

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

				/* VALIDATE */
				// meeting. e.g. `Inv`, `Acht1` or `team1` lessons.
				var meeting = found.teacher && !(found.group || found.cluster);
				var type = lesson.origin ? lesson.origin.type : '';
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
}
util.inherits(AbstractSchema, Schema);

mongoose.model('Lesson', new AbstractSchema());
module.exports = AbstractSchema;