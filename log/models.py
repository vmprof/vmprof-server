import hashlib

from django.db import models
from django.conf import settings
from django.contrib import admin

from profile.models import Log as Profile


class BinaryJitLog(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)
    created = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/%Y/%m/%d')
    # relations
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    profile = models.ForeignKey(Profile, null=True, blank=False)

    def decompressed_jitlog(self):
        jitlog = []
        lzc = lzma.LZMADecompressor()
        for chunk in self.file.chunks():
            out = lzc.compress(chunk)
            jitlog.append(out)
        out = lzc.flush()
        jitlog.append(out)

        return ''.join(jitlog)

@admin.register(BinaryJitLog)
class BinaryJitLogAdmin(admin.ModelAdmin):
    list_display = ('checksum', 'created', 'file', 'user', 'profile')
