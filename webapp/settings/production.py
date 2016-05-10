from . import *


DEBUG = False
ALLOWED_HOSTS = ['vmprof.com']


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': 'vmprof',
        'USER': 'vmprof',
    }
}


INSTALLED_APPS = INSTALLED_APPS + (
    'raven.contrib.django.raven_compat',
)

# this is just for test
RAVEN_CONFIG = {
    'dsn': 'https://68b9d0f79fde48d5a1b0a155521d07d5:6ba8f1aa58e342ba91811047538db625@app.getsentry.com/43517',
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': os.path.join(BASE_DIR, '..', 'vmprof.log'),
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['file'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
