var _ = require('lodash');

module.exports = function (schema) {
	// unless overwritten, set defaults for a select option in this models' populations.
	var str = '-__v -createdAt -updatedAt -index',
		select = schema.options.select;

	var res = { self: str, population: str };

	if (select)
		if (_.isString(select)) {
			res.self += ' ' + select;
		} else if (_.isObject(select)) {
			res.population =  select.population || res.self;
			if (select.self) res.self += ' ' + select.self;
		}

	if (!schema.options.selection)
		schema.options.selection = res;
};