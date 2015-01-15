var LessonSchema = require('../lesson'),
	Lesson = require('mongoose').model('Lesson');

var Schema = new LessonSchema();

Schema.virtual('content').set(function (content) {
	// may also be group. but since it hasn't serialize, we'll gamble.
	if (content[0]) this.cluster = content[0];
	if (content[1]) this.subject = content[1];
	if (content[2]) this.teacher = content[2];
});

Schema.virtual('origin').set(function (origin) {
	this.room = origin._id;
});

Schema.pre('construct', function (next) {
	// unset teacher on lessons with no audience. e.g. `Inv`
	if (!(this.cluster || this.group)) this.teacher = undefined;

	next();
});

Lesson.discriminator('RoomLesson', Schema);