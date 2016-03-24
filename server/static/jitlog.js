
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

ResOp.prototype.to_s = function(format) {
  var prefix = ''
  if ('res' in this._data && this._data.res !== '?') {
    prefix = this._data.res + ' = '
  }
  var opnum = this._data.num
  var opname = this._jitlog._resops[opnum]
  var args = this._data.args
  var descr = undefined
  var format = function(prefix, opname, args, descr) {
    var a = args.join(', ')
    return prefix + '<span class="resop-name">' +
           opname + '</span>(' + a + ')'
  }
  var format_variable = function(variable) {
    return '<span class="var ' +  + '">' + variable + '</span>'
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

  var cs = new capstone.Cs(capstone.ARCH_X86, capstone.MODE_64);
  var instructions = cs.disasm(buffer, offset);
  instructions.forEach(function (instr) {
    array.push(instr.mnemonic + " " + instr.op_str);
  });
  cs.delete();
  return array;
}
