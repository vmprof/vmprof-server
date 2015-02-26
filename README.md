# vmprof


Virtual Machine profiler (so far restricted to pypy and cpython)


## development

	pip install -r requirements/development.txt

	python manage.py syncdb --noinput
	python manage.py migrate

	python manage.py runserver


## deployment

	fab deploy -H {HOST} -u {USER}


