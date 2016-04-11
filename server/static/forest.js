
VisualTrace = function(trace, yoff){
  this.trace_obj = trace
  trace.visual_trace = this
  this.links = []
  this.stitches = []
  this.nodes = []
  this.yoff = yoff
}

VisualTraceNode = function(vtrace, index) {
  this.visual_trace = vtrace
  this.class = 'trace-enter'
  this.order = vtrace.nodes.length
  this.index = index
  this.x = 0
  this.y = 0
  // nodes that have been consumed (they are not displayed)
  this.consumed = []
  this.guard = null
}

VisualTraceNode.prototype.set_guard = function(op, bridge){
  this.guard = op
  op.visual_node = this
  this.bridge = bridge
  this.class = 'guard'
}

TraceForest = function(jitlog){
  this._jitlog = jitlog
  this._forest = []
}

TraceForest.prototype.draw_trace_enter = function(svg){
    svg.append("svg:circle").attr("r", 3)
}

TraceForest.prototype.draw_trace_exit = function(svg){
    svg.append("svg:circle").attr("r", 3)
}

TraceForest.prototype.draw_stitched_guard = function(svg){
    svg.append("svg:circle").attr("r", 3)
}

TraceForest.prototype.draw_guard = function(svg){
      var node = svg.append("svg:g").attr("class", "guard-not-stitched")
      var cw = 2 // cross half width
      node.append("svg:line")
                    .attr("class", "guard-not-stitched")
                    .attr("x1", -cw).attr("y1", -cw)
                    .attr("x2", cw).attr("y2", cw)
      node.append("svg:line")
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
  var root = d3.select(id + "_svg")
  var init_xoff = bot_margin 
  var init_yoff = bot_margin
  var legend = root.select(id + "_legend")
  legend.attr("transform", this._tr(div.width()-195,15))
  var svg = root.attr("width", div.width())
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
    // currently not necessary, tree grows from top to bottom
    //svg.attr("transform", _this._tr(init_xoff + x,init_yoff + y))
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

  var link_layer = svg.append("svg:g")
  var node_layer = svg.append("svg:g")

  var _this = this;
  //
  // for each tree root in the known traces
  //
  var xxx = 0
  var links = [];
  this._forest.forEach(function(trunk){
    if (xxx >= 1) {
      return
    }
    xxx += 1;
    var traces = [];
    _this.walk_trace_tree(trunk, 0, traces, links)
    //var off = _this.position_trace_tree(trunk, pos)

    var tree_grp = node_layer.append("svg:g")

    trunk.align_tree(0)

    for (var i = 0; i < traces.length; i++) {
      var trace = traces[i]
      var trace_grp = tree_grp.append("svg:g")
                        .attr("class", "trace")
                        .attr("transform", function(d){
                          var x = trace.xoff*10
                          var y = trace.yoff*7
                          return _this._tr(x, y)
                        })

      var node = trace_grp.selectAll(".node").data(trace.nodes)
                  .enter().append("svg:g")
                    .attr("class", function(d){ return 'node ' + d.class })
                    .attr("transform", function(d) {
                      d.ix = 0
                      d.iy = d.index
                      d.x = 0
                      d.y = d.iy * 7
                      return _this._tr(d.x, d.y)
                    })

      // first and last instruction
      _this.draw_trace_enter(node.filter(function(d){return !d.guard}))

      // stitched guards
      _this.draw_stitched_guard(node.filter(function(d){return d.bridge}))

      // not stitched guards
      var not_stitched = node.filter(function(d){return d.guard && !d.bridge})
      _this.draw_guard(not_stitched);

      var trace_connect = function(obj,x,y){
        var rel = obj.source.visual_trace
        var x1 = obj.source.x + rel.xoff * 10
        var y1 = obj.source.y + rel.yoff * 7

        var rel = obj.target.visual_trace
        var x2 = obj.target.x + rel.xoff * 10
        var y2 = obj.target.y + rel.yoff * 7

        var line = "M"+x1+","+y1 + " L"+x2+","+y2
        return line
      }

    }

    var link = link_layer.selectAll("path.link")
           .data(links)
         .enter()
           .insert("svg:path")
           .attr("class", 'link')
           .attr("d", trace_connect)
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

TraceForest.prototype.walk_trace_tree = function(trunk, yoff, traces, links) {
  var _this = this
  var vtrace = new VisualTrace(trunk, yoff)
  traces.push(vtrace)
  var node = new VisualTraceNode(vtrace, 0)
  var first = node
  var last = node
  vtrace.nodes.push(node)
  var i = 1;
  trunk.forEachOp(function(op){
    if (op.is_guard()) {
      // add a new node, give it a connection to the previous
      var bridge = op.get_stitched_trace()
      if (!bridge && last.guard && last.class.indexOf('stitched') == -1) {
        last.consumed.push(op)
        return true;
      }
      var node = new VisualTraceNode(vtrace, i)
      node.set_guard(op, bridge)
      vtrace.nodes.push(node)
      links.push({'source': last, 'target': node})
      if (bridge !== undefined) {
        node.class += ' stitched'
        vtrace.stitches.push({'op': op, 'index': vtrace.nodes.length })
      }
      last = node
      i += 1;
    }
    return true;
  })

  vtrace.stitches.forEach(function(obj){
    var op = obj.op
    var stitched = op.get_stitched_trace()
    if (stitched !== undefined){
      var yoff = vtrace.yoff + obj.index-1
      var vstrace = _this.walk_trace_tree(stitched, yoff, traces, links)
      var tgt = vstrace.nodes[0]
      links.push({'source': op.visual_node , 'target': tgt, class: 'stitch-edge'})
    }
  })

  if (trunk.ends_with_jump()) {
    // add a node for the jump!
    var node = new VisualTraceNode(vtrace, i)
    i += 1
    vtrace.nodes.push(node)
    links.push({'source': last, 'target': node})
    last = node
  }

  return vtrace
}



