var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema,
	RSVP = require('RSVP');

var Schema = new Schema({
	_id: String,
	groups: [{
		type: String,
		ref: 'Group'
	}]
});

Schema.plugin(timestamps);

Schema.statics.aggregation = function () {
	var self = this;

	return this.aggregate({ $match: { type: 'Group' } }, {
		$group: {
			_id: '$grade',
			groups: { $push: '$_id' }
		}
	}).exec().then(function (grades) {
		return RSVP.all(grades.map(function (grade) {
			var Grade = self.model('Grade');

			return Grade.upsert(new Grade(grade));
		}));
	});
};

mongoose.model('Grade', Schema);