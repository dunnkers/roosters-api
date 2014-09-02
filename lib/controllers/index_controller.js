var crypto = require('crypto'),
	assert = require('assert'),
	cheerio = require('cheerio'),
	RSVP = require('rsvp'),
	rest = require('restler'),
	format = require('util').format,
	_ = require('lodash'),
	print = require('util').print;

var cookie,
	host = 'intranet.arentheem.nl',
	base = 'https://' + host;

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

	function mapDay () {
		var tds = $(this).find('td');
		if (tds.length) {
			var hours = tds.map(mapDay).toArray();
			return _.zipObject(hours.map(function (value, i) {
				return i + '';
			}), hours);
		}
		var itemData = $(this).html().split("<br>");
		return (itemData || '').length > 1 ? new model.Hour(itemData.map(function (data) {
			return data.trim();
		})) : { empty: true };
	}

	var timetable = _.zip($('tr:not(:first-child)').map(function() {
		// strip last teacher tr
		if (!(($(this).children().first().text() || '').trim().length > 1)) {
			return null;
		}
		return [$(this).children('td:not(:first-child)').map(mapDay).toArray()];
	}).toArray()).map(_.compact);

	if (_.isEmpty(_.compact(_.flatten(timetable)))) {
		return null;
	}
	// hours between
	return new model.Schedule(item._id, timetable.map(function (day) {
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
	}));
};

IndexController.prototype.authenticate = function (url, name) {
	var timeStr = format('%s %s', cookie ? 'GET' : 'POST', name);
	var time = new Date();

	return new RSVP.Promise(function (resolve, reject) {
		(cookie ? rest.get(base + url, {headers: {'Cookie': cookie}}) : 
			rest.post(base + '/CookieAuth.dll?Logon', getPostData(url))
		).on('401', function () {
			reject('Unauthorized! - invalid cookie or credentials');
		}).on('error', function (err) {
			reject(format('Couldn\'t authenticate %s - %s\nURL: %s', name, err, url));
		}).on('success', function (data, response) {
			print(format('%s: %dms\t\t', timeStr, new Date() - time));

			var setCookie = response.headers['set-cookie'];
			if (setCookie) {
				cookie = setCookie[0];
				print(format('COOKIE for: %s\t\t', name));
			}

			resolve(data);
		});
	});
};

IndexController.prototype.downloadSchedules = function (itemsParam) {
	var schedules = [];
	var self = this;
	var items = _.cloneDeep(itemsParam);

	function recurse (items) {
		if (!items) {
			return -1;
		}
		var docs = items.splice(0, 20);
		return RSVP.all(docs.map(function (item) {
			var url = format(self.model.scheduleURL, item.index);
			return self.authenticate(url, item._id).then(function (data) {
				return self.parseSchedule(data, item);
			}, function (error) {
				console.error('Failed to download schedule for ' + item._id + '\n' + error);
			});
		})).then(function (results) {
			schedules = schedules.concat(results);
			console.log('DOWNLOADED', docs.length);
			return items.length ? recurse(items) : schedules;
		});
	}
	return recurse(items);
};

function getPostData (url) {
	return {
		followRedirects: true,
		headers: {
			'Host': host,
			'Content-Type': 'application/x-www-form-urlencoded',
			'Cache-Control': 'no-cache'
		},
		username: 'ARENTHEEM\\' + process.env.INTRANET_USERNAME,
		password: decrypt(process.env.INTRANET_PASSWORD, process.env.INTRANET_USERNAME),
		data: {
			curl: url,
			flags: '0',
			forcedownlevel: '0',
			formdir: '8',
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