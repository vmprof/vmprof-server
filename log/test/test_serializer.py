import struct, py, sys
from vmprof.log.objects import (FlatOp, TraceForest, Trace,
        MergePoint, iter_ranges)
from vmprof.log import constants as const
from log.views import LogMetaSerializer

PY3 = sys.version_info[0] >= 3

def filename_mergepoint(name):
    return MergePoint({const.MP_SCOPE[0]: name})

class FakeJitLog(object):
    def __init__(self, forest):
        self.forest = forest

    def decode_forest(self):
        return self.forest

def test_to_json_meta_info():
    forest = TraceForest(1)
    forest.resops = { 15: 'divide' }
    trace = forest.add_trace('loop', 0)
    stage = trace.start_mark(const.MARK_TRACE_OPT)
    stage.get_ops().append(filename_mergepoint('my_func'))
    assert LogMetaSerializer().to_representation(FakeJitLog(forest)) == \
            { 'resops': { 15: 'divide' },
              'traces': { 0: { 'scope': 'my_func', 'filename': None, 'lineno': 0,
                               'type': 'loop' } },
            }
