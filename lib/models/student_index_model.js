var Index = require('../models/index_model'),
	Item = require('../models/item_model');

function Student (index, menuData) {
	Item.call(this, index, Number(menuData[1]));
	this.voornaam = menuData[4];
	this.achternaam = menuData[3];
	this.klas = menuData[2];
}

Student.prototype = new Item();
Student.prototype.constructor = Student;

Student.prototype.addToSet = function() {
	return ['klas'];
};

function Hour (itemData) {
	this.vak = itemData[0];
	this.docent = itemData[1];
	this.lokaal = itemData[2];
}

function StudentIndex () {
	Index.call(this, Student, Hour, 'students', 'Leerlingen');
}

StudentIndex.prototype = new Index();
StudentIndex.prototype.constructor = Student;

module.exports = StudentIndex;