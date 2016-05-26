# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import json

from django.db import models, migrations


def forward(apps, schema_editor):
    Log = apps.get_model("vmprofile", "Log")
    for log in Log.objects.all():
        data = json.loads(log.data)

        log.name = data.get('argv', '')
        log.vm = data.get('VM', 'cpython')
        log.save()


class Migration(migrations.Migration):

    dependencies = [
        ('vmprofile', '0003_auto_20150921_1116'),
    ]

    operations = [
        migrations.RunPython(forward, migrations.RunPython.noop),
    ]
