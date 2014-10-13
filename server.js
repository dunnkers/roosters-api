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
	delete doc.__v;

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

function notFound (res) {
	res.status(404).send('We couldn\'t find those, sorry!');
}

function route (req, res, next) {
	var select = req.model.schema.options.select || '';

	req.findQuery.select(select).setOptions(req.model.queryOptions()).exec()
		// docs exist
		.then(function (docs) {
			if (!docs || _.isEmpty(docs)) {
				notFound(res);
				throw new Error('not found');
			}

			return docs;
		})
		.then(function (docs) {
			return req.model.populateAll(docs, true);
		})
		/*.then(makeRoot(req.model))
		.then(function (docs) {
			// now that we're flat thanks to makeRoot, change the id.
			return _.mapValues(docs, transform);
		})*/
		.then(function (root) {
			res.send(root);
		}, function (err) {
			if (err.name === 'CastError' || err.message === 'not found')
				return notFound(res);

			var model = req.model ? format('[%s] ', req.model.modelName) : '',
			id = req.id ? format(' (%s)', req.id) : '';

			var msg = format('%sFailed to retrieve model!%s - %s', model, id, err);
			if (err) return next(msg);
		}
	);
}

app.use('/:model', function (req, res, next) {
	var timeStr = format('%s%s retrieval', req.modelName, 
		req.id ? format(' (%s)', req.id) : '');
	console.time(timeStr);

	res.on('finish', function () {
		console.timeEnd(timeStr);
	});

	next();
});

app.get('/:model/:id', function (req, res, next) {
	req.findQuery = req.model.findById(req.id);
	next();
}, route);

app.get('/:model', function (req, res, next) {
	req.findQuery = req.model.find();
	next();
}, route);

db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});