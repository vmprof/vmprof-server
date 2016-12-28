import sys
from twisted.internet.protocol import Factory
from twisted.internet import endpoints
from twisted.internet import reactor
from vmcache.cache import CacheFactory
from twisted.application import internet, service


factory = CacheFactory()

application = service.Application("cached application data (LRU scheme)")
server = endpoints.serverFromString(reactor, "unix:./cache.socket")
server.listen(factory)
