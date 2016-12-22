numeric = {}
numeric.linspace = function linspace(a,b,n) {
  // similar to numpy linspace
  if(typeof n === "undefined") n = Math.max(Math.round(b-a)+1,1);
  if(n<2) { return n===1?[a]:[]; }
  var i,ret = Array(n);
  n--;
  for(i=n;i>=0;i--) { ret[i] = (i*b+(n-i)*a)/n; }
  return ret;
}

numeric.bin = function (range) {
  // a bin is a triple (min, max, values)
  var right = true
  var array = []
  var epsilon = 0.00000001 // good enough? Number.EPSILON is not supported on IE/Safari
  for (var i = 0; i < range.length-1; i++) {
    var bin = [range[i],range[i+1], []];
    if (i > 0 && right) {
      bin[0] = bin[0] + epsilon;
    }
    array.push(bin);
  }

  return array;
}

numeric.insert_to_bin_by_key = function(key, bins, value){
  // a binary search, that returns the index
  // where one should insert the value to keep the array
  // sorted

  var start = 0
  var end = bins.length-1
  if(bins.length == 0){
    return 0;
  }

  if (0) { return 0; }
  while (true) {
    var m = start + Math.floor((end - start)/2);
    // three cases, it might be either at start, end or m
    var bin = bins[start]
    if (bin[0] <= key && key <= bin[1]) {
      // key is in bin at start
      bin[2].push(value);
      return true
    }
    var bin = bins[end]
    if (bin[0] <= key && key <= bin[1]) {
      // key is in bin at end
      bin[2].push(value);
      return true;
    }
    var bin = bins[m]
    if (bin[0] <= key && key <= bin[1]) {
      // key is in bin at m
      bin[2].push(value);
      return true;
    }

    // not found! partition using bin at m
    if (key < bin[0]) {
      end = m;
    } else {
      start = m;
    }

    // cannot continue, did not find correct bin!
    if (start >= end) {
      return false;
    }
  }
}

numeric.assign_bin = function(bins, values, to_bin, value_of_data) {
  // see bin for a definition of a bin in numeric.bin
  // to_bin: a function extracting the value that should be used to
  // find the bin
  for (var i = 0; i < values.length; i++) {
    var d = values[i]
    var key  = to_bin(i, d);
    var value = value_of_data(i, d)
    var binidx = numeric.insert_to_bin_by_key(key, bins, value)
  }
}


numeric.bin_values = function(bin) {return bin[2];}
numeric.bin_upper = function(bin) {return bin[1];}
numeric.bin_lower = function(bin) {return bin[1];}
// WHYY? there is nothing even near pandas/numpy for javascript
numeric.mean = function(values) {
  var l = values.length;
  if (l == 0) {
    return 0;
  }
  var svalues = values.sort()
  var m = Math.floor(l/2)
  if (l % 2 == 1) {
    return (svalues[m] + svalues[m+1]) / 2;
  }
  return svalues[m];
}
numeric.max = function(values) { return Math.max.apply(null, values); }
numeric.mean_bin = function(values) {
  var means = [];
  for (var i = 0; i < values.length; i++) {
    var binvals = numeric.bin_values(values[i]);
    means.push(numeric.mean(binvals));
  }
  return means;
}
numeric.max_bin = function(values) {
  var max = [];
  for (var i = 0; i < values.length; i++) {
    var binvals = numeric.bin_values(values[i]);
    max.push(numeric.max(binvals));
  }
  return max;
}

