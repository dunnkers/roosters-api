function Schedule(unique) {
	this._id = unique;
	this.timetable = [[], [], [], [], []];
};

Schedule.prototype.updateQuery = function() {
	return {
		$addToSet: {
			timetable: this.timetable
		}
	};
};

module.exports = Schedule;