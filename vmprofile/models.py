import uuid

from django.db import models
from django.conf import settings
from django.contrib import admin


def get_profile_storage_directory(profile, filename):
    return "cpu/%d/%s" % (profile.pk, filename)


class RuntimeData(models.Model):
    runtime_id = models.CharField(max_length=64, default=uuid.uuid4, primary_key=True, unique=True)
    created = models.DateTimeField(auto_now_add=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=False, on_delete=models.CASCADE)
    vm = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=256, blank=True)
    completed = models.BooleanField(default=False)

    start_time = models.DateTimeField(null=True)
    stop_time = models.DateTimeField(null=True)

    arch = models.CharField(max_length=25, default="")
    os = models.CharField(max_length=25, default="")

    @property
    def jitlog_id(self):
        from vmlog.models import BinaryJitLog
        try:
            return self.jitlog.pk
        except BinaryJitLog.ObjectNotFound:
            return ''

    @property
    def time_in_seconds(self):
        if self.stop_time and self.start_time:
            return (self.stop_time - self.start_time).total_seconds()
        return 0

    class Meta:
        ordering = ['-created']


# rename that model to CPUProfile, add new model 'Upload', ...
class CPUProfile(models.Model):
    cpuprofile_id = models.CharField(max_length=64, default=uuid.uuid4, primary_key=True)
    file = models.FileField(null=True, upload_to=get_profile_storage_directory)
    # deprecated, do NOT use!
    data = models.TextField(null=True)

    runtime_data = models.OneToOneField(RuntimeData, related_name='cpu_profile',
                                        null=True, blank=True, on_delete=models.CASCADE)


@admin.register(RuntimeData)
class RuntimeDataAdmin(admin.ModelAdmin):
    list_display = ('name', 'vm', 'user', 'created')
