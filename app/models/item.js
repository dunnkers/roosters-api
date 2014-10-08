var util = require('util'),
	// deps
	mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema;

// schema inheritance - http://bit.ly/1jOOq13
function AbstractSchema () {
	Schema.apply(this, arguments);

	this.add({
		_id: String,
		index: { type: Number, required: true },
		schedule: {
			type: Schema.Types.ObjectId,
			ref: 'Schedule',
			childPath: 'items',
			populate: true
		}
	});

	// discriminator options - http://bit.ly/1knmNlG
	this.options.collection = 'items';
	this.options.discriminatorKey = 'type';

	this.options.select = { self: '-grade -index', population: '-__v -createdAt' };

	// createdAt and updatedAt properties
	this.plugin(timestamps);
	// one-to-many relationship with schedule
	this.plugin(relationship, {
		relationshipPathName: 'schedule'
	});
};
util.inherits(AbstractSchema, Schema);


mongoose.model('Item', new AbstractSchema());
module.exports = AbstractSchema;