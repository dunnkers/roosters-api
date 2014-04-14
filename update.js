var format = require('util').format,
	_ = require('lodash'),
	adapter = require('./lib/mongodb_adapter'),
	IndexController = require('./lib/controllers/index_controller'),
	StudentIndexModel = require('./lib/models/student_index_model'),
	TeacherIndexModel = require('./lib/models/teacher_index_model');

var grab = true;

var model = new StudentIndexModel();
var controller = new IndexController(model);

handleCollection(model.items, function () {
	return controller.authenticate().then(function (data) {
		return controller.parseMenu(data);
	});
}).then(function (docs) {
	console.log('');
	return handleCollection(model.schedules, function () {
		return downloadSchedules(_.first(docs, 1));
	});
}).then(function () {
	console.log('\nSetting %s schedule relations...', model.items);
	return adapter.setScheduleRelations(model.schedules);
}).then(function (results) {
	console.log('Set %d %s schedule relations!', results.length, model.items);

	adapter.close();
});


function handleCollection (name, download) {
	var localModels;

	console.log('[%s]', name.toUpperCase());
	console.log("Loading %s...", name);
	return adapter.loadCollection(name).then(function (count) {
		var action = count > 0 ? format('Loaded %d', count) : 'Created collection';
		console.log('%s %s!\n', action, name);

		console.log('Downloading %s...', name);
		console.time('Download ' + name);
	}).then(grab ? download : function () {
		return [];
	}).then(function (models) {
		console.timeEnd('Download ' + name);
		console.log('Downloaded %d %s!\n', models.length, name);


		localModels = models;

		console.log('Adding new %s...', name);
		return adapter.addModels(name, models);
	}).then(function (stats) {
		console.log('Updated %d and inserted %d %s!', stats.updated || 0, stats.inserted || 0, name);
		// \n


		/*console.log('Removing old %s...', name);
		return adapter.removeOldModels(name, localModels);
	}).then(function (count) {
		console.log('Removed %d old %s!\n', count, name);*/

		console.log('[/%s]', name.toUpperCase());
		return localModels;
	}, function (error) {
		console.error(error);
	});
}

function downloadSchedules (items) {
	var schedules = [];

	function recurse () {
		var item = (Array.isArray(items) ? items : [items]).shift();

		return controller.authenticate(item).then(function (data) {
			return controller.parseSchedule(data, item);
		}).then(function (schedule) {
			if (schedule) {
				schedules.push(schedule);
			}
			return items.length ? recurse() : schedules;
		});
	}

	return recurse();
}

// delete lodash in this doc, just as RSVP.
// using downloadSchedules RECYCLES the students. by dellin' them.
// if rooster reverted, it wont update.
// intranet TIMEOUT = 10min.
// in authenticate(), Headers give us lastModified information. 

// hour can be undefined in IndexController ln. 60

// don't download EVERYTHING first, modularly download, then add; less error prone.