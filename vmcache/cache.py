import psutil
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
from vmprof.profiler import read_profile as read_cpu_profile
import io

from twisted.python import log

def get_reader(filename):
    if filename.endswith(".zip"):
        return gzip.GzipFile(filename)
    elif filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    return open(filename, 'rb')

def try_gunzip_or_plain(fileobj):
    is_gzipped = fileobj.read(2) == b'\037\213'
    fileobj.seek(-2, os.SEEK_CUR)
    if is_gzipped:
        fileobj = io.BufferedReader(gzip.GzipFile(fileobj=fileobj))
    return fileobj

class Cache(object):

    def __init__(self, maxsize, seconds=10*60):
        self.cache = {}
        self.decay_delta = timedelta(seconds=seconds)
        self.maxsize = maxsize

    def memory_usage(self):
        process = psutil.Process(os.getpid())
        mb = process.memory_info()[0] / float(2**20)
        return mb

    def put(self, key, obj):
        current = self.memory_usage()
        if current > self.maxsize:
            self.decay(force=True)
            current = self.memory_usage()
            if current > self.maxsize:
                log.msg("cannot add profile to the cache, I shall not consume more memory")
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

BASE = r"([a-zA-Z0-9/.\-_]+) ([a-zA-Z0-9-]+)"
GENERIC_REQ = re.compile('([^ ]+) '+BASE)

META_REQUEST = re.compile('meta '+BASE)
META_SERIALIZER = serializer.LogMetaSerializer()

TRACE_REQUEST = re.compile('trace ' + BASE + r' (\d+)')
TRACE_SERIALIZER = serializer.TraceSerializer()

STITCH_REQUEST = re.compile('stitch ' + BASE + r' (\d+)')
STITCH_SERIALIZER = serializer.VisualTraceTreeSerializer()

FLAMEGRAPH_SERIALIZER = serializer.FlamegraphSerializer()
MEMORYGRAPH_REQUEST = re.compile('mem ' + BASE + r' (\d+.\d+) (\d+.\d+|inf)')
MEMORYGRAPH_SERIALIZER = serializer.MemorygraphSerializer()

META_CPU_SERIALIZER = serializer.CPUMetaSerializer()

CACHE = Cache(1 * 1024 * 1024 * 1024) # 4 GB

class CacheProtocol(LineReceiver):
    def __init__(self):
        self.cache = CACHE

    def connectionMade(self):
        log.msg("new connection opened")

    def lineReceived(self, bytesline):
        try:
            self._handle(bytesline)
        except Exception as e:
            self.sendLine(('{"error": "%s"}' % str(e)).encode('utf-8'))
        self.transport.loseConnection()

    def _handle(self, bytesline):
        data = bytesline.decode('utf-8')
        # generic match
        match = GENERIC_REQ.match(data)
        if not match:
            return

        cmd = match.group(1)
        filename = match.group(2)
        checksum = match.group(3)
        if not os.path.exists(filename):
            return

        start = time.time()
        profile = self.load(cmd, filename, checksum)
        parsing_secs = time.time() - start


        size = os.path.getsize(filename)
        measures = { 'parsing': '%.3fms' % (parsing_secs * 1000.0),
                     'log (zip)': '%.1fMB' % (size // 1024 // 1024),
                   }


        start = time.time()
        #
        jsondata = None
        if data.startswith("metacpu"):
            jsondata = META_CPU_SERIALIZER.to_representation(profile)
        elif data.startswith("cpu"):
            jsondata = FLAMEGRAPH_SERIALIZER.to_representation(profile)
        elif data.startswith("mem"):
            match = MEMORYGRAPH_REQUEST.match(data)
            if not match:
                return
            start = float(match.group(3))
            stop  = float(match.group(4))
            jsondata = MEMORYGRAPH_SERIALIZER.to_representation(profile, start, stop)
        elif data.startswith("meta"):
            match = META_REQUEST.match(data)
            if match:
                jsondata = META_SERIALIZER.to_representation(profile)
        elif data.startswith("trace"):
            match = TRACE_REQUEST.match(data) 
            if match:
                uid = int(match.group(3))
                trace = profile.get_trace_by_id(uid)
                jsondata = TRACE_SERIALIZER.to_representation(trace)
        elif data.startswith("stitch"):
            match = STITCH_REQUEST.match(data) 
            if match:
                uid = int(match.group(3))
                trace = profile.get_trace_by_id(uid)
                jsondata = STITCH_SERIALIZER.to_representation(trace)
        #
        json_secs = time.time() - start

        if jsondata:
            measures['json'] = '%.3fms' % (json_secs * 1000.0)
            jsondata['measures'] = measures
            self.sendLine(json.dumps(jsondata).encode('utf-8'))
            log.msg("sent data, closing connection")
        else:
            log.msg("no data sent, closing connection")

    def load(self, type, filename, checksum):
        profile = self.cache.get(checksum)
        if profile:
            log.msg("cached profile (checksum %s)" % (checksum,))
            return profile

        with get_reader(filename) as fobj:
            if type == "cpu" or type == "mem" or type == "metacpu":
                profile = read_cpu_profile(fobj)
            else:
                profile = parser._parse_jitlog(fobj)
            self.cache.put(checksum, profile)
        assert self.cache.get(checksum) is not None
        log.msg("parsed jitlog in file %s (checksum %s)" % (filename, checksum))
        return profile

    def connectionLost(self, reason):
        # Clean up the timeout, if necessary.
        pass

class CacheFactory(protocol.Factory):
    protocol = CacheProtocol
