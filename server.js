#!/bin/env node

var express = require('express'),
	app = express(),
	adapter = require('./lib/mongodb_adapter'),
	RSVP = require('rsvp'),
	_ = require('lodash'),
	StudentIndexModel = require('./lib/models/student_index_model'),
	TeacherIndexModel = require('./lib/models/teacher_index_model');

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
	port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

var studentModel = new StudentIndexModel(),
	teacherModel = new TeacherIndexModel();

app.configure(function () {
	app.use(function (req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		next();
	});
	app.use(express.static(__dirname + '/public', {
		maxAge: 1000 * 60 * 60 * 24
	}));

	app.set('json spaces', 0);
});

configureCollection(studentModel).then(function () {
	return configureCollection(teacherModel);
}).then(function () {
	app.get('/*', function(req, res) {
		res.sendfile('index.html', {
			root: __dirname + '/public'
		});
	});

	app.listen(port, ip, function () {
		console.log('Listening on %s:%d ...', ip, port);
	});
});

function configureCollection (model) {

	function configure (name, singular, docModel) {
		console.log("Loading %s...", name);
		return adapter.loadCollection(name).then(function (count) {
			console.log('Loaded %d %s!\n', count, name);
			
			app.get('/' + name, function (req, res) {
				var ids = req.query.ids;
				ids = (_.isString(ids) ? ids.split(',') : ids || []).map(function (id) {
					return Number(id) || id;
				});
				var query = ids.length ? {_id: {$in: ids}} : {};

				adapter.find(name, query).then(function (docs) {
					var root = {};
					root[name] = docs.map(function (doc) {
						return modify(doc, docModel);
					});
					res.json(root);
				}, function (error) {
					console.error('oops!', error);
					res.send(404);
				});
			});

			app.get('/' + name + '/:id', function (req, res) {
				adapter.findOne(name, Number(req.params.id) || req.params.id).then(function (doc) {
					if (!doc) {
						res.send(404);
					}
					var root = {};
					root[singular] = modify(doc, docModel);
					res.json(root);
				}, function (error) {
					console.error('oops!', error);
					res.send(404);
				});
			});
		});
	}
	
	return configure(model.items, model.item, model.Item).then(function () {
		return configure(model.schedules, model.schedule, model.Schedule);
	}).then(function () {
		return adapter.loadCollection(model.scheduleRelations).then(function () {
			app.get('/' + model.scheduleRelations, function (req, res) {
				adapter.findOne(model.scheduleRelations).then(function (doc) {
					delete doc._id;
					res.json(doc);
				}, function (error) {
					console.error('oops!', error);
					res.send(404);
				});
			});
		});
	}, function (error) {
		console.error('oops!', error);
	});
}

function modify (doc, docModel) {
	var modified = _.mapValues(doc, function (value, key) {
		var arr = docModel.addToSet ? _.transform(docModel.addToSet, function (result, value) {
			result.push(value + 'Modified');
			return result.push(value);
		}) : [];
		return arr.indexOf(key) > -1 ? _.first(value) : value;
	});
	modified.id = modified._id;
	delete modified._id;
	return modified;
}