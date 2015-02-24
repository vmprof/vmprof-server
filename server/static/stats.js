var Stats = function (data) {
	this.profiles = data.profiles;
	this.addresses = data.addresses;
};

Stats.prototype.process = function(functions, total) {

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
	var max = total || top[0].times;

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

	return this.process(functions, total);
};

var Node = function(addr, name) {
	this.children = [];
	this.addr = addr;
	this.name = name;
	this.total = 0;
	this.self = 0;
};

Node.prototype.add_child = function(addr, name, is_leaf) {
	var child = this.children[addr];
	if (!child) {
		child = new Node(addr, name);
		this.children[addr] = child;
	}
	child.total++;
	if (is_leaf) {
		child.self++;
	}
	return child;
}

Stats.prototype.get_tree = function() {
	var addr = this.profiles[0][0][0];
	var name = this.addresses[addr];
	var top = new Node(addr, name);
	for (var index in this.profiles) {
		var cur = top;
		profile = this.profiles[index][0];
		for (var i = 1; i < profile.length; i++) {
			var v = profile[i];
			cur = cur.add_child(v, this.addresses[v], i == profile.length - 1);
		}
	}
	return top;
};