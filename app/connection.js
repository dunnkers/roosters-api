var mongoose = require('mongoose'),
	RSVP = require('rsvp'),
	log4js = require('log4js'),
	log = log4js.getLogger('connection'),
	stream = process.stdout;

var config = require('../config/config');
var db = mongoose.connection;

db.connect = function () {
	return new RSVP.Promise(function (resolve, reject) {
		mongoose.connect(config.db_connStr);

		db.on('error', reject);

		db.once('open', function () {
			log.info('Connection opened.');
			stream.write('\n');
			resolve();
		});

		db.on('close', function () {
			stream.write('\n');
			log.info('Connection closed.');
		});
	});
};

module.exports = db;
