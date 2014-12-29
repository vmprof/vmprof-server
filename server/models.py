import hashlib

from django.db import models


class Log(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)

    data = models.BinaryField()

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = self.data
            self.checksum = hashlib.md5(data).hexdigest()

        return super(Log, self).save(*args, **kwargs)
