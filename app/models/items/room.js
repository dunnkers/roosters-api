var ItemSchema = require('../item'),
	Item = require('mongoose').model('Item');

var Schema = new ItemSchema();

Schema.virtual('content').set(function (content) {
	this._id = content[0];
});

Item.discriminator('Room', Schema);