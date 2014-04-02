#!/bin/env node

var express = require('express');
var app = express();

var ip = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 8080;


process.on('exit', function() {
	console.log('%s: Received %s - terminating app ...', Date(Date.now()));
	process.exit(1);
	console.log('%s: Node server stopped.', Date(Date.now()));
});
['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
].forEach(function(element, index, array) {
	process.on(element, function() {
		if (element === 'string') {
			console.log('%s: Received %s - terminating app ...', Date(Date.now()), sig);
			process.exit(1);
			console.log('%s: Node server stopped.', Date(Date.now()));
		}
	});
});

app.get('/', function (req, res) {
	res.send('wasup');
});

app.listen(port, ip, function() {
	console.log('%s: Node server started on %s:%d ...', Date(Date.now()), ip, port);
});
