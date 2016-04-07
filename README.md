# Vmprof


Virtual Machine profiler (so far restricted to pypy and cpython)


## Development

This setup is available on both Linux and Windows.
	
	pip install -r requirements\development.txt
	python manage.py syncdb --noinput
	python manage.py runserver

## Test

You should run the tests before committing with this command:
    py.test tests/

## Deployment

	apt-get install gcc python-dev postgresql-9.X postgresql-server-dev-9.X

    pip install -r requirements/development.txt
	
    python manage.py syncdb --noinput
    python manage.py migrate
	python manage.py runserver

	edit /etc/postgresql/9.X/main/pg_hba.conf
	local all postgres trust
	createdb -U postgres vmprof

	#use this to deploy to your own server
    fab deploy -H vmprof.com -u {USER}
