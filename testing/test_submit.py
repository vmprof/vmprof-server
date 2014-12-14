import os
import json
import pytest
import hashlib

from rest_framework.test import APIClient


from base64 import b64encode
from vmprof.models import Log


c = pytest.fixture(lambda: APIClient())


def read_log(name):
    here = os.path.dirname(__file__)

    with open(os.path.join(here, name)) as fp:
        return fp.read()


@pytest.mark.django_db
def test_submit(c):

    data = {
        'prof': b64encode(read_log('test.prof')),
        'prof_sym': b64encode(read_log('test.prof.sym'))
    }

    response = c.post('/api/log/', data=data)

    assert Log.objects.get(checksum=response.data)
    assert Log.objects.count() == 1


@pytest.mark.django_db
def test_log(client):
    prof = read_log('test.prof')
    prof_sym = read_log('test.prof.sym')

    log = Log.objects.create(prof=prof, prof_sym=prof_sym)

    response = client.get('/api/log/%s/' % log.checksum)

    assert log.checksum == response.data['checksum']
