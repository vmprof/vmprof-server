var Stats = function (data) {
	this.profiles = data.profiles;
	this.addresses = data.addresses;
};

Stats.prototype.process = function(functions) {

	if(Object.keys(functions).length == 0) {
		return []
	}

	var top = [];

	for (address in functions) {
		var nameSegments = this.addresses[address].split(":");
		top.push({
			address: address,
			name: nameSegments[1],
			line: nameSegments[2],
			file: nameSegments[3],
			times: functions[address],
		});
	}

	top.sort(function(a, b) {
		return b.times - a.times;
	})
	var max = top[0].times;

	return top.map(function(a) {
		a.times = a.times / max * 100;
		return a;
	})

};

Stats.prototype.top = function() {
	var functions = {};

	this.profiles.forEach(function(profile) {
		var currentIteration = {};
		profile[0].forEach(function(address) {
			if(!(address in currentIteration)) {
				if(address in functions) {
					functions[address] += 1;
				} else {
					functions[address] = 1;
				}
				currentIteration[address] = null;
			}
		}, this);
	}, this);

	return this.process(functions);
};

Stats.prototype.profile = function(topAddress) {
	var functions = {}
	var total = 0
	this.profiles.forEach(function(profile) {
		var currentIteration = {};
		var counting = false;
		profile[0].forEach(function(address) {
			if (counting) {
				if(!(address in currentIteration)) {
					currentIteration[address] = null;
					if(address in functions) {
						functions[address] += 1;
					} else {
						functions[address] = 1;
					}
				}
			} else {
				if (address == topAddress) {
					counting = true
					total += 1;
				}
			}
		}, this);

	}, this);

	return this.process(functions);
};
