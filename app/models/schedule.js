var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema;

var Schema = new Schema({
	lessons: [{
		type: Schema.Types.ObjectId,
		ref: 'Lesson',
		childPath: 'schedules',
		populate: 'sideload'
	}],
	items: [{
		type: String,
		ref: 'Item'
	}]
});

Schema.plugin(timestamps);

// lessons many-to-many relationship
Schema.plugin(relationship, {
	relationshipPathName: 'lessons'
});

Schema.methods.fields = [ 'lessons' ];

mongoose.model('Schedule', Schema);