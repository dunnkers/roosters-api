var format = require('util').format,
	express = require('express'),
	app = express(),
	log4js = require('log4js'),
	log = log4js.getLogger('server'),
	_ = require('lodash'),
	RSVP = require('rsvp'),
	utils = require('mongoose/lib/utils'),
	stream = process.stdout;

var db = require('./app/connection'),
	collections = require('./app/initializers/collections'),
	config = require('./config/config');

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
	var select = req.model.schema.options.select || '',
			time = new Date();

	req.findQuery.select(select).exec()
		// docs exist
		.then(function (docs) {
			if (!docs) {
				notFound(res);
				throw new Error('not found');
			}

			return docs;
		})
		.then(function (docs) {
			log.debug('\tFind query:', new Date() - time, 'ms');
			time = new Date();

			// passing true to populateAll forces for a root
			return req.model.populateAll(docs, true);
		})
		.then(function (root) {
			log.debug('\tPopulate-all: ', new Date() - time, 'ms');

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

function measureTime (req, res, next) {
	log.info('Fetching %s%s%s...', req.modelName,
						req.id ? format(' (%s)', req.id) : '',
						req.query.q ? format(' (like "%s")', req.query.q) : '');

	var time = new Date();
	res.on('finish', function () {
		log.info('Total:', new Date() - time, 'ms');
		stream.write('\n');
	});

	next();
}

app.use('/:model/:id', measureTime);

app.get('/:model/:id', function (req, res, next) {
	req.findQuery = req.model.findById(req.id);
	req.findQuery.setOptions(req.model.queryOptions());
	next();
}, route);

app.use('/:model', measureTime);

app.get('/:model', function (req, res, next) {
	req.findQuery = req.model.find(req.model.searchQuery(req.query.q));

	var queryOptions = req.model.queryOptions(),
			limit = Number(req.query.limit);

	if (limit) {
		queryOptions.limit = limit;
	}

	req.findQuery.setOptions(queryOptions);

	next();
}, route);

db.connect().then(function () {
	app.listen(config.port, config.ip, function () {
		log.info('Listening on %s:%d...', config.ip, config.port);
		stream.write('\n');
	});
}, function (err) {
	log.error('Failed to connect to database! -', err);

	db.close();
});
