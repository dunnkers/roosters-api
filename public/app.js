App = Ember.Application.create();

App.Router.map(function() {
	this.resource('schedule', {path: ':id'}, function() {
		this.resource('between', {path: ':day/:hour'});
	});
});

App.Router.reopen({
	location: 'history'
});

App.Student = DS.Model.extend({
	voornaam: DS.attr('string'),
	achternaam: DS.attr('string'),
	klas: DS.attr('string'),
	jaarlaag: DS.attr('string'),
	naam: function () {
		return this.get('voornaam') + ' ' + this.get('achternaam');
	}.property('voornaam', 'achternaam'),
	titel: function () {
		return this.get('naam') + ' (' + this.get('klas') + ')';
	}.property('naam', 'klas')
});

App.Teacher = DS.Model.extend({
	naam: DS.attr('string'),
	titel: function () {
		return this.get('id') + ', ' + this.get('naam');
	}.property('naam', 'id')
});

App.StudentSchedule = DS.Model.extend({
	timetable: DS.attr('timetable')
});

App.TeacherSchedule = App.StudentSchedule.extend();

App.TimetableTransform = DS.Transform.extend({
	deserialize: function(value) {
		value = value.map(function(dag, i) {
			return dag.map(function(uur, j){
				uur.i = i;
				uur.j = j;
				var nested = [];
				_.forIn(uur, function (value, key) {
					if (Number(key) || Number(key) === 0) {
						nested.push(value);
					}
				});
				if (nested.length) {
					uur.nested = nested;
				}
				return uur;
			});
		});

		value.unshift(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map(function(uur) {
			return { uur: uur };
		}));
		return _.zip(value);
	}
});

App.ApplicationController = Ember.ArrayController.extend({
	searchValue: '',
	actions: {
		search: function () {
			val = this.get('searchValue');
			if (!(val && val.length)) {
				return;
			}
			var self = this;

			function handle (engine) {
				engine.get(val, function (suggestions) {
					if (suggestions && suggestions.length) {
						$('#bloodhound .typeahead')
						.typeahead('val', _.first(suggestions).unique)
						.typeahead('close');

						self.transitionToRoute('schedule', _.first(suggestions).id);
					}
				});
			}

			handle(Ember.studentEngine);
			handle(Ember.teacherEngine);
		}
	}
});

App.ApplicationRoute = Ember.Route.extend({
	init: function () {
		Ember.days = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag'];
		Ember.hours = ['1e', '2e', '3e', '4e', '5e', '6e', '7e', '8e'];

		var bloodhoundConfig = {
			datumTokenizer: Bloodhound.tokenizers.obj.whitespace('unique'),
			queryTokenizer: Bloodhound.tokenizers.whitespace,
			local: []
		};
		Ember.studentEngine = new Bloodhound(bloodhoundConfig);
		Ember.studentEngine.initialize();
		Ember.teacherEngine = new Bloodhound(bloodhoundConfig);
		Ember.teacherEngine.initialize();
		Ember.RSVP.hash({
				teachers: this.store.find('teacher'),
				students: this.store.find('student')
			}).then(function (results) {
			Ember.studentEngine.add(_.transform(results.students.content, function (result, item) {
				result.push({ unique:item.id, id: item.id });
				return result.push({ unique: item.get('naam'), id: item.id });
			}));
			Ember.teacherEngine.add(results.teachers.content.map(function (teacher) {
				return { unique: teacher.get('titel'), id: teacher.id };
			}));
		});
	}
});

App.ApplicationView = Ember.View.extend({
	didInsertElement: function () {
		var self = this;
		$('#bloodhound .typeahead').typeahead({
			hint: true,
			highlight: true,
			minLength: 1
		}, {
			name: 'students-search',
			displayKey: 'unique',
			source: Ember.studentEngine.ttAdapter()
		}, {
			name: 'teachers-search',
			displayKey: 'unique',
			source: Ember.teacherEngine.ttAdapter()
		}).on('typeahead:selected', function (event, item) {
			self.get('controller').set('searchValue', item.unique);
		}).on('typeahead:autocompleted', function (event, item) {
			self.get('controller').set('searchValue', item.unique);
		}).focus();
	}
});

App.ScheduleRoute = Ember.Route.extend({
	model: function(params) {
		var doc = this.controllerFor('schedule').resolveType(params.id);
		
		if (doc === 'student' && !Ember.scheduleRelations) {
			$.getJSON('/studentScheduleRelations').then(function (data) {
				Ember.scheduleRelations = data.relations;
			});
		}

		return Ember.RSVP.hash({
			schedule: this.store.find(doc + 'Schedule', params.id),
			item: this.store.find(doc, params.id)
		});
	}
});

App.ScheduleController = Ember.ObjectController.extend({
	type: 'student',
	handleBetween: false,
	resolveType: function (id) {
		var ret = null;
		if (Number(id)) {
			if (Number(id) > 1000) {
				ret = 'student';
				this.set('handleBetween', true);
			}else {
				// classroom
			}
		}else {
			if (/\d/g.test(id)) {
				// class
			}else {
				ret = 'teacher';
				this.set('handleBetween', false);
			}
		}

		this.set('type', ret);
		return ret;
	},
	actions: {
		between: function (i, j) {
			this.transitionToRoute('between', Ember.days[i], Ember.hours[j]);
		}
	}
});

App.HourView = Ember.View.extend({
	templateName: function () {
		return this.get('controller').get('type') + 'Hour';
	}.property()
});


App.BetweenRoute = Ember.Route.extend({
	model: function(params) {
		var relations = Ember.scheduleRelations;
		if (!(relations && relations.length)) {
			return [];
		}
		var day = relations[Ember.days.indexOf(params.day)];
		if (!(day && day.length)) {
			return [];
		}
		var hour = day[Ember.hours.indexOf(params.hour)];
		var currentItem = this.modelFor('schedule').item;
		var unique = currentItem.id;
		var ids = _.without(hour, Number(unique) || unique);
		if (!ids.length) {
			return [];
		}
		var store = this.store;
		var students = ids.map(function (unique) {
			var item = store.getById('student', unique) || 
				this.store.find('student', unique);
			return {
				naam: item.get('naam'),
				klas: item.get('klas'),
				jaarlaag: item.get('jaarlaag'),
				id: item.id
			};
		});
		var filtered = [];
		_.forEach(_.groupBy(students, 'jaarlaag'), function (value, key) {
			var klasFiltered = [];
			_.forEach(_.groupBy(value, 'klas'), function (value, key) {
				klasFiltered.push({
					'klas': key,
					'students': value,
					'klas_id': '#' + key
				});
			});

			filtered.push({
				'jaarlaag': key,
				'jaarlaag_id': '#' + key,
				'jaarlaag_klassen': key + 'klassen',
				'jaarlaag_klassen_id': '#' + key + 'klassen',
				'klassen': klasFiltered,
				'eigen_jaarlaag': currentItem.get('jaarlaag') === key ? true : false
			});
		});
		filtered = _.sortBy(filtered, function (filter) {
			return filter.jaarlaag.charAt(2);
		});
		filtered.reverse();
		return filtered;
	}
});