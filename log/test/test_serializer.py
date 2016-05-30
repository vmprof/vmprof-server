import pytest
import struct, py, sys
from vmprof.log.objects import (FlatOp, TraceForest, Trace,
        MergePoint, iter_ranges)
from vmprof.log import constants as const
from log.views import LogMetaSerializer, TraceSerializer

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
    trace.counter = 42
    stage = trace.start_mark(const.MARK_TRACE_OPT)
    stage.get_ops().append(filename_mergepoint('my_func'))
    assert LogMetaSerializer().to_representation(FakeJitLog(forest)) == \
            { 'resops': { 15: 'divide' },
              'traces': { 0: { 'scope': 'my_func', 'filename': None, 'lineno': 0,
                               'type': 'loop', 'counter': 42 } },
              'bridges': { 0: {} }
            }

def test_to_json_meta_bridges():
    forest = TraceForest(1)
    forest.resops = { 15: 'guard_true' }
    trunk = forest.add_trace('loop', 0)
    bridge1 = forest.add_trace('bridge', 1)
    bridge2 = forest.add_trace('bridge', 2)
    bridge3 = forest.add_trace('bridge', 3)
    trunk.stitch_bridge(0, 10, 1)
    trunk.stitch_bridge(0, 11, 2)
    bridge1.stitch_bridge(0, 12, 3)
    bridge2.stitch_bridge(0, 13, 3)
    #
    stage = trunk.start_mark(const.MARK_TRACE_OPT)
    j = LogMetaSerializer().to_representation(FakeJitLog(forest))
    assert len(j['bridges']) == 4
    bridges = j['bridges']
    assert bridges[0] == {'0xa': '0x1', '0xb': '0x2'}
    assert bridges[1] == {'0xc': '0x3'}
    assert bridges[2] == {'0xd': '0x3'}
    assert bridges[3] == {}

DEFAULT_TEST_RESOPS = {
    # do NOT edit this numbers
    15: 'guard_true',
    16: 'int_add',
    17: 'load'
}

assert max(set(DEFAULT_TEST_RESOPS.keys())) < 255

def opnum_from_opname(name):
    for num, opname in DEFAULT_TEST_RESOPS.items():
        if opname == name:
            return num
    raise AssertionError("%s is not known operation name in the test suite" % name)

@pytest.fixture
def forest():
    forest = TraceForest(1)
    forest.resops = DEFAULT_TEST_RESOPS
    return forest

def add_instr(trace, opname, result, args, descr=None):
    if descr:
        descr, descr_nmr = descr
        op = FlatOp(opnum_from_opname(opname), opname, args, result, descr, descr_nmr)
    else:
        op = FlatOp(opnum_from_opname(opname), opname, args, result)
    trace.add_instr(op)

def test_serialize_trace(forest):
    trunk = forest.add_trace('loop', 0)
    _ = trunk.start_mark(const.MARK_TRACE_OPT)
    add_instr(trunk, 'load', 'i1', 'p0,i0', descr=('descr', 0x1))
    add_instr(trunk, 'int_add', 'i2', 'i1,i1')
    add_instr(trunk, 'guard_true', 'i2', None, descr=('guarddescr', 0x2))
    t = TraceSerializer().to_representation(trunk)
    assert t['stages'].get('opt', None) == {
        'merge_points': {},
        'ops': [{ 'num': 17, 'args': 'p0,i0', 'res': 'i1', 'descr':'descr', 'descr_number': '0x1' },
                { 'num': 16, 'args': 'i1,i1', 'res': 'i2' },
                { 'num': 15, 'descr':'guarddescr', 'res': 'i2', 'descr_number': '0x2' }]
    }


