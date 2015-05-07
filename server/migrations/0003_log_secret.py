# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0002_log_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='log',
            name='secret',
            field=models.BooleanField(default=False),
            preserve_default=True,
        ),
    ]
