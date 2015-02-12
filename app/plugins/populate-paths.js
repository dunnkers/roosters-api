var _ = require('lodash');

module.exports = function (schema) {

	/**
	 * Returns the paths to populate for this model. Populate a path
	 * by setting `populate: 'sideload' | 'embed'`.
	 *
	 * @return {Object}  An object with the paths.
	 */
	schema.statics.populatePaths = function () {
		// get only paths where (populate: true)
		return _.forEach(this.filterPaths([ 'ref', 'populate' ]), function (opt, path) {
			// set reference model
			opt.model = this.model(opt.ref);

			// include query options set on schema options.
			opt.options = _.pick(opt.model.schema.options, 'select', 'match');
			opt.options.path = path;
			opt.options.options = opt.model.queryOptions();
		}, this);
	};

	schema.statics.queryOptions = function () {
		// query options - http://mongoosejs.com/docs/api.html#query_Query-setOptions
		return _.pick(this.schema.options, 'tailable', 'sort', 'limit', 'skip',
			'maxscan', 'batchSize', 'comment', 'snapshot', 'hint', 'slaveOk',
			'lean', 'safe');
	};
};
