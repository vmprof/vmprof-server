var StackFrameNode = function() {
}

StackFrameNode.setPrototype = function(node) {
    // recursively set the prototype of node and of all its children; used to
    // "convert" the JSON object into a real StackFrameNode object
    node.__proto__ = StackFrameNode.prototype;

    // XXX?
    node.total = node.total_cumulative_ticks();
    node.self = node.total_self_or_virtual_ticks(); 
    node.name = node.frame;
    // XXX?

    for (var i in node.children) {
        var child = node.children[i];
        StackFrameNode.setPrototype(child);
    }
}

function _total_ticks(d) {
    var total = 0;
    for (var tag in d) {
        var ticks = d[tag];
        total += ticks;
    }
    return total;
}    

StackFrameNode.prototype.total_cumulative_ticks = function() {
    return _total_ticks(this.cumulative_ticks);
}

StackFrameNode.prototype.total_self_or_virtual_ticks = function() {
    if (this.is_virtual)
        return _total_ticks(this.virtual_ticks);
    else
        return _total_ticks(this.self_ticks);
}

StackFrameNode.prototype.max_self = function() {
    var max = this.total_self_or_virtual_ticks();
    for (var i in this.children) {
        child = this.children[i];
        var child_max_self = child.max_self();
        if (child_max_self > max)
            max = child_max_self;
    }
    return max;
}

StackFrameNode.prototype.get_ticks_dict = function(kind) {
    if (kind == "cumulative")
        return this.cumulative_ticks;
    else if (this.is_virtual)
        return this.virtual_ticks;
    else
        return this.self_ticks;
}

StackFrameNode.prototype.get_ticks = function(kind, tag) {
    var d = this.get_ticks_dict(kind);
    var ticks = 0;
    for (var curtag in d) {
        if (curtag.startsWith(tag)) {
            ticks += d[curtag];
        }
    }
    if (ticks == 0)
        return 0;
    return ticks / _total_ticks(d);
}

StackFrameNode.prototype.red = function() {
    var C = this.cumulative_ticks['C'] || 0;
    return C / this.total_cumulative_ticks();
}

StackFrameNode.prototype.green = function() {
    var JIT = this.cumulative_ticks['JIT'] || 0;
    return JIT / this.total_cumulative_ticks();
}

StackFrameNode.prototype.yellow = function() {
    var WARMUP = this.cumulative_ticks['WARMUP'] || 0;
    return WARMUP / this.total_cumulative_ticks();
}

StackFrameNode.prototype.gc = function() {
    var GC_minor = this.cumulative_ticks['GC:MINOR'] || 0;
    var GC_major = this.cumulative_ticks['GC:MAJOR'] || 0;
    return (GC_minor+GC_major) / this.total_cumulative_ticks();
}

StackFrameNode.prototype.find = function(pattern) {
    if (this.name.match(pattern))
        return this;

    for (var i in this.children) {
        var child = this.children[i];
        var res = child.find(pattern);
        if (res)
            return res;
    }
    return null;
}
        
