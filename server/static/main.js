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
		$scope.log = response.data;

		var stats = new Stats(response.data.data);

		if ($routeParams.id) {
			$scope.currentProfiles = stats.profile($routeParams.id);
		} else {
			$scope.currentProfiles = stats.top();
		}

		if ($scope.currentProfiles.length > 0) {

			$timeout(function () {
				var drawProfiles = $scope.currentProfiles
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
		}

		$scope.loading = false;
	});
});

