var _ = require('lodash'),
	RSVP = require('rsvp'),
	utils = require('mongoose/lib/utils');

module.exports = function (schema) {

	// easier accessors
	schema.statics.plural = function () {
		return utils.toCollectionName(this.modelName);	
	};

	schema.statics.singular = function () {
		return this.modelName.toLowerCase();	
	};

	schema.statics.queryOptions = function () {
		// query options - http://mongoosejs.com/docs/api.html#query_Query-setOptions
		return _.pick(this.schema.options, 'tailable', 'sort', 'limit', 'skip', 
			'maxscan', 'batchSize', 'comment', 'snapshot', 'hint', 'slaveOk', 
			'lean', 'safe');
	}

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
			options.model = pathModel;

			if (models && _.contains(models, pathModel.modelName)) return false;

			// include query options set on schema options.
			options.options = _.pick(pathModel.schema.options, 'select', 'match');
			options.options.path = path;
			options.options.options = pathModel.queryOptions();

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
	 * @param {Object} root All docs are attached to this `root` object. Pass
	 * value `true` to always return a root.
	 * @param  {[String]} models  An array of previous models. Necessary
	 * to avoid circular references caused by recursion.
	 * @return {Promise}  A promise containing (recursed) population.
	 */
	schema.statics.populateAll = function (docs, root, models) {
		var attach = root === true;
		if (attach) root = undefined;

		var model = this,
			initiator = !root;

		root = root || {};
		models = models || [];

		// avoid following circular references by keeping a register of (parent) models
		if (!_.contains(models, model.modelName)) models.push(model.modelName);

		// filter paths to populate
		var paths = model.populatePaths(docs, models);

		if (_.isEmpty(paths)) return send(docs);

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

		function send (docs) {
			var sendRoot = attach || !_.isEmpty(root);
			if (initiator && sendRoot) {
				root[_.isArray(docs) ? model.plural() : model.singular()] = docs;
				return root;
			}

			return docs;
		}

		// recurses the populated paths of a doc.
		function recurse (doc) {
			// remove null values padded for which population failed.
			doc = cleanNulls(doc);

			var populatePaths = _.pick(paths, function (pathType, path) {
				// if this doc didn't have the ref for the populated path
				return !_.isUndefined(doc[path]);
			});

			// map the recursive paths to populate before it is set to id.
			var toPopulate = _.mapValues(populatePaths, function (pathType, path) {
				// recursively search for more fields to populate
				return pathType.model.populateAll(doc[path], root, models);
			});

			// attach populated paths to root, if sideload
			_.forIn(populatePaths, function (pathType, path) {
				if (!(pathType.populate === 'sideload')) return;

				var key = pathType.model.plural();

				if (!root[key])
					root[key] = [];

				function push (doc) {
					// push if not already in array
					if (!_.some(root[key], { '_id': doc._id }) && doc._id)
						root[key].push(doc);
				}

				// attach to root and set ref to id.
				if (_.isArray(doc[path])) {
					doc[path].forEach(push);
					// use cached ids if possible.
					doc[path] = doc.populated ? 
						doc.populated(path) : _.pluck(doc[path], '_id');
				} else {
					push(doc[path]);
					doc[path] = doc.populated ? 
						doc.populated(path) : doc[path]._id;
				}
			});

			// recurse. properties are attached because object is synchronized.
			return RSVP.hash(toPopulate).then(function () {
				return doc;
			});
		}

		return model.populate(docs, _.pluck(paths, 'options')).then(function (docs) {
			if (_.isArray(docs))
				return RSVP.all(docs.map(recurse).concat(merge)).then(send);
			else
				return recurse(docs).then(send);
		});
	};
};