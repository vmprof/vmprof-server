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


function setupPlot (addrNameMap, plotData) {
  var chart = $("#chart"),
      graph = new Graph(chart[0], addrNameMap, plotData);

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

  graph.render();
}


$(function () {
  $.views.settings.delimiters("<%", "%>");
  var addrNameMapFetch = ajaxMsgpack({url: ADDR_NAME_MAP_FETCH_URL});
  $.when(addrNameMapFetch, retrievePlotData())
   .then(setupPlot, function (err) { showError("Error retrieving profile data", err.statusText); });
});
