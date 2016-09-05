import re
import sys
import gzip
import bz2
import time
import os
import json
from datetime import datetime

from twisted.python.log import startLogging
from twisted.python.filepath import FilePath
from twisted.protocols.basic import LineReceiver
from twisted.internet import protocol
from twisted.internet import reactor
from jitlog import parser
from vmlog import serializer

def get_reader(filename):
    if filename.endswith(".zip"):
        return gzip.GzipFile(filename)
    elif filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    raise NotImplementedError("use gzip/bz2 for compression!")

class Cache(object):
    def __init__(self):
        self.cache = {}

    def put(self, key, obj):
        self.cache[key] = (datetime.now(), obj)

    def get(self, key):
        return self.cache.get(key, (None, None))[1]

    def decay(self):
        keys = []
        # uff, we can do better. I'm sure!
        for key, (t, obj) in self.cache.items():
            if t + timedelta(minutes=10) < datetime.now():
                keys.append(key)

        for key in keys:
            del self.cache[key]

CACHE = {}

BASE = "([a-zA-Z0-9/.\-]+) ([a-zA-Z0-9]+)"
GENERIC_REQ = re.compile('[^ ]+ '+BASE)

META_REQUEST = re.compile('meta '+BASE)
META_SERIALIZER = serializer.LogMetaSerializer()

TRACE_REQUEST = re.compile('trace '+BASE+' (\d+)')
TRACE_SERIALIZER = serializer.TraceSerializer()

STITCH_REQUEST = re.compile('stitch '+BASE+' (\d+)')
STITCH_SERIALIZER = serializer.VisualTraceTreeSerializer()

class CacheProtocol(LineReceiver):
    def __init__(self):
        self.cache = Cache()

    def connectionMade(self):
        pass

    def lineReceived(self, bytesline):
        data = bytesline.decode('utf-8')
        # generic match
        match = GENERIC_REQ.match(data)
        if not match:
            self.transport.loseConnection()
            return

        filename = match.group(1)
        checksum = match.group(2)
        if not os.path.exists(filename):
            self.transport.loseConnection()
            return

        start = time.time()
        forest = self.load(filename, checksum)
        parsing_secs = time.time() - start

        size = os.path.getsize(filename)
        measures = { 'parsing': '%.3fms' % (parsing_secs * 1000.0),
                     'log (zip)': '%.1fMB' % (size // 1024 // 1024),
                   }


        start = time.time()
        #
        jsondata = None
        if data.startswith("meta"):
            match = META_REQUEST.match(data)
            if match:
                jsondata = META_SERIALIZER.to_representation(forest)
        elif data.startswith("trace"):
            match = TRACE_REQUEST.match(data) 
            if match:
                uid = int(match.group(3))
                trace = forest.get_trace_by_id(uid)
                jsondata = TRACE_SERIALIZER.to_representation(trace)
        elif data.startswith("stitch"):
            match = STITCH_REQUEST.match(data) 
            if match:
                uid = int(match.group(3))
                trace = forest.get_trace_by_id(uid)
                jsondata = STITCH_SERIALIZER.to_representation(trace)
        #
        json_secs = time.time() - start

        if jsondata:
            measures['json'] = '%.3fms' % (json_secs * 1000.0)
            jsondata['measures'] = measures
            self.sendLine(json.dumps(jsondata).encode('utf-8'))

        self.transport.loseConnection()

    def load(self, filename, checksum):
        forest = self.cache.get(checksum)
        if forest:
            return forest
        self.cache.decay()
        fobj = get_reader(filename)
        forest = parser._parse_jitlog(fobj)
        self.cache.put(checksum, forest)
        return forest

    def connectionLost(self, reason):
        # Clean up the timeout, if necessary.
        pass

class CacheFactory(protocol.Factory):
    protocol = CacheProtocol
