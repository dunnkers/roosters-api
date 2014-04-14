var format = require('util').format,
	_ = require('lodash'),
	adapter = require('./lib/mongodb_adapter'),
	IndexController = require('./lib/controllers/index_controller'),
	StudentIndexModel = require('./lib/models/student_index_model'),
	TeacherIndexModel = require('./lib/models/teacher_index_model');

var grab = true;

var model = new StudentIndexModel();
var controller = new IndexController(model);

/*handleCollection(model.items, function () {
	return controller.authenticate().then(function (data) {
		return controller.parseMenu(data);
	});
}).then(function (docs) {
	console.log('');
	return handleCollection(model.schedules, function () {
		return downloadSchedules(_.first(docs, 1));
	});
}).then(function () {
	console.log(JSON.stringify(_.first(docs), null, '\t'));

	console.log('\nSetting %s schedule relations...', model.items);
	console.time('\nResolve schedules ' + model.items);
	return adapter.setScheduleRelations(model.schedules);
}).then(function (results) {
	console.timeEnd('\nResolve schedules ' + model.items);
	console.log('Set %d %s schedule relations!', results.length, model.items);

	adapter.close();
});*/


function handleCollection (name, download) {
	var localModels;

	console.log('[%s]', name.toUpperCase());
	console.log("Loading %s...", name);
	return adapter.loadCollection(name).then(function (count) {
		var action = count > 0 ? format('Loaded %d', count) : 'Created collection';
		console.log('%s %s!\n', action, name);

		console.log('Downloading %s...', name);
		console.time('\nDownload ' + name);
	}).then(grab ? download : function () {
		return [];
	}).then(function (models) {
		console.timeEnd('\nDownload ' + name);
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
		}, function (error) {
			console.error('Failed to download schedule for ' + item._id + '\n' + error);
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

var boy = '<html><head><title>Zermelo Rasterscherm</title></head><body><br><table STYLE="border: Solid 1px Black;border-collapse: collapse;font-family: arial;width: 100%;" CELLSPACING=0><tr><TD BGCOLOR="FFFF80" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">TV4</TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">11508</TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">TG4q</TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">Mataheru </TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">Robin</TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">Tv2</TD></tr></table><br><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="nl"><head><title>Zermelo Rasterscherm</title><style type="text/css">*{padding: 0px;margin: 0px;}body{padding: 10px;}table{border: solid 1px rgb( 0, 0, 0 );border-spacing: 0px;border-collapse: collapse;}td{border: solid 1px rgb( 0, 0, 0 );padding: 2px;vertical-align: top;white-space: nowrap;font-size: 12px;font-family: arial;}</style></head><body><table><tr><td style="background-color: rgb(220, 220, 220);">Uur\Dag</td><td style="background-color: rgb(220, 220, 220);">maandag</td><td style="background-color: rgb(220, 220, 220);">dinsdag</td><td style="background-color: rgb(220, 220, 220);">woensdag</td><td style="background-color: rgb(220, 220, 220);">donderdag</td><td style="background-color: rgb(220, 220, 220);">vrijdag</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u1</td><td>lo<br/>Viss<br/>610</td><td>&nbsp;</td><td>schk<br/>Bosj<br/>325</td><td>ak<br/>Vist<br/>167</td><td>&nbsp;</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u2</td><td>maat<br/>Bruc<br/>130</td><td>&nbsp;</td><td>&nbsp;</td><td>in<br/>Lafh<br/>327</td><td>&nbsp;</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u3</td><td>entl<br/>Aale<br/>131</td><td>biol<br/>Hulm<br/>224</td><td>biol<br/>Hulm<br/>333</td><td>wisA<br/>Jong<br/>238</td><td>latl<br/>Bers<br/>262</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u4</td><td>wisA<br/>Jong<br/>220</td><td>wisA<br/>Jong<br/>229</td><td>biol<br/>Hulm<br/>333</td><td>entl<br/>Aale<br/>223</td><td>&nbsp;</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u5</td><td>netl<br/>Camr<br/>232</td><td>&nbsp;</td><td>&nbsp;</td><td>schk<br/>Bosj<br/>325</td><td>netl<br/>Camr<br/>232</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u6</td><td>lv<br/>Becl<br/>160</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">in<br/>Lafh<br/>327 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Vist<br/>124 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">men<br/>Aale Bers<br/>263 </td></tr></table></td><td>anw<br/>Hulm<br/>126</td><td>kcv<br/>Mose<br/>037</td><td>anw<br/>Hulm<br/>126</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u7</td><td>&nbsp;</td><td>&nbsp;</td><td>latl<br/>Bers<br/>262</td><td>&nbsp;</td><td>latl<br/>Bers<br/>262</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u8</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table></body></html><br><br></body></html>';
boy = '<html><head><title>Zermelo Rasterscherm</title></head><body><br><table STYLE="border: Solid 1px Black;border-collapse: collapse;font-family: arial;width: 100%;" CELLSPACING=0><tr><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">Tv2</TD><TD BGCOLOR="FFFF80" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">TV5</TD><TD BGCOLOR="DCDCDC" NOWRAP style="border: none;font-family: Arial;font-size: 20px;font-weight: bold;padding: 5px;">TA5b</TD></tr></table><br><!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd"><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="nl"><head><title>Zermelo Rasterscherm</title><style type="text/css">*{padding: 0px;margin: 0px;}body{padding: 10px;}table{border: solid 1px rgb( 0, 0, 0 );border-spacing: 0px;border-collapse: collapse;}td{border: solid 1px rgb( 0, 0, 0 );padding: 2px;vertical-align: top;white-space: nowrap;font-size: 12px;font-family: arial;}</style></head><body><table><tr><td style="background-color: rgb(220, 220, 220);">Uur\Dag</td><td style="background-color: rgb(220, 220, 220);">maandag</td><td style="background-color: rgb(220, 220, 220);">dinsdag</td><td style="background-color: rgb(220, 220, 220);">woensdag</td><td style="background-color: rgb(220, 220, 220);">donderdag</td><td style="background-color: rgb(220, 220, 220);">vrijdag</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u1</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>124 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">biol<br/>Hasa<br/>333 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Gieg<br/>330 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ges<br/>Maaa<br/>132 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ges<br/>Eijd<br/>037 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bakc<br/>328 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bekr<br/>224 </td></tr></table></td><td>econ<br/>Boer<br/>129</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">biol<br/>Hasa<br/>333 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">maw<br/>Bruc<br/>130 </td></tr></table></td><td>netl<br/>Herm<br/>234</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u2</td><td>lv<br/>Hena<br/>225</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Jong<br/>236 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>132 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bekr<br/>224 </td></tr></table></td><td>netl<br/>Herm<br/>234</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Jong<br/>238 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Ruth<br/>237 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Zuij<br/>236 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Jong<br/>233 </td></tr></table></td></tr><tr><td style="background-color: rgb(220, 220, 220);">u3</td><td>entl<br/>Hofe<br/>223</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Ricm<br/>163 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Veja<br/>229 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Stra<br/>230 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Joum<br/>161 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">in<br/>Lafh<br/>327 </td></tr></table></td><td>entl<br/>Hofe<br/>234</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Gieg<br/>330 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">nat<br/>Logr<br/>224 </td></tr></table></td></tr><tr><td style="background-color: rgb(220, 220, 220);">u4</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Boer<br/>129 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">nat<br/>Buub<br/>225 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bakc<br/>328 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">te<br/>Basf<br/>036 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">mu<br/>Ribm<br/>530 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>124 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">mu<br/>Ribm<br/>530 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>124 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Stra<br/>230 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Ruth<br/>237 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Jong<br/>238 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Zuij<br/>236 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Gieg<br/>330 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ges<br/>Maaa<br/>132 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ges<br/>Eijd<br/>169 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bakc<br/>328 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">schk<br/>Bekr<br/>323 </td></tr></table></td></tr><tr><td style="background-color: rgb(220, 220, 220);">u5</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Ruth<br/>237 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Jong<br/>220 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Zuij<br/>238 </td></tr></table></td><td>entl<br/>Hofe<br/>234</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>124 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">maw<br/>Bruc<br/>130 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">maw<br/>Bruc<br/>130 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">spe<br/>Goes<br/>234 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisB<br/>Jong<br/>238 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">nat<br/>Buub<br/>225 </td></tr></table></td><td>lo<br/>Ormw<br/>620</td></tr><tr><td style="background-color: rgb(220, 220, 220);">u6</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Ricm<br/>228 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Veja<br/>229 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Stra<br/>230 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Joum<br/>161 </td></tr></table></td><td>men<br/>Logr Pasr Tinw Vosd<br/>229 328 330</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Sper<br/>221 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">econ<br/>Boer<br/>129 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">nat<br/>Logr<br/>224 </td></tr></table></td><td>ckv<br/>Pasr<br/>036</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Jong<br/>236 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">in<br/>Lafh<br/>327 </td></tr></table></td></tr><tr><td style="background-color: rgb(220, 220, 220);">u7</td><td>wisA<br/>Jong<br/>237</td><td>&nbsp;</td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">maw<br/>Bruc<br/>130 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">in<br/>Lafh<br/>327 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">spe<br/>Goes<br/>230 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Veja<br/>229 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">dutl<br/>Ricm<br/>229 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">fatl<br/>Joum<br/>161 </td></tr></table></td><td><table><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">te<br/>Basf<br/>036 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">in<br/>Lafh<br/>327 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">wisA<br/>Jong<br/>236 </td></tr><tr><td style="background-color: rgb(255, 255, 255);width: 100%;">ak<br/>Tinw<br/>124 </td></tr></table></td></tr><tr><td style="background-color: rgb(220, 220, 220);">u8</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table></body></html><br><br></body></html>';
var dude = new model.Item(704, ['TV4', '11508', 'TG4q', 'Mataheru', 'Robin', 'Tv2']);
var schedule = controller.parseSchedule(boy, dude);
console.log('schedule', JSON.stringify(schedule,null,'\t'));
