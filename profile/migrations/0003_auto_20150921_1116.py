# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('profile', '0002_log_user'),
    ]

    operations = [
        migrations.AddField(
            model_name='log',
            name='name',
            field=models.CharField(max_length=256, blank=True),
        ),
        migrations.AddField(
            model_name='log',
            name='vm',
            field=models.CharField(max_length=32, blank=True),
        ),
    ]
