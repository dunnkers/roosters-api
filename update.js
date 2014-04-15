var format = require('util').format,
	_ = require('lodash'),
	adapter = require('./lib/mongodb_adapter'),
	IndexController = require('./lib/controllers/index_controller'),
	StudentIndexModel = require('./lib/models/student_index_model'),
	TeacherIndexModel = require('./lib/models/teacher_index_model'),
	RSVP = require('rsvp');

var app = process.env.OPENSHIFT_APP_NAME;

var model = new StudentIndexModel(),
	controller = new IndexController(model);

handleCollection(model.items, function () {
	return controller.authenticate(model.menuURL, 'menu').then(function (data) {
		return controller.parseMenu(data);
	});
}).then(function (docs) {
	console.log('');
	return handleCollection(model.schedules, function () {
		return controller.downloadSchedules(app ? docs : _.first(docs, 1));
	}, docs);
}).then(function () {

	console.log('\nSetting %s schedule relations...', model.items);
	return adapter.loadCollection(model.scheduleRelations).then(function () {
		return adapter.remove(model.scheduleRelations, {});
	});
}).then(function () {
	return adapter.findOne(model.schedules).then(function (doc) {
		return adapter.resolveSchedule(model.schedules, _.first(doc.timetable)).then(function (doc) {
			return adapter.insert(model.scheduleRelations, { relations: doc });
		});
	});
}).then(function () {
	console.log('Set %s schedule relations!', model.items);

	adapter.close();
});


function handleCollection (name, download, items) {
	var localModels;

	console.log('[%s]', name.toUpperCase());
	console.log("Loading %s...", name);
	return adapter.loadCollection(name).then(function (count) {
		var action = count > 0 ? format('Loaded %d', count) : 'Created collection';
		console.log('%s %s!\n', action, name);

		console.log('Downloading %s...', name);
		console.time('Download ' + name);
	}).then(download).then(function (models) {
		console.timeEnd('Download ' + name);
		console.log('Downloaded %d %s!\n', models.length, name);
		localModels = models;

		console.log('Adding new %s...', name);
		return adapter.addModels(name, models);
	}).then(function (stats) {
		console.log('Updated %d and inserted %d %s!\n', stats.updated || 0, stats.inserted || 0, name);

		console.log('Archiving old %s...', name);
		return adapter.archiveOldModels(name, items || localModels);
	}).then(function (count) {
		console.log('Archived %d old %s!', count, name);

		console.log('[/%s]', name.toUpperCase());
		return localModels;
	}, function (error) {
		console.error(error);
	});
}

// if rooster reverted, it wont update
// headers give lastModified information
// modular schedule downloads by saving them when they arrive