import os
import gzip

from vmprof.log import constants as c
from vmprof.binary import (encode_le_u16 as u16,
        encode_le_u32 as u32, encode_s64 as s64, encode_u64 as u64,
        encode_str, encode_le_addr as addr)

test_logs = [
('v1',
c.MARK_JITLOG_HEADER + b"\x01\x00" +
c.MARK_RESOP_META + u16(8) +
  u16(0) + encode_str('load') +
  u16(1) + encode_str('store') +
  u16(2) + encode_str('int_add') +
  u16(3) + encode_str('guard_true') +
  u16(4) + encode_str('guard_false') +
  u16(5) + encode_str('finish') +
  u16(6) + encode_str('label') +
  u16(7) + encode_str('jump') +

c.MARK_START_TRACE + addr(0) + encode_str('loop') + addr(0) +
  c.MARK_TRACE_OPT + addr(0) +
  c.MARK_INIT_MERGE_POINT + u16(2) + bytes([c.MP_FILENAME[0]]) + b"s" + bytes([c.MP_SCOPE[0]]) + b"s" +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/home/user")  + b"\xff" + encode_str("funcname1") +
  c.MARK_RESOP_DESCR + u16(3) + encode_str('?,i2,guard_resume') + addr(0xaffe) +
  c.MARK_RESOP + u16(7) + encode_str('i2,i1') +

  c.MARK_TRACE_ASM + addr(0) +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_RESOP_DESCR + u16(3) + encode_str('?,i2,guard_resume') + addr(0xaffe) +

# trace with id 1, this is a loop with one bridge
c.MARK_START_TRACE + addr(1) + encode_str('loop') + addr(0) +
  c.MARK_TRACE_ASM + addr(1) +
  c.MARK_INIT_MERGE_POINT + u16(2) + bytes([c.MP_FILENAME[0]]) + b"s" + bytes([c.MP_SCOPE[0]]) + b"s" +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/home/user") + b"\xff" + encode_str("func_with_bridge") +
  c.MARK_RESOP_DESCR + u16(3) + encode_str('?,i2,guard_resume') + addr(0x1234) +
  c.MARK_RESOP_DESCR + u16(7) + encode_str('i2,i1,jmpdescr') + addr(0x0011) +
  c.MARK_ASM_ADDR + addr(0x100) + addr(0x200) +

# the bridge
c.MARK_START_TRACE + addr(2) + encode_str('bridge') + addr(0) +
  c.MARK_TRACE_ASM + addr(2) +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_ASM_ADDR + addr(0x300) + addr(0x400) +

# stitch the bridge
c.MARK_STITCH_BRIDGE + addr(0x1234) + addr(0x300) +

c.MARK_START_TRACE + addr(3) + encode_str('loop') + addr(0) +
  c.MARK_TRACE_OPT + addr(3) +
  c.MARK_INPUT_ARGS  + encode_str('p1,i1') +
  c.MARK_INIT_MERGE_POINT + u16(1) + bytes([c.MP_SCOPE[0]]) + b"s" +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("func_with_nop_assembly") +
  c.MARK_TRACE_ASM + addr(3) +
  c.MARK_INPUT_ARGS  + encode_str('p1,i1') +
  c.MARK_RESOP + u16(6) + encode_str('p1,i1') + # label
  c.MARK_RESOP + u16(1) + encode_str('p1,i1') +
  c.MARK_ASM + u16(0) + u32(2) + b"\x90\x90" +
  c.MARK_RESOP + u16(1) + encode_str('p1,p1') +
  c.MARK_ASM + u16(0) + u32(1) + b"\x90" +

c.MARK_START_TRACE + addr(4) + encode_str('loop') + addr(0) +
  c.MARK_TRACE_OPT + addr(4) +
  c.MARK_INPUT_ARGS  + encode_str('p1,i1') +
  c.MARK_INIT_MERGE_POINT + u16(3) + bytes([c.MP_SCOPE[0]]) + b"s" +
                                     bytes([c.MP_SCOPE[0]]) + b"s" +
                                     bytes([c.MP_LINENO[0]]) + b"i" +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/a.py") + b"\xff" + encode_str("func_with_source_code") + b"\x00" + u64(1) +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/b.py") + b"\xff" + encode_str("inlined_func1") + b"\x00" + u64(25) +
  c.MARK_RESOP + u16(2) + encode_str('i3,i2,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/b.py") + b"\xff" + encode_str("inlined_func1") + b"\x00" + u64(26) +
  c.MARK_RESOP + u16(1) + encode_str('?,p1,i2,i1') +
  c.MARK_RESOP + u16(1) + encode_str('?,p1,i2,i1') +
  c.MARK_RESOP + u16(1) + encode_str('?,p1,i2,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/b.py") + b"\xff" + encode_str("inlined_func1") + b"\x00" + u64(27) +

  # keep this to the very end!!
  c.MARK_SOURCE_CODE + encode_str("/a.py") + u16(1) +
      u16(1) + b"\x04" + encode_str("a = b + c")  +
  c.MARK_SOURCE_CODE + encode_str("/b.py") + u16(3) +
      u16(25) + b"\x08" + encode_str("def wait_for_me():") +
      u16(26) + b"\x0c" + encode_str("yield 13") +
      u16(27) + b"\x0c" + encode_str("a,b,c = call.me(1,2,3) # here is a comment")
)]

if __name__ == "__main__":
    path = os.path.dirname(__file__)
    for i, (version, log) in enumerate(test_logs):
        with gzip.open(os.path.join(path, "log-test-%d-%s.jlog.zip" % (i+1, version)),
                       mode="wb") as fd:
            fd.write(log)
