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

function clean (object) {
	return _.transform(object, function (res, value, key) {
		if (value) res[key] = value;
	});
}

function AbstractSchema () {
	Schema.apply(this, arguments);

	this.add({
		// positioning
		day: Number,
		index: Number,
		/* note on subIndex and sibling: */
		// not consistent across items. new strategy involves recreating subindexes
		// upon detection of multiple lessons in one cell.
		//subIndex: Number, // cells within a cell
		//sibling: Number, // "261 262 263" -> three siblings
		// states
		empty: Boolean,
		between: Boolean,
		reserved: Boolean,

		// lesson-specific serialization
		room: { type: String, ref: 'Room' },
		teacher: { type: String, ref: 'Teacher' },
		group: { type: String, ref: 'Group' },
		subject: String,
		cluster: String,

		schedules: [ { type: String, ref: 'Schedule' } ]/*,
		students: [ { type: String, ref: 'Student' } ],
		teachers: [ { type: String, ref: 'Teacher' } ]*/
	});

	// lesson-specific properties of which can be multiple in -one- lesson.
	// for example, subject is never duplicated
	this.methods.specifics = [ 'room', 'teacher', 'cluster' ];
	// fields that determine a unique lesson. these are used to query.
	// -not- `subIndex`, lessons always nest in group lessons
	// -not- `sibling`, on 'men' or 'bu' lessons this is not the same across all items
	this.methods.fields = [ 'day', 'index', 
						'empty', 'between', 'reserved',
						// -not- `cluster`, student-lesson lacks this
						'room', 'teacher', 'subject' ];

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
				lesson.content = _.transform(lesson.content, function (res, value, key) {
					// loop all items
					if (_.isEmpty(_.filter(items, function (distinctions, key) {
						// check if value is one of them
						return distinctions.filter(function (distinction) {
							if (_.contains(value, distinction)) {
								found[key] = value;

								return true;
							}
						}).length > 0;
					}))) {
						res[key] = value;
					}
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