var util = require('util'),
	// deps
	mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema,
	_ = require('lodash'),
	RSVP = require('RSVP');

// schema inheritance - http://bit.ly/1jOOq13
function AbstractSchema () {
	Schema.apply(this, arguments);

	this.add({
		_id: String,
		index: { type: Number, required: true },
		schedule: { type: Schema.Types.ObjectId, ref: 'Schedule', childPath: 'items' }
	});

	// discriminator options - http://bit.ly/1knmNlG
	this.options.collection = 'items';
	this.options.discriminatorKey = 'type';

	// createdAt and updatedAt properties
	this.plugin(timestamps);
	// one-to-many relationship with schedule
	this.plugin(relationship, {
		relationshipPathName: 'schedule'
	});

	// grades
	this.statics.aggregateGrades = function () {
		var self = this;
		return this.aggregate({ '$match': { type: 'Group' } }, {
			'$group': {
				_id: '$grade',
				groups: { '$push': '$_id' }
			}
		}).exec().then(function (grades) {
			return RSVP.all(grades.map(function (grade) {
				var Grade = self.model('Grade');
				return Grade.upsert(new Grade(grade));
			}));
		});
	};
};
util.inherits(AbstractSchema, Schema);


mongoose.model('Item', new AbstractSchema());
module.exports = AbstractSchema;