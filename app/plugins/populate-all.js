var _ = require('lodash'),
	RSVP = require('rsvp');

module.exports = function (schema) {

	/**
	 * Returns the paths to populate for this model. Populate a path
	 * by setting `populate: 'sideload' | 'embed'`.
	 * 
	 * @return {Object}  An object with as keys the paths, and as values the models.
	 */
	schema.statics.populatePaths = function () {
		var model = this;

		return _.transform(model.schema.paths, function (res, path, key) {
			var options = path.options;

			// for path arrays
			if (options.type && _.isArray(options.type))
				options = _.first(options.type);

			// path should have ref and populate property
			if (options.ref && options.populate)
				res[key] = model.model(options.ref);
		});
	}

	function cleanNulls (object) {
		_.forIn(object, function (value, key) {
			if (_.isNull(value)) {
				object[key] = undefined; // if object is mongoose doc
				delete object[key]; // if object is lean
			}
		})
		return object;
	}

	/**
	 * Populates the given document(s) recursively. Turn on population
	 * for a field using either `populate: 'sideload'` or `populate: 'embed'`.
	 *
	 * @param {Object | Array} docs  A document, or array of docs.
	 * @param {Object} options Options to pass to `Model.populate`.
	 * @param  {[String]} models  An array of previous models. Necessary
	 * to avoid circular references caused by recursion.
	 * @return {Promise}  A promise containing (recursed) population.
	 */
	schema.statics.populateAll = function (docs, options, models) {
		var model = this;

		models = models || [];
		options = options || {};

		// avoid following circular references by keeping a register of (parent) models
		if (!_.contains(models, model.modelName)) models.push(model.modelName);

		// filter paths to populate
		var paths = _.transform(model.populatePaths(), function (res, model, path) {
			// don't populate previously populated models
			if (_.contains(models, model.modelName)) return false;

			// only populate fields that actually exist
			if (_.isArray(docs) ? _.some(docs, path) : docs[path])
				res[path] = model;
		});

		if (_.isEmpty(paths)) return docs;

		var path = _.keys(paths);

		// do not populate docs that do not have any of the paths
		// -> this makes for a slightly better performance
		var merge = [];
		docs = _.isArray(docs) ? _.transform(docs, function (res, doc) {
			if (_.isEmpty(_.pick(doc, path)))
				merge.push(doc);
			else
				res.push(doc);
		}) : docs;

		return model.populate(docs, {
			path: path.join(' '),
			options: options,
			select: model.schema.options.selection.population || ''
		}).then(function (docs) {
			function recursePopulated (doc) {
				return _.transform(paths, function (res, model, path) {
					// if ref was padded as null or somehow became undefined
					if (_.isUndefined(doc[path]) || _.isNull(doc[path])) return false;

					// recursively search for more fields to populate
					res[path] = model.populateAll(doc[path], options, models);
				});
			}

			function recurse (doc) {
				// remove null values padded for which population failed.
				doc = cleanNulls(doc);

				// recurse. properties are attached because object is synchronized.
				return RSVP.hash(recursePopulated(doc)).then(function () {
					return doc;
				});
			}

			if (_.isArray(docs))
				return RSVP.all(docs.map(recurse).concat(merge));
			else
				return recurse(docs);
		});
	};
};