from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from vmprofile.models import CPUProfile


class Command(BaseCommand):
    help = 'Cleans up old profiler logs from the database and file system'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, help='Number of days to keep logs', default=30)

    def handle(self, *args, **options):
        days = options['days']
        delete_older_than = timezone.now() - timedelta(days=days)
        self.stdout.write(f"Deleting profiler logs older than {days} days")
        to_be_deleted = CPUProfile.objects.filter(runtime_data__created__lte=delete_older_than)\
            .select_related('runtime_data')
        count = len(to_be_deleted)
        self.stdout.write(f"Found {count} logs to be deleted")
        for x, profile in enumerate(to_be_deleted):
            self.stdout.write(f"Removing cpu profile log {x+1} of {count}")
            profile.file.delete()
            profile.runtime_data.delete()
