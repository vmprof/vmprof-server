var Stats = function (data) {
	this.argv = data.argv;
	this.VM = data.VM || "cpython";
	this.nodes = this.makeTree(data.profiles);
};

var FunctionData = function (elem) {
    this.total = 0;
    this.self = 0;
    this.name = elem.name;
    this.addr = elem.addr;
};

FunctionData.prototype.update = function(node) {
    this.total += node.total;
};

function walk_recursive(allStats, n, accum)
{
    if (accum[n.addr]) {
        return;
    }
    accum = clone(accum);
    accum[n.addr] = "a";
    if (allStats[n.addr] == undefined) {
        allStats[n.addr] = new FunctionData(n);
    }
    allStats[n.addr].update(n);
    for (var i in n.children) {
        walk_recursive(allStats, n.children[i], accum);
    }
}

function walk_tree(n)
{
    for (var i in n.children) {
        walk_tree(n.children[i]);
    }
}

function run_walk()
{
    d0 = new Date();
    walk_recursive([], global_stats.nodes, []);
    d1 = new Date();
    console.log(d1.getTime() - d0.getTime());
}

Stats.prototype.makeTree = function(t) {
	var n = new Node(t[0], t[1], t[2], t[3], t[4]);
    allStats = {};
    n.walk(function (elem) {
        if (allStats[elem.addr] === undefined) {
            console.log(elem.addr);
            allStats[elem.addr] = new FunctionData(elem);
        }
    });
    walk_recursive(allStats, n, []);
    n.walk(function (elem) {
        allStats[elem.addr].self += elem.self;
    });
    this.allStats = allStats;
    n.countCumulativeMeta();
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
	this.self = this.count_self();
};

Node.prototype.countCumulativeMeta = function () {
    for (var i in this.children) {
        this.children[i].countCumulativeMeta();
    }
    this.cumulative_meta = dict_copy(this.meta);
    for (var i in this.children) {
        dict_update(this.cumulative_meta, this.children[i].cumulative_meta);
    }
};

function dict_get(d, v, _default)
{
    var item = d[v];
    if (item === undefined) {
        return _default;
    }
    return item;
}

function dict_update(d, d1)
{
    for (var i in d1) {
        d[i] = dict_get(d, i, 0) + d1[i];
    }    
}

function dict_copy(a)
{
    var new_a = [];
    for (var i in a) {
        new_a[i] = a[i];
    }
    return new_a;
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

Node.prototype.walk = function(cb) {
    cb(this);
    for (var i in this.children) {
        c = this.children[i];
        c.walk(cb);
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

Node.prototype.max_self = function() {
    var max = this.count_self();
    for (var i in this.children) {
        c = this.children[i];
        var child_max_self = c.max_self();
        if (child_max_self > max)
            max = child_max_self;
    }
    return max;
}



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

function parse_func_name(name)
{
    var nameSegments = name.split(":");
    var file;
    if (nameSegments.length > 4) {
        file = nameSegments.slice(4, nameSegments.length).join(":");
    } else {
        file = nameSegments[3];
    }
    return [nameSegments[1], nameSegments[2], file];
}

Stats.prototype.process = function(functions, parent, total, path_so_far, paths) {
	var top = [];

	for (var i in functions) {
		var func = functions[i];
		var name = parse_func_name(functions[i].name);
        var file = name[2];
		var path;
		if (path_so_far.length == 0) {
			path = i.toString();
		} else {
			path = path_so_far + "," + i.toString();
		}
		top.push({
			path: path,
			name: name[0],
			line: name[1],
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
