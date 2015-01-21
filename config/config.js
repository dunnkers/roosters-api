// cloudControl requires extracting credentials file
var env = process.env.CRED_FILE ? require(process.env.CRED_FILE).CONFIG.CONFIG_VARS : process.env;

// environment
exports.production = env[env.ROOSTERS_MONGODB_DB_URL_VAR] || env[env.ROOSTERS_PORT_VAR] ? true : false;

// database
exports.db_url = env[env.ROOSTERS_MONGODB_DB_URL_VAR] || 'mongodb://localhost/';
exports.db_name = env[env.ROOSTERS_MONGODB_DATABASE_VAR] || 'roosters';
exports.db_connStr = exports.db_url + exports.db_name;

// server
exports.ip = env[env.ROOSTERS_DOMAIN_VAR] || '127.0.0.1';
exports.port = env[env.ROOSTERS_PORT_VAR] || 5000;

// scraper
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
