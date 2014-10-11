var _ = require('lodash'),
	RSVP = require('rsvp'),
	utils = require('mongoose/lib/utils');

module.exports = function (schema) {

	// easier accessors
	schema.statics.plural = function () {
		return this.collection.name;	
	};

	schema.statics.singular = function () {
		return this.modelName.toLowerCase();	
	};

	/**
	 * Returns the paths to populate for this model. Populate a path
	 * by setting `populate: 'sideload' | 'embed'`.
	 *
	 * @param {Object|Array} docs Optionally, filter by path existance in these docs.
	 * @param {Array} models Optionally filter by (these) circular model references.
	 * @return {Object}  An object with the paths.
	 */
	schema.statics.populatePaths = function (docs, models) {
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

			// don't populate previously populated (circular) models
			var pathModel = model.model(options.ref);

			if (models && _.contains(models, pathModel.modelName)) return false;

			// only populate fields that actually exist
			return docs ? (_.isArray(docs) ? _.some(docs, path) : docs[path]) : true;
		}), function (res, pathType, path) {
			// only return options since we only need those.
			res[path] = pathType.options;
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
	schema.statics.populateAll = function (docs, options, root, models) {
		var model = this,
			initiator = !root;

		options = options || {};
		root = root || {};
		models = models || [];

		// avoid following circular references by keeping a register of (parent) models
		if (!_.contains(models, model.modelName)) models.push(model.modelName);

		// filter paths to populate
		var paths = model.populatePaths(docs, models);

		if (_.isEmpty(paths)) return docs;

		var path = _.keys(paths);

		// only populate docs that have any of the paths
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
				return _.transform(paths, function (res, pathType, path) {
					// if this doc didn't have the ref for the populated path
					if (_.isUndefined(doc[path])) return false;

					// recursively search for more fields to populate
					var pathModel = model.model(pathType.ref);
					res[path] = pathModel.populateAll(doc[path], options, root, models);
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

			function send () {
				if (initiator && !_.isEmpty(root)) {
					root[_.isArray(docs) ? model.plural() : model.singular()] = docs;
					return root;
				}

				return docs;
			}

			if (_.isArray(docs))
				return RSVP.all(docs.map(recurse).concat(merge)).then(send);
			else
				return recurse(docs).then(send);
		});
	};
};