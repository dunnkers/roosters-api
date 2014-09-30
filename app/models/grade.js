var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	Schema = mongoose.Schema;

var Schema = new Schema({
	_id: String,
	groups: [{
		type: String,
		ref: 'Group'
	}]
});

Schema.plugin(timestamps);

mongoose.model('Grade', Schema);