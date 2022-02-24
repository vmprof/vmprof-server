from django.core.management.base import BaseCommand
from django.contrib.sessions.models import Session


class Command(BaseCommand):
    help = 'Clears users sessions'

    def handle(self, *args, **options):
        # XXX a bit too dramatic, but will work for now
        Session.objects.all().delete()
        self.stdout.write("done")
