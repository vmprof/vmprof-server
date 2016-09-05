import hashlib
import io

from jitlog.parser import _parse_jitlog

from django.db import models
from django.conf import settings
from django.contrib import admin
from django.core.cache import caches

from vmprofile.models import Log as Profile

from forestcache.cache import get_reader

class BinaryJitLog(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)
    created = models.DateTimeField(auto_now_add=True)
    file = models.FileField(upload_to='uploads/%Y/%m/%d')
    # relations
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    profile = models.ForeignKey(Profile, related_name='jitlog',
                                null=True, blank=False)


@admin.register(BinaryJitLog)
class BinaryJitLogAdmin(admin.ModelAdmin):
    list_display = ('checksum', 'created', 'file', 'user', 'profile')
