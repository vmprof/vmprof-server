
from vmprof.reader import LibraryData
from vmprof.addrspace import AddressSpace

class TestAddrSpace(object):
    def test_lookup(self):
        d = LibraryData("lib", 1234, 1300)
        d.symbols = [(1234, "a"), (1260, "b")]
        d2 = LibraryData("lib2", 1400, 1500)
        d2.symbols = []
        addr = AddressSpace([d, d2])
        fn, is_virtual = addr.lookup(1350)
        assert fn == '0x0000000000000547' # outside of range
        fn, is_virtual = addr.lookup(1250)
        assert fn == "a"

    def test_add_virtual_lib(self):
        d = LibraryData("lib", 1234, 1300)
        d.symbols = [(1234, "a"), (1260, "b")]
        d2 = LibraryData("jit", 1400, 1500, True)
        
