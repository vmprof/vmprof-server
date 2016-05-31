
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

    jitlog = new JitLog();
    jitlog.checksum = $routeParams.log
    $scope.jitlog = jitlog

    $http.get('/api/log/meta/' + $routeParams.log + '/', {
        cache: true
    }).then(function(response) {
      jitlog.set_meta(response.data)
      //$scope.meta = response.data

      //$scope.log = response.data;
      jitlog.trace_type = $scope.trace_type
      $scope.traces = jitlog.filter_traces("", true, false)
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
      $scope.loading = true
      //
      $scope.$storage.last_trace_id = trace.get_id()
      $http.get('/api/log/trace/' + jitlog.checksum + "/?id=" + trace.get_id(), {
          cache: true
      }).then(function(response) {
        // set the new type and the subject trace
        JitLog.resetState()
        $scope.trace_type = type
        jitlog.trace_type = type
        trace.set_data(response.data)
        $scope.selected_trace = trace
        $scope.$broadcast('trace-update')
        trace_forest.display_tree($scope, trace)
        $scope.loading = false
      })
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
