# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import datetime
from django.utils.timezone import utc


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='log',
            name='created',
            field=models.DateTimeField(default=datetime.datetime(2015, 1, 26, 23, 38, 14, 520959, tzinfo=utc), auto_now_add=True),
            preserve_default=False,
        ),
    ]
