var _ = require('lodash');

module.exports = function (schema) {

	/**
	 * Returns the paths to populate for this model. Populate a path
	 * by setting `populate: 'sideload' | 'embed'`.
	 *
	 * @return {Object}  An object with the paths.
	 */
	schema.statics.populatePaths = function () {
		var model = this;

		return _.transform(_.pick(model.schema.paths, function (pathType, path) {
			var options = pathType.options;

			// for path arrays
			if (options.type && _.isArray(options.type)) {
				options = _.first(options.type);
				pathType.options = options;
			}

			// path should have ref and populate property
			if (!(options.ref && options.populate)) return false;

			var pathModel = model.model(options.ref);
			options.model = pathModel;

			// include query options set on schema options.
			options.options = _.pick(pathModel.schema.options, 'select', 'match');
			options.options.path = path;
			options.options.options = pathModel.queryOptions();

			return true;
		}), function (res, pathType, path) {
			// only return options since we only need those.
			res[path] = pathType.options;
		});
	};

	schema.statics.queryOptions = function () {
		// query options - http://mongoosejs.com/docs/api.html#query_Query-setOptions
		return _.pick(this.schema.options, 'tailable', 'sort', 'limit', 'skip',
			'maxscan', 'batchSize', 'comment', 'snapshot', 'hint', 'slaveOk',
			'lean', 'safe');
	};
};
