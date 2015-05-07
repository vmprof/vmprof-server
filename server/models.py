import hashlib

from django.db import models
from django.conf import settings


class Log(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    secret = models.BooleanField(default=False)

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
