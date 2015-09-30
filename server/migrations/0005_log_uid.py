# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import server.models


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0004_auto_20150921_1116'),
    ]

    operations = [
        migrations.AddField(
            model_name='log',
            name='uid',
            field=models.CharField(default=server.models.default_hash, max_length=128),
        ),
    ]
