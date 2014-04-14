var Doc = require('../models/doc_model');

function Schedule (unique, timetable) {
	Doc.call(this, unique);
	this.timetable = timetable;
};

Schedule.prototype = new Doc();
Schedule.prototype.constructor = Schedule;

Schedule.addToSet = ['timetable'];
Schedule.prototype.addToSet = Schedule.addToSet;

module.exports = Schedule;