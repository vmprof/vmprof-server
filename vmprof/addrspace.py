
import bisect

def fmtaddr(x):
    return '0x%016x' % x

class AddressSpace(object):
    def __init__(self, libs):
        self.libs = libs
        self.lib_lookup = [lib.start for lib in libs]

    def lookup(self, arg):
        addr = arg + 1
        i = bisect.bisect(self.lib_lookup, addr)
        if i > len(self.libs) or i <= 0:
            return fmtaddr(addr), False
        lib = self.libs[i - 1]
        if addr < lib.start or addr >= lib.end:
            return fmtaddr(addr), False
        i = bisect.bisect(lib.symbols, (addr + 1,))
        if i > len(lib.symbols) or i <= 0:
            return fmtaddr(addr), False
        addr, name = lib.symbols[i - 1]
        is_virtual = lib.is_virtual
        return name, is_virtual

    def dump_stack(self, stacktrace):
        for addr in stacktrace:
            print fmtaddr(addr), self.lookup(addr)[0]
