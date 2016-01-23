import os
import json
import pytest

from base64 import b64encode

from rest_framework.test import APIClient

from server.models import Log


c = pytest.fixture(lambda: APIClient())


def read_log(name):
    here = os.path.dirname(__file__)

    with open(os.path.join(here, name)) as fp:
        return fp.read()


@pytest.mark.django_db
def test_submit(c):
    from .submit import data

    data = {
        'data': b64encode(json.dumps(data)),
        'VM': 'cpython',
        'argv': 'test.py'
    }

    response = c.post('/api/log/', data=data)

    assert Log.objects.get(checksum=response.data)
    assert Log.objects.count() == 1


@pytest.mark.django_db
def test_submit_uid(c):
    from .submit import data

    data = {
        'data': b64encode(json.dumps(data)),
        'VM': 'cpython',
        'argv': 'test.py',
        'uid': 'test'
    }

    response = c.post('/api/log/', data=data)

    assert Log.objects.count() == 1
    log = Log.objects.get(checksum=response.data)
    assert json.loads(log.entries.first().data) == data


@pytest.mark.django_db
def test_submit_uid_2(c):
    from .submit import data

    data = {
        'data': b64encode(json.dumps(data)),
        'VM': 'cpython',
        'argv': 'test.py',
    }

    response = c.post('/api/log/', data=data)

    uid = response.data

    data = {
        'data': b64encode(json.dumps(data)),
        'VM': 'cpython',
        'argv': 'test.py',
        'uid': uid
    }

    response = c.post('/api/log/', data=data)
    assert Log.objects.count() == 1
    log = Log.objects.get(checksum=response.data)

    assert log.entries.count() == 2


@pytest.mark.django_db
def test_log(c):
    from .submit import data

    checksum = "test"

    log = Log.objects.create(checksum=checksum)
    log.entries.create(data=json.dumps(data))

    response = c.get('/api/log/%s/' % log.checksum)

    assert log.checksum == response.data['checksum']
