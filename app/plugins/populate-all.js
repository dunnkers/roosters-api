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

	// allows modifying every single document.
	schema.statics.middleware = function (doc) {
		// if lean, we want to perform toJSON transform
		var toJSON = this.schema.options.toJSON;

		if (!doc.toJSON && toJSON && toJSON.transform)
			// clone to prevent synchronous models getting transformed too.
			toJSON.transform(null, doc);
	};

	function cleanNulls (object) {
		_.forIn(object, function (value, key) {
			if (_.isNull(value)) {
				object[key] = undefined; // if object is mongoose doc
				delete object[key]; // if object is lean
			}
		})
		return object;
	}

	schema.statics.attach = function (docs, sideload, root) {
		if (!sideload) return null;

		var model = this,
			key = model.plural();

		root[key] = root[key] || [];

		function push (doc) {
			// push if not already in array
			/* -regarding already transformed synchronous objects- */
			/* in some cases, doc might not have an _id but an id  *
			 * because of a transform. in this case we can be sure *
			 * that this object already has been added to our root,*
			 * because else it wouldn't have been transformed.	   */
			if (doc._id && !_.some(root[key], { _id: doc._id })) {
				model.middleware(doc);
				root[key].push(doc);
			}
		}

		// extract id(s) from document(s) to set as reference
		// -> in some cases, this doc is already transformed. check for `id`'s as well.
		function refId (doc) {
			return doc._id || doc.id;
		}

		var populated = _.isArray(docs) ? docs.map(refId) : refId(docs);

		// fix polymorphic reference
		if (model.discriminators) {
			function ref (doc) {
				var typeKey = model.schema.options.discriminatorKey,
					idKey = doc._id ? '_id' : 'id';
					res = _.pick(doc, idKey, typeKey);

				// if no type, not a polymorphic model
				if (!doc[typeKey]) return doc[idKey];

				if (doc.toJSON) { // not lean
					// create new model of corresponding type to bind typeKey
					return new model.discriminators[doc[typeKey]](res);
				} else { // lean
					//model.middleware(res);
					return res;
				}
			}

			populated = _.isArray(docs) ? docs.map(ref) : ref(docs);
		}

		// attach to root and set ref to id.
		if (_.isArray(docs))
			docs.forEach(push);
		else
			push(docs);

		return populated;
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
	schema.statics.populateAll = function (docs, sideload, root, models) {
		var model = this,
			initiator = !root;

		root = root || {};
		models = models || [];

		// avoid following circular references by keeping a register of (parent) models
		if (!_.contains(models, model.modelName)) models.push(model.modelName);

		// filter paths to populate by previously populated (circular) models
		var paths = _.pick(model.populatePaths(docs, models), function (pathType, path) {
			if (_.contains(models, pathType.model.modelName)) return false;
			return _.isArray(docs) ? _.some(docs, path) : docs[path];
		});

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
			// attach populated paths to root, if sideload
			if (!initiator) {
				var res = model.attach(docs, sideload, root);
				if (res) return res;
			}

			// middleware
			if (_.isArray(docs))
				docs.forEach(function (doc) {
					model.middleware(doc);
				});
			else
				model.middleware(docs);

			// sideload initiator
			if (initiator && (sideload || !_.isEmpty(root))) {
				var key = _.isArray(docs) ? model.plural() : model.singular();
				root[key] = docs;

				return root;
			}

			return docs;
		}

		// recurses the populated paths of a doc.
		function recurse (doc) {
			// remove null values padded for which population failed.
			doc = cleanNulls(doc);

			var recursePaths = _.pick(paths, function (pathType, path) {
				// if this doc didn't have the ref for the populated path
				return !_.isUndefined(doc[path]);
			});

			// map the recursive paths to populate before it is set to id.
			recursePaths = _.mapValues(recursePaths, function (pathType, path) {
				// recursively search for more fields to populate
				return pathType.model.populateAll(doc[path], 
					pathType.populate === 'sideload', root, models);
			});

			// recurse. properties are attached because object is synchronized.
			return RSVP.hash(recursePaths).then(function (populatedPath) {
				// attach properties. previously attached through synchronized objects,
				// now we have to assign because of sideloads.
				_.assign(doc, populatedPath);

				return doc;
			});
		}

		return model.populate(docs, _.pluck(paths, 'options')).then(function (docs) {
			if (_.isArray(docs))
				return RSVP.all(docs.map(recurse).concat(merge));
			else
				return recurse(docs);
		}).then(send);
	};
};