var _ = require('lodash');

function Item (index, unique) {
	this.index = index;
	this._id = unique;
}

Item.prototype.updateQuery = function() {
	var query = {
		$set: {},
		$addToSet: {}
	};
	var addToSet = this.addToSet;
	
	_.forIn(this, function (value, key) {
		if (addToSet && addToSet().indexOf(key) > -1) {
			query.$addToSet[key] = value;
		}else if (key !== '_id') {
			query.$set[key] = value;
		}
	});
	
	return query;
};

module.exports = Item;