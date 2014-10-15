var _ = require('lodash');

module.exports = function (schema) {
	// unless overwritten, set defaults for a select option in this models' populations
	if (!schema.options.select)
		schema.options.select = '-__v -createdAt -updatedAt';

	// lean
	schema.options.lean = true;

	// rename the id when serializing.
	if (!schema.options.toJSON) schema.options.toJSON = {};

	schema.options.toJSON.transform = function (doc, ret) {
		if (schema.options.toJSON.transformation) {
			schema.options.toJSON.transformation(ret);
		}

		if (!ret.id) {
			ret.id = ret._id;
			ret._id = undefined;
			delete ret._id;
		}

		// remove empty values and arrays
		_.forIn(ret, function (value, key) {
			if ((_.isArray(value) || _.isString(value)) && _.isEmpty(value)) {
				ret[key] = undefined;
				delete ret[key];
			}
		});
	};
};