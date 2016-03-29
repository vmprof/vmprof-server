
var JitLog = function (data) {
  this._traces = {};
  this._resops = data.resops
  this._trace_list = [];
  for (var key in data.traces) {
    var trace = data.traces[key]
    var objtrace = new Trace(this, trace);
    this._traces[trace.addr[0]] = objtrace
    this._trace_list.push(objtrace)
  }
};

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
  var enable = function(e, clicked){
    jQuery('.live-range').removeClass('selected');
    var varid = extract_class(jQuery(this).attr('class'), 'varid-');
    var min_index = Number.MAX_VALUE;
    var max_index = -1;
    jQuery("."+varid).each(function(){
      jQuery(this).addClass('selected');
      if (clicked) {
        jQuery(this).data('_stay_selected', clicked)
      }
      var integer = parseInt(jQuery(this).parent().data('index'))
      if (integer < min_index) { min_index = integer; }
      if (integer > max_index) { max_index = integer; }
    })
    console.log("found min,max index: %d,%d", min_index, max_index);
    for (var i = min_index; i <= max_index; i++) {
      jQuery('.live-range-' + (i+1)).addClass('selected')
    }
  }
  var disable = function(e, varid){
    jQuery('.var').each(function(){
      var _this = jQuery(this)
      if (_this.hasClass('selected')) {
        // varid is undefined: deselect only if _stay_selected is undefined
        var staysel = _this.data('_stay_selected')
        if (!staysel || // remove if should not stay selected
            (staysel && varid && _this.hasClass(varid))) {
          _this.removeClass('selected');
          _this.removeAttr('_stay_selected');
        }
      }
    })
    jQuery('.live-range').removeClass('selected');
  }
  var enable_or_disable = function(){
    if (jQuery(this).data('_stay_selected')) {
      var varid = extract_class(jQuery(this).attr('class'), 'varid-');
      disable.call(this, undefined, varid);
    } else {
      enable.call(this, undefined, 1);
    }
  }
  jQuery('.var').hover(enable, disable);
  jQuery('.var').click(enable_or_disable);
}

JitLog.prototype.all_traces = function() {
  return this._trace_list;
}
JitLog.prototype.get_trace_by_id = function(id) {
  return this._traces[id]
}

var Trace = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data
}

Trace.prototype.get_type = function() {
  return this._data.type;
}
Trace.prototype.get_name = function() {
  return this._data.name || 'empty'
}

Trace.prototype.get_unique_id = function() {
  if ('addr' in this._data) {
    return this._data.addr[0]
  }
  return this._data.unique_id
}

Trace.prototype.get_operations = function(name) {
  var stages = this._data.stages;
  if (name in stages) {
    return new Operations(this._jitlog, stages[name]);
  }
  return new Operations(this._jitlog, {'ops': [], 'tick': -1});
}

var Operations = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data.ops
  this._tick = data.tick
  this._ops = []
  for (var key in this._data) {
    var opdata = this._data[key]
    var op = new ResOp(this._jitlog, opdata)
    this._ops.push(op)
  }
}

Operations.prototype.list = function() {
  return this._ops;
}


var ResOp = function(jitlog, data) {
  this._jitlog = jitlog
  this._data = data
}

ResOp.prototype.to_s = function(index) {
  var prefix = '<span class="live-range live-range-'+index+'"></span>' +
               '<span class="trace-line-number">'+index+':</span> '
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
  return array;
}
