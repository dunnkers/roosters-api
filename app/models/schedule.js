var mongoose = require('mongoose'),
	timestamps = require('mongoose-timestamp'),
	relationship = require('mongoose-relationship'),
	Schema = mongoose.Schema;

var Schema = new Schema({
	_id: String,
	lessons: [{
		type: Schema.Types.ObjectId,
		ref: 'Lesson',
		childPath: 'schedules'
	}],
	item: { type: String, ref: 'Item' },
	itemType: String
});

Schema.plugin(timestamps);

// lessons many-to-many relationship
Schema.plugin(relationship, {
	relationshipPathName: 'lessons'
});

// duplicate
Schema.path('_id').set(function (value) {
	this.item = value;
	return value;
});

mongoose.model('Schedule', Schema);