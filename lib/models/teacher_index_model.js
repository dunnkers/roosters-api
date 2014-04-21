var Index = require('../models/index_model'),
	Doc = require('../models/doc_model');

function Teacher (index, menuData) {
	Doc.call(this, menuData[0]);
	this.index = index;
	this.naam = menuData[1];
}

Teacher.prototype = new Doc();
Teacher.prototype.constructor = Teacher;

function TeacherIndex () {
	Index.call(this, 'Docenten', 'teacher', Teacher, function (itemData) {
		this.klas = itemData[0];
		this.vak = itemData[1];
		this.lokaal = itemData[2];
		if (itemData[3]) {
			this.examen = itemData[3];
		}
	});
}

TeacherIndex.prototype = new Index();
TeacherIndex.prototype.constructor = TeacherIndex;

module.exports = TeacherIndex;