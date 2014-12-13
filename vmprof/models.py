import hashlib

from django.db import models


class Log(models.Model):
    checksum = models.CharField(max_length=32, primary_key=True)

    prof = models.BinaryField()
    prof_sym = models.BinaryField()

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = self.prof + self.prof_sym
            self.checksum = hashlib.md5(data).hexdigest()

        return super(Log, self).save(*args, **kwargs)
