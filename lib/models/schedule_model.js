function Schedule(unique, timetable) {
	this._id = unique;
	this.timetable = timetable;
};

Schedule.prototype.updateQuery = function() {
	return {
		$addToSet: {
			timetable: this.timetable
		},
		$setOnInsert: {
			timetableModified: [new Date()],
			dateCreated: new Date()
		}
	};
};

module.exports = Schedule;