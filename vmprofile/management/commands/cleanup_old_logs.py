from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from vmprofile.models import RuntimeData
from django.core.exceptions import ObjectDoesNotExist


class Command(BaseCommand):
    help = 'Clean up old profiler logs from the database and file system'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, help='Number of days to keep logs', default=30)

    def handle(self, *args, **options):
        days = options['days']
        delete_older_than = timezone.now() - timedelta(days=days)
        self.stdout.write(f"Deleting profiler logs older than {days} days")
        to_be_deleted = RuntimeData.objects.filter(created__lte=delete_older_than).select_related('cpu_profile')
        count = len(to_be_deleted)
        self.stdout.write(f"Found {count} logs to be deleted")
        for x, runtime_data in enumerate(to_be_deleted):
            self.stdout.write(f"Removing runtime data {x+1} of {count}")
            try:
                runtime_data.cpu_profile.file.delete()
                runtime_data.cpu_profile.delete()
            except ObjectDoesNotExist:
                pass
            runtime_data.delete()
