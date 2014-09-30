var format = require('util').format,
	print = require('util').print,
	// deps
	cheerio = require('cheerio'),
	_ = require('lodash');

var config = require('../config/config'),
	request = require('./request');

exports.parseItems = function (data) {
	print('\n');
	$ = cheerio.load(data);

	return $('tr').map(function () {
		var column = $(this).children('td');
		var href = column.first().children().first().attr('href');
		if (!href) {
			throw new Error('Incorrect menu data!');
		}

		return {
			index: Number(href.substring(0, href.lastIndexOf("."))),
			content: column.map(function () {
				return $(this).text().trim();
			}).toArray()
		};
	}).toArray();
};

exports.parseLessons = function (data) {
	print('\n');
	$ = cheerio.load(data);
	
	// inverted x- or y-axis
	var headers = $('body body > table > tr:first-child').children('td + td');
	// -> when there are any numbers on the x-axis header
	var invertedAxis = headers.filter(function (index, element) {
		return /\d/.test($(this).text());
	}).length > 0;
	// skip cells if no header
	var emptyHeaders = headers.map(function(index) {
		return ($(this).text() || '').trim() || false;
	});

	var lessons = $('body body > table > tr + tr').map(function (index) {
		// skip row if no header
		var rowHeader = $(this).children('td').first();
		if (_.isEmpty((rowHeader.text() || '').trim())) return;

		// skip last n cells if no header above it
		lessons = $(this).children('td + td').filter(function (index) {
			return emptyHeaders.get(index);
		});

		// parse
		// -> toArray converts object {'0': ...} to array. 
		lessons = lessons.map(exports.parseLesson).toArray();

		return lessons.map(function (lesson) {
			// switch axis them if necessary
			if (invertedAxis) {
				lesson.index = lesson.day;
				lesson.day = index;
			}else {
				lesson.index = index;
			}
			return lesson;
		});
	}).toArray();
	return exports.resolveBetween(lessons);
};

exports.parseLesson = function (day) {
	// support nested
	var tds = $(this).find('td');
	if (tds.length) {
		return tds.map(exports.parseLesson).toArray().map(function (lesson) {
			// day is overwritten. subIndex becomes day.
			// -> due to recursion, day becomes its own subIndex.
			return _.assign(lesson, {
				day: day,
				subIndex: lesson.day
			});
		});
	}

	/* Algorithm - iterates the contents(), uses filter and map
	-> doesn't deal with lessons where only partial fields are filled
	 
	var trim = function() {
		// return empty array for empty lines (= &nbsp;)
		return $(this).text().trim();
	};
	var text = function () {
		return $(this)[0].type === 'text';
	};
	var lesson = {
		day: day,
		// filter isolates text, map trims the array
		content: content.filter(text).map(trim).toArray()
	};
	*/

	var i = 0;
	/* Algorithm - iterates contents() and maps to a var as the correct index
	 */
	var content = {};
	$(this).contents().each(function () {
		if ($(this)[0].name === 'br') i ++;
		if ($(this)[0].type === 'text') {
			var str = $(this).text().trim();
			// remove last aterisk if any
			if (str.slice(-1) === '*') str = str.replace(/\*$/, '');
			//if (str.lastIndexOf('*') != -1) str = str.substr(0, i) + str.substr(i);
			if (str) content[i] = str;
		}
	});
	/* Algorithm - translates contents() to raw object and transforms it,
		then manipulating the data.
	-> doesn't compute text; html characters are not decoded
		-> `empty` cannot be set from outside this function
	
	var content = _.transform($(this).contents(), function(res, value) {
		// increment each linebreak. allows us to correctly map properties
		// even when some are missing / empty
		if (value.name === 'br') i ++;
		if (value.type === 'text') res[i] = value.data.trim();
	});*/

	// setting content length is useless. use lesson.empty instead.
	//content.length = _.values(content).length;


	var lesson = {
		day: day
	};

	// for empty lessons
	if (!$(this).text().trim()) {
		lesson.empty = true;
	}else {
		lesson.content = content;
	}
	// for teacher reserved lessons
	if (_.contains(_.values(lesson.content), '===')) lesson.reserved = true;

	return lesson;
};

// sets 'between: true' property
exports.resolveBetween = function (lessons) {
	_.forEach(_.groupBy(lessons, 'day'), function (day) {
		// indexes of lessons, with empty ones filtered
		var indexes = _.pluck(_.reject(_.reject(day, 'empty'), 'reserved'), 'index');
		// range from lowest to max, e.g. [2, 3, 4]
		var range = _.range(_.min(indexes), _.max(indexes) + 1);
		var betweens =  _.difference(range, indexes);

		// map property onto the lessons
		day.map(function (lesson) {
			if (_.contains(betweens, lesson.index)) lesson.between = true
			return lesson;
		});
	});
	return lessons;
};

exports.getItems = function (modelName) {
	var uri = format(config.remote.itemsURI, config.remote.getType(modelName));
	return request(uri, modelName + '-menu').then(exports.parseItems);
};

exports.getLessons = function (modelName, reference) {
	var index = reference.index;
	var uri = format(config.remote.scheduleURI, config.remote.getType(modelName), index);
	return request(uri, modelName + '-' + index)
		.then(exports.parseLessons)
		.then(function (lessons) {
		// assign references as an origin
		return lessons.map(function (lesson) {
			// only attach to non-empty lessons
			if (!(lesson.empty || lesson.reserved)) {
				lesson.origin = reference;
			}
			return lesson;
		});
	});
};