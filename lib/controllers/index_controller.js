var crypto = require('crypto'),
	assert = require('assert'),
	cheerio = require('cheerio'),
	RSVP = require('rsvp'),
	rest = require('restler'),
	format = require('util').format,
	_ = require('lodash'),
	Schedule = require('../models/schedule_model');

var cookie;

assert(process.env.INTRANET_USERNAME, 'Please set the username environment variable!');
assert(process.env.INTRANET_PASSWORD, 'Please set the password environment variable!');

function IndexController (indexModel) {
	this.model = indexModel;
}

IndexController.prototype.parseMenu = function (data) {
	$ = cheerio.load(data);
	var model = this.model;

	return $('tr').map(function() {
		var column = $(this).children('td');
		var href = column.first().children().first().attr('href');
		if (!href) {
			throw new Error('Incorrect menu data!');
		}
		var index = Number(href.substring(0, href.lastIndexOf(".")));

		return new model.Item(index, column.map(function () {
			return $(this).text().trim();
		}).toArray());
	}).toArray();
};

IndexController.prototype.parseSchedule = function (data, item) {
	$ = cheerio.load(data);
	var model = this.model;

	var timetable = _.zip($('tr:not(:first-child)').map(function() {

		return [$(this).children('td:not(:first-child)').map(function() {
			var itemData = $(this).html().split("<br>");

			return (itemData || '').length > 1 ? new model.Hour(itemData) : {empty: true};
		}).toArray()];
	}).toArray());
	var valid = _.isEmpty(_.compact(_.flatten(timetable)));

	return valid ? null : new Schedule(item._id, setHoursBetween(timetable));
};

function setHoursBetween (timetable) {
	return timetable.map(function (day) {
		var hadHour = false;
		var potentials = [];

		day.forEach(function (hour, i) {
			if (hour && !hour.empty) {
				hadHour = true;
				potentials.forEach(function (potential) {
					day[potential] = { between: true};
				});
			}else if (hadHour) {
				potentials.push(i);
			}
		});
		return day;
	});
}

IndexController.prototype.authenticate = function (item) {
	var url = item ? format(this.model.scheduleURL, item.index) : this.model.menuURL;
	var base = 'https://intranet.arentheem.nl';
	var name = item ? item._id : 'menu';
	var timeStr = format('%s %s', cookie ? 'GET' : 'POST', name);

	console.time(timeStr);
	return new RSVP.Promise(function (resolve, reject) {
		(cookie ? rest.get(base + url, {headers: {'Cookie': cookie}}) : 
			rest.post(base + '/CookieAuth.dll?Logon', getPostData(url))
		).on('401', function () {
			reject('Unauthorized! - invalid cookie or credentials');
		}).on('error', function (err) {
			reject(format('Couldn\'t authenticate %s - %s\nURL: %s', name, err, url));
		}).on('success', function (data, response) {
			console.timeEnd(timeStr);

			var setCookie = response.headers['set-cookie'];
			if (setCookie) {
				cookie = setCookie[0];
				console.log('COOKIE for: ' + name);
			}

			resolve(data);
		});
	});
};

function getPostData (url) {
	return {
		followRedirects: true,
		headers: {
			'Host': 'intranet.arentheem.nl',
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache'
		},
		username: 'ARENTHEEM\\' + process.env.INTRANET_USERNAME,
		password: decrypt(process.env.INTRANET_PASSWORD, process.env.INTRANET_USERNAME),
		data: {
			curl: url,
			flags: '0',
			forcedownlevel: '0',
			formdir: '3',
			trusted: '0',
			isutf8: '1'
		}
	};
}

// https://gist.github.com/csanz/1181250
function decrypt (text, key) {
	var decipher = crypto.createDecipher('aes-256-cbc', key);
	var dec = decipher.update(text, 'hex', 'utf8');
	dec += decipher.final('utf8');
	return dec;
}

module.exports = IndexController;