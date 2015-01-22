var app = angular.module('vmprof', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {
	// $locationProvider.html5Mode(true).hashPrefix('!');

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

	$http.get('/api/log').then(function(response) {
		$scope.logs = response.data;

		$scope.loading = false;
	});
});

app.controller('details', function ($scope, $http, $routeParams) {
	var function_name = $routeParams.function;

	$scope.loading = true;

	$http.get('/api/log/' + $routeParams.log)
		.then(function(response) {

			var profiles = response.data.data;

			$scope.func = null;
			$scope.log = response.data;
			$scope.loading = false;
			$scope.profiles = profiles.top;

			$scope.setFunction = function(func) {
				$scope.func = func;
				if (func) {
					$scope.profiles = profiles[func.id];
				} else {
					$scope.profiles = profiles.top;
				}
			}

		});
});

