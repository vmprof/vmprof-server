# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations


def asssing_default_user(apps, schema_editor):

    Log = apps.get_model("server", "Log")
    User = apps.get_model("auth", "User")

    if User.objects.count() > 0:
        user = User.objects.all()[0]
    else:
        user = User.objects.create(
            username="anonymous",
            email="anonymous@email.com",
        )

    Log.objects.filter(user__isnull=True).update(user=user)


class Migration(migrations.Migration):

    dependencies = [
        ('server', '0003_log_secret'),
    ]

    operations = [
        migrations.RunPython(asssing_default_user),
    ]
