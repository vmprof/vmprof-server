import hashlib
import io
import bz2
import gzip

from jitlog.parser import _parse_jitlog

from django.db import models
from django.conf import settings
from django.contrib import admin
from django.core.cache import caches

from vmprofile.models import Log as Profile

def get_reader(filename):
    if filename.endswith(".zip"):
        return gzip.GzipFile(filename)
    elif filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    raise NotImplementedError("use gzip/bz2 for compression!")

FOREST_CACHE = caches['forest-cache']

class BinaryJitLog(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)
    created = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/%Y/%m/%d')
    # relations
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    profile = models.ForeignKey(Profile, null=True, blank=False)

    def decode_forest(self):
        forest = FOREST_CACHE.get(self.checksum)
        if forest:
            FOREST_CACHE.set(self.checksum, forest) # refresh the cache
            return forest
        with get_reader(self.file.name) as fd:
            forest = _parse_jitlog(fd)
            FOREST_CACHE.set(self.checksum, forest)
            return forest

@admin.register(BinaryJitLog)
class BinaryJitLogAdmin(admin.ModelAdmin):
    list_display = ('checksum', 'created', 'file', 'user', 'profile')
