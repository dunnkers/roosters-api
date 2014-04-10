var express = require('express'),
	app = express(),
	adapter = require('./lib/mongodb_adapter'),
	RSVP = require('rsvp'),
	_ = require('lodash');

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;

app.get('/', function(req, res) {
	res.send('Welcome to the schedules express rest api!');
});

function setupCollection (collection, plural) {
	console.log('Loading', collection);
	adapter.loadCollection(collection).then(function (count) {
		console.log('Loaded %d %s', count, collection);
	});

	app.get('/' + plural + 's', function (req, res) {
		adapter.findAll(collection).then(function (docs) {
			var root = {};
			root[plural + 's'] = docs.map(modifyArrays);
			res.json(root);
		});
	});

	app.get('/' + plural + 's' + '/:id', function (req, res) {
		adapter.findOne(collection, Number(req.params.id)).then(function (doc) {
			var root = {};
			root[plural] = modifyArrays(doc);
			res.json(root);
		});
	});
}

function modifyArrays (doc) {
	return _.mapValues(doc, function (value) {
		return _.isArray(value) ? value[value.length - 1] : value;
	});
}

setupCollection('students', 'student');
setupCollection('students_schedules', 'studentSchedule');


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