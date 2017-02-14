import uuid

from jitlog.parser import _parse_jitlog

from django.db import models
from django.contrib import admin

from vmprofile.models import RuntimeData

from vmcache.cache import get_reader

def get_profile_storage_directory(profile, filename):
    return "log/%d/%s" % (profile.pk, filename)

class BinaryJitLog(models.Model):
    jitlog_id = models.CharField(max_length=64, primary_key=True)
    checksum = models.CharField(max_length=128)
    created = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to=get_profile_storage_directory)
    # relations
    profile = models.ForeignKey(RuntimeData, related_name='jitlog',
                                null=True, blank=False)

    def decode_forest(self):
        # ultra slow, especially when run on cpython 3.5
        # see vmcache.cache for a faster impl. using pypy.
        # it caches the results as well (not using pickle)
        with get_reader(self.file.name) as fd:
            forest = _parse_jitlog(fd)
            return forest

@admin.register(BinaryJitLog)
class BinaryJitLogAdmin(admin.ModelAdmin):
    list_display = ('checksum', 'created', 'file', 'profile')
