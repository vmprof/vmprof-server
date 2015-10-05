# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


def migrate(apps, schema_editor):
    Entry = apps.get_model("server", "Entry")

    for entry in Entry.objects.all():
        entry.created_at = entry.log.created
        entry.save()


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0007_entry_data'),
    ]

    operations = [
        migrations.AddField(
            model_name='entry',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.RunPython(migrate),
    ]
