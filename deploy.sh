UWSGI=/var/www/vmprof/virtualenv/bin/uwsgi
PYTHON=/var/www/vmprof/virtualenv/bin/python
sudo $UWSGI --stop uwsgi.ini
git pull
DJANGO_SETTINGS_MODULE='webapp.settings.production' $PYTHON manage.py migrate
DJANGO_SETTINGS_MODULE='webapp.settings.production' $PYTHON manage.py collectstatic --noinput
DJANGO_SETTINGS_MODULE='webapp.settings.production' $PYTHON manage.py compress --noinput
sudo $UWSGI --ini uwsgi.ini

