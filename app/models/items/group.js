var ItemSchema = require('../item'),
	Item = require('mongoose').model('Item'),
	relationship = require('mongoose-relationship');

var Schema = new ItemSchema({
	grade: { type: String, ref: 'Grade', childPath: 'groups' },
	students: [{ type: String, ref: 'Student', populate: 'sideload' }]
});

Schema.plugin(relationship, {
	relationshipPathName: 'grade'
});

Schema.virtual('content').set(function (content) {
	this._id = content[2];
	this.grade = content[1];
});

Item.discriminator('Group', Schema);
