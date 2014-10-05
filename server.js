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

// item menu
app.get('/menus/item', function (req, res, next) {
	console.time('item menu retrieval');

	var selection = '-type -createdAt -updatedAt -index -__v';
	RSVP.hash({
		students: collections.students.find().lean().select(selection).exec(),
		groups: collections.groups.find().lean().select(selection).exec(),
		teachers: collections.teachers.find().lean().select(selection).exec(),
		rooms: collections.rooms.find().lean().select(selection).exec(),
		menu: collections.items.find().lean().select('_id type').exec()
	}).then(function (root) {
		root = _.mapValues(root, function (items) {
			return items.map(function (item) {
				item.id = item._id;
				delete item._id;
				return item;
			});
		});

		root.menu = {
			id: 'item',
			items: root.menu
		};

		console.timeEnd('item menu retrieval');
		res.send(root);
	}, function (error) {
		if (error) return next('Failed to retrieve item menu!');
	});
});

/*
 * Special routes for polymorphic models.
 */
app.get('/items', function (req, res, next) {
	var select = '-index -__v -updatedAt -createdAt';
	console.time('item menu retrieval');
	collections.items.find().lean().select(select).exec().then(function (docs) {
		if (!docs) res.status(404).send('We couldn\'t find items, sorry!');

		docs = docs.map(function (item) {
			item.id = item._id;
			delete item._id;
			return item;
		});

		var root = _.groupBy(docs, 'type');

		root.items = docs.map(function (item) {
			return {
				id: item.id,
				item: {
					id: item.id,
					type: item.type
				}
			}
		});

		// pluralize
		root = _.transform(root, function (res, value, key) {
			res[utils.toCollectionName(key)] = value;
		});
		
		console.timeEnd('item menu retrieval');
		res.send(root);
	}, function (error) {
		var msg = format('We went wrong good men.');
		if (error) return next(msg);
	});
});

// item detail
app.get('/items/:id', function (req, res, next) {
	collections.items.findById(req.id).exec().then(function (doc) {
		if (!doc) res.status(404).send('We couldn\'t find that one, sorry!');

		var root = {
			item: {
				id: doc.id,
				item: {
					id: doc.id,
					type: doc.type
				}
			}
		};

		root[utils.toCollectionName(doc.type)] = [ doc.toJSON() ];

		res.send(root);
	}, function (error) {
		var msg = format('Failed to retrieve specific model! [%s](%s)', 
			req.model.modelName, req.id);
		if (error) return next(msg);
	});
});

app.get('/:model/:id', function (req, res, next) {
	var populatePath = req.model.populatePath;
	var query = req.model.findById(req.id);
	// req.model.findPopulated()
	(populatePath ? query.populate(populatePath) : query).exec().then(function (doc) {
		if (!doc) res.status(404).send('We couldn\'t find that one, sorry!');

		res.send(req.model.root(doc));
	}, function (error) {
		var msg = format('Failed to retrieve specific model! [%s](%s)', 
			req.model.modelName, req.id);
		if (error) return next(msg);
	});
});

app.get('/:model', function (req, res, next) {
	req.model.find().exec().then(function (docs) {
		if (!docs) res.status(404).send('We couldn\'t find those, sorry!');
		var root = {};

		root[req.modelName] = docs.map(function (doc) {
			return doc.toJSON();
		});

		res.send(root);
	}, function (error) {
		var msg = format('Failed to retrieve collection! [%s]', req.model.modelName);
		if (error) return next(msg);
	});
});


db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});