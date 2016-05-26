
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

  // the poor man's angular support for svg.
  // there might be a better way to use angular directly,
  // but I did not bother to put effort into that!
  var root = jQuery(svg[0])
  for (var key in dict) {
    var value = dict[key]
    root.find("[data-key='"+key+"']").text(value)
  }

  var c = dict
  root.find("[data-if]").each(function(){
    var elem = jQuery(this)
    if (eval(elem.data('if'))) {
      elem.show()
    } else {
      elem.hide()
    }
  })
}


PopOver.prototype.hide = function() {
  this._svg.style("visibility", "hidden")
}
