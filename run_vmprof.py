#!/usr/bin/env python
import cgi, sys
import tornado.ioloop
import tornado.web

from vmprof.process.reader import read_prof, read_ranges, read_sym_file, LibraryData
from vmprof.process.addrspace import AddressSpace, Profiles

prof_content = open(sys.argv[1], 'rb').read()
prof_sym_content = open("%s.sym" % sys.argv[1]).read()

period, profiles, symmap = read_prof(prof_content)
libs = read_ranges(symmap)
for lib in libs:
    lib.read_object_data()
libs.append(
    LibraryData(
        '<virtual>', 0x8000000000000000L, 0x8fffffffffffffffL, True,
        symbols=read_sym_file(prof_sym_content))
)

libs.sort()
profiles = Profiles(AddressSpace(libs).filter(profiles))

class MainHandler(tornado.web.RequestHandler):
    def get(self):
        items = profiles.functions.items()
        items.sort(key = lambda i : -i[1])
        for name, count in items:
            names = name.split(":")
            funcname = cgi.escape(names[2])
            self.write('<a href="/show?function=%s">%s</a>    %d%%<br/>' % (name, funcname, int(float(count) /
                                          len(profiles.profiles) * 100)))

class ShowHandler(tornado.web.RequestHandler):
    def get(self):
        funcname = self.request.arguments['function']
        items, total = profiles.generate_per_function(funcname[0])
        items = items.items()
        items.sort(key = lambda i : -i[1])
        for name, count in items:
            names = name.split(":")
            funcname = cgi.escape(names[2])
            self.write('<a href="/show?function=%s">%s</a>    %d%%<br/>' % (name, funcname, int(float(count) /
                                          total * 100)))

application = tornado.web.Application([
    (r"/", MainHandler),
    (r"/show", ShowHandler),
])

if __name__ == "__main__":
    print "Listening on 8888"
    application.listen(8888)
    tornado.ioloop.IOLoop.instance().start()
