var Index = require('../models/index_model'),
	Doc = require('../models/doc_model');

function Teacher (index, menuData) {
	Doc.call(this, menuData[0]);
	this.index = index;
	this.naam = menuData[1];
}

Teacher.prototype = new Doc();
Teacher.prototype.constructor = Teacher;


function Hour (itemData) {
	this.klas = itemData[0];
	this.vak = itemData[1];
	this.lokaal = itemData[2];
}

function TeacherIndex () {
	Index.call(this, Teacher, Hour, 'Docenten', 'teacher');
}

TeacherIndex.prototype = new Index();
TeacherIndex.prototype.constructor = Teacher;

module.exports = TeacherIndex;