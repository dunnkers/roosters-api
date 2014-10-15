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