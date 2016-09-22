from __future__ import unicode_literals
from django.db import models
from vmprofile.models import RuntimeData


def get_profile_storage_directory(profile, filename):
    return "mem/%d/%s" % (profile.pk, filename)


class MemoryProfile(models.Model):
    checksum = models.CharField(max_length=128, primary_key=True)
    # actual data
    file = models.FileField(upload_to=get_profile_storage_directory)
    addr_name_map = models.FileField(upload_to=get_profile_storage_directory)

    # data that can be extracted from the log
    version = models.IntegerField()
    start_date = models.DateTimeField(blank=True, null=True)
    project = models.CharField(max_length=200)
    top_level_function = models.CharField(max_length=200, blank=True)
    #: Maximum memory used by the function, in KiB. (max: 8 ZiB)
    max_memory_use = models.BigIntegerField(blank=True, null=True)
    #: Time spent in the function (in microseconds; this is simply a cached
    #: version of "#ticks * profile_resolution")
    time_spent = models.BigIntegerField(blank=True, null=True)
    #: Time resolution of profile (delay between profile ticks in microseconds)
    profile_resolution = models.BigIntegerField(blank=True, null=True)

    # relations
    #runtime_data = models.ForeignKey(RuntimeData, related_name='memory_profile',
    #                                 null=True, blank=False)

    @property
    def max_memory_use_gib(self):
        if self.max_memory_use is not None:
            return self.max_memory_use / 1024.0 / 1024

    @property
    def time_spent_human(self):
        if self.time_spent is not None:
            res = []
            remainder = self.time_spent / 10.**6
            if remainder >= 3600:
                res.append("%dh" % (remainder / 3600))
                remainder %= 3600
            if remainder >= 60:
                res.append("%dm" % (remainder / 60))
                remainder %= 60
            if remainder > 0 and len(res) < 2:
                res.append("%ds" % remainder)
            return " ".join(res)
