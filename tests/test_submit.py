import os
import json
import pytest

from base64 import b64encode

from rest_framework.test import APIClient

from profile.models import Log as Profile


c = pytest.fixture(lambda: APIClient())


def read_log(name):
    here = os.path.dirname(__file__)

    with open(os.path.join(here, name)) as fp:
        return fp.read()


@pytest.mark.django_db
def test_submit(c):
    from .submit import data

    data = {
        'data': b64encode(json.dumps(data).encode('utf-8')),
        'VM': 'cpython',
        'argv': 'test.py'
    }

    response = c.post('/api/log/', data=data)

    assert Profile.objects.get(checksum=response.data)
    assert Profile.objects.count() == 1


@pytest.mark.django_db
def test_profile(c):
    from .submit import data

    log = Profile.objects.create(data=json.dumps(data).encode('utf-8'))

    response = c.get('/api/log/%s/' % log.checksum)

    assert log.checksum == response.data['checksum']
