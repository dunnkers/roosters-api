#!/bin/env node

var express = require('express'),
	app = express(),
	adapter = require('./lib/mongodb_adapter'),
	RSVP = require('rsvp'),
	_ = require('lodash'),
	StudentIndexModel = require('./lib/models/student_index_model'),
	Schedule = require('./lib/models/schedule_model');

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



configure(model.items, model.item, model.Item).then(function () {
	return configure(model.schedules, model.schedule, Schedule);
}).then(function () {

	console.log('\nSetting %s schedule relations...', model.items);
	console.time('\nResolve schedules ' + model.items);
	return adapter.setScheduleRelations(model.schedules);
}).then(function (results) {
	console.timeEnd('\nResolve schedules ' + model.items);
	console.log('Set %d %s schedule relations!\n', results.length, model.items);

	app.listen(port, ip, function () {
		console.log('Listening on %s:%d ...', ip, port);
	});
});

function configure (name, singular, docModel) {
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

			adapter.find(name, query).then(function (docs) {
				var root = {};
				root[name] = docs.map(function (doc) {
					return modify(doc, docModel);
				});
				res.json(root);
			});
		});

		app.get('/' + name + '/:id', function (req, res) {
			adapter.findOne(name, Number(req.params.id)).then(function (doc) {
				var root = {};
				root[singular] = modify(doc, docModel);
				res.json(root);
			});
		});
		return;
	});
}

function modify (doc, docModel) {
	// break arrays
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