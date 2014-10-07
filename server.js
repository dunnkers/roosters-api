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
	return _.isArray(docs) ? docs.map(transformDoc) : transformDoc(doc);
}

function transformDoc (doc) {
	// return id the way ember wants it
	doc.id = doc._id;
	delete doc._id;

	// remove empty arrays
	doc = _.transform(doc, function (res, value, key) {
		if (!(_.isArray(value) && _.isEmpty(value))) res[key] = value;
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
	return _.transform(object, function (res, value, key) {
		if (!_.isNull(value)) res[key] = value;
	});
}

/**
 * Populates the invoked documents with as the given model.
 * 
 * @param  {Model} model  The model of the docs.
 * @param  {[Model]} models  An array of previous models. Necessary
 * to avoid circular references caused by recursion.
 * @return {Promise}  A promise containing (recursed) population.
 */
function populate (model, models) {
	models = models || [];
	models.push(model.modelName);

	// docs is either Array or Object
	return function (docs) {
		var paths = populatePaths(model);

		// filter paths to populate.
		paths = _.transform(paths, function (res, model, path) {
			// only populate fields that actually exist
			var exists = _.isArray(docs) || docs[path];

			// don't populate previously populated models
			if (!_.contains(models, model.modelName) && exists) {
				res[path] = model;
			}
		});

		var path = _.keys(paths).join(' '),
			options = { lean: true };

		if (_.isEmpty(paths)) return docs;

		return model.populate(docs, {
			path: path,
			options: options
		}).then(function (docs) {
			function recurse (doc) {
				// remove padded null values caused when populating an array of docs
				doc = _.isArray(doc) ? doc.map(cleanNulls) : cleanNulls(doc);

				_.forIn(paths, function (value, key) {
					if (!_.isUndefined(doc[key])) {
						// recursively search for more fields to populate
						doc[key] = populate(value, models)(doc[key]);
					}
				});
				return RSVP.hash(doc);
			}

			// now check populated props for population
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

	req.model.find().lean().exec()
		.then(exists(res))
		.then(populate(req.model))
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

app.get('/:model/:id', function (req, res, next) {
	var populatePath = req.model.populatePath;
	var query = req.model.findById(req.id);
	// req.model.findPopulated()
	(populatePath ? query.populate(populatePath) : query).exec().then(function (doc) {
		if (!doc) res.status(404).send('We couldn\'t find that one, sorry!');

		res.send(req.model.root(doc));
	}, handleError(req, next));
});

app.get('/:model', route);

db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});