module.exports = function (schema) {

	if (!schema.options.toJSON) schema.options.toJSON = {};

	schema.options.toJSON.transform = function (doc, ret, options) {
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	};
};