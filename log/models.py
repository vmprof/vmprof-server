import hashlib
import io
import bz2
import lzma
import gzip

from vmprof.log.parser import _parse_jitlog

from django.db import models
from django.conf import settings
from django.contrib import admin

from vmprofile.models import Log as Profile

def get_reader(filename):
    if filename.endswith(".zip"):
        return gzip.GzipFile(filename)
    elif filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    elif filename.endswith(".xz"):
        return lzma.LZMAFile(filename)
    raise NotImplementedError("only bz2 and xz are supported!")

class BinaryJitLog(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)
    created = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/%Y/%m/%d')
    # relations
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    profile = models.ForeignKey(Profile, null=True, blank=False)

    def decode_forest(self):
        with get_reader(self.file.name) as fd:
            return _parse_jitlog(fd)

@admin.register(BinaryJitLog)
class BinaryJitLogAdmin(admin.ModelAdmin):
    list_display = ('checksum', 'created', 'file', 'user', 'profile')
