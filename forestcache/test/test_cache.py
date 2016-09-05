import json
from twisted.trial import unittest
from forestcache.cache import CacheFactory
from twisted.test import proto_helpers

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
