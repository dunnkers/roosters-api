var _ = require('lodash');

module.exports = function (schema) {
	// unless overwritten, set defaults for a select option in this models' populations
	if (!schema.options.selection)
		str = schema.options.select || '';
		schema.options.selection = '-__v -createdAt ' + str;
};