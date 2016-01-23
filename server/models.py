import uuid
import hashlib

from django.db import models
from django.conf import settings
from django.contrib import admin


def default_hash():
    return str(uuid.uuid4()).replace("-", "")


class Log(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL,
                             null=True, blank=False)

    checksum = models.CharField(max_length=32, primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    uid = models.CharField(max_length=128, default=default_hash)

    name = models.CharField(max_length=256, blank=True)
    vm = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ['-created_at']


class Entry(models.Model):
    log = models.ForeignKey('Log', related_name="entries")
    data = models.TextField(default="{}")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ('name', 'vm', 'checksum', 'user', 'created_at')
