
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
  this.xoff = 0
}

VisualTrace.prototype.branch_count = function() {
  if (this._branch_count !== undefined) {
    return this._branch_count
  }
  var count = 1;
  this.stitches.forEach(function(stitch){
    count += stitch.trace.branch_count()
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

  this.stitches.forEach(function(stitch){
    var trace = stitch.trace
    if (part.leftcount < part.rightcount) {
      part.leftcount += trace.branch_count()
      part.left.push(trace)
    } else {
      part.rightcount += trace.branch_count()
      part.right.push(trace)
    }
  })
  // sort the sets left and right to display them correctly!
  part.left.sort(function(a,b){
    return a.yoff - b.yoff
  })
  part.right.sort(function(a,b){
    return b.yoff - a.yoff
  })

  if (part.leftcount + part.rightcount + 1 != part.total) {
    console.error("partition for rendering has incorrrect branch count!")
    console.error(part.leftcount, "+", part.rightcount, "!=", total)
  }


  return part
}

VisualTraceNode = function(vtrace, order, index, type, descr_nmr, target) {
  this.vtrace = vtrace
  this.class = 'trace-enter'
  this.order = order // order in which it should be drawn
  this.index = index // the index within the trace
  this.type = type
  this.descr_nmr = descr_nmr
  this.target = target
  this.x = 0
  this.y = 0
  this.guard = null
}

TraceForest = function(jitlog){
  this._jitlog = jitlog
  this._forest = []
}

TraceForest.prototype.draw_trace_enter = function(svg){
    svg.append("svg:circle").attr("r", 3)
}

TraceForest.prototype.draw_trace_finish = function(svg){
    svg.append("svg:circle").attr("r", 3)
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
  this.up_layer = svg.append("svg:g")
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
  //jthis.find('rect').attr("class","trace-bg-active")
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
  //jthis.find('rect').attr("class","empty-rect")
  trace_forest.pop_over.hide()
}

TraceForest.prototype.mouse_enter_node = function() {
  var jthis = jQuery(this)
  scale(jthis, 2)
  var trace = jitlog.get_trace_by_id(parseInt(jthis.data('trace-id')))
  var stage = trace.get_stage('asm')
  var op = stage.get_operation_by_index(parseInt(jthis.data('op-index')))
  var values = {
    node_type: jthis.data('op-type'),
  }
  if (op.has_stitched_trace()) {
    var strace = op.get_stitched_trace()
    values.op = op
    values.tgt_trace = strace
    values.tgt_funcname = strace.get_func_name()
    values.tgt_filename = strace.get_filename()
    values.tgt_lineno = strace.get_lineno()
  }
  trace_forest.pop_over.show(values)

  var g = d3.select("#popover-trace-node")
  g.selectAll("*").remove() 
  var type = jthis.data('op-type')
  if (type == 'l') { draw_node('label', g) }
  else if (type == 'j') { draw_node('jump', g) }
  else if (type == 'f') { draw_node('finish', g) }
  else if (type == 'g') {
    if (op.has_stitched_trace()) { draw_node('stitched', g) }
    else { draw_node('guard', g) }
  }
}
TraceForest.prototype.mouse_leave_node = function() {
  var jthis = jQuery(this)
  scale(jthis, 1)
}

draw_triangle = function(g, s) {
  var h = s * 2
  return g.append("svg:path")
     .attr("class", 'svg-arrow')
     .attr("d", "M0,-"+h+" l"+s+","+h+" l-"+2*s+",0 l"+s+",-"+h)
}

draw_node = function(type, svg) {
  if (type == 'stitched') {
    var svg = svg.append("svg:rect").attr("x", -2.5).attr("y", -2.5).attr("width", 5).attr("height", 5)
  } else if (type == 'finish') {
    var svg = svg.append("svg:rect").attr("x", -2.5).attr("y", -2.5).attr("width", 5).attr("height", 5)
                 .attr("fill", "#EF351D")
  } else if (type == 'label') {
    var cw = 3;
    type = 'jump-label'
    var svg = svg.append("svg:circle")
                 .attr("r", cw)
                 .attr("fill", "#EF351D")
  } else if (type == 'jump' || type == 'label') {
    var cw = 3;
    var svg = svg.append("svg:line")
                 .attr("x1", -cw).attr("y1", 0)
                 .attr("x2", cw).attr("y2", 0)
                 .attr("class", type)
  } else if (type == 'guard' || type == 'finish') {
    var svg = svg.append("svg:g")
    var cw = 2 // cross half width
    svg.append("svg:line")
                  .attr("x1", -cw).attr("y1", -cw)
                  .attr("x2", cw).attr("y2", cw)
                  .attr("class", type)
    svg.append("svg:line")
                  .attr("x1", cw).attr("y1", -cw)
                  .attr("x2", -cw).attr("y2", cw)
                  .attr("class", type)
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

  svg.attr("class", type)
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
  var vtrace = _this.walk_visual_trace_tree(visual_trace, visual_trace.stitches[visual_trace.root], 0, traces, links)

  this.node_layer.remove()
  this.link_layer.remove()
  this.up_layer.remove()
  this.link_layer = this.svg.append("svg:g")
  this.node_layer = this.svg.append("svg:g")
  this.up_layer = this.svg.append("svg:g")

  var tree_grp = this.node_layer.append("svg:g")

  var part = vtrace.align_tree(0)
  var width = (part.leftcount + 1 + part.rightcount) * 10
  this.link_layer.attr("transform", translate(-width/2,25))
  this.node_layer.attr("transform", translate(-width/2,25))
  this.up_layer.attr("transform", translate(-width/2 + 10,10))

  var par = trunk.get_parent()
  if (par) {
    this.up_layer.on("click", function(){
                      var trace = jitlog.get_trace_by_id(parseInt(par,16))
                      $scope.switch_trace(trace, trace.type)
                    })
    this.up_layer.append("svg:circle")
            .attr("r", 8)
            .attr("class", "trace-nav-up")
    draw_triangle(this.up_layer, 4.5).attr("transform", translate(0,3))
  }

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
                  .attr("class", function(d){
                    return 'node ' + d.class
                  })
                  .attr("data-trace-id", parseInt(trace.id,16))
                  .attr("data-op-index", function(d){ return d.index })
                  .attr("data-op-type", function(d){ return d.type })
                  .attr("transform", function(d) {
                    d.ix = 0
                    d.iy = d.order
                    d.x = 0
                    d.y = d.iy * 7
                    return translate(d.x, d.y)
                  })
                  .on("mouseenter", this.mouse_enter_node)
                  .on("mouseleave", this.mouse_leave_node)

    // first and last instruction
    draw_node('label', node.filter(function(d){return d.type == 'l'}))
    draw_node('finish', node.filter(function(d){return d.type == 'f'}))
    draw_node('jump', node.filter(function(d){return d.type == 'j'}))

    draw_node('stitched', node.filter(function(d){return d.type == 'g' && d.target != 0 }))
    draw_node('guard', node.filter(function(d){return d.type == 'g' && d.target == 0 }))

    var trace_connect = function(obj,x,y){
      var a = obj.source
      var b = obj.target

      var x1 = a.x + a.vtrace.xoff * 10
      var y1 = a.y + a.vtrace.yoff * 7
      var x2 = b.x + b.vtrace.xoff * 10
      var y2 = b.y + b.vtrace.yoff * 7

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

TraceForest.prototype.walk_visual_trace_tree = function(json, visual_nodes, yoff, traces, links) {
  if (!visual_nodes) {
    console.warn("did not find the node list!")
    return new VisualTrace(json.root, yoff)
  }
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
  var order = 0;
  for (var i = 0; i < visual_nodes.length; i++) {
    var vn = visual_nodes[i].split(',')
    var type = vn[0]
    var index = parseInt(vn[1])
    var descr_nmr = parseInt(vn[2], 16)
    var target = 0;
    if (vn.length > 3) {
      var target = parseInt(vn[3], 16)
    }

    // remove multiple guards that are not stitched
    if (last && last.type === 'g' && last.target === 0 &&
        type === 'g' && target === 0) {
      continue;
    }

    var node = new VisualTraceNode(vtrace, order++, index, type, descr_nmr, target)
    last = node;
    vtrace.nodes.push(node)
    if (type == 'g' && target !== 0) {
      var bridge = this.walk_visual_trace_tree(json, json.stitches['0x'+target.toString(16)], yoff + order, traces, links);
      bridge.class += ' stitched'
      var target = bridge.nodes[0]
      if (target) {
        links.push({'source': node, 'target': target, class: 'stitch-edge'})
        vtrace.stitches.push({'node': node, 'trace': bridge, 'index': index })
      }
    }
  }

  // create the links between the nodes
  var last = null
  vtrace.nodes.forEach(function(node,index){
    if (last !== null) {
      links.push({'source': last, 'target': node});
    }
    last = node;
  });

  return vtrace
}
