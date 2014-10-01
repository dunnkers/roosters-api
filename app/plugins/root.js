var utils = require('mongoose/lib/utils'),
	_ = require('lodash');

module.exports = function (schema) {

	schema.statics.root = function (doc) {
		var root = _.transform(doc.toObject(), function (res, value, path) {
			var populated = doc.populated(path);

			if (populated) {
				// set sideload to objects
				var val = doc[path];
				res[utils.toCollectionName(path)] = _.isArray(val) ? val : [ val ];
				// set doc to ids
				doc[path] = populated;
			}
		});

		root[this.modelName.toLowerCase()] = doc.toJSON();
		
		return root;
	};
};