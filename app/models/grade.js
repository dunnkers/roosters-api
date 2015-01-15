var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema,
	RSVP = require('rsvp'),
	flow = require('../utils/flow-control');

var Schema = new Schema({
	_id: String,
	groups: [{
		type: String,
		ref: 'Group',
		populate: false
	}],
	clusters: [{
		type: String,
		ref: 'Cluster',
		populate: false
	}]
});

Schema.plugin(timestamps);

Schema.statics.aggregation = function () {
	var Item = this.model('Item'),
		Grade = this;

	return Item.aggregate({ $match: { type: 'Group' } }, {
		$group: {
			_id: '$grade',
			groups: { $push: '$_id' }
		}
	}).exec().then(function (grades) {
		return flow.asyncMap(grades, function (grade) {
			return Grade.upsert(new Grade(grade));
		});
	});
};

mongoose.model('Grade', Schema);
