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
		var empty = (_.isArray(value) || _.isString(value)) && _.isEmpty(value);
		if (!empty) res[key] = value;
	});

	return doc;
}

/*
 * Wrap polymorphic models.
 * -> works only with lean models!
 */
function sendItems (modelName, res) {
	return function (docs) {
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

/**
 * Constructs a root object.
 * @param  {Model} model  The initial model.
 * @param {Object} root Accumulating root object.
 * @return {[Document]}  An array of documents.
 */
function makeRoot (model, root) {
	// converge with `autoPopulate.populatePaths()`
	function getModelForKey (key) {
		var path = model.schema.paths[key];

		if (!path) return;

		var options = path.options;
		options = options.type && _.isArray(options.type) ? 
			_.first(options.type) : options;

		if (options.ref) return model.model(options.ref);
	}

	return function (docs) {
		// `docs` is an object -> originates from findById
		var singular = !root && !_.isArray(docs);
		root = root || {};


		function attach (doc) {
			_.forIn(doc, function (value, key) {
				var recurse = false;
				
				if (_.isArray(value))
					recurse = _.some(value, '_id');
				else if (_.isObject(value) && value._id)
					recurse = true

				var model = getModelForKey(key);
				
				// property has been populated
				if (recurse && model) {
					doc[key] = _.isArray(value) ? 
						_.pluck(value, '_id') : value._id;
					makeRoot(model, root)(value);
				}
			});

			return doc;
		}

		// attach additional object if present
		if (_.isArray(docs))
			docs = docs.map(attach);
		else
			docs = attach(docs);


		if (singular) {
			root[model.modelName.toLowerCase()] = docs;
		} else {
			var key = utils.toCollectionName(model.modelName),
				arr = _.isArray(docs) ? docs : [ docs ];
			if (root[key]) {
				arr.forEach(function (item) {
					if (!_.some(root[key], { _id: item._id })) root[key].push(item);
				});
			}else {
				root[key] = arr;
			}
		}

		return root;
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
	var query = req.id ? req.model.findById(req.id) : req.model.find();
	query.lean().exec()
		.then(exists(res))
		.then(req.model.autoPopulate({ lean: true }))
		.then(makeRoot(req.model))
		.then(function (docs) {
			// now that we're flat thanks to makeRoot, change the id.
			return _.mapValues(docs, transform);
		})
		//.then(transform)
		//.then(assemble)
		.then(send(res), handleError(req, next));
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

app.use('/:model', function (req, res, next) {
	var timeStr = format('%s%s retrieval', req.modelName, 
		req.id ? format(' (%s)', req.id) : '');
	console.time(timeStr);

	res.on('finish', function () {
		console.timeEnd(timeStr);
	});

	next();
});

app.get('/:model/:id', route);

app.get('/:model', route);

db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});