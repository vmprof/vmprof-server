import os

import dj_database_url
from django.core.management.utils import get_random_secret_key

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

SECRET_KEY = os.environ.get('SECRET_KEY', get_random_secret_key())

DEBUG = True
ALLOWED_HOSTS = ['*']


INSTALLED_APPS = (
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework.authtoken',
    'compressor',

    'webapp',
    'vmprofile',
    'vmlog',
    'vmmemory',
)

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]


TEMPLATES = [
    { 'BACKEND': 'django.template.backends.django.DjangoTemplates',
      'APP_DIRS': True,
      'OPTIONS': {
        'context_processors': [
           # Insert your TEMPLATE_CONTEXT_PROCESSORS here or use this
           # list if you haven't customized them:
           'django.contrib.auth.context_processors.auth',
           'django.template.context_processors.debug',
           'django.template.context_processors.i18n',
           'django.template.context_processors.media',
           'django.template.context_processors.static',
           'django.template.context_processors.tz',
           'django.contrib.messages.context_processors.messages',
           'django.template.context_processors.request',
        ],
      },
    },
]

ROOT_URLCONF = 'webapp.urls'
WSGI_APPLICATION = 'webapp.wsgi.app'
REGISTRATION_ENABLED = True

DATABASES = {
    'default': dj_database_url.config(default='sqlite:///sqlite3.db')
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_L10N = False
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

STATICFILES_FINDERS = (
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    'compressor.finders.CompressorFinder'
)

STATICFILES_DIRS = (
    os.path.join(BASE_DIR, 'vmprofile', 'static'),
    os.path.join(BASE_DIR, 'vmlog', 'static')
)

REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.LimitOffsetPagination',
    'PAGE_SIZE': 10,
}

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'TIMEOUT': 4*60, # 4 minutes
        'MAX_ENTRIES': 500,
    },
    'forest-cache': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'TIMEOUT': 4*60, # 4 minutes
        'MAX_ENTRIES': 500,
    }
}
