var Index = require('../models/index_model'),
	Item = require('../models/item_model');

function Teacher (index, menuData) {
	Item.call(this, index, menuData[0]);
	this.naam = menuData[1];
}

Teacher.prototype = new Item();
Teacher.prototype.constructor = Teacher;


function Hour (itemData) {
	this.klas = itemData[0];
	this.vak = itemData[1];
	this.lokaal = itemData[2];
}

function TeacherIndex () {
	Index.call(this, Teacher, Hour, 'teachers', 'Docenten');
}

TeacherIndex.prototype = new Index();
TeacherIndex.prototype.constructor = Teacher;

module.exports = TeacherIndex;