
scale = function(elem, scale) {
  var trans = elem.attr("transform")
  var i = trans.indexOf("scale(")
  if (i !== -1) {
    var first = trans.substr(0, i)
    var second = trans.substr(i)
    if (second.indexOf(")") !== -1) {
      trans = first + second.substr(second.indexOf(")")+1)
    } else {
      trans = first
    }
  }
  elem.attr("transform", trans + ' scale(' + scale+ ')')
}

VisualTrace = function(trace, yoff){
  this.id = trace
  this.links = []
  this.stitches = []
  this.nodes = []
  this.yoff = yoff
}

VisualTrace.prototype.branch_count = function() {
  if (this._branch_count !== undefined) {
    return this._branch_count
  }
  var count = 1;
  this.stitches.forEach(function(obj){
    count += obj.node.branch_count()
  })
  this._branch_count = count;
  return count
}


VisualTrace.prototype.align_tree = function(xoff) {
  // true means right, false means left
  var part = this.partition_subtree()
  this.xoff = 1 + xoff + part.leftcount

  var d = 1 + xoff + part.leftcount

  // walk the right side of the trace
  var t = 1 + xoff + part.leftcount
  part.right.forEach(function(trace){
    var p = trace.align_tree(t)
    t += p.total
  })

  // walk the left side of the trace
  var t = xoff
  part.left.forEach(function(trace){
    var p = trace.align_tree(t)
    t += p.total
  })

  return part
}

VisualTrace.prototype.partition_subtree = function() {
  var total = this.branch_count()
  var part = {leftcount:0, left:[], rightcount:0, right:[], total:total}

  this.stitches.forEach(function(obj){
    if (part.leftcount < part.rightcount) {
      part.leftcount += obj.node.branch_count()
      part.left.push(obj.node)
    } else {
      part.rightcount += obj.node.branch_count()
      part.right.push(obj.node)
    }
  })
  // sort the sets left and right to display them correctly!
  part.left.sort(function(a,b){
    return a.visual_trace.yoff - b.visual_trace.yoff
  })
  part.right.sort(function(a,b){
    return b.visual_trace.yoff - a.visual_trace.yoff
  })

  if (part.leftcount + part.rightcount + 1 != part.total) {
    console.error("partition for rendering has incorrrect branch count!")
    console.error(part.leftcount, "+", part.rightcount, "!=", total)
  }


  return part
}

VisualTraceNode = function(vtrace, order, index, type, descr_nmr, target) {
  this.visual_trace = vtrace
  this.class = 'trace-enter'
  this.index = index
  this.order = order
  this.type = type
  this.descr_nmr = descr_nmr
  this.target = target || ''
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
  this.svg.attr("transform", translate(this.init_xoff + x,this.init_yoff + y))
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

  var bot_margin = 5
  var div = jQuery(id)
  var root = d3.select(id + "_svg")
  var init_xoff = bot_margin + div.width() / 2
  var init_yoff = bot_margin
  this.init_xoff = init_xoff
  this.init_yoff = init_yoff
  var g = root.select("#legend-indicator")
              .attr("transform", translate(div.width()-35,15))
  this.legend = new PopOver(root.select("#legend"), div.width()-10, div.height()-10)
  g.on("mouseenter", function(){
    _this.legend.show({})
  })
  g.on("mouseleave", function(){
    _this.legend.hide()
  })
  root.attr("width", div.width())
              .attr("height", div.height())
  var svg = root.select(id + "_grp")
                .attr("transform", translate(init_xoff, init_yoff))
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
  var g = root.select("g#trace-details")
  this.pop_over = new PopOver(g, 250, div.height()-10)
}

TraceForest.prototype.mouse_click_trace = function(){
  var jthis = jQuery(this)
  var trace = jitlog.get_trace_by_id(jthis.data('trace-id'))
  var $scope = trace_forest.$scope
  $scope.switch_trace(trace, $scope.trace_type)
}

TraceForest.prototype.mouse_enter_trace = function(){
  var jthis = jQuery(this)
  jthis.find('rect').attr("class","trace-bg-active")
  var trace = jitlog.get_trace_by_id(jthis.data('trace-id'))
  var values = {
    funcname: trace.get_func_name(),
    entrycount: numeral(trace.get_enter_count()).format('0,0 a'),
    entrypercent: numeral(trace.get_enter_percent()).format('0.00%'),
    filename: trace.get_filename(),
    lineno: trace.get_lineno(),
  }
  trace_forest.pop_over.show(values)
}

TraceForest.prototype.mouse_leave_trace = function(){
  var jthis = jQuery(this)
  jthis.find('rect').attr("class","empty-rect")
  trace_forest.pop_over.hide()
}

TraceForest.prototype.mouse_enter_node = function() {
  var jthis = jQuery(this)
  scale(jthis, 2)
  var trace = jitlog.get_trace_by_id(jthis.data('trace-id'))
  var stage = trace.get_stage('asm')
  var op = stage.get_operation_by_index(jthis.data('op-index'))
  var values = {
    node_type: 'op',
  }
  if (op.has_stitched_trace()) {
    values.node_type = 'guard-stitched'
    var strace = op.get_stitched_trace()
    values['op'] = op
    values['tgt_trace'] = strace
    values['tgt_funcname'] = strace.get_func_name()
    values['tgt_filename'] = strace.get_filename()
    values['tgt_lineno'] = strace.get_lineno()
  } else if (op.is_guard()) {
    values.node_type = 'guard'
  }
  trace_forest.pop_over.show(values)
}
TraceForest.prototype.mouse_leave_node = function() {
  var jthis = jQuery(this)
  scale(jthis, 1)
}

TraceForest.prototype.display_tree = function($scope, trunk, visual_trace){
  this.$scope = $scope
  var _this = this;
  this.reset_slide()
  //
  // for each tree root in the known traces
  //
  var links = [];
  var traces = [];
  var vtrace = _this.walk_visual_trace_tree(visual_trace, 0, traces, links)

  this.node_layer.remove()
  this.link_layer.remove()
  this.link_layer = this.svg.append("svg:g")
  this.node_layer = this.svg.append("svg:g")

  var tree_grp = this.node_layer.append("svg:g")

  var part = vtrace.align_tree(0)
  var width = (part.leftcount + 1 + part.rightcount) * 10
  this.link_layer.attr("transform", translate(-width/2,0))
  this.node_layer.attr("transform", translate(-width/2,0))

  for (var i = 0; i < traces.length; i++) {
    var trace = traces[i]
    var trace_grp = tree_grp.append("svg:g")
                      .attr("class", "trace")
                      .attr("transform", function(d){
                        var x = trace.xoff*10
                        var y = trace.yoff*7
                        return translate(x, y)
                      })
                      .attr("data-trace-id", parseInt(trace.id,16))
    var rect = trace_grp.append("svg:rect")
                       .attr("class", "empty-rect")
                       .attr("transform", "translate(-5,-5)")
                       .attr("width", 10)
                       .attr("height", trace.nodes.length * 7 + 4)
    trace_grp.on("mouseenter", this.mouse_enter_trace)
    trace_grp.on("mouseleave", this.mouse_leave_trace)
    trace_grp.on("click", this.mouse_click_trace)

    var node = trace_grp.selectAll(".node").data(trace.nodes)
                .enter().append("svg:g")
                  .attr("class", function(d){ return 'node ' + d.class })
                  .attr("data-trace-id", trace.id)
                  .attr("data-op-index", function(d){
                    return d.index
                  })
                  .attr("transform", function(d) {
                    d.ix = 0
                    d.iy = d.index
                    d.x = 0
                    d.y = d.iy * 7
                    return translate(d.x, d.y)
                  })
                  .on("mouseenter", this.mouse_enter_node)
                  .on("mouseleave", this.mouse_leave_node)

    // first and last instruction
    _this.draw_trace_enter(node.filter(function(d){return d.type == 'l'}))
    _this.draw_trace_jump(node.filter(function(d){return d.type == 'j'}))
    _this.draw_trace_finish(node.filter(function(d){return d.type == 'f'}))

    // stitched guards
    _this.draw_stitched_guard(node.filter(function(d){return d.type == 'g' && !d.target }))

    // not stitched guards
    var not_stitched = node.filter(function(d){return d.type == 'g' && d.target })
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

translate = function(a, b) {
  return 'translate(' + a + ',' + b + ')'
}
TraceForest.prototype._tr = translate

TraceForest.prototype.walk_visual_trace_tree = function(json, yoff, traces, links) {
  // iterate the trace tree and create visual objects that can later be easily
  // aligned and rendered in the SVG chart
  var _this = this
  var vtrace = new VisualTrace(json.root, yoff)
  traces.push(vtrace)
  var labels = {}
  var label_counter = 1
  var last = null
  var node = null
  var i = 0;
  var visual_nodes = json.stitches[json.root]
  for (var i = 0; i < visual_nodes.length; i++) {
    var vn = visual_nodes[i].split(',')
    var type = vn[0]
    var index = parseInt(vn[1])
    var descr_nmr = parseInt(vn[2], 16)
    var target = null
    if (vn.length > 3) {
      var target = parseInt(vn[3], 16)
    }
    var node = new VisualTraceNode(vtrace, index, i, type, descr_nmr, target)
    vtrace.nodes.push(node)
  }

  // create the links between the nodes
  var last = null
  vtrace.nodes.forEach(function(node,index){
    if (last !== null) {
      links.push({'source': last, 'target': node});
    }
    last = node;
  });

  // xxx
  //vtrace.stitches.forEach(function(obj){
  //  var op = obj.op
  //  var stitched = op.get_stitched_trace()
  //  if (stitched !== undefined){
  //    var yoff = vtrace.yoff + obj.index-1
  //    var vstrace = _this.walk_visual_trace_tree(stitched, yoff, traces, links)
  //    var tgt = vstrace.nodes[0]
  //    links.push({'source': op.visual_node , 'target': tgt, class: 'stitch-edge'})
  //  }
  //})
//  trunk.forEachOp(function(op){
//    if (op.is_label() || op.is_jump()) {
//      vtrace.nodes.push(node)
//      if (op.get_descr_nmr() in labels) {
//        node.label = labels[op.get_descr_nmr()]
//      } else {
//        node.label = label_counter
//        labels[op.get_descr_nmr()] = label_counter
//        label_counter += 1
//      }
//      i += 1
//    } else if (op.is_guard()) {
//      // add a new node, give it a connection to the previous
//      var bridge = op.get_stitched_trace()
//      if (last && !bridge && last.guard && last.class.indexOf('stitched') == -1) {
//        last.consumed.push(op)
//        return true;
//      }
//      node = new VisualTraceNode(vtrace, i, op)
//      node.set_guard(op, bridge)
//      vtrace.nodes.push(node)
//      if (bridge !== undefined) {
//        node.class += ' stitched'
//        vtrace.stitches.push({'op': op, 'index': vtrace.nodes.length })
//      }
//      i += 1;
//    } else if (op.is_finish()) {
//      node = new VisualTraceNode(vtrace, i, op)
//      vtrace.nodes.push(node)
//      node.finish = true
//      i += 1
//    } else {
//      return true // continue to next iteration
//    }
//    if (last) {
//      links.push({'source': last, 'target': node})
//    }
//    last = node
//    return true;
//  })

  return vtrace
}
