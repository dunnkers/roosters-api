var RSVP = require('rsvp'),
	_ = require('lodash');

module.exports = function (schema) {
	/**
	 * Upserts a given `document`.
	 * @param  {Document} newDoc The document you'd like to upsert.
	 * @param {Object} fields Fields to search with. (id by default)
	 * @param {Object} excludes Fields not to save.
	 * @return {Promise}        A Promise, returned from the promisedSave plugin.
	 */
	schema.statics.upsert = function (newDoc) {
		var fields = this.schema.options.fields,
			query = fields ? _.pick(newDoc.toObject(), fields) :  { _id: newDoc._id };
			
		return this.findOne(query).exec().then(function (doc) {
			// this part is easy. if no document found, just save.
			if (!doc) return newDoc.promisedSave();

			// overwrite newly generated one by found one (for using ObjectIds)
			newDoc._id = doc._id;

			// find empty arrays which are automatically initiated
			var emptyArrays = _.pick(newDoc.toObject(), function(value, key) {
				return _.isArray(value) && _.isEmpty(value)
			});
			
			// duplicate from doc to newDoc
			_.keys(emptyArrays).forEach(function (key) {
				newDoc.set(key, doc[key]);
			});

			doc.set(newDoc);

			return doc.promisedSave();
		});
	};

	/**
	 * Saves a document to the database, returning a promise.
	 * @return {Promise} A Promise compliant with Promises/A+ specification.
	 */
	schema.methods.promisedSave = function () {
		var self = this;

		return new RSVP.Promise(function (resolve, reject) {
			self.save(function (err, product, numberAffected) {
				if (err) reject(err);

				resolve({
					product: product,
					numberAffected: numberAffected
				});
			});
		});
	};
};