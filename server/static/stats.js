var Stats = function (data) {
	this.argv = data.argv;
	this.nodes = this.makeTree(data.profiles);
};

var FunctionData = function (elem) {
    this.total = 0;
    this.self = 0;
    this.name = elem.name;
    this.update(elem);
};

FunctionData.prototype.update = function(node) {
    if (this.name != node.name) {
    }
    this.total += node.total;
};

Stats.prototype.makeTree = function(t) {
	var n = new Node(t[0], t[1], t[2], t[3], t[4]);
    allStats = [];
    n.walk(function (elem, accum) {
        if (accum[elem.addr]) {
            return 0;
        }
        accum = clone(accum);
        accum[elem.addr] = "a"; // non-zero length
        if (allStats[elem.addr] === undefined) {
            allStats[elem.addr] = new FunctionData(elem);
        } else {
            allStats[elem.addr].update(elem);
        }
        return 1;
    }, []);
    n.walk(function (elem, ignored) {
        allStats[elem.addr].self += elem.self;
        return 1;
    });
    this.allStats = allStats;
	return n;
};

function Node(name, addr, total, meta, children) {
	this.total = total;
	this.name = name;
	this.addr = addr;
    this.meta = meta;
	this.children = [];
	for (var i in children) {
		c = children[i];
		this.children[i] = new Node(c[0], c[1], c[2], c[3], c[4]);
	}
    var c = {};
    this.cumulative_meta = this.countCumulativeMeta(c);
	this.self = this.count_self();
};

Node.prototype.countCumulativeMeta = function (c) {
    for (var key in this.meta) {
        var value = this.meta[key];
        if (c[key]) {
            c[key] += value;
        } else {
            c[key] = value;
        }
    }
    for (var i in this.children) {
        this.children[i].countCumulativeMeta(c);
    }
    return c;
};

function dict_get(d, v, _default)
{
    var item = d[v];
    if (item === undefined) {
        return _default;
    }
    return item;
}

Node.prototype.green = function() {
    return dict_get(this.cumulative_meta, "jit", 0) / this.total;
};

Node.prototype.red = function() {
    return 1 - this.green() - this.yellow();
};

Node.prototype.yellow = function() {
    return (dict_get(this.cumulative_meta, "tracing", 0) + dict_get(this.cumulative_meta, "blackhole", 0)) / this.total;
};

Node.prototype.blackhole = function() {
    return dict_get(this.cumulative_meta, "blackhole", 0) / this.total;
};

Node.prototype.tracing = function() {
    return dict_get(this.cumulative_meta, "tracing", 0) / this.total;
};

Node.prototype.yellow = function() {
    return (dict_get(this.cumulative_meta, "tracing", 0) + dict_get(this.cumulative_meta, "blackhole", 0)) / this.total;
};

Node.prototype.gc = function() {
    return (dict_get(this.cumulative_meta, "gc:major", 0) + dict_get(this.cumulative_meta, "gc:minor", 0)) / this.total;
};

Node.prototype.gc_minor = function() {
    return dict_get(this.cumulative_meta, "gc:minor", 0) / this.total;
};

Node.prototype.gc_major = function() {
    return dict_get(this.cumulative_meta, "gc:major", 0) / this.total;
};

function clone(a) {
    // JS is idiotic
    var new_a = [];
    for (var i in a) {
        new_a[i] = a[i];
    }
    return new_a;
}

Node.prototype.walk = function(cb, accum) {
    if (!cb(this, accum)) {
        return;
    }
    for (var i in this.children) {
        c = this.children[i];
        c.walk(cb, clone(accum));
    }
};

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
	var res = this.process(nodes.children, total, this.nodes.total, path,
                           paths);
    res.root = nodes;
    return res;
};

function split_name(name) {
	var nameSegments = name.split(":");
	var file;
	if (nameSegments.length > 4) {
		file = nameSegments.slice(4, nameSegments.length).join(":");
	} else {
		file = nameSegments[3];
	}
    return {file: file, funcname:nameSegments[1], line: nameSegments[2]};
}

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
