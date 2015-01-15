var mongoose = require('mongoose'),
	utils = require('mongoose/lib/utils'),
	construct = require('mongoose-construct'),
	globSync = require('glob').sync,
	_ = require('lodash');

// attach plugins to global schema
var plugins = globSync('../plugins/**/*.js', { cwd: __dirname }).map(require);
plugins.forEach(function (plugin) {
	mongoose.plugin(plugin);
});

// constructor hook
mongoose.plugin(construct);

// attach models to mongoose instance
globSync('../models/**/*.js', { cwd: __dirname }).forEach(require);

// flattens mongoose.model object to increase discriminator accessibility
function mapModels (models) {
	return _.transform(models, function (result, model, key) {
		var discriminators = model.discriminators;

		if (discriminators) {
			// add shortcut for array of discriminators
			result[utils.toCollectionName(key)] = _.toArray(discriminators);
			// recurse to add discriminator models on a flat level
			_.assign(result, mapModels(discriminators));
		}
		result[key] = model;
	});
}

module.exports = mapModels(mongoose.models);