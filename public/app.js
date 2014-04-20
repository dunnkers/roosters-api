App = Ember.Application.create();

App.Router.map(function() {
	this.resource('studentSchedule', {path: ':id'}, function() {
		this.resource('hour', {path: ':dayIndex/:hourIndex'});
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

App.StudentSchedule = DS.Model.extend({
	timetable: DS.attr('timetable')
});

App.StudentScheduleController = Ember.ObjectController.extend({
	actions: {
		between: function (i, j) {
			this.transitionToRoute('hour', i, j);
		}
	}
});

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
	queryParams: ['query'],
	query: null,
	searchValue: '',
	actions: {
		search: function () {
			val = this.get('searchValue');
			if (!(val && val.length)) {
				return;
			}
			var self = this;
			Ember.engine.get(val, function (suggestions) {
				if (suggestions && suggestions.length) {
					$('#bloodhound .typeahead')
					.typeahead('val', _.first(suggestions).unique)
					.typeahead('close');

					self.transitionToRoute('studentSchedule', _.first(suggestions).id);
				}
			});
		}
	}
});

App.ApplicationRoute = Ember.Route.extend({
	init: function () {
		Ember.engine = new Bloodhound({
			datumTokenizer: Bloodhound.tokenizers.obj.whitespace('unique'),
			queryTokenizer: Bloodhound.tokenizers.whitespace,
			local: []
		});
		this.store.find('student').then(function (data) {
			Ember.engine.add(_.transform(data.content, function (result, student) {
				result.push({unique:student.id, id: student.id});
				return result.push({unique:student.get('naam'), id: student.id});
			}));
			Ember.engine.initialize();
		});
	},
	model: function(params) {
		return this.store.find('student');
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
			name: 'searchBox',
			displayKey: 'unique',
			source: Ember.engine.ttAdapter()
		}).on('typeahead:selected', function (event, item) {
			self.get('controller').set('searchValue', item.unique);
		}).on('typeahead:autocompleted', function (event, item) {
			self.get('controller').set('searchValue', item.unique);
		}).focus();
	}
});

App.StudentScheduleRoute = Ember.Route.extend({
	init: function () {
		//
		$.getJSON('https://api-roosters.rhcloud.com/studentScheduleRelations').then(function (data) {
			Ember.studentScheduleRelations = data.relations;
		});
	},
	model: function(params) {
		return Ember.RSVP.hash({
			schedule: this.store.find('studentSchedule', params.id),
			student: this.store.find('student', params.id)
		});
	}
});

App.HourRoute = Ember.Route.extend({
	model: function(params) {
		function error () {
			return [{
				error: true,
				message: 'Niets gevonden'
			}];
		}

		var relations = Ember.studentScheduleRelations;
		if (!(relations && relations.length)) {
			return error();
		}
		var day = relations[params.dayIndex];
		if (!(day && day.length)) {
			return error();
		}
		var hour = day[params.hourIndex];
		var unique = this.modelFor('studentSchedule').student.id;
		var ids = _.without(hour, Number(unique) || unique);
		if (!ids.length) {
			return error();
		}
		var store = this.store;
		var students = ids.map(function (unique) {
			var student = store.getById('student', unique) || 
				this.store.find('student', unique);
			return {
				naam: student.get('naam'),
				klas: student.get('klas'),
				jaarlaag: student.get('jaarlaag'),
				id: student.id
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
				'klassen': klasFiltered
			});
		});
		filtered = _.sortBy(filtered, function (filter) {
			return filter.jaarlaag.charAt(2);
		});
		filtered.reverse();
		return filtered;
	}
});