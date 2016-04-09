
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
  var init_xoff = bot_margin 
  var init_yoff = bot_margin
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
      console.log(d)
      return [d.x, d.y];
    });

  var link_layer = svg.append("svg:g")
  var node_layer = svg.append("svg:g")

  var _this = this;
  var pos = {l:0,r:0,i:0};
  this._forest.forEach(function(trunk){
    var traces = [];
    _this.walk_trace_tree(trunk, 0, traces)
    //var off = _this.position_trace_tree(trunk, pos)

    var tree_grp = node_layer.append("svg:g")
    // TODO add offset

    for (var i = 0; i < traces.length; i++) {
      var trace = traces[i]
      var trace_grp = tree_grp.append("svg:g")
                        .attr("class", "trace")
                        .attr("transform", function(d){
                          var x = i*10
                          var y = trace.yoff*7
                          return _this._tr(x, y)
                        })

      var node = trace_grp.selectAll(".node").data(trace.nodes)
                  .enter().append("svg:g")
                    .attr("class", function(d){ return 'node ' + d.class })
                    .attr("transform", function(d) {
                      var x = 0
                      var y = (d.index || 0) * 7
                      d.x = x + i * 10
                      d.y = y + trace.yoff * 7
                      return _this._tr(x, y)
                    })

      var link = link_layer.selectAll("path.link")
             .data(trace.links)
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
      //not_stitched.append("svg:text")
      //              .attr("class", "guard-not-stitched-text")
      //              .attr("x", cw * 2)
      //              .attr("y", cw/2)
      //              .text(function(d){
      //                var len = d.shrunk_guards.length || 0
      //                if (len <= 1) {
      //                  return ""
      //                } else {
      //                  return d.shrunk_guards.length
      //                }
      //              })
    }
  })
}

TraceForest.prototype.position_trace_tree = function(trace, pos) {
  var off = trace._offset || offset(0,0)
  if (pos.i > 0) {
    pos.r += trace.trace_strips() * 7;
  }
  var off = off_plus(off, offset(pos.r, 0))
  pos.i += 1;
  return off
}

TraceForest.prototype._tr = function(a, b) {
  return 'translate(' + a + ',' + b + ')'
}

TraceForest.prototype.walk_trace_tree = function(trunk, yoff, traces) {
  var _this = this
  var trace = { 'stitches': [], 'links': [], 'nodes': [], 'yoff': yoff }
  traces.push(trace)
  var node = { 'trace': trace, class: 'trunk', 'order': trace.nodes.length,
               'index': 0 }
  var first = node
  var last = node
  trace.nodes.push(node)
  var i = 1;
  trunk.forEachOp(function(op){
    if (op.is_guard()) {
      // add a new node, give it a connection to the previous
      var bridge = op.get_stitched_trace()
      if (!bridge && last.guard && last.class.indexOf('stitched') == -1) {
        last.shrunk_guards.push(op)
        return true;
      }
      var node = { 'guard': op, class: 'guard',
                   'trace': trunk, 'stitched': bridge,
                   'shrunk_guards': [], 'index': i }
      trace.nodes.push(node)
      //trace.links.push({'source': last, 'target': node})
      op._node = node;
      if (bridge !== undefined) {
        node.class += ' stitched'
        trace.stitches.push({'op': op, 'order': trace.nodes.length })
      }
      last = node
      i += 1;
    }
    return true;
  })

  trace.stitches.sort(function(a,b){
    return b.order - a.order
  })

  trace.stitches.forEach(function(obj){
    var op = obj.op
    var stitched = op.get_stitched_trace()
    if (stitched !== undefined){
      var yoff = trace.yoff + obj.order-1
      var strace = _this.walk_trace_tree(stitched, yoff, traces)
      trace.links.push({'source': op._node, 'target': strace.nodes[0], class: 'stitch-edge'})
    }
  })

  if (trunk.ends_with_jump()) {
    // add a node for the jump!
    var node = {'trace': trunk, class: 'trunk'}
    trace.nodes.push(node)
    last = node

    // TODO
    //links.push({'source': node, 'target': trunk, class: 'jump-edge'})
  }
  //trace.links.push({'source': trunk, 'target': last})

  return trace
}



