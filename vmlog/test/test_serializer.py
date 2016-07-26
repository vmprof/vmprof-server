import pytest
import struct, py, sys
from jitlog.objects import (FlatOp, TraceForest, Trace,
        MergePoint, iter_ranges, PointInTrace)
from jitlog import constants as const
from vmlog.views import (LogMetaSerializer, TraceSerializer,
        VisualTraceTreeSerializer)

PY3 = sys.version_info[0] >= 3

class FakeJitLog(object):
    def __init__(self, forest):
        self.forest = forest

    def decode_forest(self):
        return self.forest

def test_to_json_meta_info():
    forest = TraceForest(1)
    forest.resops = { 15: 'divide' }
    trace = forest.add_trace('loop', 0, 0)
    trace.counter = 42
    stage = trace.start_mark(const.MARK_TRACE_OPT)
    stage.append_op(MergePoint({const.MP_SCOPE[0]: 'my_func' }))
    json = LogMetaSerializer().to_representation(FakeJitLog(forest))
    del json['bridges'] # do not care for this test
    assert json == \
            { 'resops': { 15: 'divide' },
              'traces': { 0: { 'scope': 'my_func', 'filename': None, 'lineno': 0,
                  'type': 'loop', 'counter_points': { 'enter': 42 } } },
            }

def test_to_json_meta_bridges():
    forest = TraceForest(1)
    forest.resops = { 15: 'guard_true' }
    trunk = forest.add_trace('loop', 0, 0)
    bridge1 = forest.add_trace('bridge', 1, 0)
    bridge2 = forest.add_trace('bridge', 2, 0)
    bridge3 = forest.add_trace('bridge', 3, 0)
    forest.descr_nmr_to_point_in_trace[10] = PointInTrace(trunk, None)
    forest.descr_nmr_to_point_in_trace[11] = PointInTrace(trunk, None)
    forest.descr_nmr_to_point_in_trace[12] = PointInTrace(bridge1, None)
    forest.descr_nmr_to_point_in_trace[13] = PointInTrace(bridge2, None)
    #
    trunk.set_addr_bounds(99,100)
    bridge1.set_addr_bounds(100,101)
    bridge2.set_addr_bounds(200,201)
    bridge3.set_addr_bounds(300,301)
    #
    forest.stitch_bridge(10, 100)
    forest.stitch_bridge(11, 200)
    forest.stitch_bridge(12, 300)
    #
    stage = trunk.start_mark(const.MARK_TRACE_OPT)
    j = LogMetaSerializer().to_representation(FakeJitLog(forest))
    assert len(j['bridges']) == 4
    bridges = j['bridges']
    assert bridges[0] == {10: 100, 11: 200}
    assert bridges[1] == {12: 300}
    assert bridges[2] == {}
    assert bridges[3] == {}

DEFAULT_TEST_RESOPS = {
    # do NOT edit this numbers
    15: 'guard_true',
    16: 'int_add',
    17: 'load',
    18: 'label',
    19: 'jump',
    20: 'finish',
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
    trunk = forest.add_trace('loop', 0, 0)
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

def test_serialize_debug_merge_point(forest):
    trunk = forest.add_trace('loop', 0, 0)
    _ = trunk.start_mark(const.MARK_TRACE_OPT)
    trunk.add_instr(MergePoint({ 0x1: '/x.py',
                                 0x2: 2,
                                 0x4: 4,
                                 0x8: 'funcname',
                                 0x10: 'LOAD_FAST'}))
    dict = TraceSerializer().to_representation(trunk)
    stage = dict['stages']['opt']
    assert len(stage['merge_points']) == 2 # plus the 'first' key
    merge_points = stage['merge_points']
    assert 0 in merge_points.keys()
    assert merge_points['first'] == 0
    assert merge_points[0][0] == {
            'filename': '/x.py',
            'lineno': 2,
            'scope': 'funcname',
            'index': 4,
            'opcode': 'LOAD_FAST'
           }

def test_serialize_visual_trace_tree(forest):
    trunk = forest.add_trace('loop', 0, 0)
    _ = trunk.start_mark(const.MARK_TRACE_ASM)
    add_instr(trunk, 'label', None, 'i1,i1', descr=(None, 0xa))
    add_instr(trunk, 'int_add', 'i2', 'i1,i1')
    add_instr(trunk, 'guard_true', 'i2', None, descr=('guarddescr', 0x2))
    add_instr(trunk, 'jump', None, 'i1,i1', descr=(None, 0xa))
    #
    bridge1 = forest.add_trace('bridge', 1, 0)
    forest.addrs[100] = bridge1
    forest.stitch_bridge(2, 100)
    _ = bridge1.start_mark(const.MARK_TRACE_ASM)
    add_instr(bridge1, 'finish', None, 'i1,i1', descr=(None, 0xb))
    #
    t = VisualTraceTreeSerializer().to_representation(trunk)
    assert t['root'] == '0x0'
    assert t['stitches'] == {
        '0x0': ['l,0,0xa','g,2,0x2,0x1','j,3,0xa'],
        '0x1': ['f,0,0xb']
    }
