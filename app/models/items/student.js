var ItemSchema = require('../item'),
	Item = require('mongoose').model('Item'),
	relationship = require('mongoose-relationship');

var Schema = new ItemSchema({
	firstName: String,
	lastName: String,
	grade: { type: String, ref: 'Grade' },
	group: { type: String, ref: 'Group', childPath: 'students' }
});

Schema.plugin(relationship, {
	relationshipPathName: 'group'
});

Schema.virtual('content').set(function (content) {
	this._id = content[1];
	this.schedule = content[1];
	this.firstName = content[4];
	this.lastName = content[3];
	this.grade = content[0];
	this.group = content[2];
});


Item.discriminator('Student', Schema);