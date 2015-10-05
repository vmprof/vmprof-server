# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0009_auto_20151005_1106'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='log',
            options={'ordering': ['-created_at']},
        ),
        migrations.RenameField(
            model_name='log',
            old_name='created',
            new_name='created_at',
        ),
    ]
