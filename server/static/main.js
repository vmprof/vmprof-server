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

app.controller('details', function ($scope, $http, $routeParams, $timeout) {
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

		$scope.paper = null

		$timeout(function () {

			var $treemap = $("#treemap");
			if ($treemap.length == 0)
				return

			var node = stats.getTree(addresses);
			var $table = $('.table');

			var height = $table.height();
			var width = $treemap.width();
			var x = $treemap.offset().left;
			var y = $treemap.offset().top;

			$scope.paper = Raphael(x, y, width, height);

			function draw(x, y, width, height, node, scale) {
				var scale = scale || scale;

				var rect = $scope.paper.rect(x, y, width, height);
				rect.attr({fill: '#9cf', stroke: '#888', 'stroke-width': 2});
				rect.data('address', node.addr);

				rect.hover(
					function(e) {
						var address = this.data('address');
						$scope.$apply(function () {
							$scope.address = address;
						});
						this.attr({'fill': 'red'});
					},
					function(e) {
						this.attr({'fill': '#9cf'});
						$scope.$apply(function () {
							$scope.address = null;
						});
					}
				);

				if (node.total == node.self) {
					var scale = 1;
				} else {
					var scale = 1 - (node.self / node.total);
				}

				if (_.keys(node.children).length == 1) {
					var node = node.children[Object.keys(node.children)[0]];
					var box = rect.getBBox();

					draw(box.x, box.y, box.width, box.height, node);

				} else if (_.keys(node.children).length > 1) {
					var times = [];
					var names = [];
					var addresses = [];
					var children = [];

					for (var child in node.children) {
						var child = node.children[child];
						times.push(child.self);
						addresses.push(child.addr);
						names.push(stats.addresses[child.addr]);
						children.push(child);
					}

					var xd = (width - (width * scale)) / 2;
					var yd = (height - (height * scale)) / 2;


					var width = width * scale;
					var height = height * scale;

					var boxes = Treemap.generate(
						addresses, names, times,
						width,
						height, x+xd, y+yd
					);


					for (var i = 0; i < boxes.length; i++) {
						var box = boxes[i];
						var x1=box.square[0],
							y1=box.square[1],
							x2=box.square[2],
							y2=box.square[3];

						draw(x1, y1, x2-x1, y2-y1, children[i]);
					}
				}
			}
			draw(0, 0, width, height, node);

		});

		$scope.loading = false;
	});
});

