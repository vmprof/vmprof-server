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

app.controller('details', function ($scope, $http, $routeParams) {
	var function_id = $routeParams.id;

	$scope.loading = true;

	$http.get('/api/log/' + $routeParams.log + '/', {
		cache: true
	}).then(function(response) {

		$scope.log = response.data;

		var data = response.data.data;

		$scope.profiles = data.profiles;

		if(function_id) {
			$scope.currentProfiles = data.calls[function_id];
			$scope.currentFunction = data.profiles[function_id];
		} else {
			$scope.currentProfiles = data.head;
			$scope.currentFunction = null;
		}

		$scope.loading = false;

		});
});

