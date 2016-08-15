# VMProf

[![Build Status](https://travis-ci.org/vmprof/vmprof-server.svg?branch=master)](https://travis-ci.org/vmprof/vmprof-server)

A Virtual Machine profiling platform. Currently restricted to PyPy and CPython. The service is hosted at http://vmprof.com

## Development

Setting up development can be done using the following commands:

	$ virtualenv -p /usr/bin/python3 vmprof3
	$ source vmprof3/bin/activate
	# setup django service
	(vmprof3) $ cd ../vmprof-server
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

	py.test .
