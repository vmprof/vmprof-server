var app = angular.module('vmprof', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {

	$routeProvider
		.when('/', {
			templateUrl: '/static/list.html',
			controller: 'list'
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
	angular.element('svg').remove();

	$scope.loading = true;

	$http.get('/api/log/').then(function(response) {
		$scope.logs = response.data;

		$scope.loading = false;
	});
});

app.controller('details', function ($scope, $http, $routeParams, $timeout, $location) {
	angular.element('svg').remove();

	$scope.loading = true;

	$http.get('/api/log/' + $routeParams.log + '/', {
		cache: true
	}).then(function(response) {
		$scope.log = response.data;

		var addresses = $routeParams.id;

		var stats = new Stats(response.data.data);

		if (addresses) {
			$scope.currentProfiles = stats.getSubProfiles($routeParams.id);
			$scope.name = stats.addresses[$routeParams.id];
		} else {
			$scope.currentProfiles = stats.getTopProfiles();
		}

		$scope.visualization = 'squares';
		var root = stats.getTree(addresses);


		$timeout(function () {

			var height = $('.table').height();

			Visualization.squareChart($("#visualization"), height, root, stats,
									  $scope, $location);

			$scope.visualizationChange = function(visualization) {
				if ($scope.visualization == visualization)
					return

				$scope.visualization = visualization;
				if (visualization == 'squares') {
					Visualization.squareChart(
						$("#visualization"),
						height,
						root,
						stats,
						$scope, $location
					);
				}
				if (visualization == 'flames') {
					Visualization.flameChart(
						$("#visualization"),
						height,
						root,
						$scope, $location
					);
				}
			}
		});

		$scope.loading = false;
	});
});

