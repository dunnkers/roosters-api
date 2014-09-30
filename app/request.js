var format = require('util').format,
	print = require('util').print,
	crypto = require('crypto'),
	assert = require('assert'),
	// deps
	rest = require('restler'),
	RSVP = require('rsvp')/*,
	log4js = require('log4js'),
	log = log4js.getLogger('request')*/;

var config = require('../config/config');
var cookie;
var timeout = 60000;

assert(process.env.INTRANET_USERNAME, 'Please set the username environment variable!');
assert(process.env.INTRANET_PASSWORD, 'Please set the password environment variable!');

// exports.request
module.exports = function (uri, name) {
	var timeStr = format('%s %s', cookie ? 'GET' : 'POST', name);
	var time = new Date();

	return new RSVP.Promise(function (resolve, reject) {
		(cookie ? rest.get(config.remote.base + uri, {
			headers: { 'Cookie': cookie }, timeout: timeout
		}) : 
			rest.post(config.remote.authURL, getPostData(uri))
		).on('401', function () {
			reject('Unauthorized! - invalid cookie or credentials');
		}).on('error', function (err) {
			reject(format('Couldn\'t request %s (%s)\n%s', name, uri, err));
		}).on('success', function (data, response) {
			print(format('http %s: %dms\t\t', timeStr, new Date() - time));

			var setCookie = response.headers['set-cookie'];
			/*log.debug('http %s: %dms%s', 
				timeStr, new Date() - time, setCookie ? ' [COOKIE]' : '');*/
			if (setCookie) {
				cookie = setCookie[0];
				print(format('COOKIE for: %s\t\t', name));
			}

			resolve(data);
		});
	});
};

function getPostData (uri) {
	return {
		followRedirects: true,
		headers: {
			'Host': config.remote.host,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache'
		},
		username: config.remote.domain + '\\' + process.env.INTRANET_USERNAME,
		password: decrypt(process.env.INTRANET_PASSWORD, process.env.INTRANET_USERNAME),
		data: {
			curl: uri,
			flags: '0',
			forcedownlevel: '0',
			formdir: '8',
			trusted: '0',
			isutf8: '1'
		},
		timeout: timeout
	};
}

// https://gist.github.com/csanz/1181250
function decrypt (text, key) {
	var decipher = crypto.createDecipher('aes-256-cbc', key);
	var dec = decipher.update(text, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
}