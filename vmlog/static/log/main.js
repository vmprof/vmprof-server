
app.directive('hoverVars', function($timeout){
  return {
    'link': function(scope, element, attrs) {
      scope.$on('trace-update', function() {
        // need the timeout, otherwise the wrong variables
        // will be selected
        $timeout(function(){
          JitLog.hoverVars.call(this, scope)
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

app.directive('liveRange', function(){
  return {
    'link': function(scope, element, attrs) {
      var jelem = jQuery(element);
      var column = parseInt(jelem.data('column'));
      var index = scope.$index;
      scope.$on('live-range-' + column, function(e, from, to, color) {
        if (from <= index && index <= to) {
          jelem.css('background-color', color);
          if (color == '') {
            jelem.height(1);
          } else {
            var jparent = jelem.parent();
            var height = jparent.parent().first().height();
            jelem.height(height);
            jparent.height(height);
          }
        }
      })
    }
  }
});

app.directive('compile', ['$compile', function ($compile) {
  return function(scope, element, attrs) {
    scope.$watch(
      function(scope) {
        return scope.$eval(attrs.compile);
      },
      function(value) {
        element.html(value);
        $compile(element.contents())(scope);
      }
   )};
}]);

app.controller('jit-trace-forest', function ($scope, $http, $routeParams, $timeout,
                                    $location, $localStorage) {
    // variable defaults
    $scope.$storage = $localStorage.$default({
      filter_loop: true,
      filter_bridge: false,
      show_asm: false,
      trace_type: 'opt',
      show_source_code: true,
      show_byte_code: false,
      sort_traces: 'count',
    })
    $scope.live_ranges = { 8: { 0: {'background-color': 'green', 'height': '20px', 'width': '2px'}} }
    $scope.loader = new Loading($scope)
    $scope.loader.start()
    $scope.selected_trace = null;
    $scope.numeral = numeral
    var lh = $scope.$storage.last_trace_hash
    if (lh !== $scope.$storage.last_trace_hash) {
      $scope.$storage.last_trace_id = null
    }
    $scope.$storage.last_trace_hash = $routeParams.log

    jitlog = new JitLog();
    jitlog.checksum = $routeParams.log
    $scope.jitlog = jitlog
    $scope.gotmeta = false
    $scope.auto_hide = {'preamble': true}

    var error = function(message) {
        $scope.error = {
          'message': message,
        }
    }

    var http_request_errored = function(response, url){
      var http = response.status + ' ' + response.statusText + '.'
        $scope.error = {
          message: response.data.message,
          url: url,
          http: http,
        }
        $scope.loader.stop()
    }

    var url = '/api/jit/meta/' + $routeParams.log + '/'
    $http.get(url, { cache: true }).then(function(response) {
      // success callback
      jitlog.set_meta(response.data)
      jitlog.add_measures('get meta', response.data)

      $scope.gotmeta = true
      var last_id = $scope.$storage.last_trace_id
      var trace = jitlog.get_trace_by_id(last_id)
      if (last_id && trace) {
        $timeout(function(){
          $scope.switch_trace(trace, $scope.$storage.trace_type, $scope.$storage.show_asm)
        })
      }

      $timeout(function(){
        $scope.$broadcast('trace-init')
        $scope.$broadcast('trace-update')
      })
      $scope.loader.stop()
    }, function(response){
      // error callback
      http_request_errored(response, url)
    });

    $scope.switch_trace = function(trace, type, asm) {
      if (typeof(trace) == "string"){
        var id = trace
        trace = $scope.jitlog.get_trace_by_id(trace)
        if (!trace) {
          error("could not switch to trace with "+id)
          return
        }
      }
      if (!$scope.loader.complete()) { return; }
      $scope.$storage.show_asm = asm
      $scope.$storage.trace_type = type
      //
      $scope.show_asm = asm
      //
      $scope.loader.start("trace")
      JitLog.resetState()
      $scope.selected_trace = null
      //
      $scope.$storage.last_trace_id = trace.get_id()
      var url = '/api/jit/trace/' + jitlog.checksum + "/?id=" + trace.get_id()
      $http.get(url, { cache: true }).then(function(response) {
        // success callback
        // set the new type and the subject trace
        jitlog.add_measures('get trace', response.data)
        trace.set_data(response.data)
        $scope.selected_trace = trace
        $timeout(function(){
          $scope.$broadcast('trace-update')
        })
      }, function(response) {
        // error callback
        http_request_errored(response, url)
      })

      var url = '/api/jit/stitches/' + jitlog.checksum + "/?id=" + trace.get_id()
      $http.get(url, { cache: true }).then(function(response) {
        // set the new type and the subject trace
        jitlog.add_measures('get stitches', response.data)
        var visual_trace = response.data
        trace_forest.display_tree($scope, trace, visual_trace)
        $scope.loader.stop()
      }, function(response) {
        // error callback
        http_request_errored(response, url)
      })
    }

    $scope.filter_and_sort_traces = function(text, loops, bridges, ordering) {
      if (!text){ text = ""; }
      //
      var type = "none"
      if (loops && bridges) { var type = "both" }
      else if (loops) { var type = "loop" }
      else if (bridges) { var type = "bridge" }
      //
      return jitlog.filter_and_sort_traces(text, type, ordering)
    }
});
