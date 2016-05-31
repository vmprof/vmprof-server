import os
import lzma

from vmprof.log import constants as c
from vmprof.binary import (encode_le_u16 as u16,
        encode_s64 as s64, encode_u64 as u64,
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
  c.MARK_INIT_MERGE_POINT + u16(1) + bytes([c.MP_FILENAME[0]]) + b"s" +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_MERGE_POINT + b"\xff" + encode_str("/home/user") +
  c.MARK_RESOP_DESCR + u16(3) + encode_str('?,i2,guard_resume') + addr(0xaffe) +

  c.MARK_TRACE_ASM + addr(0) +
  c.MARK_INPUT_ARGS  + encode_str('i0,i1') +
  c.MARK_RESOP + u16(2) + encode_str('i2,i1,i1') +
  c.MARK_RESOP_DESCR + u16(3) + encode_str('?,i2,guard_resume') + addr(0xaffe)
)]

if __name__ == "__main__":
    path = os.path.dirname(__file__)
    for i, (version, log) in enumerate(test_logs):
        with lzma.open(os.path.join(path, "log-test-%d-%s.jlog.xz" % (i+1, version)),
                       mode="wb") as fd:
            fd.write(log)
