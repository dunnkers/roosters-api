var format = require('util').format,
	// deps
	should = require('should'),
	cheerio = require('cheerio'),
	_ = require('lodash');

var scraper = require('../app/scraper'),
	fixtures = require('./fixtures');

describe('Parsing - General schedule (student)', function () {
	var lessons = scraper.parseLessons(fixtures.schedules.student),
		days = _.groupBy(lessons, 'day');

	it('should have correct amount of lessons, betweens and empties', function () {
		// check days / lessons
		_.size(days).should.be.exactly(5);
		_.forEach(days, function (lessons, day) {
			lessons.should.have.a.lengthOf(day === '1' ? 9 : 8);
		});
		lessons.should.have.a.lengthOf(41);

		_.filter(lessons, 'between').should.have.a.lengthOf(1);
		_.filter(lessons, 'empty').should.have.a.lengthOf(13);
		_.filter(lessons, 'reserved').should.have.a.lengthOf(0);
		
		var subLessons = _.without(_.pluck(lessons, 'subIndex'), undefined);
		subLessons.should.have.a.lengthOf(2);
		_.difference(subLessons, [0, 1]).should.be.empty;
	});

	it('should have a correct first lesson on monday', function () {
		var lesson = _.find(lessons, { day: 0, index: 0 });
		lesson.content.should.have.properties({
			'0': 'wisA',
			'1': 'Ruth',
			'2': '237'
		});
	});
});

describe('Parsing - Teacher schedule', function () {
	var lessons = scraper.parseLessons(fixtures.schedules.teacher);

	it('should have correct reserved lessons', function () {
		// monday
		_.groupBy(lessons, 'day')[0].forEach(function (lesson) {
			lesson.should.have.property('reserved', true);
		});

		_.filter(lessons, 'reserved').should.have.a.lengthOf(13);
	});

	// because a reserved lesson is not empty
	it('should have correct empty lessons', function () {
		_.filter(lessons, 'empty').should.have.a.lengthOf(10);
	});

	it('should correctly handle reserved lesson with teacher defined', function() {
		var html = '<tr><td>' + 
			'<br><br>Boer Sper Tinw<br><br>===' +
		'</td></tr>';

		$ = cheerio.load(html);
		var lesson = $('td').map(scraper.parseLesson).toArray()[0];
		lesson.content.should.have.properties({
			'2': 'Boer Sper Tinw',
			'4': '==='
		});
		_.isEmpty(lesson.content).should.be.false;
		lesson.should.have.property('reserved', true);
	})

	it('should correctly handle `inv` lessons', function() {
		var html = '<tr><td>' + 
			'<br>Inv<br>' +
		'</td></tr>';

		$ = cheerio.load(html);
		var lesson = $('td').map(scraper.parseLesson).toArray()[0];
		lesson.content.should.have.property('1', 'Inv');
	})
});

describe('Parsing - Another teacher schedule', function() {
	var lessons = scraper.parseLessons(fixtures.schedules.anotherTeacher);

	it('should have correct amount of betweens', function() {
		_.filter(lessons, 'empty').should.have.a.lengthOf(6);
		_.filter(lessons, 'reserved').should.have.a.lengthOf(23);
		_.filter(lessons, 'between').should.have.a.lengthOf(1);
	});
});

describe('Parsing - Different axis teacher schedule', function() {
	var lessons = scraper.parseLessons(fixtures.schedules.rotatedTeacherSchedule);

	it('should have correct amount of empties, reserved and betweens', function() {
		_.filter(lessons, 'empty').should.have.a.lengthOf(15);
		_.filter(lessons, 'reserved').should.have.a.lengthOf(0);
		_.filter(lessons, 'between').should.have.a.lengthOf(1);
	});

	it('should have correct day indexes', function() {
		_.where(lessons, { day: 4, index: 6}).should.not.be.empty;
		_.where(lessons, { day: 1, index: 0}).should.not.be.empty;
	});

	it('should not bind teacher origin to clusterless lesson', function() {
		(_.where(lessons, { subject: 'Acht1' }).teacher === undefined).should.be.true;
	});
});