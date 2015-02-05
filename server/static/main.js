var app = angular.module('vmprof', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {

	$routeProvider
		.when('/', {
			templateUrl: '/static/list.html',
			controller: 'list'
		})
		.when('/help', {
			templateUrl: '/static/help.html',
		})
		.when('/:log', {
			templateUrl: '/static/details.html',
			controller: 'details'
		})
		.otherwise({
			redirectTo: '/'
		});
}]);


app.controller('list', function ($scope, $http) {
	$scope.loading = true;

	$http.get('/api/log/').then(function(response) {
		$scope.logs = response.data;

		$scope.loading = false;
	});
});

app.controller('details', function ($scope, $http, $routeParams, $timeout) {
	var function_id = $routeParams.id;

	$scope.loading = true;

	$http.get('/api/log/' + $routeParams.log + '/', {
		cache: true
	}).then(function(response) {

		var log = response.data;

		$scope.log = log;

		var profiles = log.data.profiles;
		var addresses = log.data.addresses;

		var functions = {};

		profiles.forEach(function(profile) {
			var currentIteration = {};
			profile[0].forEach(function(address) {
				if(!(address in currentIteration)) {
					if(address in functions) {
						functions[address] += 1;
					} else {
						functions[address] = 1;
					}
					currentIteration[address] = null;
				}
			});
		});

		var top = [];
		for (address in functions) {
			var nameSegments = addresses[address].split(":");
			top.push({
				address: address,
				name: nameSegments[1],
				line: nameSegments[2],
				file: nameSegments[3],
				times: functions[address],
			});
		}

		top.sort(function(a, b) {
			return b.times - a.times;
		})

		var max = top[0].times;

		top = top.map(function(a) {
			a.times = a.times / max * 100;
			return a;
		})

		$scope.currentProfiles = top;

			 // functions.forEach(function(func) {
			// debugger
			// if() {
			// }
		// })
		// for(var i=0; i<profiles.length; i++) {
		// 	var profile = profiles[i];

		// 	for(var j=0; j<profile[0].length) {
		// 		var address =
		// 	}
		// })


		// var data = response.data.data;

		// $scope.profiles = data.profiles;

		// if(function_id) {
		// 	$scope.currentProfiles = data.calls[function_id];
		// 	$scope.currentFunction = data.profiles[function_id];
		// } else {
		// 	$scope.currentProfiles = data.head;
		// 	$scope.currentFunction = null;
		// }

		// if ($scope.currentProfiles.length > 0) {

		$timeout(function () {
			var drawProfiles = $scope.currentProfiles.slice(1);
			var times = $.map(drawProfiles, function(val, i) {
				return val.times;
			});

			var labels = $.map(drawProfiles, function(val, i) {
				return val.name;
			});

			var height = $('.table').height();
			var width = $("#treemap").width();

			var boxFormatter = function (coordinates, index) {

				var color = 255 - times[index[0]] - 123;
				color = "rgb("+ color + ","+ color +","+ color +")";
				return { "fill" : color };
			};

			Treemap.draw("treemap", width, height,
						 times, labels, {'box' : boxFormatter});

		});

		$scope.loading = false;
	});
});

