var app = angular.module('vmprof', ['ngRoute'], function($routeProvider) {
    $routeProvider.when('/:vmprof_vanilla_workaround/', {
        templateUrl: '/static/vmprof-server/details.html',
        controller: 'details'
    }).otherwise({
        redirectTo: '/_/'
    });
});


app.controller('details', function ($scope, $http, $routeParams, $timeout, $q,
                                    $location) {
    angular.element('svg').remove();

    if ($scope.stats) {
        display_log($scope, $routeParams, $timeout, $location);
        return;
    }
    $scope.loading = true;

    var addrNameMapFetch = ajaxMsgpack({url: ADDR_NAME_MAP_FETCH_URL});
    var profileFetch = ajaxMsgpack({url: PROFILE_FETCH_URL});
    $q.all([addrNameMapFetch, profileFetch]).then(function ([addrNameMap, profiles]) {
      $scope.log = {data: {argv: "CPU profile"}, checksum: "_"};
      $scope.stats = new Stats({
        profiles: convertCPUProfile(addrNameMap, profiles)
      });
      display_log($scope, $routeParams, $timeout, $location);
    }, function (err) {
      showError("Error retrieving profile data", err.statusText);
    });
});


function convertCPUProfile(adr_dict, [addr, count, jitInfo, children]) {
    return [adr_dict[addr], addr, count, jitInfo,
            children.map(convertCPUProfile.bind(null, adr_dict))];
}




/*** BEGIN UNCHANGED CODE FROM VMPROF-SERVER ***/
app.filter('ago', function() {
    return function(input) {
        return moment.utc(input, 'YYYY-MM-DD HH:mm:ss').fromNow();
    };
});

function display_log($scope, $routeParams, $timeout, $location)
{
    var stats = $scope.stats;
    $scope.visualization = $routeParams.view || 'flames';

    $timeout(function () {
        $('[data-toggle=tooltip]').tooltip();
        var height = 800; //$('.table').height();
        var $visualization = $("#visualization");
        if ($visualization.length < 1)
            return;
        $scope.visualizationChange = function(visualization) {
            $scope.visualization = visualization;
            var stats = $scope.stats;
            if (visualization == 'list') {
                Visualization.listOfFunctions(
                    $("#visualization"),
                    height, $scope, $location,
                    stats.VM, true
                );
            }
            if (visualization == 'function-details') {
                Visualization.functionDetails($("#visualization"),
                    height, $routeParams.func_addr, $scope, $location);
            }
            if (visualization == 'list-2') {
                Visualization.listOfFunctions(
                    $("#visualization"),
                    height, $scope, $location,
                    stats.VM, false
                );
            }
            if (visualization == 'flames') {
                var d = stats.getProfiles($routeParams.id);
                $scope.root = d.root;
                var cutoff = d.root.total / 100;
                var addresses = $routeParams.id;
                var path_so_far;
                $scope.total_time = stats.allStats[d.root.addr].total / stats.nodes.total;
                $scope.self_time = stats.allStats[d.root.addr].self / stats.nodes.total;
                $scope.node_total_time = d.root.total / stats.nodes.total;
                $scope.node_self_time = d.root.self / stats.nodes.total;
                $scope.paths = d.paths;

                if (addresses) {
                    path_so_far = addresses.split(",");
                } else {
                    path_so_far = [];
                }
                Visualization.flameChart(
                    $("#visualization"),
                    height,
                    d.root,
                    $scope, $location,
                    cutoff, path_so_far,
                    stats.VM
                );
            }
        };

        $scope.visualizationChange($scope.visualization);
    });
    $scope.loading = false;
}
/*** END UNCHANGED CODE FROM VMPROF-SERVER ***/
