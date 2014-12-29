import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()


def app(environ, start_response):
    # import pdb; pdb.set_trace()
    # from vmprof import django
    return application(environ, start_response)
