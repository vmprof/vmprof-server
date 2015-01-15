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
	$scope.function_name = function_name;

	if (function_name) {
		$http.get('/api/log/' + $routeParams.log + '/?function=' + function_name)
			.then(function(response) {
				$scope.log = response.data;
				$scope.loading = false;
			});
	} else {
		$http.get('/api/log/' + $routeParams.log)
			.then(function(response) {
				$scope.log = response.data;
				$scope.loading = false;
		});
	}
});
