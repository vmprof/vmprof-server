# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Log',
            fields=[
                ('checksum', models.CharField(max_length=32, serialize=False, primary_key=True)),
                ('data', models.BinaryField()),
            ],
            options={
            },
            bases=(models.Model,),
        ),
    ]
