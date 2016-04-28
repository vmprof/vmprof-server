
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

TraceForest.prototype.draw_trace_jump = function(svg){
    svg.append("svg:circle").attr("r", 3)
}

TraceForest.prototype.draw_trace_finish = function(svg){
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

TraceForest.prototype.reset_slide = function(){
  this.svg._slide = false
  this.svg._slide_offset = {x0:0,y0:0,x:0,y:0}
  this.update_slide(0,0)
}

TraceForest.prototype.update_slide = function(mx,my) {
  var dx = this.svg._slide_offset.x - mx
  var dy = this.svg._slide_offset.y - my
  var ox = this.svg._slide_offset.x0
  var oy = this.svg._slide_offset.y0
  var x = ox - dx
  var y = oy - dy
  this.svg.attr("transform", this._tr(this.init_xoff + x,this.init_yoff + y))
}

TraceForest.prototype.setup_once = function(id){
  var _this = this;
  this._jitlog.filter_traces("", "both").forEach(function(trace) {
    if (trace.is_trunk()) {
      // only add traces that are trunks, bridges will
      // be visited/visible by walking trunk traces
      _this._forest.push(trace)
    }
  })

  //this._forest.sort(function(a,b){return a._width-b._width})

  var bot_margin = 5
  var div = jQuery(id)
  var root = d3.select(id + "_svg")
  var init_xoff = bot_margin + div.width() / 2
  var init_yoff = bot_margin
  this.init_xoff = init_xoff
  this.init_yoff = init_yoff
  var legend = root.select(id + "_legend")
  legend.attr("transform", this._tr(div.width()-195,15))
  var svg = root.attr("width", div.width())
              .attr("height", div.height())
            .append("svg:g")
              .attr("transform", this._tr(init_xoff, init_yoff))
  this.svg = svg
  this.reset_slide()
  root.on("mouseleave", function(){
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
      _this.update_slide(d3.event.x, d3.event.y);
    }
  })

  this.link_layer = svg.append("svg:g")
  this.node_layer = svg.append("svg:g")
  this.pop_over = svg.append("svg:g")
}

TraceForest.prototype.show_popover = function(trace) {
  var pop_over = this.pop_over

  var rect = pop_over.append("svg:rect")

  var title = pop_over.append("svg:text")
  title.text(trace.get_func_name())



  return pop_over
}

TraceForest.prototype.hide_popover = function() {
  this.pop_over.removeChildren()
}

TraceForest.prototype.mouse_enter_trace = function(){
  var jthis = jQuery(this)
  jthis.attr("class", "trace-bg-active")
  var trace = jitlog.get_trace_by_id(jthis.attr('data-trace-id'))
  var pop_over = trace_forest.show_popover(trace)
  pop_over.attr("transform", "translate("+d3.event.x+","+d3.event.y+")")
}

TraceForest.prototype.mouse_leave_trace = function(){
  var jthis = jQuery(this)
  jthis.attr("class", "trace-bg")
  trace_forest.hide_popover()
}

TraceForest.prototype.display_tree = function(trunk){
  var _this = this;
  this.reset_slide()
  //
  // for each tree root in the known traces
  //
  var links = [];
  var traces = [];
  _this.walk_trace_tree(trunk, 0, traces, links)

  this.node_layer.remove()
  this.link_layer.remove()
  this.link_layer = this.svg.append("svg:g")
  this.node_layer = this.svg.append("svg:g")

  var tree_grp = this.node_layer.append("svg:g")

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
    var rect = trace_grp.append("svg:rect")
                       .attr("class", "trace-bg")
                       .attr("transform", "translate(-5,-5)")
                       .attr("width", 10)
                       .attr("height", trace.nodes.length * 7 + 10)
                       .attr("data-trace-id", trace.trace_obj.get_id())
    rect.on("mouseenter", this.mouse_enter_trace)
    rect.on("mouseleave", this.mouse_leave_trace)

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
    _this.draw_trace_enter(node.filter(function(d){return d.label}))
    _this.draw_trace_jump(node.filter(function(d){return d.jump}))
    _this.draw_trace_finish(node.filter(function(d){return d.finish}))

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

  var link = this.link_layer.selectAll("path.link")
         .data(links)
       .enter()
         .insert("svg:path")
         .attr("class", 'link')
         .attr("d", trace_connect)
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
  var labels = {}
  var label_counter = 1
  var last = null
  var node = null
  var i = 0;
  trunk.forEachOp(function(op){
    if (op.is_label() || op.is_jump()) {
      node = new VisualTraceNode(vtrace, i)
      vtrace.nodes.push(node)
      if (op.get_descr_nmr() in labels) {
        node.label = labels[op.get_descr_nmr()]
      } else {
        node.label = label_counter
        labels[op.get_descr_nmr()] = label_counter
        label_counter += 1
      }
      i += 1
    } else if (op.is_guard()) {
      // add a new node, give it a connection to the previous
      var bridge = op.get_stitched_trace()
      if (last && !bridge && last.guard && last.class.indexOf('stitched') == -1) {
        last.consumed.push(op)
        return true;
      }
      node = new VisualTraceNode(vtrace, i)
      node.set_guard(op, bridge)
      vtrace.nodes.push(node)
      if (bridge !== undefined) {
        node.class += ' stitched'
        vtrace.stitches.push({'op': op, 'index': vtrace.nodes.length })
      }
      i += 1;
    } else if (op.is_finish()) {
      node = new VisualTraceNode(vtrace, i)
      vtrace.nodes.push(node)
      node.finish = true
      i += 1
    } else {
      return true // continue to next iteration
    }
    if (last) {
      links.push({'source': last, 'target': node})
    }
    last = node
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

  return vtrace
}



