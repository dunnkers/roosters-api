// database
var db_url = process.env.OPENSHIFT_MONGODB_DB_URL || 'mongodb://localhost/',
	db_name = process.env.OPENSHIFT_APP_NAME || 'roosters';

exports.db = {
	connStr: db_url + db_name
};


// intranet
var host = 'intranet.arentheem.nl',
	base = 'https://' + host,
	baseURI = '/thomasakempis/Roostermakers/Roosters/Roosters/%s/';

exports.remote = {
	host: host,
	domain: 'ARENTHEEM',
	base: base,
	authURL: base + '/CookieAuth.dll?Logon',
	getType: function (modelName) {
		switch (modelName) {
			case 'Teacher':
				return 'Docenten';
			case 'Group':
				return 'Klassen';
			case 'Student':
				return 'Leerlingen';
			case 'Room':
				return 'Lokalen';
			default:
				return 'Error';
		}
	},
	itemsURI:  baseURI + 'menu.html',
	scheduleURI:  baseURI + '%s.html'
};