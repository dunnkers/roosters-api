var print = require('util').print,
	// deps
	mongoose = require('mongoose'),
	RSVP = require('rsvp'),
	log4js = require('log4js'),
	log = log4js.getLogger('connection');

var config = require('../config/config');
var db = mongoose.connection;

db.connect = function () {
	return new RSVP.Promise(function (resolve, reject) {
		mongoose.connect(config.db.connStr);

		db.on('error', reject);

		db.once('open', function () {
			log.info('Connection opened.');
			print('\n');
			resolve();
		});

		db.on('close', function () {
			print('\n');
			log.info('Connection closed.');
		});
	});
};

module.exports = db;