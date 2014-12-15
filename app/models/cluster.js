var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema,
	_ = require('lodash'),
	RSVP = require('RSVP'),
	flow = require('../utils/flow-control');

var Schema = new Schema({
	_id: String,
	students: [ { type: String, ref: 'Student', childPath: 'clusters' } ],
	grade: { type: String, ref: 'Grade', childPath: 'clusters' }
});

Schema.plugin(timestamps);

Schema.plugin(relationship, {
	relationshipPathName: [ 'students', 'grade' ]
});

Schema.statics.aggregation = function () {
	var Lesson = this.model('Lesson'),
		Schedule = this.model('Schedule'),
		Item = this.model('Item'),
		Cluster = this.model('Cluster'),
		Group = this.model('Group');

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

			// find grade by searching cluster name
			cluster.grade = Group.find().distinct('grade').exec();

			// hash to retain cluster object
			return RSVP.hash(cluster).then(function (cluster) {
				// students
				cluster.students = _.flatten(_.pluck(cluster.schedules, 'items'));
				delete cluster.schedules;

				// id refs
				cluster.students = _.pluck(cluster.students, '_id');

				// set grade if found in title
				var found = cluster.grade.some(function (grade) {
					if (_.contains(cluster._id, grade))
						return cluster.grade = grade;
				});
				if (!found) delete cluster.grade;

				return cluster.students.length ? cluster : {};
			});
		}));
	}).then(function (clusters) {
		clusters = _.filter(clusters, 'students');

		return flow.asyncMap(clusters, function (cluster) {
			return Cluster.upsert(new Cluster(cluster));
		});
	});
};

mongoose.model('Cluster', Schema);