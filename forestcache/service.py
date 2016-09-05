from twisted.internet.protocol import Factory
from twisted.internet.endpoints import TCP4ServerEndpoint
from twisted.internet import reactor
from forestcache.cache import CacheProtocol

address = FilePath(sys.argv[1])
# 8007 is the port you want to run under. Choose something >1024
endpoint = UnixServerEndpoint(reactor, address)
endpoint.listen(CacheFactory())
reactor.run()

