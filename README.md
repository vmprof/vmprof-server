# vmprof


Virtual Machine profiler (so far restricted to pypy and cpython)


## development

	apt-get install gcc python-dev 

    pip install -r requirements/development.txt

    python manage.py syncdb --noinput
    python manage.py migrate

    python manage.py runserver

## test

    py.test tests/

## deployment

    fab deploy -H {HOST} -u {USER}
    host: baroquesoftware.com, user: www-data


