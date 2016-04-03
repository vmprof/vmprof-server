
TraceForest = function(jitlog){
  this._jitlog = jitlog
  this._forest = []
}

TraceForest.BRIDGE_YOFF = 10

TraceForest.prototype.grow_forest = function(id){
  var _this = this;
  this._jitlog.all_traces().forEach(function(trace) {
    trace.calc_width();
    if (trace.is_trunk()) {
      // only add traces that are trunks, bridges will
      // be visited/visible by walking trunk traces
      _this._forest.push(trace)
    }
  })

  this._forest.sort(function(a,b){return a._width-b._width})

  var bot_margin = 5
  var div = jQuery(id)
  var root = d3.select(id).append("svg:svg")
  var init_xoff = div.width()/2
  var init_yoff = div.height() - bot_margin
  var svg = root
              .attr("width", div.width())
              .attr("height", div.height())
            .append("svg:g")
              .attr("transform", this._tr(init_xoff, init_yoff))

  svg._slide = false
  svg._slide_offset = {x0:0,y0:0,x:0,y:0}
  root.on("mousedown", function(){
    svg._slide_offset.x = d3.event.x
    svg._slide_offset.y = d3.event.y
    svg._slide = true;
  })
  root.on("mouseup", function(){
    svg._slide = false;
    svg._slide_offset.x0 -= (svg._slide_offset.x - d3.event.x)
    svg._slide_offset.y0 -= (svg._slide_offset.y - d3.event.y)
  })
  root.on("mousemove", function(){
    if (svg._slide) {
      var dx = svg._slide_offset.x - d3.event.x
      var dy = svg._slide_offset.y - d3.event.y
      var ox = svg._slide_offset.x0
      var oy = svg._slide_offset.y0
      var x = ox - dx
      var y = oy - dy
      svg.attr("transform", _this._tr(init_xoff + x,init_yoff + y))
    }
  })

  var diagonal = d3.svg.diagonal()
    .projection(function(d) {
      return [d.x, d.y];
    });

  var link_layer = svg.append("svg:g")
  var node_layer = svg.append("svg:g")

  var _this = this;
  this._forest.forEach(function(trace){
    var nodes = [];
    var links = [];
    var data = _this.walk_trace_tree(trace, nodes, links)
    console.log(nodes, links)

    var node = node_layer.selectAll(".node").data(nodes)
                .enter().append("svg:g")
                  .attr("class", function(d){ return 'node ' + d.class })
                  .attr("transform", function(d){
                    var pos = _this.trace_position(d)
                    return _this._tr(pos.x, pos.y)
                  })

    var link = link_layer.selectAll("path.link")
           .data(links)
         .enter()
           .insert("svg:path")
           .attr("class", function(d){ return 'link ' + d.class })
           .attr("d", diagonal)

    // first and last instruction
    node.filter(function(d){
      return d.guard === undefined
    }).append("svg:circle").attr("r", 3)

    // stitched guards
    node.filter(function(d){
      return d.guard !== undefined && d.stitched !== undefined
    }).append("svg:circle").attr("r", 3)

    // not stitched guards
    var not_stitched = node.filter(function(d){
      return d.guard !== undefined && d.stitched === undefined
    }).append("svg:g")
    var cw = 3 // cross half width
    not_stitched.append("svg:line")
                  .attr("class", "guard-not-stitched")
                  .attr("x1", -cw).attr("y1", -cw)
                  .attr("x2", cw).attr("y2", cw)
    not_stitched.append("svg:line")
                  .attr("class", "guard-not-stitched")
                  .attr("x1", cw).attr("y1", -cw)
                  .attr("x2", -cw).attr("y2", cw)
  })
  console.log(data)
}

TraceForest.prototype.trace_position = function(d) {
  var trace = d.trace;
  var x = -d.xoffset || 0;
  var y = -d.yoffset || 0;

  var depth = 0;
  var prev = d._vis_prev
  var root = prev
  while (prev !== undefined){
    y -= (20 + (prev.yoffset || 0));
    prev = prev._vis_prev
    depth += 1;
    if (prev !== undefined) {
      root = prev
    }
  }

  if (trace !== undefined) {
    var parent = trace.parent()
    while (parent !== undefined){
      x += 15;
      parent = parent.parent();
    }
  }

  d.x = x
  d.y = y

  return d
}

TraceForest.prototype._tr = function(a, b) {
  return 'translate(' + a + ',' + b + ')'
}

TraceForest.prototype.walk_trace_tree = function(trace, nodes, links) {
  var _this = this
  var trunk = {'trace': trace, class: 'trunk'}
  trace._node = trunk
  nodes.push(trunk)
  var last = trunk
  var stitches = []
  trace.forEachOp(function(op){
    if (op.is_guard()) {
      // add a new node, give it a connection to the previous
      var bridge = op.get_stitched_trace()
      var node = {'guard': op, class: 'guard', 'trace': trace, 'stitched': bridge }
      op._node = node;
      node._vis_prev = last
      nodes.push(node)
      if (bridge !== undefined) {
        node.class += ' stitched'
        stitches.push(op)
      }
      links.push({'source': last, 'target': node})
      last = node
    }
    return true;
  })

  stitches.forEach(function(op){
    var trace = op.get_stitched_trace()
    console.log(trace)
    if (trace !== undefined){
      var trunk = _this.walk_trace_tree(trace, nodes, links)
      trunk.yoffset = TraceForest.BRIDGE_YOFF
      links.push({'source': op._node, 'target': trunk, class: 'stitch-edge'})
    }
  })

  if (trace.ends_with_jump()) {
    // add a node for the jump!
    var node = {'trace': trace, class: 'trunk'}
    trace._node = trunk
    node._vis_prev = last
    nodes.push(node)
    last = node

    //links.push({'source': node, 'target': trunk, class: 'jump-edge'})
  }
  links.push({'source': trunk, 'target': last})

  return trunk
}



