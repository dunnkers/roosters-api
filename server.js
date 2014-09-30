var format = require('util').format,
	print = require('util').print,
	express = require('express'),
	app = express(),
	log4js = require('log4js'),
	log = log4js.getLogger('server'),
	_ = require('lodash'),
	RSVP = require('RSVP');

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

	var selection = '-type -createdAt -updatedAt -index';
	RSVP.hash({
		students: collections.students.find().select(selection).exec(),
		groups: collections.groups.find().select(selection).exec(),
		teachers: collections.teachers.find().select(selection).exec(),
		rooms: collections.rooms.find().select(selection).exec(),
		menu: collections.items.find().select('_id type').exec()
	}).then(function (root) {
		console.timeEnd('item menu retrieval');

		root.menu = {
			id: 'item',
			items: root.menu
		};

		res.send(root);
	}, function (error) {
		if (error) return next('Failed to retrieve item menu!');
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

app.get('/schedules/:id', function (req, res, next) {
	collections.schedules.findById(req.id).populate('lessons').exec()
	.then(function (schedule) {
		if (!schedule) res.status(404).send('We couldn\'t find that one, sorry!');

		var lessons = schedule.lessons.map(function (lesson) {
			return lesson.toJSON();
		});

		var root = {
			schedule: schedule.toJSON(),
			lessons: lessons
		};

		root.schedule.lessons = schedule.populated('lessons');

		res.send(root);
	});
});

app.get('/:model/:id', function (req, res, next) {
	req.model.findById(req.id).exec().then(function (doc) {
		if (!doc) res.status(404).send('We couldn\'t find that one, sorry!');
		var root = {};

		// use proper singularization (inflection) for teacher-lesson
		root[req.model.modelName.toLowerCase()] = doc.toJSON();

		res.send(root);
	}, function (error) {
		var msg = format('Failed to retrieve specific model! [%s](%s)', 
			req.model.modelName, req.id);
		if (error) return next(msg);
	});
});


db.connect().then(function () {
	app.listen(port, ip, function () {
		log.info('Listening on %s:%d...', ip, port);
	});
});




/*

console.time('METHOD 1');
console.time('items retrieval');
db.connect().then(function () {
	return collections.items.find().exec();
}).then(function (items) {
	console.timeEnd('items retrieval');

	console.time('items type calculations');

	var d = items.map(function (item) {
		return _.pick(item.toJSON(), [ 'id', 'type' ]);
	});
	var res = _.groupBy(items, 'type');

	console.timeEnd('items type calculations');
	console.timeEnd('METHOD 1');

	console.time('METHOD 2');
	console.time('items retrieval');
	var selection = '-type -createdAt -updatedAt -index';
	return RSVP.hash({
		s: collections.students.find().select(selection).exec(),
		g: collections.groups.find().select(selection).exec(),
		t: collections.teachers.find().select(selection).exec(),
		r: collections.rooms.find().select(selection).exec(),
		items: collections.items.find().select('_id type').exec()
	});
}).then(function (items) {
	console.timeEnd('items retrieval');

	console.timeEnd('METHOD 2');

	db.close();
});*/