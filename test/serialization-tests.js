var db = require('../app/connection'),
	models = require('../app/initializers/models');

before(function (done) {
	db.connect().then(function () {
		done();
	})
});

describe('Serialization - items', function () {
	it('should correctly serialize teacher item', function () {
		new models.Teacher({
			content: ['Suph', 'Henry Superman']
		}).should.have.properties({
			_id: 'Suph', name: 'Henry Superman', type: 'Teacher'
		});
	});

	it('should correctly serialize student item', function () {
		new models.Student({
			content: ['TA3', '133721', 'TA8a', 'Buali', 'Tom', 'Tv5']
		}).should.have.properties({
			_id: '133721', firstName: 'Tom', lastName: 'Buali', 
			grade: 'TA3', group: 'TA8a', type: 'Student'
		});
	});

	it('should correctly serialize room item', function () {
		new models.Room({
			content: ['037']
		}).should.have.properties({
			_id: '037'
		});
	});

	it('should correctly serialize group item', function () {
		new models.Group({
			content: ['Tv2', 'TA1', 'TA1a']
		}).should.have.properties({
			_id: 'TA1a', grade: 'TA1'
		});
	});
});

describe('Serialization - lesson', function () {
	it('should be serialized as general lesson', function () {
		new models.Lesson({
			day: 4, index: 7, empty: true, between: true
		}).should.have.properties({
			day: 4, index: 7, empty: true, between: true
		}).should.not.have.any.of.properties(['subIndex', 'sibling']);
	});

	it('should be serialized as teacher lesson', function () {
		var lesson = new models.TeacherLesson({
			content: ['TV5.in2', 'in', '327'],
			origin: { _id: 'Lafh' }
		});
		lesson.should.have.properties({
			cluster: 'TV5.in2', 
			subject: 'in', 
			room: '327',
			teacher: 'Lafh'
		});
	});

	it('should be serialized as teacher lesson without teacher', function (done) {
		var lesson = new models.TeacherLesson({
			content: {
				1: 'team5', 2: '037'
			},
			origin: { _id: 'Kiew' }
		});
		models.Lesson.serialize([ lesson ]).then(function (lessons) {
			var lesson = lessons[0];
			
			lesson.should.have.properties({
				subject: 'team5', 
				room: '037'
			});

			(lesson.teacher === undefined).should.be.true;
			done();
		});
	});

	// FIXED: -> this is now handled in pre('save', function) !
	/*it('should be serialized as teacher lesson with group', function () {
		var lesson = new models.TeacherLesson({
			content: ['TG1p', 'men', '263']
		});
		
		var lesson = models.Lesson.parse(lesson)[0];
		lesson.should.have.properties({
			subject: 'men', 
			group: 'TG1p',
			room: '263'
		});

		(lesson.teacher === undefined).should.be.true;
	});*/

	it('should be serialized as teacher lesson with origin', function () {
		var lesson = new models.TeacherLesson({
			cluster: 'TA5d.in3',
			origin: { _id: 'Henry' }
		});
		lesson.should.have.properties({
			teacher: 'Henry'
		});
	});

	// FIXED: -> by setting origin -only- on non-empty lessons!
	/*it('should be serialized as empty teacher lesson with origin', function () {
		var lesson = new models.TeacherLesson({
			origin: { _id: 'Henry' },
			empty: true
		});
		(lesson.teacher === undefined).should.be.true;

		// It fails when the properties are initiated in this order!
		var lesson = new models.TeacherLesson({
			empty: true,
			origin: { _id: 'Henry' }
		});
		(lesson.teacher === undefined).should.be.true;
	});*/

	it('should be serialized as reserved teacher lesson', function () {
		new models.TeacherLesson({
			content: ['==='],
			reserved: true
		}).should.have.properties({
			reserved: true
		}).should.not.have.any.of.properties(['subject', 'cluster', 'teacher', 'room']);
	});

	// CHANGED: -> there are no more reserved lessons. these weird ones will be handled later.
	/*  // related code in teacher-lesson.virtual('content')
		if (this.reserved) {
			// if teacher is set on a reserved lesson
			if (content[2]) {
				this.teacher = content[2];
			}
			return;
		}
	 */
	/*it('should be serialized as reserved teacher lesson with teachers prop', function () {
		new models.TeacherLesson({
			cluster: 'Banduur 32',
			content: {
				2: 'Boer Sper Tinw',
				4: '===', 
				length: 2
			},
			reserved: true
		}).should.have.properties({
			teacher: 'Boer Sper Tinw',
			reserved: true
		}).should.not.have.any.of.properties(['subject', 'cluster', 'room']);
	});*/

	it('should be serialized as student lesson', function () {
		new models.StudentLesson({
			content: ['ne', 'Opgs', '165']
		}).should.have.properties({
			subject: 'ne',
			teacher: 'Opgs',
			room: '165'
		});
	});

	it('should be serialized as room lesson', function () {
		new models.RoomLesson({
			content: ['TV4.te1', 'te', 'Haaa']
		}).should.have.properties({
			cluster: 'TV4.te1',
			subject: 'te',
			teacher: 'Haaa'
		});
	});

	it('should be serialized as room lesson with origin', function () {
		var lesson = new models.RoomLesson({
			origin: { _id: '327' }
		});
		lesson.should.have.properties({
			room: '327'
		});
	});

	it('should be serialized as group lesson', function () {
		new models.GroupLesson({
			content: ['nastec', 'Sims', '337']
		}).should.have.properties({
			subject: 'nastec',
			teacher: 'Sims',
			room: '337'
		});
	});

	// CHANGED: -> turned out this is not ALWAYS true
	// however, the same info is available in teachers' schedule
	/*it('should be serialized as group lesson with origin', function () {
		var lesson = new models.GroupLesson({
			origin: { _id: 'TA6c' }
		});
		lesson.should.have.properties({
			group: 'TA6c'
		});
	});*/

	it('should be serialized as group lesson with deleted origin', function (done) {
		var lesson = new models.GroupLesson({
			subIndex: 2,
			origin: { _id: 'TA6c' }
		});
		models.Lesson.serialize([ lesson ]).then(function (lessons) {
			var lesson = lessons[0];

			(lesson.group === undefined).should.be.true;

			done();
		});
	});
});

describe('Parsing - lesson', function () {
	it('should be parsed as empty', function () {
		var lesson = new models.StudentLesson({
			day: 0, index: 0, empty: true
		});
		models.Lesson.serialize([ lesson ]).then(function (lessons) {
			lessons.should.be.an.Array;
			lessons.should.have.a.lengthOf(1);
			lessons[0].should.have.properties({
				empty: true
			}).should.not.have.any.of.properties([
				'teacher', 'subject', 'cluster', 'room', 'sibling'
			]);

			done();
		});
	});
	
	/* CHANGED: -> no more siblings are attached since they are inconsistent
	across all items.
	it('should be parsed as nested student lesson', function () {
		var lesson = new models.StudentLesson({
			content: ['Stl', 'Bein Buto Camr Dijr Havd*', '161 163 164 165 166*']
		});
		var lessons = models.Lesson.parse(lesson);

		lessons.should.be.an.Array;
		lessons.should.have.a.lengthOf(5);
		lessons.forEach(function (lesson, i) {
			lesson.should.have.properties({
				subject: 'Stl',
				sibling: i
			});
		});
	});*/

	it('should be parsed as unaltered nested student lesson', function (done) {
		var lesson = {
			content: { '0': 'men', '1': 'Logr Pasr Tinw Vosd', '2': '229 328 330' }
		};
		models.Lesson.serialize([ lesson ]).then(function (lessons) {
			lessons.should.be.an.Array;
			lessons.should.have.a.lengthOf(4);
			lessons[0].should.have.properties({ teacher: 'Logr', room: '229' });
			lessons[1].should.have.properties({ teacher: 'Pasr', room: '328' });
			lessons[2].should.have.properties({ teacher: 'Tinw', room: '330' });
			(lessons[3].room === undefined).should.be.true;
			lessons[3].teacher.should.eql('Vosd');

			done();
		});
	});
});
