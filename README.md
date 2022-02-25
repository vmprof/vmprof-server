# VMProf

![Build status](https://github.com/vmprof/vmprof-server/actions/workflows/main.yml/badge.svg)

A Virtual Machine profiling platform. Currently restricted to PyPy and CPython.

## Development

Setting up development can be done using the following commands:

	$ virtualenv -p /usr/bin/python3 vmprof3
	$ source vmprof3/bin/activate

	# setup django service

	(vmprof3) $ cd vmprof-server
	(vmprof3) $ pip install -r requirements/development.txt
	(vmprof3) $ python manage.py migrate
	(vmprof3) $ python manage.py runserver -v 3

	# install vmprof for development (only needed if you want to co develop vmprof-python)

	(vmprof3) $ git clone git@github.com:vmprof/vmprof-python.git ../
	(vmprof3) $ cd ../vmprof-python
	(vmprof3) $ python setup.py develop

Please also consult our section for development at https://vmprof.readthedocs.org.

## Test

For new feature requests open a new branch or fork the repository. We use continous integration
provided by travis. Before you commit run tests using py.test:

	pytest

## Docker

Build docker image and apply migrations (for a new setup or version upgrade):
    
    docker-compose build
    docker-compose run --rm vmprof-server python3 manage.py migrate

Run the server inside docker container:
    
    docker-compose up

Generate API token:

    docker-compose run --rm vmprof-server python3 manage.py generate_api_token

