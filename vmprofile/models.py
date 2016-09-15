import hashlib

from django.db import models
from django.conf import settings
from django.contrib import admin

def get_profile_storage_directory(profile, filename):
    return "cpu/%d/%s" % (profile.pk, filename)

class RuntimeData(models.Model):
    created = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False)
    vm = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=256, blank=True)

    class Meta:
        ordering = ['-created']

# rename that model to CPUProfile, add new model 'Upload', ...
class CPUProfile(models.Model):
    checksum = models.CharField(max_length=128, primary_key=True)
    cpu_profile = models.FileField(upload_to=get_profile_storage_directory)
    # deprecated, do NOT use!
    data = models.TextField(null=True)

    runtime_data = models.ForeignKey(RuntimeData, related_name='cpu_profile',
                                     null=True, blank=False)

    def save(self, *args, **kwargs):
        if not self.checksum:
            data = self.data
            self.checksum = hashlib.md5(data).hexdigest()

        return super(CPUProfile, self).save(*args, **kwargs)

@admin.register(RuntimeData)
class RuntimeDataAdmin(admin.ModelAdmin):
    list_display = ('name', 'vm', 'user', 'created')
