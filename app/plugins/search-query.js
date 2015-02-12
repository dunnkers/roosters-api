var _ = require('lodash');

module.exports = function (schema) {

  function escapeRegExp (str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  schema.statics.filterPaths = function (properties) {
    var filteredPaths = _.pick(this.schema.paths, function (pathType, path) {
      var options = pathType.options;

      // for path arrays
      if (options.type && _.isArray(options.type)) {
        options = _.first(options.type);
        pathType.options = options;
      }

      // path should have given properties.
      var validate = properties.every(function (property) {
        return options[property];
      });

      return validate;
    });

    // only return pathType.options. The rest is redundant
    return _.transform(filteredPaths, function (res, pathType, path) {
      res[path] = pathType.options;
    });
  };

  schema.statics.searchables = function () {
    var searchables = [];

    if (this.discriminators) {
      _.forEach(this.discriminators, function (discriminator) {
        searchables = searchables.concat(discriminator.searchables());
      });
    }

    var paths = _.keys(this.filterPaths([ 'searchable' ]));

    return _.unique(searchables.concat(paths));
  };

  schema.statics.searchQuery = function (q) {
    var paths = this.searchables(),
        query = {};

    if (q && paths.length) {
      q = q.split(' ').filter(function (keyword) {
        return keyword;
      }).map(escapeRegExp);

      query.$and = q.map(function (keyword) {
        var root = {};

        root.$or = paths.map(function (path) {
          var obj = {};

          obj[path] = new RegExp('\\b' + keyword, 'i', 'g');

          return obj;
        });

        return root;
      });
    }

    return query;
  };
};
