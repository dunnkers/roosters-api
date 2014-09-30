var RSVP = require('rsvp');

module.exports = function (schema) {
	/**
	 * Saves a document to the database, wrapped in a promise.
	 * @return {Promise} A Promise of type A+ specification. (RSVP.js)
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