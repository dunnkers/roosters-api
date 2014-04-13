var _ = require('lodash');

function Doc (unique) {
	this._id = unique;
}

Doc.prototype.updateQuery = function() {
	var query = {
		$set: {},
		$addToSet: {},
		$setOnInsert: { dateCreated: new Date() }
	};
	var addToSet = this.addToSet;
	
	_.forIn(this, function (value, key) {
		if ((addToSet || []).indexOf(key) > -1) {
			query.$addToSet[key] = value;
			query.$setOnInsert[key + 'Modified'] = [new Date()];
		}else if (['_id', 'addToSet'].indexOf(key) == -1 && !_.isFunction(value)) {
			query.$set[key] = value;
		}
	});
	
	return query;
};

module.exports = Doc;