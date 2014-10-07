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
	 * Populates the invoked document(s) with as the given model. If you don't
	 * pass `lean: true` as an option, documents with 'missing' references will
	 * have null values.
	 * 
	 * @param  {Model} model  The model of the docs.
	 * @param {Object} options Options to pass to `Model.populate`.
	 * @param  {[Model]} models  An array of previous models. Necessary
	 * to avoid circular references caused by recursion.
	 * @return {Promise}  A promise containing (recursed) population.
	 */
	schema.statics.autoPopulate = function (options, models) {
		var model = this;

		models = models || [];
		options = options || {};

		// avoid following circular references by keeping a register of (parent) models
		if (!_.contains(models, model.modelName)) models.push(model.modelName);

		// docs is either Array or Object
		return function (docs) {
			var paths = populatePaths(model);

			// filter paths to populate
			paths = _.transform(paths, function (res, model, path) {
				// only populate fields that actually exist
				var exists = _.isArray(docs) || docs[path];// arr ? _.some(docs, path)

				// don't populate previously populated models
				if (!_.contains(models, model.modelName) && exists) res[path] = model;
			});

			if (_.isEmpty(paths)) return docs;

			var path = _.keys(paths).join(' ');

			return model.populate(docs, {
				path: path,
				options: options
			}).then(function (docs) {
				function recurse (doc) {
					// remove null values padded when population failed.
					doc = _.isArray(doc) ? doc.map(cleanNulls) : cleanNulls(doc);

					// create hash of fields to populate (not hashing doc to retain prototype)
					return RSVP.hash(_.transform(paths, function (res, model, path) {
						// if ref was padded as null or somehow became undefined
						if (!_.isUndefined(doc[path]) && !_.isNull(doc[path])) {
							// recursively search for more fields to populate
							res[path] = model.autoPopulate(options, models)(doc[path]);
						}
					})).then(function (populated) {
						// attach populated fields to doc
						_.forIn(populated, function (value, path) {
							doc[path] = value;
						});

						return doc;
					});
				}

				return _.isArray(docs) ? RSVP.all(docs.map(recurse)) : recurse(docs);
			});
		};
	};
};