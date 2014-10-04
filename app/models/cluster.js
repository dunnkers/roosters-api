var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema,
	_ = require('lodash'),
	RSVP = require('RSVP');

var Schema = new Schema({
	_id: String,
	students: [ { type: String, ref: 'Student', childPath: 'clusters' } ],
	schedule: { type: Schema.Types.ObjectId, ref: 'Schedule' }
});

Schema.plugin(timestamps);

Schema.plugin(relationship, {
	relationshipPathName: 'students'
});

Schema.statics.aggregation = function () {
	var Lesson = this.model('Lesson'),
		Schedule = this.model('Schedule'),
		Item = this.model('Item'),
		Cluster = this.model('Cluster');

	// group all different clusters
	return Lesson.aggregate({ $match: { cluster: { $exists: true } } }, {
		$group: {
			_id: "$cluster",
			schedules: {
				$addToSet: "$schedules"
			}
		}
	}, { $unwind: "$schedules" }).exec().then(function (clusters) {
		// populate schedules
		return Schedule.populate(clusters, { path: 'schedules', select: 'items' });
	}).then(function (clusters) {
		// populate students
		return RSVP.all(clusters.map(function (cluster) {
			cluster.schedules = Item.populate(cluster.schedules, {
				path: 'items',
				select: '_id',
				match: { type: 'Student' }
			});

			// hash to retain cluster object
			return RSVP.hash(cluster).then(function (cluster) {
				// students
				cluster.students = _.flatten(_.pluck(cluster.schedules, 'items'));
				delete cluster.schedules;
				// id refs
				cluster.students = _.pluck(cluster.students, '_id');

				return cluster.students.length ? cluster : {};
			});
		}));
	}).then(function (clusters) {
		clusters = _.filter(clusters, 'students');

		return RSVP.all(clusters.map(function (cluster) {
			return Cluster.upsert(new Cluster(cluster));
		}));
	});
};

Schema.statics.aggregateSchedules = function () {
	var Lesson = this.model('Lesson'),
		Schedule = this.model('Schedule'),
		Cluster = this.model('Cluster');

	return Lesson.aggregate({ $match: { cluster: { $exists: true } } }, {
		$group: {
			_id: "$cluster",
			lessons: {
				$addToSet: "$_id"
			}
		}
	}).exec().then(function (schedules) {
		return RSVP.all(schedules.map(function (schedule) {
			var id = schedule._id;
			delete schedule._id;

			return Schedule.upsert(new Schedule(schedule)).then(function (schedule) {
				// set relation
				return Cluster.findById(id).exec().then(function (cluster) {
					if (!cluster) return {};

					cluster.schedule = schedule.product._id;
					return cluster.promisedSave();
				}).then(function () {
					return schedule;
				});
			});
		}));
	});
}

mongoose.model('Cluster', Schema);