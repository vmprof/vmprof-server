# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0008_entry_created_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='entry',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True),
        ),
    ]
