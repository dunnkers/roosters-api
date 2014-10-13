var _ = require('lodash');

module.exports = function (schema) {
	// unless overwritten, set defaults for a select option in this models' populations
	if (!schema.options.select)
		schema.options.select = '-__v -createdAt -updatedAt';

	// lean
	schema.options.lean = true;

	// rename the id when serializing.
	if (!schema.options.toJSON) schema.options.toJSON = {};

	schema.options.toJSON.transform = function (doc, ret, options) {
		ret.id = ret._id;
		delete ret._id;
	};
};