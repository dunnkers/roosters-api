var util = require('util'),
	// deps
	mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema,
	_ = require('lodash');

// schema inheritance - http://bit.ly/1jOOq13
function AbstractSchema () {
	Schema.apply(this, arguments);

	this.add({
		_id: String,
		index: { type: Number, required: true },
		schedule: { type: String, ref: 'Schedule' }
	});

	// discriminator options - http://bit.ly/1knmNlG
	this.options.collection = 'items';
	this.options.discriminatorKey = 'type';

	// createdAt and updatedAt properties
	this.plugin(timestamps);

	// duplicate
	this.path('_id').set(function (value) {
		this.schedule = value;
		return value;
	});
};
util.inherits(AbstractSchema, Schema);


mongoose.model('Item', new AbstractSchema());
module.exports = AbstractSchema;