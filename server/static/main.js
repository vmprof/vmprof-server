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
        global_stats = stats;
		var root = stats.nodes;
		$scope.visualization = 'squares';
		var d = stats.getProfiles($routeParams.id);
		$scope.currentProfiles = d.profiles;
        $scope.root = d.root;
        $scope.total_time = stats.allStats[d.root.addr].total / stats.nodes.total;
        $scope.self_time = stats.allStats[d.root.addr].self / stats.nodes.total;
		$scope.paths = d.paths;

		$timeout(function () {

			var height = 800; //$('.table').height();
			var $visualization = $("#visualization");
			if ($visualization.length < 1)
		 		return;
			return;
			$scope.visualizationChange = function(visualization) {
				
		 		$scope.visualization = visualization;
		 		if (visualization == 'squares') {
		 			Visualization.squareChart(
		 				$("#visualization"),
		 				height,
		 				root,
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
		 	};

		 	$scope.visualizationChange($scope.visualization);
		});

		$scope.loading = false;
	});
});

