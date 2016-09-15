import hashlib

from django.db import models
from django.conf import settings
from django.contrib import admin

# duplicated from vmmemory/models.py
def get_profile_storage_directory(profile, filename):
    return "%d/%s" % (profile.pk, filename)

# rename that model to CPUProfile, add new model 'Upload', ...
class Log(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    created = models.DateTimeField(auto_now_add=True)
    #
    checksum = models.CharField(max_length=32, primary_key=True)
    cpu_profile = models.FileField(upload_to=get_profile_storage_directory, null=True)
    # deprecated, do NOT use!
    data = models.TextField()

    # data that can be extracted from the log
    name = models.CharField(max_length=256, blank=True)
    vm = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ['-created']

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = self.data
            self.checksum = hashlib.md5(data).hexdigest()

        return super(Log, self).save(*args, **kwargs)

@admin.register(Log)
class LogAdmin(admin.ModelAdmin):
    list_display = ('name', 'vm', 'checksum', 'user', 'created')
