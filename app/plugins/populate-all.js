var _ = require('lodash'),
	RSVP = require('rsvp');

module.exports = function (schema) {

	function populatePaths (model) {
		return _.transform(model.schema.paths, function (res, path, key) {
			var options = path.options;
			options = options.type && _.isArray(options.type) ? 
				_.first(options.type) : options;

			var pop = options.populate,
				ref = options.ref;

			if (pop && ref) res[key] = model.model(ref);
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

		// docs is either Array or Object
		var paths = populatePaths(model);

		// filter paths to populate
		paths = _.transform(paths, function (res, model, path) {
			// don't populate previously populated models
			if (_.contains(models, model.modelName)) return false;

			// only populate fields that actually exist
			var exists = _.isArray(docs) ? _.some(docs, path) : docs[path];
			if (exists) res[path] = model;
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
			function recurse (doc) {
				// remove null values padded for which population failed.
				doc = _.isArray(doc) ? doc.map(cleanNulls) : cleanNulls(doc);

				// create hash of fields to populate (doc is not hashed to
				// retain prototype)
				return RSVP.hash(_.transform(paths, function (res, model, path) {
					// if ref was padded as null or somehow became undefined
					if (!_.isUndefined(doc[path]) && !_.isNull(doc[path])) {
						// recursively search for more fields to populate
						res[path] = model.populateAll(doc[path], options, models);
					}
				})).then(function (populated) {
					// attach populated fields to doc
					_.forIn(populated, function (value, path) {
						doc[path] = value;
					});

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