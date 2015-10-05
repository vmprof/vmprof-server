# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


def migrate(apps, schema_editor):
    Log = apps.get_model("server", "Log")

    for log in Log.objects.all():
        log.entries.create(data=log.data)


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0006_entry'),
    ]

    operations = [
        migrations.AddField(
            model_name='entry',
            name='data',
            field=models.TextField(default=b'{}'),
        ),
        migrations.RunPython(migrate),
    ]
