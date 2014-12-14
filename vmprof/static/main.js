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
		.when('/:log/:func', {
			templateUrl: '/static/details.html',
			controller: 'details'
		})
		.otherwise({
			redirectTo: '/'
		});
}]);


app.controller('list', function ($scope, $http) {
	$http.get('/api/log').then(function(response) {
		$scope.logs = response.data;
	});
});

app.controller('details', function ($scope, $http, $routeParams) {

	$scope.func = $routeParams.func;

	if ($routeParams.func) {
		$http.get('/api/log/' + $routeParams.log + '/?function=' + $routeParams.func)
			.then(function(response) {
				$scope.log = response.data;
			});
	} else {
		$http.get('/api/log/' + $routeParams.log).then(function(response) {
			$scope.log = response.data;
		});
	}
});

