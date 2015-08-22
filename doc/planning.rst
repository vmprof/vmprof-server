What we want from the vmprof:

* windows/OS X support (coming along)

* make sure tracking of vmprof.c between pypy and cpython version stays
  correct (right now there is a different subset of features)

* make node.color() return meaningful stuff on pypy

* cpython JITted makes no sense - improve

* function name in the box

* cleaner information in the main (this function/this call site)

* full function name in the main

* introduce line-based profiles

* link to traces/view traces

