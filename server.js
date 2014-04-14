#!/bin/env node

var express = require('express'),
	app = express(),
	adapter = require('./lib/mongodb_adapter'),
	RSVP = require('rsvp'),
	_ = require('lodash'),
	StudentIndexModel = require('./lib/models/student_index_model');

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

var model = new StudentIndexModel();

app.use(function (req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	next();
});

app.get('/', function(req, res) {
	res.send('Roosters!');
});

configure(model.items, model.item).then(function () {
	return configure(model.schedules, model.schedule, function (docs) {
		return _.isArray(docs) ? 
			adapter.resolveSchedules(model.schedules, docs) : 
			adapter.resolveSchedule(model.schedules, docs);
	});
}).then(function () {
	app.listen(port, ip, function () {
		console.log('Listening on %s:%d ...', ip, port);
	});
});

function configure (name, singular, transform) {
	console.log("Loading %s...", name);
	return adapter.loadCollection(name).then(function (count) {
		console.log('Loaded %d %s!\n', count, name);
		return count;
	}).then(function () {
		
		app.get('/' + name, function (req, res) {
			var ids = req.query.ids;
			ids = (_.isString(ids) ? ids.split(',') : ids || []).map(function (id) {
				return Number(id) || id;
			});
			var query = ids.length ? {_id: {$in: ids}} : {};

			adapter.find(name, query).then(transform || function (docs) {
				return docs;
			}).then(function (docs) {
				var root = {};
				root[name] = docs.map(modify);
				res.json(root);
			});
		});

		app.get('/' + name + '/:id', function (req, res) {
			adapter.findOne(name, Number(req.params.id)).then(transform || function (doc) {
				return doc;
			}).then(function (doc) {
				var root = {};
				root[singular] = modify(doc);
				res.json(root);
			});
		});
		return;
	});
}

function modify (doc) {
	// break arrays
	var modified = _.mapValues(doc, function (value) {
		return _.isArray(value) ? _.first(value) : value;
	});
	modified.id = modified._id;
	delete modified._id;
	return modified;
}