import sys
from twisted.internet.protocol import Factory
from twisted.internet import endpoints
from twisted.internet import reactor
from forestcache.cache import CacheFactory
from twisted.application import internet, service


factory = CacheFactory()

application = service.Application("cached forest parser")
server = endpoints.serverFromString(reactor, "unix:./cache.socket")
server.listen(factory)
