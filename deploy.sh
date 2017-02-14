cd /var/www/vmprof/vmprof
git pull
cd /var/www/vmprof
source virtualenv/bin/activate

sudo /var/www/vmprof/virtualenv/bin/uwsgi --stop vmprof/uwsgi.ini
DJANGO_SETTINGS_MODULE='webapp.settings.production' python manage.py migrate
DJANGO_SETTINGS_MODULE='webapp.settings.production' python manage.py collectstatic --noinput
DJANGO_SETTINGS_MODULE='webapp.settings.production' python manage.py compress --noinput
sudo /var/www/vmprof/virtualenv/bin/uwsgi --ini vmprof/uwsgi.ini

