
offset = function(x,y){
  return {'x':x, 'y':y}
}

off_plus = function(a,b) {
  return { 'x': a.x + b.x, 'y': a.y + b.y }
}


TraceForest = function(jitlog){
  this._jitlog = jitlog
  this._forest = []
}

TraceForest.BRIDGE_YOFF = 10

TraceForest.prototype.grow_forest = function(id){
  var _this = this;
  this._jitlog.all_traces().forEach(function(trace) {
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
  var update_slide = function(mx,my) {
    var dx = svg._slide_offset.x - mx
    var dy = svg._slide_offset.y - my
    var ox = svg._slide_offset.x0
    var oy = svg._slide_offset.y0
    var x = ox - dx
    var y = oy - dy
    svg.attr("transform", _this._tr(init_xoff + x,init_yoff + y))
  }
  root.on("mouseenter", function(){
    var h2 = div.height()*2
    init_yoff += div.height();
    div.height(h2)
    root.attr("height", div.height())
    update_slide(svg._slide_offset.x,
                 svg._slide_offset.y)
  })
  root.on("mouseleave", function(){
    var h2 = div.height()/2
    init_yoff -= h2
    div.height(h2)
    root.attr("height", div.height())
    update_slide(svg._slide_offset.x,
                 svg._slide_offset.y)
    if (svg._slide) {
      svg._slide = false;
      svg._slide_offset.x0 -= (svg._slide_offset.x - d3.event.x)
      svg._slide_offset.y0 -= (svg._slide_offset.y - d3.event.y)
    }
  })
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
      update_slide(d3.event.x, d3.event.y);
    }
  })

  var diagonal = d3.svg.diagonal()
    .projection(function(d) {
      return [d.x, d.y];
    });

  var link_layer = svg.append("svg:g")
  var node_layer = svg.append("svg:g")

  var _this = this;
  var pos = {l:0,r:0,i:0};
  var x = 0
  this._forest.forEach(function(trace){
    if (x > 0) {
      return // XXX
    }
    var nodes = [];
    var links = [];
    _this.walk_trace_tree(trace, nodes, links)
    _this.position_trace_tree(trace, pos)
    x += 1

    var trace_grp = node_layer.append("svg:g")

    var node = trace_grp.selectAll(".node").data(nodes)
                .enter().append("svg:g")
                  .attr("class", function(d){ return 'node ' + d.class })
                  .attr("transform", function(d){
                    var pos = _this.node_position(d)
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
    not_stitched.append("svg:text")
                  .attr("class", "guard-not-stitched-text")
                  .attr("x", cw * 2)
                  .attr("y", cw/2)
                  .text(function(d){
                    var len = d.shrunk_guards.length || 0
                    if (len <= 1) {
                      return ""
                    } else {
                      return d.shrunk_guards.length
                    }
                  })
  })

  console.log(data)
}

TraceForest.prototype.position_trace_tree = function(trace, pos) {
  var off = trace._offset || offset(0,0)
  if (pos.i > 0) {
    pos.r += trace.trace_strips() * 7;
  }
  var off = off_plus(off, offset(pos.r, 0))
  pos.i += 1;
  trace._offset = off
}

TraceForest.prototype.node_position = function(d) {
  // the offset of the trace
  var trace = d.trace;
  var off = (trace._offset || offset(0,0))
  if (off && d._offset) {
    off = off_plus(off, d._offset)
  }

  //var prev = d._vis_prev
  //while (prev !== undefined){
  //  off.y -= 20
  //  prev = prev._vis_prev
  //}

  var trunk = trace.get_trunk()
  if (trunk !== trace) {
    off = off_plus(off, trunk._offset)
  }

  d.x = off.x
  d.y = off.y

  return d
}

TraceForest.prototype._tr = function(a, b) {
  return 'translate(' + a + ',' + b + ')'
}

TraceForest.prototype.walk_trace_tree = function(trace, nodes, links) {
  var _this = this
  var trunk = { 'trace': trace, class: 'trunk',
                'order': nodes.length }
  trace._node = trunk
  nodes.push(trunk)
  var last = trunk
  var stitches = []
  var i = 1;
  var n = 1;
  trace.forEachOp(function(op){
    if (op.is_guard()) {
      // add a new node, give it a connection to the previous
      var bridge = op.get_stitched_trace()
      if (!bridge && last.guard && last.class.indexOf('stitched') == -1) {
        last.shrunk_guards.push(op)
        return true;
      }
      var node = { 'guard': op, class: 'guard',
                   'trace': trace, 'stitched': bridge,
                   'shrunk_guards': []}
      node._offset = offset(0, -i*20)
      op._node = node;
      op._node_index = n;
      n += 1;
      node._vis_prev = last
      nodes.push(node)
      if (bridge !== undefined) {
        node.class += ' stitched'
        stitches.push({'op': op, 'order': nodes.length })
      }
      links.push({'source': last, 'target': node})
      last = node
      i += 1;
    }
    return true;
  })

  stitches.sort(function(a,b){
    return b.order - a.order
  })

  var i = 1
  stitches.forEach(function(obj){
    var op = obj.op
    var trace = op.get_stitched_trace()
    if (trace !== undefined){
      var y = op._node_index * 20
      trace._offset = offset(i * 20, -y)
      i += 1;
      var trunk = _this.walk_trace_tree(trace, nodes, links)
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

    // TODO
    //links.push({'source': node, 'target': trunk, class: 'jump-edge'})
  }
  links.push({'source': trunk, 'target': last})

  return trunk
}



