from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    DEFAULT_USERNAME = 'api_user'

    help = 'Generate new API token for uploading profile logs'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, help='Assign the token to a certain user')

    def handle(self, *args, **options):
        username = options['username'] or self.DEFAULT_USERNAME
        user, _ = User.objects.get_or_create(username=username)
        token, new = Token.objects.get_or_create(user=user)
        if not new:
            self.stderr.write("Token already exists for this user: {}".format(token.key))
        else:
            self.stdout.write(token.key)
