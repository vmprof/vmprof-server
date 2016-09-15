/*
NOTE: Both vmprof and plotly use the term "trace".
- A vmprof trace is a stack trace (technically: a list of instruction pointers)
- A plotly trace is a "line in the graph"/"single graph".

We use the term "graph" for plotly traces here, and the term "stack trace"
for vmprof traces.
*/

function Graph(domTarget, addrNameMap, initialData) {
  this.domTarget = domTarget;
  this.addrNameMap = addrNameMap;
  this.initialData = initialData;
  this.traceSelection = "max";
  this.timeMode = START_DATE === null ? "relative" : "absolute";
  this.resetData();

  // Initialise empty Plotly plot
  Plotly.newPlot(this.domTarget, [], {yaxis: {showticklabels: false}}, {displayModeBar: true});
  this.nPlotlyTraces = 0;
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
  if (PROFILE_PERIOD !== null) {
    var offset = this.timeMode === "absolute" ? START_DATE : new Date(-3600000);
    return new Date(offset.valueOf() + x * PROFILE_PERIOD / 1000);
  } else {
    return x;
  }
}

Graph.prototype.xFromPlotly = function (x) {
  if (PROFILE_PERIOD !== null) {
    var offset = this.timeMode === "absolute" ? START_DATE : new Date(-3600000);
    return (x.valueOf() - offset.valueOf()) * 1000 / PROFILE_PERIOD;
  } else {
    return x;
  }
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
