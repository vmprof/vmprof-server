import hashlib

from django.db import models
from django.conf import settings
from django.contrib import admin


class Log(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)

    checksum = models.CharField(max_length=32, primary_key=True)
    created = models.DateTimeField(auto_now_add=True)

    data = models.TextField()

    class Meta:
        ordering = ['-created']

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = self.data
            self.checksum = hashlib.md5(data).hexdigest()

        return super(Log, self).save(*args, **kwargs)


@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ('user', 'created', 'data')
