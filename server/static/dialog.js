
PopOver = function(svg, width, height) {
  this._svg = svg
  this._width = width
  this._height = height
}

PopOver.prototype.show = function(dict) {
  var svg = this._svg
  svg.style("visibility", "visible")
  var rect = svg.select(".background")
                .attr("width", this._width)
                .attr("height", this._height)

  var root = jQuery(svg[0])
  for (var key in dict) {
    var value = dict[key]
    root.find("[data-key='"+key+"']").text(value)
  }
}


PopOver.prototype.hide = function() {
  this._svg.style("visibility", "hidden")
}
