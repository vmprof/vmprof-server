import hashlib
from django.db import models


class Log(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)
    content = models.TextField()

    def save(self, *args, **kwargs):
        if not self.checksum:
            self.checksum = hashlib.md5(self.content).hexdigest()

        return super(Log, self).save(*args, **kwargs)
