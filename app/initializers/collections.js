// dependent on ./models
var models = require('./models'),
	mongoose = require('mongoose'),
	utils = require('mongoose/lib/utils'),
	_ = require('lodash');

module.exports = _.transform(mongoose.models, function (res, model, modelName) {
	res[utils.toCollectionName(modelName)] = model;
});