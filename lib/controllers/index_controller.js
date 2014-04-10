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
	var list = [];
	var model = this.model;

	$('tr').each(function(i, elem) {

		var menuData = [];

		var column = $(this).children('td');
		var href = column.first().children().first().attr('href');
		if (!href) {
			throw new Error('Incorrect menu data!');
		}
		var index = Number(href.substring(0, href.lastIndexOf(".")));

		column.each(function(i, elem) {
			menuData.push($(this).text().trim());
		});

		list.push(new model.Item(index, menuData));
	});
	return list;
};

IndexController.prototype.parseSchedule = function (data, item) {
	$ = cheerio.load(data);
	var model = this.model;
	var schedule = new Schedule(item._id);

	$('tr:not(:first-child)').each(function(i, elem) {
		$(this).children('td:not(:first-child)').each(function(j, elem) {

			var itemData = $(this).html().split("<br>");

			if ((itemData || '').length > 1) {
				schedule.timetable[j][i] = new model.Hour(itemData);
			}else {
				schedule.timetable[j][i] = {empty: true};
			}
		});
	});

	return _.isEmpty(_.compact(_.flatten(schedule.timetable))) ? null : setHoursBetween(schedule);
};

function setHoursBetween (schedule) {
	var timetable = schedule.timetable;

	for (var i in timetable) {

		var day = timetable[i];
		var hadHour = false;
		var potentials = [];

		for (var j in day) {

			var hour = day[j];

			if (hadHour) {
				if (hour.empty) {
					potentials.push(j);
				}else {
					for (var k in potentials) {
						day[potentials[k]] = {hourBetween: true};
					}
				}
			}else if (!hour.empty) {
				hadHour = true;
			}
		}
	}
	return schedule;
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
			reject('Unauthorized!');
		}).on('error', function (err) {
			reject(format('Couldn\'t authenticate %s - %s\nURL: %s', name, err, url));
		}).on('success', function (data, response) {
			console.timeEnd(timeStr);

			var setCookie = response.headers['set-cookie'];
			if (setCookie) {
				cookie = setCookie[0];
				console.log(response.statusCode + ' cookie for ' + name);
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

// USE HEADERS to see lastModified