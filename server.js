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
	doc.id = doc._id;
	delete doc._id;

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

function getPopulatePath (schema) {
	var populatePaths = _.transform(schema.paths, function (res, path, key) {
		if (path.options.populate/*&& path.options.ref*/) res[key] = path;
	});
	return _.keys(populatePaths).join(' ');
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

var models;
function populate (model) {

	return function (docs) {
		if (!docs) return docs;

		var paths = populatePaths(model);

		// remove paths of which are no ref, for objects.
		if (!_.isArray(docs)) {
			paths = _.transform(paths, function (res, value, key) {
				if (docs[key]) res[key] = value;
			});
		}

		var path = _.keys(paths).join(' '),
			options = { lean: true };

		// DO NOT USE DEPTH anymore! it remains in a session!!!!!
		if (_.isEmpty(paths) || depth > 100) return docs;

		// when arrays have docs missing references, population prop is added as null.
		depth ++;
		return model.populate(docs, {
			path: path,
			options: options
		}).then(function (docs) { // can be array or object
			function recurse (doc) { // can be array or object
				doc = _.isArray(doc) ? doc.map(cleanNulls) : cleanNulls(doc);
				// first clean object.

				_.forIn(paths, function (value, key) {
					if (!_.isUndefined(doc[key])) doc[key] = populate(value)(doc[key]);
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

	var populatePath = getPopulatePath(req.model.schema);

	req.model.find({_id: {$in:['320','10971']}}).lean()/*.populate(populatePath)*/.exec()
		.then(exists(res))
		.then(populate(req.model))
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