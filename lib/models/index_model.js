var Doc = require('../models/doc_model');

function Index (urlInterfix, singular, Item, Hour) {
	this.urlInterfix = urlInterfix;
	var baseURL = '/thomasakempis/Roostermakers/Roosters/Roosters/' + this.urlInterfix + '/';
	this.menuURL = baseURL + 'menu.html';
	this.scheduleURL = baseURL + '%d.html';

	this.item = singular;
	this.items = singular + 's';
	this.schedule = singular + 'Schedule';
	this.schedules = singular + 'Schedules';
	this.scheduleRelation = this.schedule + 'Relation'
	this.scheduleRelations = this.scheduleRelation + 's'

	this.Item = Item;
	this.Hour = Hour;
	
	this.Schedule = function (unique, timetable) {
		Doc.call(this, unique);
		this.timetable = timetable;
	}
	this.Schedule.prototype = new Doc();
	this.Schedule.prototype.constructor = this.Schedule;

	this.Schedule.addToSet = ['timetable'];
	this.Schedule.prototype.addToSet = this.Schedule.addToSet;
}

module.exports = Index;