var Stats = function (data) {
	this.argv = data.argv;
	this.nodes = this.makeTree(data.profiles);
};


Stats.prototype.makeTree = function(t) {
	var n = new Node(t[0], t[1], t[2], t[3]);
	return n;
};

function Node(name, addr, total, children) {
	this.total = total;
	this.name = name;
	this.addr = addr;
	this.children = [];
	for (var i in children) {
		c = children[i];
		this.children[i] = new Node(c[0], c[1], c[2], c[3]);
	}
	this.self = this.count_self();
}

Node.prototype.count_self = function () {
	var s = this.total;
	for (var i in this.children) {
		c = this.children[i];
		s -= c.total;
	}
	return s;
};

Stats.prototype.getProfiles = function(path) {
	var total = this.nodes.total;
	var nodes = this.nodes;
	if (!path) {
		path = [];
	} else {
		path = path.split(",");
	}
	var path_so_far = [];
	var paths = [];
	for (var i in path) {
		var elem = path[i];
		total = nodes.total;
		paths.push({'name': nodes.name.split(":", 2)[1],
					'path':path_so_far.toString(),
					"percentage": nodes.total / this.nodes.total});
		path_so_far.push(elem);
		nodes = nodes.children[elem];
	}
	paths.push({'name': nodes.name.split(":", 2)[1],
				'path':path_so_far.toString(),
				"percentage": nodes.total / this.nodes.total });
	return this.process(nodes.children, total, this.nodes.total, path, paths);
};


Stats.prototype.process = function(functions, parent, total, path_so_far, paths) {
	if(Object.keys(functions).length == 0) {
		return []
	}

	var top = [];

	for (var i in functions) {
		var func = functions[i];
		var nameSegments = func.name.split(":");
		var file;
		if (nameSegments.length > 4) {
			file = nameSegments.slice(4, nameSegments.length).join(":");
		} else {
			file = nameSegments[3];
		}
		var path;
		if (path_so_far.length == 0) {
			path = i.toString();
		} else {
			path = path_so_far + "," + i.toString();
		}
		top.push({
			path: path,
			name: nameSegments[1],
			line: nameSegments[2],
			file: file,
			times: func.total,
			self: func.self / total * 100,
		});
	}

	top.sort(function(a, b) {
		return b.times - a.times;
	})
	var max = parent || top[0].times;

	return {'profiles': top.map(function(a) {
		a.total = a.times / total * 100;
		a.times = a.times / max * 100;
		return a;
	}), 'paths': paths};

};

///////////////////////

Stats.prototype.generateTree = function() {
	var nodes = {};
	var addr = this.profiles[0][0][0];
	var name = this.addresses[addr];
	var top = new Node(addr, name);

	nodes[addr] = top;

	for (var index in this.profiles) {
		var cur = top;
		profile = this.profiles[index][0];
		for (var i = 1; i < profile.length; i++) {
			var v = profile[i];
			cur = cur.addChild(v, this.addresses[v], i == profile.length - 1);
			nodes[v] = cur;
		}
	}
	return nodes;
};

Stats.prototype.getTopProfiles = function() {
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

Stats.prototype.getSubProfiles = function(topAddress) {
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


var XxNode = function(addr, name) {
	this.children = {};
	this.addr = addr;
	this.name = name;
	this.total = 0;
	this.self = 0;
};


XxNode.prototype.addChild = function(addr, name, is_leaf) {
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


Stats.prototype.getTree = function(address) {
	var address = address || this.profiles[0][0][0];
	return this.nodes[address];
}
