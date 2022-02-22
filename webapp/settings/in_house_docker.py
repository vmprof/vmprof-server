from . import *

DEBUG = False
ALLOWED_HOSTS = ['*']
COMPRESS_OFFLINE = True
REGISTRATION_ENABLED = False
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
