
var Loading = function($scope) {
  this._requests = []
  this.$scope = $scope
}

Loading.prototype.start = function(msg) {
  this._requests.push(msg)
  this.$scope.loading = true
}

Loading.prototype.stop = function() {
  this._requests.pop()
  if (this._requests.length == 0) {
    this.$scope.loading = false
  }
}

Loading.prototype.complete = function() {
  return this._requests.length === 0
}

var JitLog = function () {
  this._id_to_traces = {};
  this._addr_to_trace = {}
  this._descrnmr_to_op = {}
  this._trace_list = []
  this._resops = {}
  this._timings = {}
  this.measures = []
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

JitLog.hoverVars = function($scope) {
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
    var column = undefined
    if (hovered) {
      // if it is already hovered we know which color to take
      color = jQuery(this).data('hover-color')
      column = jQuery(this).data('live-range')
    }
    if (!column) {
      column = JitLog.liverange_indices.pop()
    }
    jQuery("." + varid).each(function(){
      var span = jQuery(this)
      span.data('live-range', column)
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
      var integer = parseInt(jQuery(this).parent().first().data('index'))
      if (integer < min_index) { min_index = integer; }
      if (integer > max_index) { max_index = integer; }
    })
    var broadcast_key = 'live-range-' + column;
    $scope.$broadcast(broadcast_key, min_index, max_index, color)
  }
  //
  // disable a hovered variable
  //
  var disable = function(e, varid, click){
    var $this = jQuery(this)
    var lr = parseInt($this.data('live-range'))
    var columns_to_disable = []

    if (!$this.data('_stay_selected') || click) {
      var color = $this.data('hover-color')
      if (color) {
        JitLog.freeColors.push(color)
      }
      if (lr) {
        JitLog.liverange_indices.push(lr)
        columns_to_disable.push(lr)
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

    columns_to_disable.forEach(function(column){
      $scope.$broadcast('live-range-' + column, 0, Number.MAX_VALUE, '');
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

JitLog.prototype.add_measures = function(action, data) {
  var last = {}
  for (m in data.measures) {
    last[m] = data.measures[m]
  }
  if (!('action' in last)) {
    last['action'] = action
  }
  this.measures.push(last)
}

JitLog.prototype.set_meta = function(meta) {
  this._resops = meta.resops
  this.machine = meta.machine
  this.word_size = meta.word_size
  var total_entries = 0
  var traces = meta.traces
  for (var key in traces) {
    var trace = traces[key]
    var objtrace = new Trace(this, key, trace);
    // a lookup to find the assembly addr (first byte) -> trace
    if (trace.addr) {
      this._addr_to_trace[trace.addr[0]] = objtrace
    }
    // a lookup to find the mapping from id -> trace
    this._id_to_traces[objtrace.get_id()] = objtrace
    this._trace_list.push(objtrace)

    total_entries += objtrace.get_enter_count()
  }
  for (var key in this._id_to_traces) {
    var trace = this._id_to_traces[key]
    var p = (trace.get_enter_count() / total_entries) * 100.0
    if (p > 100) {
      console.error("total {0} entries {1} -> {2}%".format(total_entry, trace.get_enter_count(), p))
    }
    trace.entry_percent = p
  }

  var links = meta.links
  for (var subject_id in links) {
    // the source trace
    var strace = this.get_trace_by_id(subject_id)
    var idxtoid = links[subject_id]
    for (var idx in idxtoid) {
      var trace_id = idxtoid[idx]
      // target trace
      var ttrace = this.get_trace_by_id(trace_id)
      strace.link_op_to(parseInt(idx), ttrace)
    }
  }
}

JitLog.prototype.filter_and_sort_traces = function(text, type, ordering) {
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
      var scope = trace.get_func_name()
      var filename = trace.get_filename()
      if (scope && scope.indexOf(text) !== -1) {
        list.push(trace)
      } else if (filename && filename.indexOf(text) !== -1) {
        list.push(trace)
      }
    }
  })

  list.sort(function(a,b){
    if (ordering === 'count') {
      return b.counter_points[0] - a.counter_points[0]
    } else if (ordering === 'name') {
      var aname = a.get_func_name()
      var bname = b.get_func_name()
      return aname.localeCompare(bname)
    } else {
      return a.recording_stamp - b.recording_stamp
    }
  })

  return list
}

JitLog.prototype.get_trace_by_id = function(id) {
  return this._id_to_traces[id]
}

JitLog.prototype.get_trace_by_addr = function(addr) {
  return this._addr_to_trace[addr]
}

Trace = function(jitlog, id, meta) {
  this._jitlog = jitlog
  this.id = id
  this.scope = meta.scope
  this.filename = meta.filename
  this.lineno = meta.lineno
  this.type = meta.type
  this._parent = meta.parent
  this.counter_points = meta.counter_points
  this._stages = {}
  this.jd_name = meta.jd_name
  this.recording_stamp = meta.stamp
  this._failing_guard = null
  this._opidx_to_trace = {}
}

Trace.prototype.link_op_to = function(index, target) {
  // it is assumed that the index comes from an op in the "asm" stage
  this._opidx_to_trace[index] = target
}

Trace.prototype.set_data = function(data) {
  var stages = data.stages;
  if (stages.noopt){
    this._stages.noopt = new Stage("noopt", this, stages.noopt, data.code)
  }
  if (stages.opt){
    this._stages.opt = new Stage("opt", this, stages.opt, data.code)
  }
  if (stages.asm){
    this._stages.asm = new Stage("asm", this, stages.asm, data.code)
  }
  this._failing_guard = new ResOp(this._jitlog, data.failing_guard, this, 0)
  this.link()
}

Trace.prototype.get_enter_percent = function() {
    // when this trace has been entered 10 times,
    // and the sum of every other trace.get_enter_count() is 100
    // then this function returns 10.0
    return this.entry_percent
}
Trace.prototype.get_enter_count = function() {
  return this.counter_points[0] || 0
}

Trace.prototype.get_id = function() {
  return this.id
}

Trace.prototype.is_bridge = function() {
  return this.type === 'bridge'
}

Trace.prototype.trace_top_info_html = function() {
  var info = []
  info.push('Driver name: "' + this.jd_name + '"')
  info.push('Scope/Function: "' + this.scope + '"')
  info.push(null)
  info.push('Filename: ' + this.filename)
  info.push('Lineno: ' + this.lineno)
  info.push(null)
  if (this.is_bridge()) {
    var parent_id = parseInt(this.get_parent(), 16)
    if (parent_id) {
      var par = this._jitlog.get_trace_by_id(parent_id)
      var parent_str = '&uarr; back to parent trace';
      info.splice(0, 0, 'This trace is a <strong>bridge</strong>.')
      info.push('Parent:')
      info.push('<a ng-click="switch_trace(\''+parent_id+'\', $storage.trace_type, $storage.show_asm)">'+parent_str+'</a>')
      info.push('Driver name: "' + par.jd_name + '"')
      info.push('Scope/Function: "' + par.scope + '"')
      var op = this._failing_guard
      if (op) {
        info.push(null)
        info.push("Guard that failed: <span class=\"parent-failed-guard\">" + op.format_resop('','',false)) + "</span>"
      }
    } else {
      info.push("no known parent id")
    }
  } else {
    info.splice(0, 0, 'This trace is a <strong>loop</strong>.')
  }
  var str = '';
  for (var i = 0; i < info.length; i++) {
    var elem = info[i]
    if (elem) {
      str += '<span>'+elem+'</span> '
    } else {
      // elem is null, insert <br>
      str += '<br>'
    }
  }
  return str
}

Trace.prototype.link = function() {
  var _this = this;
  this.forEachOp(function(op){
    var descr_nmr = op.get_descr_nmr()
    if (descr_nmr && descr_nmr !== "-0x1") {
      _this._jitlog._descrnmr_to_op[descr_nmr] = op
    }
    return true
  })
}

Trace.prototype.get_parent = function() {
  return this._parent
}

Trace.prototype.is_trunk = function() {
  return this.get_type() === 'loop'
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
  return this.type;
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

Trace.prototype.get_func_name = function(){
  return this.scope;
}

Trace.prototype.get_driver_name = function(){
  return this.jd_name
}

Trace.prototype.get_filename = function(){
  return this.filename;
}

Trace.prototype.get_lineno = function(){
  return this.lineno;
}

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
  return new Stage(name, this, {'ops': [], 'tick': -1}, {});
}

var MergePoint = function(data) {
  this._data = data
}

var Stage = function(name, trace, data, code) {
  this._name = name
  this._trace = trace
  this._jitlog = trace._jitlog
  this._data = data
  this._code = code
  this._tick = data.tick
  this.ops = []
  var i = 0
  for (var key in data.ops) {
    var opdata = data.ops[key]
    var op = new ResOp(this._jitlog, opdata, this, i)
    this.ops.push(op)
    i += 1
  }
}

Stage.prototype.list = function() {
  return this.ops;
}

Stage.prototype.get_operation_by_index = function(index) {
  if (index < 0 || index >= this.ops.length) {
    return null
  }
  return this.ops[index]
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



var ResOp = function(jitlog, data, stage, index) {
  this._jitlog = jitlog;
  this._stage = stage;
  this._data = data;
  this._assembly = null;
  this.index = index;
  this._link_updated = false
  this._link = undefined
}

ResOp.prototype.get_descr_nmr = function() {
  return this._data.descr_number
}

ResOp.prototype.get_index = function() {
  return this.index
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
  //return this.get_descr_nmr() && this.get_descr_nmr() in this._jitlog._descrnmr_to_trace
  this.update_link()
  return this._link != undefined
}

ResOp.prototype.update_link = function() {
  if (this._link_updated === false) {
    var mytrace = this._stage._trace
    // the target trace
    this._link = mytrace._opidx_to_trace[self.index]
    this._link_updated = true
  }
}

ResOp.prototype.get_stitched_trace = function() {
  this.update_link()
  return this._link
  //var stitched = this._jitlog._descrnmr_to_trace[parseInt(this._data.descr_number,16)]
  //return stitched
}

ResOp.prototype.get_stitch_id = function() {
  return this._data.descr_number
}

ResOp.prototype.has_descr = function() {
  return this._data.descr_number !== undefined
}

ResOp.prototype.format_resop = function(prefix, suffix, html) {
  if ('rs' in this._data && this._data.res !== '?') {
    if (html) {
       prefix += this.format_var(this._data.res) + ' = '
    } else {
       prefix += this._data.res + ' = '
    }
  }
  var opnum = this._data.num
  var opname = this._jitlog._resops[opnum]
  var args = this._data.args || []
  var descr = this._data.descr
  var arg_str = ''
  for (var i = 0; i < args.length; i++) {
    if (html) {
      arg_str += this.format_var(args[i]);
    } else {
      arg_str += args[i];
    }
    if (i+1 < args.length) {
      arg_str += ', ';
    }
  }
  if (descr) {
    var descr_str = descr.replace("<","").replace(">","")
    descr = (' <span class="resop-descr">' + descr_str + "</span>");
    if (this.has_descr() && html && this._stage.name === "asm") {
      var trace = undefined
      var jl = this._jitlog
      if (opname == 'label') {
        console.warn("label?")
        //trace = jl._descrnmr_to_trace[parseInt(this._data.descr_number, 16)]
      } else if (opname == 'jump') {
        console.warn("jump?")
        //trace = jl._descrnmr_to_trace[parseInt(this._data.descr_number, 16)]
      } else {
        trace = this.get_stitched_trace()
      }
      if (trace) {
        var id = trace.id
        descr = ' <a class="resop-descr" ng-click="switch_trace(\''+id+'\', $storage.trace_type, $storage.show_asm)">&rarr; '+descr_str+'</a>'
      }
    }
  } else {
    descr = '';
  }
  return prefix + '<span class="resop-name">' +
         opname + '</span>(' + arg_str + ')' + descr + suffix
}

ResOp.prototype.format_var = function(variable) {
  var type = 'const';
  if (variable.startsWith("i") ||
      variable.startsWith("r") ||
      variable.startsWith("p") ||
      variable.startsWith("v") ||
      variable.startsWith("f")) {
    var type = 'var';
  }
  return '<span class="'+type+' varid-' + variable + '">' + variable + '</span>'
}

ResOp.prototype.to_s = function() {
  var prefix = ''
  return this.format_resop(prefix, '', false);
}

ResOp.prototype.to_html = function(index) {
  var humanindex = index
  index = index - 1
  var prefix = ''
  prefix += '<span class="trace-line-number">'+humanindex+':</span> '
  var opnum = this._data.num
  var opname = this._jitlog._resops[opnum]
  var suffix = '';
  if (opname === "increment_debug_counter") {
    var trace = this._stage._trace
    var count = trace.counter_points[index]
    if (count) {
      var count = 
      suffix += ' <span class="resop-run-count">passed '+numeral(count).format('0.0 a')+' times</span>'
    }
  }
  return this.format_resop(prefix, suffix, true);
}

ResOp.prototype.source_code = function(index) {
  // first extract the merge points for this index
  var data = this._stage._data
  var merge_points = data.merge_points[index]
  if (!merge_points) { return '' }

  // try to find the previous merge point
  var prev_merge_points
  for (prev_index = index - 1; prev_index >= 0; prev_index -= 1) {
    prev_merge_points = data.merge_points[prev_index]
    if (prev_merge_points) {
      break
    }
  }
  var resop = this
  var text = []
  var code = this._stage._code
  var last_filename
  var last_lineno
  var last_scope
  if (prev_merge_points) {
    last_filename = prev_merge_points[prev_merge_points.length - 1].filename
    last_lineno = prev_merge_points[prev_merge_points.length - 1].lineno
  }
  merge_points.forEach(function(mp) {
    var same_line = (last_filename == mp.filename) && (last_lineno == mp.lineno)
    // only print the source line if it is different than the source line of
    // the previous merge point. Often, it is the same source line, since there
    // are many opcodes on the same line.
    if (!same_line && mp.filename in code) {
      var source_lines = code[mp.filename]
      var line = ''
      var indent = '';
      if (mp.lineno in source_lines) {
        var indent_n_line = source_lines[mp.lineno]
        indent = Array(indent_n_line[0]+1).join(' ')
        line = indent_n_line[1]
      } else {
        line = "?"
      }
      text.push('<code class="trace-source">&gt;<pre>'+indent+line+'</pre></code>')
      last_filename = mp.filename
      last_lineno = mp.lineno
    }
  })
  return text.join("<br>")
}

ResOp.prototype.byte_codes = function(index) {
  // first extract the merge points for this index
  var data = this._stage._data
  var merge_points = data.merge_points[index]
  var resop = this
  var text = []
  var code = this._stage._code
  if (!merge_points) {
    // is the case for jit drivers such as the ones in micro numpy (do not have byte codes)
    return '';
  }
  merge_points.forEach(function(mp) {
    var source_lines = code[mp.filename]
    if (!source_lines) {
      return
    }
    var indent = '';
    if (mp.lineno in source_lines) {
      var indent_n_line = source_lines[mp.lineno]
      indent = Array(indent_n_line[0]+1).join(' ')
    }
    text.push('<code class="trace-bytecode">&gt;<pre>'+indent+mp.opcode+'</pre></code>')
  })
  return text.join("<br>")
}


var get_capstone_arch_descr = function(jl) {
  var machine = jl.machine || ''
  var word_size = jl.word_size || 8
  var mode = 0
  if (word_size == 4) {
    mode |= capstone.MODE_32
  } else {
    mode |= capstone.MODE_64
  }
  if (machine.startsWith("x86")) {
    return { 'mode': mode, 'arch': capstone.ARCH_X86 }
  } else if (machine.startsWith("ppc")) {
    if (machine.endsWith("le")) {
      mode |= capstone.MODE_LITTLE_ENDIAN
    } else if (machine.endsWith("be")) {
      mode |= capstone.MODE_BIG_ENDIAN
    }
    return { 'mode': mode, 'arch': capstone.ARCH_PPC }
  } else if (machine.startsWith("s390x")) {
    mode |= capstone.MODE_BIG_ENDIAN
    return { 'mode': mode, 'arch': capstone.ARCH_SYSZ }
  } else if (machine.startsWith("arm")) {
    return { 'mode': mode, 'arch': capstone.ARCH_ARM }
  }
  return null
}

ResOp.prototype.get_disassembly = function(jl) {
  if (this._assembly) {
    return this._assembly;
  }
  var array = [];
  if (!('dump' in this._data)) {
    return array;
  }

  var dump = this._data.dump;

  var buffer = [];
  var offset = 0x0;
  // machine code dump is encoded as base64
  var buffer_str = atob(dump)
  for (var i = 0; i < buffer_str.length; ++i) {
    buffer.push(buffer_str.charCodeAt(i));
  }

  var rfmt = function(text){
    var regex = /r(ax|cx|dx|si|di|bp|sp|\d+)/g
    return text.replace(regex, '<span class="reg" data-varid="r$1">r$1</span>')
  }

  var arch_descr = get_capstone_arch_descr(jl)
  if (arch_descr === null) {
    return ''
  }

  var cs = new capstone.Cs(arch_descr.arch, arch_descr.mode);
  var instructions = cs.disasm(buffer, offset);
  instructions.forEach(function (instr) {
    array.push('<span class="asm-mnemoic">' + 
               instr.mnemonic + "</span> " + rfmt(instr.op_str));
  });
  cs.delete();
  this._assembly = array;
  return array;
}
