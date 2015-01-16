var fs = require('fs');

// database
var db_url = 'mongodb://localhost/',
	db_name = 'roosters';

// openshift deployment
if (process.env.OPENSHIFT_APP_NAME) {
	db_url = process.env.OPENSHIFT_MONGODB_DB_URL;
	db_name = process.env.OPENSHIFT_APP_NAME;
}

// cloud control deployment
else if (process.env.CRED_FILE) {
	// https://www.cloudcontrol.com/dev-center/Guides/NodeJS/Add-on%20credentials
	console.error('opening cred file...');
	var creds = JSON.parse(fs.readFileSync(process.env.CRED_FILE));
	console.error('cred file parsed:',creds);

	db_url = creds.CONFIG.CONFIG_VARS.CLOUDCONTROL_MONGODB_DB_URL;
	db_name = creds.CONFIG.CONFIG_VARS.CLOUDCONTROL_MONGODB_DATABASE;
}

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
