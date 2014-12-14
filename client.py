import sys
import requests
import json
import zlib

from base64 import b64encode

from vmprof.process.reader import (
    read_prof, read_ranges, read_sym_file, LibraryData
)

from vmprof.process.addrspace import AddressSpace


def main(prof, prof_sym):
    period, profiles, symmap = read_prof(prof)
    libs = read_ranges(symmap)

    for lib in libs:
        lib.read_object_data()
    libs.append(
        LibraryData(
            '<virtual>',
            0x8000000000000000L,
            0x8fffffffffffffffL,
            True,
            symbols=read_sym_file(prof_sym))
    )
    addrspace = AddressSpace(libs)
    filtered_profiles, addr_set = addrspace.filter_addr(profiles)
    d = {}
    for addr in addr_set:
        name, _ = addrspace.lookup(addr | 0x8000000000000000L)
        d[addr] = name

    return {'profiles': filtered_profiles, 'addresses': d}


if __name__ == '__main__':
    prof = open(sys.argv[1], 'rb').read()
    prof_sym = open(sys.argv[2], 'rb').read()

    data = zlib.compress(json.dumps(main(prof, prof_sym)))

    response = requests.post("http://127.0.0.1:8000/api/log/", data={
        'data': b64encode(data)
    })

    print response.json()
