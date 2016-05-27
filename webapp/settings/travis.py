from .tests import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'vmprof',
        'USER': 'vmprof',
    }
}
