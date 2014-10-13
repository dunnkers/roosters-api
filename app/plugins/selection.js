var _ = require('lodash');

module.exports = function (schema) {
	// unless overwritten, set defaults for a select option in this models' populations
	if (!schema.options.select)
		schema.options.select = '-__v -createdAt -updatedAt';
};