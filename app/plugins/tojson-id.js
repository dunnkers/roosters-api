var utils = require('mongoose/lib/utils'),
	_ = require('lodash');

module.exports = function (schema) {

	if (!schema.options.toJSON) schema.options.toJSON = {};

	schema.options.toJSON.transform = function (doc, ret, options) {
		var root = _.transform(ret, function (res, value, path) {
			var populated = doc.populated(path);

			if (populated) {
				// set sideload to objects
				res[path] = ret[path];
				// set doc to ids
				ret[path] = populated;
			}
		});

		/*if (doc.lessons) {
			// DEBUGGING
			var collectionName = utils.toCollectionName(doc.collection.name);
		}*/

		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	};
};