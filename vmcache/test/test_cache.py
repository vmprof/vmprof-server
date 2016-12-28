import json
from twisted.trial import unittest
from vmcache.cache import CacheFactory
from twisted.test import proto_helpers
from vmcache.cache import Cache

class TestCache(unittest.TestCase):
    def setup_method(self, name):
        factory = CacheFactory()
        self.proto = factory.buildProtocol(('127.0.0.1', 0))
        self.tr = proto_helpers.StringTransport()
        self.proto.makeConnection(self.tr)

    def teardown_method(self, name):
        pass

    def send(self, cmd):
        self.proto.dataReceived(cmd.encode('utf-8') + b'\r\n')
        return self.tr.value().decode('utf-8')

    def test_base(self):
        result = self.send('invalid command')
        assert result == ''

    def test_meta_request(self):
        result = self.send('meta vmlog/test/data/log-test-1-v1.jlog.zip 1v1')
        assert result != ''
        result = json.loads(result)
        assert result['traces'] != {}
        assert len(result['traces']) > 0

    def test_trace_request(self):
        result = self.send('trace vmlog/test/data/log-test-1-v1.jlog.zip 1v1 0')
        assert result != ''
        result = json.loads(result)
        assert result['stages'] != {}

    def test_stitch_request(self):
        result = self.send('stitch vmlog/test/data/log-test-1-v1.jlog.zip 1v1 0')
        assert result != ''
        result = json.loads(result)
        assert result['root'] != ''
        assert len(result['stitches']) != {}

class FakeCache(Cache):
    def memory_usage(self):
        return len(self.cache)

from datetime import timedelta
import time

class TestUnitCache(object):
    def test_decay_simple(self):
        cache = FakeCache(200)
        cache.decay_delta = timedelta(seconds=1)
        assert cache.decay() == 0
        cache.put(1, 'hello')
        assert cache.decay() == 0
        for i in range(100):
            cache.put(100+i, 'hello'+str(i))
        time.sleep(1.1) # sleep to seconds and let the cache invalidate
        assert cache.decay() == 101

    def test_decay_force(self):
        cache = FakeCache(3)
        assert cache.decay(force=True) == 0
        cache.put(4, 'java')
        cache.put(1, 'hello')
        cache.put(2, 'python')
        # does not collect 4 because len(cache) == 3
        cache.put(3, 'program')
        # just after len(cache) is 4, but no decay is invoked
        assert cache.decay(force=True) == 1
        assert len(cache.cache) == 3
        assert cache.get(4) is None

