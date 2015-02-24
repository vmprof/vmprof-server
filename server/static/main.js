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
	$scope.loading = true;

	$http.get('/api/log/').then(function(response) {
		$scope.logs = response.data;

		$scope.loading = false;
	});
});

app.controller('details', function ($scope, $http, $routeParams, $timeout) {
	var function_id = $routeParams.id;

	$scope.loading = true;

	$http.get('/api/log/' + $routeParams.log + '/', {
		cache: true
	}).then(function(response) {
		$scope.log = response.data;

		var stats = new Stats(response.data.data);

		if ($routeParams.id) {
			$scope.currentProfiles = stats.getSubProfiles($routeParams.id);
			// debugger
		} else {
			$scope.currentProfiles = stats.getTopProfiles();
		}

		if ($scope.currentProfiles.length > 0) {

			$timeout(function () {

				var $table = $('.table');
				var $treemap = $("#treemap");

				var height = $table.height();
				var width = $treemap.width();
				var x = $treemap.offset().left;
				var y = $treemap.offset().top;

				var profiles = $scope.currentProfiles

				var paper = Raphael(x, y, width, height);

				function draw(x, y, width, height, profiles, time) {
					var time = time || 100;
					var times = [];
					var names = [];
					var addresses = [];

					$.each(profiles, function(_, val) {
						times.push(val.times);
						names.push(val.name);
						addresses.push(val.address);
					});

					var boxes = Treemap.generate(
						addresses, names, times, width, height);

					$.each(boxes, function(i, box) {
						// debugger
						var x1=box.square[0],
							y1=box.square[1],
							x2=box.square[2],
							y2=box.square[3];
						console.log(box)
						times
						time
						boxes

						var rect = paper.rect(x1, y1, x2 - x1, y2 - y1);
						// rect.attr({
						// 	fill: '#9cf',
						// 	stroke: '#ddd'
						// });
						var text = paper.text(
							(x1 + x2) / 2, (y1 + y2) / 2, box.name);

						if(text.getBBox().width > x2-x1 &&
						   text.getBBox().width <= y2-y1) {
							text.rotate(-90);
						}

						console.log(box.name, x+x1, y+y1, x1+x2, y1+y2)
						var subProfiles = stats.getSubProfiles(box.address);
						if (subProfiles.length) {
							draw(x+x1, y+y1, x1+x2, y1+y2, subProfiles);
						}
						// debugger
						// console.log("=============")
						// return true
					});
				}

				// draw(0, 0, width, height, profiles.slice(0, 1));
				draw(0, 0, width, height, profiles);

				// var boxFormatter = function (coordinates, index) {
				// 	var color = 255 - times[index[0]] - 123;
				// 	color = "rgb("+ color + ","+ color +","+ color +")";
				// 	return { "fill" : color };
				// };


					// stats.profile(box.address);
					// debugger


				// debugger

				// var paper = Raphael(10, 50, 320, 200);

				// Treemap.draw("treemap", width, height,
							 // times, labels, {'box' : boxFormatter});
			});
		}

		$scope.loading = false;
	});
});

