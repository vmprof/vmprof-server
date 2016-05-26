import struct, py, sys
from vmprof.log.objects import (FlatOp, TraceForest, Trace,
        MergePoint, iter_ranges)
from vmprof.log import constants as const
from log.serializer import TraceForestMetaSerializer

PY3 = sys.version_info[0] >= 3

def filename_mergepoint(name):
    return MergePoint({const.MP_SCOPE[0]: name})

def test_to_json_meta_info():
    forest = TraceForest(1)
    forest.resops = { 15: 'divide' }
    trace = forest.add_trace('loop', 0)
    stage = trace.start_mark(const.MARK_TRACE_OPT)
    stage.get_ops().append(filename_mergepoint('my_func'))
    assert TraceForestMetaSerializer(forest).to_json() == \
            { 'resops': { 15: 'divide' },
              'traces': { 0: { 'scope': 'my_func', 'filename': None, 'lineno': 0 } },
            }
