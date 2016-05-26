var app = angular.module(
    'vmprof', ['ngRoute', 'ngCookies', 'ngSanitize', 'ngStorage'], function($routeProvider) {

        $routeProvider
            .when('/', {
                templateUrl: '/static/list.html',
                controller: 'list'
            })
            .when('/login', {
                templateUrl: '/static/login.html',
                controller: 'login'
            })
            .when('/logout', {
                resolve: {
                    redirect: function($location, AuthService){
                        AuthService.logout().then(function() {
                            $location.path('/');
                        });
                    }
                }
            })
            .when('/register', {
                templateUrl: '/static/register.html',
                controller: 'register'
            })
            .when('/profile', {
                templateUrl: '/static/profile.html',
                controller: 'profile'
            })
            .when('/:log', {
                templateUrl: '/static/details.html',
                controller: 'details'
            })
            .when('/:log/traces', {
                templateUrl: '/static/traces.html',
                controller: 'jit-trace-forest'
            })
            .otherwise({
                redirectTo: '/'
            });

    }).factory('AuthService', function ($http, $cookies) {
        var authService = {};

        authService.login = function (credentials) {
            var d = $http.post('/api/user/', credentials);

            d.then(function (res) {
                $cookies.user = JSON.stringify(res.data);
                return res.data;
            });

            return d;
        };

        authService.logout = function() {
            return $http.delete('/api/user/').then(function () {
                delete $cookies.user;
            });
        };

        authService.isAuthenticated = function () {
            return !!Session.userId;
        };

        return authService;

    });

app.config(['$httpProvider', function($httpProvider) {
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
    $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
}]);

app.config(function ($httpProvider) {
    $httpProvider.interceptors.push([
        '$injector',
        function ($injector) {
            return $injector.get('AuthInterceptor');
        }
    ]);
});

app.factory('AuthInterceptor', function ($rootScope, $q, $location, $cookies) {
    return {
        responseError: function (response) {
            if (response.status == 403 &&
                response.config.method != "DELETE" &&
                response.config.url != "/api/user/") {
                delete $cookies.user;
                $location.path('/');
            }
            return $q.reject(response);
        }
    };
});

app.filter('ago', function() {
    return function(input) {
        return moment.utc(input, 'YYYY-MM-DD HH:mm:ss').fromNow();
    };
});

app.controller('main', function ($scope, $cookies, $location, $http, AuthService) {
    $scope.user = $cookies.user ? JSON.parse($cookies.user) : null;

    if ($scope.user == null) {
        AuthService.logout();
    }

    $scope.$watch(function() { return $cookies.user; }, function(newValue) {
        $scope.user = $cookies.user ? JSON.parse($cookies.user) : null;
    });

    $scope.setUser = function (user) {
        $scope.user = user;
    };

});

app.controller('profile', function ($scope, $http) {

    function getToken() {
        $http.get('/api/token/').then(function(response) {
            if (response.data.length) {
                $scope.token = response.data[0];
            }
        });
    }

    getToken();

    $scope.generate = function() {
        $http.post('/api/token/').then(function(response) {
            getToken();
        });
    };

});


app.controller('login', function ($scope, $http, $location, AuthService) {

    $scope.user = {
        username: "",
        password: ""
    };

    $scope.submit = function() {
        AuthService.login($scope.user)
            .success(function(data, status, headers, config) {
                $location.path('/');
            })
            .error(function(data, status, headers, config) {
                $scope.error = true;
            });
    };
});

app.controller('register', function ($scope, $http, $location, AuthService) {
    $scope.ready = false;

    $scope.user = {
        username: "",
        password: "",
        email: ""
    };

    $scope.repeated = {
        email: "",
        password: ""
    };

    $scope.repeatedError = {
        email: "",
        password: ""
    };

    $scope.$watch(function() {return [$scope.user, $scope.repeated]}, function(items) {

        var user = items[0];
        var repeated = items[1];

        var emailValid = false;
        var passwordValid = false;

        if (user.email !== repeated.email) {
            $scope.repeatedError.email = "Repeated email does not match";
        } else {
            $scope.repeatedError.email = "";
            emailValid = true;
        }

        if (user.password !== repeated.password) {
            $scope.repeatedError.password = "Repeated password does not match";
        } else {
            $scope.repeatedError.password = "";
            passwordValid = true;
        }

        if (user.username.length > 0 && user.password.length > 0 && user.email.length > 0 &&
            emailValid && passwordValid) {
            $scope.ready = true;
        } else {
            $scope.ready = false;
        }

    }, true);

    $scope.submit = function() {
        $http.put('/api/user/', $scope.user)
            .success(function(response) {
                AuthService.login($scope.user).then(function() {
                    $location.path('/');
                });
            })
            .error(function(error) {
                $scope.error = error;
            });
    };

});


app.controller('list', function ($scope, $http, $interval) {
    angular.element('svg').remove();

    $scope.fetchAll = "";

    $scope.getLogs = function(showLoading) {
        if(showLoading) {
            $scope.loading = true;
        }
        $http.get('/api/log/', {params: {all:$scope.fetchAll}})
            .then(function(response) {
                $scope.logs = response.data.results;
                $scope.next = response.data.next;
                $scope.loading = false;
            });
    };


    $scope.more = function(next) {
        $http.get(next, {params: {all:$scope.fetchAll}})
            .then(function(response) {
                $scope.logs.push.apply($scope.logs,
                                       response.data.results);
                $scope.next = response.data.next;
            });

    };
    $scope.getLogs(true);

    $scope.background = function(time) {
        var seconds = moment.utc().diff(moment.utc(time, 'YYYY-MM-DD HH:mm:ss'), 'seconds');

        if (seconds > 500) {
            return {};
        }
        var color = Math.floor(205 + (seconds / 10));

        return {background: "rgb(255,255,"+ color +")"};
    };

});

app.controller('details', function ($scope, $http, $routeParams, $timeout,
                                    $location) {
    angular.element('svg').remove();

    $scope.loading = true;
    $http.get('/api/log/' + $routeParams.log + '/', {
        cache: true
    }).then(function(response) {
        $scope.log = response.data;
        $scope.has_jitlog = response.data.data.jitlog !== undefined

        var profiles = response.data.data.profiles || []
        if (profiles.length == 0) {
          $scope.loading = false;
          $scope.noprofile = true;
          // there is no profile (there might be jitlog though)
          return;
        }

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
        $scope.node_total_time = d.root.total / stats.nodes.total;
        $scope.node_self_time = d.root.self / stats.nodes.total;
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
                        cutoff, path_so_far,
                        stats.VM
                    );
                }
            };

            $scope.visualizationChange($scope.visualization);
        });

        $scope.loading = false;
    });
});

app.directive('hoverVars', function($timeout){
  return {
    'link': function(scope, element, attrs) {
      scope.$on('trace-update', function() {
        // need the timeout, otherwise the wrong variables
        // will be selected
        $timeout(function(){
          JitLog.hoverVars.call(this)
        });
      });
    }
  }
});

app.directive('traceForest', function($timeout){
  return {
    'link': function(scope, element, attrs) {
      scope.$on('trace-init', function() {
        trace_forest = new TraceForest(jitlog)
        trace_forest.setup_once('#forest');
      })
    }
  }
});

app.controller('jit-trace-forest', function ($scope, $http, $routeParams, $timeout,
                                    $location, $localStorage) {
    // variable defaults
    $scope.$storage = $localStorage.$default({
      filter_loop: true,
      filter_bridge: false,
      show_asm: true,
    })
    $scope.loading = true;
    $scope.ops = []
    $scope.trace_type = 'asm'
    $scope.selected_trace = null;
    var lh = $scope.$storage.last_trace_hash
    if (lh !== $scope.$storage.last_trace_hash) {
      $scope.$storage.last_trace_id = null
    }
    $scope.$storage.last_trace_hash = $routeParams.log

    $http.get('/api/log/' + $routeParams.log + '/', {
        cache: true
    }).then(function(response) {
        $scope.log = response.data;
        jitlog = new JitLog(response.data.data.jitlog);
        jitlog.trace_type = $scope.trace_type
        $scope.traces = jitlog.filter_traces("", true, false)
        $scope.jitlog = jitlog
        //
        // if a trace id has been provided display it right away
        //
        if ($routeParams.trace !== undefined) {
          var trace = jitlog.get_trace_by_id($routeParams.trace);
          $scope.ops = trace.get_operations('asm').list()
          $scope.trace_type = 'asm'
          $scope.selected_trace = trace
        }
        $scope.loading = false;
        $timeout(function(){
          $scope.$broadcast('trace-init')
          $scope.$broadcast('trace-update')
        })

        var last_id = $scope.$storage.last_trace_id
        var trace = jitlog.get_trace_by_id(last_id)
        if (last_id && trace) {
          $timeout(function(){
            $scope.switch_trace(trace, $scope.trace_type)
          })
        }
    });

    $scope.switch_trace = function(trace, type) {
      if ($scope.loading) { return; }
      // set the new type and the subject trace
      JitLog.resetState()
      $scope.trace_type = type
      jitlog.trace_type = type
      $scope.selected_trace = trace
      $scope.$broadcast('trace-update')
      trace_forest.display_tree($scope, trace)
      //
      $scope.$storage.last_trace_id = trace.get_id()
    }

    $scope.filter_traces = function(text, loops, bridges) {
      if (!text){ text = ""; }
      //
      var type = "none"
      if (loops && bridges) { var type = "both" }
      else if (loops) { var type = "loop" }
      else if (bridges) { var type = "bridge" }
      //
      return jitlog.filter_traces(text, type)
    }
});
