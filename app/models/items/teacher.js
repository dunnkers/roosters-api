var ItemSchema = require('../item'),
	Item = require('mongoose').model('Item');

var Schema = new ItemSchema({
	name: { type: String, searchable: true },
});

Schema.virtual('content').set(function (content) {
	this._id = content[0];
	this.name = content[1];
});

Item.discriminator('Teacher', Schema);
