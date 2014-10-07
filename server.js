var format = require('util').format,
	print = require('util').print,
	express = require('express'),
	app = express(),
	log4js = require('log4js'),
	log = log4js.getLogger('server'),
	_ = require('lodash'),
	RSVP = require('RSVP'),
	utils = require('mongoose/lib/utils');

log4js.configure({
	appenders: [ { type: "console", layout: { type: "basic" } } ], replaceConsole: true
});

var db = require('./app/connection'),
	collections = require('./app/initializers/collections');

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
	port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

// should be set in api, to make it more variable
// startTime: String,
// endTime: String,

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.set('Content-Type', 'application/json');
	next();
});

app.param('model', function (req, res, next, modelName) {
	req.modelName = modelName;
	req.model = collections[modelName];

	if (!req.model) {
		return res.status(404).send('Oops! - couldn\'t find any of those!');
	}

	next();
});

app.param('id', function (req, res, next, id) {
	req.id = id;
	next();
});

app.get('/', function (req, res, next) {
	res.send('Roosters-API');
});

function transform (docs) {
	return _.isArray(docs) ? docs.map(transformDoc) : transformDoc(docs);
}

function transformDoc (doc) {
	// id instead of mongodb's _id
	doc.id = doc._id;
	delete doc._id;

	doc = _.transform(doc, function (res, value, key) {
		// remove empty values and arrays
		if (_.isEmpty(value)) res[key] = value;
	});

	return doc;
}

/*
 * Wrap polymorphic models.
 * -> works only with lean models!
 */
function sendItems (modelName, res) {
	return function (docs) {
		if (!docs) res.status(404).send('We couldn\'t find that, sorry!');

		var single = _.isArray(docs) || docs.length === 1;
		docs = _.isArray(docs) ? docs : [ docs ];

		var root = _.groupBy(docs, 'type');

		// pluralize
		root = _.transform(root, function (res, docs, key) {
			res[utils.toCollectionName(key)] = docs;
		});

		// wrap
		docs = docs.map(function (doc) {
			return {
				id: doc.id,
				item: {
					id: doc.id,
					type: doc.type
				}
			};
		});

		// remove types before attaching
		root = _.mapValues(root, function (docs) {
			return docs.map(function (doc) {
				delete doc.type;
				return doc;
			});
		});

		if (single) 
			root[utils.toCollectionName(modelName)] = docs;
		else 
			root[modelName.toLowerCase()] = _.first(docs);
		
		res.send(root);
	};
}

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
 * @param  {[Model]} models  An array of previous models. Necessary
 * to avoid circular references caused by recursion.
 * @return {Promise}  A promise containing (recursed) population.
 */
function populate (model, options, models) {
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
						res[path] = populate(model, options, models)(doc[path]);
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
}

function exists (res) {
	return function (docs) {
		if (!docs || _.isEmpty(docs)) {
			res.status(404).send('We couldn\'t find those, sorry!');
		}
		return docs;
	}
}

function assemble (docs) {
	var root = {};
	root.items = docs;

	return root;
}

function send (res) {
	return function (root) {
		res.send(root);
	}
}

function route (req, res, next) {
	var timeStr = format('%s%s retrieval', req.modelName, 
		req.id ? format(' (%s)', req.id) : '');
	console.time(timeStr);

	var query = req.id ? req.model.findById(req.id) : req.model.find() ;
	query.lean().exec()
		.then(exists(res))
		.then(populate(req.model, { lean: true }))
		.then(transform)
		.then(assemble)
		.then(send(res))
		.then(function () {
		console.timeEnd(timeStr);
	}, handleError(req, next));
}

function handleError (req, next) {
	return function (err) {
		var model = req.model ? format('[%s] ', req.model.modelName) : '',
			id = req.id ? format(' (%s)', req.id) : '';

		var msg = format('%sFailed to retrieve model!%s - %s', model, id, err);
		if (err) return next(msg);
	};
}

/*// polymorphic item menu
app.get('/items', function (req, res, next) {
	var select = '-index -__v -updatedAt -createdAt';
	console.time('item menu retrieval');
	collections.items.find().lean().select(select).exec()
		.then(transform)
		.then(sendItems(collections.items.modelName, res), handleError(req, next))
		.then(function () {
			console.timeEnd('item menu retrieval');
		});
});

// polymorphic item detail
app.get('/items/:id', function (req, res, next) {
	collections.items.findById(req.id).lean().exec()
		.then(transformDoc)
		.then(sendItems(collections.items.modelName, res), handleError(req, next));
});*/

app.get('/:model/:id', route);

app.get('/:model', route);

db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});