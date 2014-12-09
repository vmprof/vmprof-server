
import py
from vmprof.reader import read_ranges, read_prof, read_sym_file, LibraryData
from vmprof.addrspace import AddressSpace

RANGES = """0400000-005a1000 r-xp 00000000 08:01 5389781                            /home/fijal/.virtualenvs/cffi3/bin/python
007a0000-007a1000 r--p 001a0000 08:01 5389781                            /home/fijal/.virtualenvs/cffi3/bin/python
007a1000-007dd000 rw-p 001a1000 08:01 5389781                            /home/fijal/.virtualenvs/cffi3/bin/python
007dd000-007ed000 rw-p 00000000 00:00 0 
020b3000-1f7d5000 rw-p 00000000 00:00 0                                  [heap]
7f9dafd4c000-7f9dafeff000 r-xp 00000000 08:01 296555                     /lib/x86_64-linux-gnu/libcrypto.so.1.0.0
7f9dafeff000-7f9db00fe000 ---p 001b3000 08:01 296555                     /lib/x86_64-linux-gnu/libcrypto.so.1.0.0
7f9db00fe000-7f9db0119000 r--p 001b2000 08:01 296555                     /lib/x86_64-linux-gnu/libcrypto.so.1.0.0
7f9db0119000-7f9db0124000 rw-p 001cd000 08:01 296555                     /lib/x86_64-linux-gnu/libcrypto.so.1.0.0
7f9db0124000-7f9db0128000 rw-p 00000000 00:00 0 
7fffc971b000-7fffc973c000 rw-p 00000000 00:00 0                          [stack]
7fffc97fe000-7fffc9800000 r-xp 00000000 00:00 0                          [vdso]
ffffffffff600000-ffffffffff601000 r-xp 00000000 00:00 0                  [vsyscall]
"""

FAKE_NM = """0000000000004ff0 t _ufc_dofinalperm_r
00000000000057f0 t _ufc_doit_r
0000000000218180 b _ufc_foobar
0000000000004de0 t _ufc_mk_keytab_r
0000000000005230 t _ufc_output_conversion_r
0000000000004790 t _ufc_setup_salt_r
000000000020a140 b _ufc_tables_lock
"""

def test_read_ranges():
    def fake_reader(name):
        return FAKE_NM

    ranges = read_ranges(RANGES)
    assert len(ranges) == 13
    assert ranges[0].name == '/home/fijal/.virtualenvs/cffi3/bin/python'
    assert ranges[-3].name == '[stack]'
    assert ranges[-5].name == '/lib/x86_64-linux-gnu/libcrypto.so.1.0.0'
    assert ranges[-4].name == ''
    symbols = ranges[-5].read_object_data(reader=fake_reader)
    assert symbols == [(18320, '_ufc_setup_salt_r'),
                       (19936, '_ufc_mk_keytab_r'),
                       (20464, '_ufc_dofinalperm_r'),
                       (21040, '_ufc_output_conversion_r'),
                       (22512, '_ufc_doit_r'),
                       (2138432, '_ufc_tables_lock'),
                       (2195840, '_ufc_foobar')]
    
def test_read_profile():
    srcname = str(py.path.local(__file__).join('..', 'test.prof'))
    symfile = str(py.path.local(__file__).join('..', 'test.prof.sym'))
    period, profiles, symmap = read_prof(srcname)
    ranges = read_ranges(symmap)
    assert ranges[5].name == '/lib/x86_64-linux-gnu/libcrypto.so.1.0.0'
    assert ranges[5].start == 140315236548608
    assert ranges[5].end == 140315238330368
    symbols = read_sym_file(symfile)
    assert symbols == [(9223512352144476464L, 'py:x.py:<module>:1'), (9223512352144796976L, 'py:x.py:testx:18'), (9223512352145269808L, 'py:x.py:f:25'), (9223512352145270192L, 'py:x.py:test2:28')]
    addrspace = AddressSpace([LibraryData('virtual', 9223512352144476464L, 9223512352145270192L + 100, True, symbols=symbols)])
    name, is_virtual = addrspace.lookup(9223512352144476463L)
    assert name == 'py:x.py:<module>:1'
    assert is_virtual
