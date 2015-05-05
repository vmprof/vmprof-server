var app = angular.module('vmprof', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {

    $routeProvider
        .when('/', {
            templateUrl: '/static/list.html',
            controller: 'list'
        })
	    .when('/login', {
            templateUrl: '/static/login.html',
            controller: 'login'
        })
		.when('/register', {
            templateUrl: '/static/register.html',
            controller: 'register'
        })
        .when('/:log', {
            templateUrl: '/static/details.html',
            controller: 'details'
        })
        .otherwise({
            redirectTo: '/'
        });
}]);


app.controller('login', function ($scope, $http) {
	$scope.user = {
		username: "",
		password: ""
	};

	$scope.submit = function() {
		$http.post('/api/user/', $scope.user).then(function(response) {
			debugger
		});
	}

});

app.controller('register', function ($scope) {

});



app.controller('list', function ($scope, $http) {
    angular.element('svg').remove();

    $scope.loading = true;

    $http.get('/api/log/').then(function(response) {
        $scope.logs = response.data;

        $scope.loading = false;
    });
});

app.controller('details', function ($scope, $http, $routeParams, $timeout,
                                    $location) {
    angular.element('svg').remove();

    $scope.loading = true;

    $http.get('/api/log/' + $routeParams.log + '/', {
        cache: true
    }).then(function(response) {
        $scope.log = response.data;

        var addresses = $routeParams.id;
        var path_so_far;

        if (addresses) {
            path_so_far = addresses.split(",");
        } else {
            path_so_far = [];
        }

        var stats = new Stats(response.data.data);
        global_stats = stats;
        var root = stats.nodes;
        $scope.visualization = $routeParams.view || 'flames';
        var d = stats.getProfiles($routeParams.id);

        $scope.currentProfiles = d.profiles;
        $scope.root = d.root;
        $scope.total_time = stats.allStats[d.root.addr].total / stats.nodes.total;
        $scope.self_time = stats.allStats[d.root.addr].self / stats.nodes.total;
        $scope.paths = d.paths;

        $timeout(function () {
            $('[data-toggle=tooltip]').tooltip();
            var height = 800; //$('.table').height();
            var $visualization = $("#visualization");
            if ($visualization.length < 1)
                return;
            $scope.visualizationChange = function(visualization) {

                $scope.visualization = visualization;
                var cutoff = d.root.total / 100;
                if (visualization == 'squares') {
                    Visualization.squareChart(
                        $("#visualization"),
                        height,
                        d.root,
                        $scope, $location, path_so_far
                    );
                }
                if (visualization == 'flames') {
                    Visualization.flameChart(
                        $("#visualization"),
                        height,
                        d.root,
                        $scope, $location,
                        cutoff, path_so_far
                    );
                }
            };

            $scope.visualizationChange($scope.visualization);
        });

        $scope.loading = false;
    });
});

