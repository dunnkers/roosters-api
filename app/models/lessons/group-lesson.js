var LessonSchema = require('../lesson'),
	Lesson = require('mongoose').model('Lesson');

var Schema = new LessonSchema();

Schema.virtual('content').set(function (content) {
	if (content[1]) this.subject = content[0];
	if (content[3]) this.teacher = content[1];
	if (content[4]) this.room = content[2];
});

Lesson.discriminator('GroupLesson', Schema);