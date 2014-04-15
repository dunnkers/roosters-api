function Index (Item, Hour, urlInterfix, singular) {
	this.Item = Item;
	this.Hour = Hour;

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
}

module.exports = Index;