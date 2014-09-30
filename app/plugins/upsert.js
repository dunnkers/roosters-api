var _ = require('lodash');

// Dependent on the promisedSave plugin.
module.exports = function (schema) {
	/**
	 * Upserts a given `document`.
	 * @param  {Document} newDoc The document you'd like to upsert.
	 * @param {Object} fields Fields to search with. (id by default)
	 * @param {Object} excludes Fields not to save.
	 * @return {Promise}        A Promise, returned from the promisedSave plugin.
	 */
	schema.statics.upsert = function (newDoc) {
		var query = newDoc.fields ? 
			_.pick(newDoc.toObject(), newDoc.fields) : 
			{ _id: newDoc._id };
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
			
			/* Algorithm - compares the two documents, disabling pre('save')
			functionality. A newer algorithm makes sure the documents are
			altered and equal before saving them.
			
			// don't save these keys // exclude them
			
			//newDoc = _.omit(newDoc, newDoc.excludes);
			var toSave = _.omit(newDoc.toObject(), newDoc.excludes);
			// only compare properties that we want to set
			var found = _.pick(doc.toObject(), _.keys(toSave));

			// overwrite properties
			doc.set(newDoc);

			// if different, save
			// -> it's better to use doc.equals(newDoc)
			return _.isEqual(toSave, found) ? {
				product: doc,
				numberAffected: 0
			} : doc.promisedSave();*/
		});
	};
};