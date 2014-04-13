var Doc = require('../models/doc_model');

function Schedule (unique, timetable) {
	Doc.call(this, unique);
	this.timetable = timetable;
};

Schedule.prototype = new Doc();
Schedule.prototype.constructor = Schedule;

// Schedule.prototype.addToSet = [ 'timetable' ];
Schedule.prototype.addToSet = ['timetable'];

module.exports = Schedule;