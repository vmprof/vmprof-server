# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0010_auto_20151005_1108'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='entry',
            options={'ordering': ['-created_at']},
        ),
        migrations.RemoveField(
            model_name='log',
            name='data',
        ),
    ]
