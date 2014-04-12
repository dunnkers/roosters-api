#!/bin/env node

var express = require('express'),
	app = express(),
	adapter = require('./lib/mongodb_adapter'),
	RSVP = require('rsvp'),
	_ = require('lodash');

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

app.get('/', function(req, res) {
	res.send('Roosters!');
});

setupCollection('students', 'student');
setupCollection('students_schedules', 'studentSchedule');

function setupCollection (collection, plural) {
	console.log('Loading', collection);
	adapter.loadCollection(collection).then(function (count) {
		console.log('Loaded %d %s', count, collection);
	});
	var pluralized = plural + 's';

	app.get('/' + pluralized, function (req, res) {
		adapter.findAll(collection).then(function (docs) {
			var root = {};
			root[pluralized] = docs.map(modifyArrays);
			res.setHeader('Access-Control-Allow-Origin', '*');
			res.json(root);
		});
	});

	app.get('/' + pluralized + '/:id', function (req, res) {

		if (collection === 'students_schedules') {
			adapter.findOne(collection, Number(req.params.id)).then(function (doc) {
				return adapter.resolveScheduleRelation(collection, doc);
			}).then(function (doc) {
				var root = {};
				root[plural] = modifyArrays(doc);
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.json(root);
			});
		}else {
			adapter.findOne(collection, Number(req.params.id)).then(function (doc) {
				var root = {};
				root[plural] = modifyArrays(doc);
				res.setHeader('Access-Control-Allow-Origin', '*');
				res.json(root);
			});
		}
	});
}

function modifyArrays (doc) {
	return _.mapValues(doc, function (value) {
		return _.isArray(value) ? _.first(value) : value;
	});
}


app.listen(port, ip, function () {
	console.log('Listening on %s:%d ...', ip, port);
});



// handle errors.
// incorrect findall response object


// To complete full ember.js support;
// SUPPORT side-loaded http relationships. @see ember guide
/*	console.log('Looking for all students');
	var query = {};
	var ids = req.query.ids;
	if (ids) {
		// Fortune.js also supports this, also type == array
		if (typeof ids === 'string') {
			ids = ids.split(',');
			// -> USE Number(); here, then pass {unique: ids} as a query.
		}
		// Ember.js sends an object a request
		var selectors = [];
		for (var i in ids) {
			selectors.push({unique: Number(ids[i])});
		}
		query = {$or: selectors};
	}*/