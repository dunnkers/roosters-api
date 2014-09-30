// deps
var should = require('should');

var scraper = require('../app/scraper'),
	fixtures = require('./fixtures');

var db = require('../app/connection'),
	models = require('../app/initializers/models');


describe('Lesson serialization', function () {
	it('should correctly serialize schedule', function () {
		var StudentLesson = models.StudentLesson;
		var lessons = scraper.parseLessons(fixtures.schedules.student);
		StudentLesson.serialize(lessons);
	});
});