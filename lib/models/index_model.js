function Index (Item, Hour, name, urlInterfix) {
	this.Item = Item;
	this.Hour = Hour;

	this.items = name;
	this.schedules = name + '_schedules';

	this.urlInterfix = urlInterfix;
	var baseURL = '/thomasakempis/Roostermakers/Roosters/Roosters/' + this.urlInterfix + '/';
	this.menuURL = baseURL + 'menu.html';
	this.scheduleURL = baseURL + '%d.html';
}

module.exports = Index;