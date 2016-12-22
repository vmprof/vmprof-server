function ajaxMsgpack(conf) {
  conf = $.extend({}, conf, {dataType: "binary", processData: false});
  conf.url += "&msgpack";
  return $.ajax(conf).then(decodeMsgpack);
}

function decodeMsgpack(blob, callback) {
  var deferred = $.Deferred();
  var reader = new FileReader();
  $(reader).on("loadend", function () {
    var decodedData = msgpack.decode(reader.result);
    deferred.resolve(decodedData);
  });
  reader.readAsArrayBuffer(blob);
  return deferred.promise();
}

function showError(title, text) {
  var content = $("<strong>").text(title + ": ")
           .add($("<span>").text(text));
  $("#error-alert").html(content).fadeIn("fast");
}

function formatBytes(val, axis) {
  if (val > 1024 * 1024) {
    return (val / 1024 / 1024).toFixed(2) + " GiB";
  } else if (val > 1024) {
    return (val / 1024).toFixed() + " MiB";
  } else {
    return val + " KiB";
  }
}

function retrievePlotData(windowStart, windowEnd) {
  var deferred = $.Deferred();
  var url = PROFILE_FETCH_URL;
  if (windowStart !== undefined)
    url += "&x0=" + windowStart;
  if (windowEnd !== undefined)
    url += "&x1=" + windowEnd;
  return ajaxMsgpack({url: url});
}

function parseStackTraceLine(line) {
  if (!line)
    return null;
  var [_, funcName, lineNo, sourceFile] = line.split(":");
  shortSourceFile = sourceFile.replace(/.*\/lib\/python[\d\.]+\/\(site-packages\/\)?/, '')
                              .split('/').slice(-2).join('/');
  return {funcName: funcName,
          lineNo: lineNo,
          sourceFile: sourceFile,
          shortSourceFile: shortSourceFile};
}




/*
NOTE: Both vmprof and plotly use the term "trace".
- A vmprof trace is a stack trace (technically: a list of instruction pointers)
- A plotly trace is a "line in the graph"/"single graph".

We use the term "graph" for plotly traces here, and the term "stack trace"
for vmprof traces.
*/

function Graph() {
}

Graph.prototype.init = function(scope, domTarget) {
  this.domTarget = domTarget[0];
  this.traceSelection = "max";
  this.timeMode = "relative"
  this.scope = scope

  // Initialise empty Plotly plot
  this.ploty = Plotly.newPlot(this.domTarget, [], {yaxis: {showticklabels: false}}, {displayModeBar: true});
  this.nPlotlyTraces = 0;
}

Graph.prototype.reset = function(plotData, addrNameMap) {
  this.addrNameMap = addrNameMap
  this.currentData = plotData
  var chart = $(self.domTarget)
  var graph = this

  chart.on("plotly_relayout", function (event, eventData) {
    if (eventData["xaxis.autorange"] || eventData["yaxis.autorange"]) {
      graph.resetData();
      graph.render();
      return;
    }
    if (eventData["xaxis.range[0]"] !== undefined && eventData["xaxis.range[1]"] !== undefined) {
      retrievePlotData(
        graph.xFromPlotly(eventData["xaxis.range[0]"]),
        graph.xFromPlotly(eventData["xaxis.range[1]"])
      ).then(
        graph.updateData.bind(graph)
      ).then(
        graph.render.bind(graph)
      )
      return;
    }
    if (eventData["yaxis.range[0]"] !== undefined || eventData["yaxis.range[1]"] !== undefined) {
      showError("Not implemented", "Y axis zooming not implemented");
      graph.render();
      return;
    }
  });

  chart.on("plotly_hover", function (event, eventData) {
    var st = graph.getStackTrace(eventData.points);
    st.union = st.union.map(parseStackTraceLine);
    st.mostFrequent = st.mostFrequent.map(parseStackTraceLine);
    $("#annotation").html($("#annotation-tmpl").render(st, {formatBytes: formatBytes}));
  });

  $(window).on("resize", function (event) {
    graph.relayout(chart.width(), chart.height())
  });

  $("input[name=trace-select]").parent().on("click", function () {
    graph.setTraceSelection({
      "max": "max",
      "mean": "mean",
      "max + mean": "both",
    }[$(this).text()]);
    graph.render();
  });

  $("input[name=time-mode-select]").parent().on("click", function () {
    graph.setTimeMode({
      "absolute time": "absolute",
      "relative time": "relative",
    }[$(this).text()]);
    graph.render();
  });

  this.render();
}

Graph.prototype.setTraceSelection = function (s) {
  this.traceSelection = s;
};

Graph.prototype.setTimeMode = function (mode) {
  this.timeMode = mode;
}

Graph.prototype.resetData = function () {
  this.currentData = this.initialData;
};

Graph.prototype.updateData = function (newData) {
  this.currentData = this.mergeData(this.initialData, newData);
};

Graph.prototype.relayout = function (w, h) {
  Plotly.relayout(this.domTarget, {width: w, height: h});
};

Graph.prototype.render = function () {
  while (this.nPlotlyTraces--)
    Plotly.deleteTraces(this.domTarget, 0);

  var traces = this.makePlotlyGraph();
  Plotly.addTraces(this.domTarget, traces);
  this.nPlotlyTraces = traces.length;
};

Graph.prototype.mergeData = function (d1, d2) {
  var res = {x: [], max: [], mean: [], trace: []};
  for (var d1idx = 0, d2idx = 0; d1idx < d1.x.length || d2idx < d2.x.length; ) {
    var reachedEndOfd2 = d2idx >= d2.x.length;
    if (reachedEndOfd2 || d1.x[d1idx] <= d2.x[d2idx]) {
      res.x.push(d1.x[d1idx]);
      res.max.push(d1.max[d1idx]);
      res.mean.push(d1.mean[d1idx]);
      res.trace.push(d1.trace[d1idx]);
      if (d1.x[d1idx] == d2.x[d2idx]) {
        /* Skip duplicate (x, y) pair */
        ++d2idx;
      }
      ++d1idx;
    } else {
      res.x.push(d2.x[d2idx]);
      res.max.push(d2.max[d2idx]);
      res.mean.push(d2.mean[d2idx]);
      res.trace.push(d2.trace[d2idx]);
      ++d2idx;
    }
  }
  return res;
};

Graph.prototype.xToPlotly = function(x) {
  return x
  // save and retrieve from this.scope
  // TODO if (PROFILE_PERIOD !== null) {
  // TODO   var offset = this.timeMode === "absolute" ? START_DATE : new Date(-3600000);
  // TODO   return new Date(offset.valueOf() + x * PROFILE_PERIOD / 1000);
  // TODO } else {
  // TODO   return x;
  // TODO }
}

Graph.prototype.xFromPlotly = function (x) {
  return x;
 //TODO if (PROFILE_PERIOD !== null) {
 //TODO   var offset = this.timeMode === "absolute" ? START_DATE : new Date(-3600000);
 //TODO   return (x.valueOf() - offset.valueOf()) * 1000 / PROFILE_PERIOD;
 //TODO } else {
 //TODO   return x;
 //TODO }
}

Graph.prototype.makePlotlyGraph = function () {
  var self = this;

  function mkTrace(attr, opts) {
    return $.extend({
      name: attr,
      x: self.currentData.x.map(self.xToPlotly.bind(self)),
      y: self.currentData[attr],
      mode: "line",
      text: self.currentData[attr].map(formatBytes),
      hoverinfo: "text+name",
      showlegend: false,
    }, opts);
  }

  if (this.traceSelection == "both")
    return [mkTrace("mean"), mkTrace("max", {mode: "fill", line: {width: 1}})];
  else
    return [mkTrace(this.traceSelection)];
};

Graph.prototype.getStackTrace = function (points) {
  var self = this;

  function mapIps(trace) {
    if (trace)
      return trace.map(function (ip) { return self.addrNameMap[ip]; });
  }

  var idx = points[0].pointNumber;
  return {
    memMax: this.currentData.max[idx],
    memMean: this.currentData.mean[idx],
    unionCount: this.currentData.trace[idx][0],
    union: mapIps(this.currentData.trace[idx][1]),
    mostFrequentCount: this.currentData.trace[idx][2],
    mostFrequent: mapIps(this.currentData.trace[idx][3]),
  };
}
