var Index = require('../models/index_model'),
	Doc = require('../models/doc_model');

function Student (index, menuData) {
	Doc.call(this, Number(menuData[1]));
	this.index = index;
	this.voornaam = menuData[4];
	this.achternaam = menuData[3];
	this.klas = menuData[2];
}

Student.prototype = new Doc();
Student.prototype.constructor = Student;

Student.addToSet = ['klas'];
Student.prototype.addToSet = Student.addToSet;

function StudentIndex () {
	Index.call(this, 'Leerlingen', 'student', Student, function (itemData) {
		this.vak = itemData[0];
		this.docent = itemData[1];
		this.lokaal = itemData[2];
	});
}

StudentIndex.prototype = new Index();
StudentIndex.prototype.constructor = StudentIndex;

module.exports = StudentIndex;