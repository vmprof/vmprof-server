import re
import sys
import gc
import gzip
import bz2
import time
import os
import json
from datetime import datetime, timedelta

from twisted.python.log import startLogging
from twisted.python.filepath import FilePath
from twisted.protocols.basic import LineReceiver
from twisted.internet import protocol
from twisted.internet import reactor
from jitlog import parser
from vmlog import serializer

from twisted.python import log

def get_reader(filename):
    if filename.endswith(".zip"):
        return gzip.GzipFile(filename)
    elif filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    raise NotImplementedError("use gzip/bz2 for compression!")

class Cache(object):

    def __init__(self, maxsize, seconds=10*60):
        self.cache = {}
        self.decay_delta = timedelta(seconds=seconds)
        self.maxsize = maxsize
        self._proc_status = '/proc/%d/status' % os.getpid()
        self._scale = {'kB': 1024.0, 'mB': 1024.0*1024.0,
                       'KB': 1024.0, 'MB': 1024.0*1024.0}

    def memory_usage(self, key='VmSize:'):
         # get pseudo file  /proc/<pid>/status
        try:
            t = open(self._proc_status)
            v = t.read()
            t.close()
        except:
            return 0.0  # non-Linux?
         # get VmKey line e.g. 'VmRSS:  9999  kB\n ...'
        i = v.index(key)
        v = v[i:].split(None, 3)  # whitespace
        if len(v) < 3:
            return 0.0  # invalid format?
         # convert Vm value to bytes
        return float(v[1]) * self._scale[v[2]]

    def put(self, key, obj):
        current = self.memory_usage()
        if current > self.maxsize:
            self.decay(force=True)
            current = self.memory_usage()
            if current > self.maxsize:
                log.msg("cannot add forest to the cache, it should not consume more memory")
                return # well, we cannot add this to the cache!
        else:
            self.decay()
        self.cache[key] = (datetime.now(), obj)

    def get(self, key):
        return self.cache.get(key, (None, None))[1]

    def decay(self, force=False):
        decayed = 0
        ordered = sorted(self.cache.items(), key=lambda v: v[1][0], reverse=True)
        if force:
            # force mode, will remove the N oldest items as long as
            # the memory threshold is not crossed
            j = len(self.cache)-1
            while self.memory_usage() > self.maxsize and j >= 0:
                checksum, subject = ordered[j]
                del self.cache[checksum]
                decayed += 1
                j -= 1
            gc.collect()
            return decayed

        keys = []
        # uff, we can do better. I'm sure!
        for key, (t, obj) in ordered:
            if t + self.decay_delta < datetime.now():
                del self.cache[key]
                decayed += 1

        return decayed

CACHE = {}

BASE = "([a-zA-Z0-9/.\-]+) ([a-zA-Z0-9]+)"
GENERIC_REQ = re.compile('[^ ]+ '+BASE)

META_REQUEST = re.compile('meta '+BASE)
META_SERIALIZER = serializer.LogMetaSerializer()

TRACE_REQUEST = re.compile('trace '+BASE+' (\d+)')
TRACE_SERIALIZER = serializer.TraceSerializer()

STITCH_REQUEST = re.compile('stitch '+BASE+' (\d+)')
STITCH_SERIALIZER = serializer.VisualTraceTreeSerializer()

CACHE = Cache(4 * 1024 * 1024 * 1024) # 4 GB

class CacheProtocol(LineReceiver):
    def __init__(self):
        self.cache = CACHE

    def connectionMade(self):
        log.msg("new connection opened")

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
            log.msg("sent data, closing connection")
            self.sendLine(json.dumps(jsondata).encode('utf-8'))
        else:
            log.msg("no data sent, closing connection")
        self.transport.loseConnection()

    def load(self, filename, checksum):
        forest = self.cache.get(checksum)
        if forest:
            log.msg("cached forest (checksum %s)" % (checksum,))
            return forest
        fobj = get_reader(filename)
        forest = parser._parse_jitlog(fobj)
        self.cache.put(checksum, forest)
        assert self.cache.get(checksum) is not None
        log.msg("parsed jitlog in file %s (checksum %s)" % (filename, checksum))
        return forest

    def connectionLost(self, reason):
        # Clean up the timeout, if necessary.
        pass

class CacheFactory(protocol.Factory):
    protocol = CacheProtocol
