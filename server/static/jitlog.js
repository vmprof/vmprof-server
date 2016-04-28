

var JitLog = function (data) {
  this._id_to_traces = {};
  this._addr_to_trace = {}
  this._descrnmr_to_trace = {}
  this._descrnmr_to_op = {}
  this._resops = data.resops
  this._trace_list = []
  var _this = this
  var total_entries = 0
  data.traces.forEach(function(trace){
    var objtrace = new Trace(_this, trace);
    // a lookup to find the assembly addr (first byte) -> trace
    if (trace.addr) {
      _this._addr_to_trace[trace.addr[0]] = objtrace
    }
    // a lookup to find the mapping from id -> trace
    _this._id_to_traces[objtrace.get_id()] = objtrace
    _this._trace_list.push(objtrace)

    total_entries += objtrace.get_enter_count()
  })
  for (var key in this._id_to_traces) {
    var trace = this._id_to_traces[key]
    trace.link();
    trace.entry_percent = (trace.get_enter_count() / total_entries) * 100.0
  }
}

JitLog.colorPalette = [
  '#801515','#804515','#116611','#3d5898',
  '#ee001c','#402152','#64ba1d','#ff6c00'
]

JitLog.resetState = function() {
  JitLog.freeColors = clone(JitLog.colorPalette);
  JitLog.liverange_indices = [0,1,2,3,4,5,6,7,8]
}
JitLog.resetState();

var extract_class = function(str, prefix){
  // returns the first occurance!
  var str = str.substr(str.indexOf(prefix))
  if (str.indexOf(' ') != -1) {
    return str.substr(0, str.indexOf(' '))
  }
  return str
}


// static call
JitLog.hoverVars = function(){
  //
  // enable a variable (by coloring it and all it's occurances)
  //
  var enable = function(e, clicked){
    // is this variable already hovered?
    var hovered = clicked || jQuery(this).data('_stay_selected')
    var varid = extract_class(jQuery(this).attr('class'), 'varid-');
    var min_index = Number.MAX_VALUE;
    var max_index = -1;
    var color = undefined
    var curlr = undefined
    if (hovered) {
      // if it is already hovered we know which color to take
      color = jQuery(this).data('hover-color')
      curlr = jQuery(this).data('live-range')
    }
    if (!curlr) {
      curlr = JitLog.liverange_indices.pop()
    }
    jQuery("." + varid).each(function(){
      var span = jQuery(this)
      span.data('live-range', curlr)
      if (clicked) {
        // mark this var as clicked
        span.data('_stay_selected', clicked)
      } else {
        if (!color) {
          // we do not yet have a color? request a new one
          color = JitLog.freeColors.pop()
        }
        span.addClass('selected')
        span.css('background-color', color)
        span.css('color', 'white')
        // save away the hover color
        span.data('hover-color', color)
      }
      // get the min. max positions for this live range
      var integer = parseInt(jQuery(this).parent().data('index'))
      if (integer < min_index) { min_index = integer; }
      if (integer > max_index) { max_index = integer; }
    })
    console.log("found min,max index: %d,%d", min_index, max_index);
    for (var i = min_index; i <= max_index; i++) {
      var lr = jQuery('.live-range-' + curlr + '-' + (i+1))
      if (clicked) {
        lr.data('_stay_selected', curlr)
      }
      lr.addClass('selected')
      lr.css('background-color', color)
    }
  }
  //
  // disable a hovered variable
  //
  var disable = function(e, varid, click){
    var $this = jQuery(this)
    var lr = $this.data('live-range')

    if (!$this.data('_stay_selected') || click) {
      var color = $this.data('hover-color')
      if (color) {
        JitLog.freeColors.push(color)
      }
      if (lr) {
        JitLog.liverange_indices.push(lr)
      }
    }
    jQuery('.var').each(function(){
      var _this = jQuery(this)
      if (_this.hasClass('selected')) {
        // varid is undefined: deselect only if _stay_selected is undefined
        var staysel = _this.data('_stay_selected')
        if (!staysel || // remove if should not stay selected
            (staysel && varid && _this.hasClass(varid))) {
          _this.removeClass('selected');
          _this.css('background-color', '');
          _this.css('color', '');
          _this.removeData('_stay_selected');
          _this.removeData('live-range');
        }
      }
    })
    jQuery('.live-range').each(function(){
      var elem = jQuery(this)
      var staysel = elem.data('_stay_selected')
      var lrclass = 'live-range-col-'+ lr;
      if (!staysel ||
          (staysel && varid && lr && elem.hasClass(lrclass))) {
        if (click){ 
          elem.removeData('_stay_selected');
          elem.removeData('live-range');
        } else {
          elem.removeClass('selected')
          elem.css('background-color', '');
        }
      }
    })
  }
  var enable_or_disable = function(){
    if (jQuery(this).data('_stay_selected')) {
      var varid = extract_class(jQuery(this).attr('class'), 'varid-');
      disable.call(this, undefined, varid, 1);
    } else {
      enable.call(this, undefined, 1);
    }
  }
  jQuery('.var').hover(enable, disable);
  jQuery('.var').click(enable_or_disable);
}

JitLog.prototype.filter_traces = function(text, type) {
  // filter all traces according to the following criteria:
  // check if the type matches
  // if any enclosed name (of the debug merge points) matches
  // if any filename of the debug merge points matches
  // if any rpython function matches (TODO)
  var list = []
  this._trace_list.forEach(function(trace){
    if (trace.get_type() !== type && type !== "both") {
      return
    }
    if (text === "") {
      list.push(trace)
    } else {
      var merge_point = trace.get_stage('opt').get_first_merge_point()
      if (!merge_point) {
        return
      }
      var scope = merge_point._data['scope']
      var filename = merge_point._data['filename']
      if (scope && scope.indexOf(text) !== -1) {
        list.push(trace)
      } else if (filename && filename.indexOf(text) !== -1) {
        list.push(trace)
      }
    }
  })

  return list
}

JitLog.prototype.get_trace_by_id = function(id) {
  return this._id_to_traces[id]
}

Trace = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data
  this._bridges = data.bridges || []
  this._parent = undefined
  var _this = this;
  this._stages = {}
  var stages = data.stages;
  if (stages.noopt){
    this._stages.noopt = new Stage(this._jitlog, stages.noopt)
  }
  if (stages.opt){
    this._stages.opt = new Stage(this._jitlog, stages.opt)
  }
  if (stages.asm){
    this._stages.asm = new Stage(this._jitlog, stages.asm)
  }
}

Trace.prototype.get_enter_percent = function() {
    // when this trace has been entered 10 times,
    // and the sum of every other trace.get_enter_count() is 100
    // then this function returns 10.0
    return this.entry_percent
}
Trace.prototype.get_enter_count = function() {
  return this._data.counter
}

Trace.prototype.get_id = function() {
  return this._data.unique_id
}

Trace.prototype.bridge_count = function(fn) {
  return this._bridges.length;
}

Trace.prototype.partition_subtree = function() {
  var total = this.branch_count()
  var part = {leftcount:0, left:[], rightcount:0, right:[], total:total}

  this.walk_bridges(function(bridge){
    if (part.leftcount < part.rightcount) {
      part.leftcount += bridge.branch_count()
      part.left.push(bridge)
    } else {
      part.rightcount += bridge.branch_count()
      part.right.push(bridge)
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

Trace.prototype.align_tree = function(xoff) {
  // true means right, false means left
  var part = this.partition_subtree()
  this.visual_trace.xoff = 1 + xoff + part.leftcount

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

Trace.prototype.walk_bridges = function(fn) {
  var _this = this;
  this._bridges.forEach(function(bridge){
    var trace = _this._jitlog._addr_to_trace[bridge.target]
    fn.call(_this, trace);
  })
}

Trace.prototype.walk_trace_tree = function(fn) {
  fn.call(this, this);
  var _this = this
  this._bridges.forEach(function(bridge){
    var trace = _this._jitlog._addr_to_trace[bridge.target]
    fn.call(trace, trace);
    trace.walk_trace_tree(fn)
  })
}

Trace.prototype.link = function() {
  var _this = this;
  this._bridges.forEach(function(bridge){
    var trace = _this._jitlog._addr_to_trace[bridge.target]
    _this._jitlog._descrnmr_to_trace[bridge.descr_number] = trace
    trace._parent = _this;
    bridge.target_obj = trace;
  })
  this.forEachOp(function(op){
    if (op.get_descr_nmr()) {
      _this._jitlog._descrnmr_to_op[op.get_descr_nmr()] = op
    }
    return true
  })
}

Trace.prototype.parent = function() {
  return this._parent
}

Trace.prototype.is_trunk = function() {
  return this.get_type() === 'loop'
}

Trace.prototype.branch_count = function() {
  if (this._branch_count !== undefined) {
    return this._branch_count
  }
  var count = 1;
  this.walk_bridges(function(bridge){
    count += bridge.branch_count()
  })
  this._branch_count = count;
  return count
}

Trace.prototype.ends_with_jump = function() {
  var ops = this.get_stage('asm')
  var oplist = ops.list()
  if (oplist.length == 0) {
    return false
  }
  var lastop = oplist[oplist.length-1]
  return lastop.opname() == "jump"
}

Trace.prototype.is_stitched = function() {
  return this.parent() !== undefined
}

Trace.prototype.get_type = function() {
  return this._data.type;
}

var gen_first_mp_info = function(name, default_value) {
  // return the first enclosed function saved in the first debug_merge_point
  var f = function() {
    var stage = this.get_stage('opt')
    var mp = stage.get_first_merge_point()
    if (mp && mp._data[name] !== undefined) {
      return mp._data[name]
    }
    return default_value
  }
  return f
}

Trace.prototype.get_func_name = gen_first_mp_info('scope', 'implement get_location in jitdriver')
Trace.prototype.get_filename = gen_first_mp_info('filename', '-')
Trace.prototype.get_lineno = gen_first_mp_info('lineno', '0')

Trace.prototype.get_memory_addr = function() {
  return this._data.addr[0]
}

Trace.prototype.forEachOp = function(fn) {
  var ops = this.get_stage('asm').list()
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i]
    if (!fn.call(op, op)) {
      return true
    }
  }
  return false
}

Trace.prototype.for_each_merge_point = function(fn) {
  // the stage 'asm' does not carry any information about
  // the debug merge point. the rewrite step throws away this information
  return this.get_stage('opt').for_each_merge_point(fn)
}


Trace.prototype.get_stage = function(name) {
  if (this._stages[name] !== undefined) {
    return this._stages[name]
  }
  return new Stage(this._jitlog, {'ops': [], 'tick': -1});
}

var MergePoint = function(data) {
  this._data = data
}

var Stage = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data
  this._tick = data.tick
  this.ops = []
  for (var key in data.ops) {
    var opdata = data.ops[key]
    var op = new ResOp(this._jitlog, opdata)
    this.ops.push(op)
  }
}

Stage.prototype.list = function() {
  return this.ops;
}

Stage.prototype.for_each_merge_point = function(fn) {
  // merge_points is a hash: integer (index) -> [merge points]
  // a single index can have several merge points. thus
  // the double nested loop
  var mps = this._data.merge_points || {}
  for (var key in mps) {
    if (key === "first"){ continue }
    var points = mps[key]
    for (var i = 0; i < points.length; i++) {
      var mp = new MergePoint(points[i])
      if (!fn.call(mp, mp)) {
        return true
      }
    }
  }
  return false
}

Stage.prototype.get_first_merge_point = function() {
  var mp = this._data.merge_points || {}
  var first_index = mp['first']
  if (!first_index) {
    return null
  }
  var list = mp[first_index]
  if (list.length == 0) {
    return null
  }
  return new MergePoint(list[0])
}



var ResOp = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data
  this._index = -1
  this._assembly = null
}

ResOp.prototype.get_descr_nmr = function() {
  return this._data.descr_number
}

ResOp.prototype.getindex = function() {
  return this._index
}

ResOp.prototype.opname = function() {
  var opnum = this._data.num
  var opname = this._jitlog._resops[opnum]
  return opname
}

ResOp.prototype.is_finish = function() {
  return this.opname() === "finish"
}

ResOp.prototype.is_jump = function() {
  return this.opname() === "jump"
}

ResOp.prototype.is_label = function() {
  return this.opname() === "label"
}

ResOp.prototype.is_guard = function() {
  return this.opname().indexOf('guard') !== -1
}

ResOp.prototype.has_stitched_trace = function() {
  return this.get_descr_nmr() && this.get_descr_nmr() in this._jitlog._descrnmr_to_stichted_trace
}

ResOp.prototype.get_stitched_trace = function() {
  var stitched = this._jitlog._descrnmr_to_trace[this._data.descr_number]
  return stitched
}

ResOp.prototype.get_stitch_id = function() {
  return this._data.descr_number
}

ResOp.prototype.to_s = function(index) {
  var prefix = ''
  for (var i = 0; i < JitLog.liverange_indices.length; i++) {
    var j = JitLog.liverange_indices[i]
    prefix += '<span class="live-range live-range-'+j+'-'+index+' ' +
              'live-range-col-'+i+'"></span>'
  }
  prefix += '<span class="trace-line-number">'+index+':</span> '
  var fvar = function(variable) {
    var type = 'const';
    if (variable.startsWith("i") ||
        variable.startsWith("r") ||
        variable.startsWith("p") ||
        variable.startsWith("f")) {
      var type = 'var';
    }
    return '<span class="'+type+' varid-' + variable + '">' + variable + '</span>'
  }
  if ('res' in this._data && this._data.res !== '?') {
    prefix += fvar(this._data.res) + ' = '
  }
  var opnum = this._data.num
  var opname = this._jitlog._resops[opnum]
  var args = this._data.args
  var descr = undefined
  var format = function(prefix, opname, args, descr) {
    var arg_str = ''
    for (var i = 0; i < args.length; i++) {
      arg_str += fvar(args[i]);
      if (i+1 < args.length) {
        arg_str += ', ';
      }
    }
    return prefix + '<span class="resop-name">' +
           opname + '</span>(' + arg_str + ')'
  }
  return format(prefix, opname, args, descr);
}

ResOp.prototype.get_disassembly = function() {
  if (this._assembly) {
    return this._assembly;
  }
  var array = [];
  if (!('dump' in this._data)) {
    return array;
  }

  var dump = this._data.dump[1];

  var buffer = [];
  var offset = 0x0;
  var lookup = "0123456789ABCDEF";
  for (var i = 0; i < dump.length; i+=2) {
    var m = lookup.indexOf(dump[i]);
    var n = lookup.indexOf(dump[i+1]);
    buffer.push((m << 4) | n)
  }

  var rfmt = function(text){
    var regex = /r(ax|cx|dx|si|di|bp|sp|\d+)/g
    return text.replace(regex, '<span class="reg" data-varid="r$1">r$1</span>')
  }

  var cs = new capstone.Cs(capstone.ARCH_X86, capstone.MODE_64);
  var instructions = cs.disasm(buffer, offset);
  instructions.forEach(function (instr) {
    array.push('<span class="asm-mnemoic">' + 
               instr.mnemonic + "</span> " + rfmt(instr.op_str));
  });
  cs.delete();
  this._assembly = array;
  return array;
}
