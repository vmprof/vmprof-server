import os
import json
import pytest

from base64 import b64encode

from rest_framework.test import APIClient

from vmprofile.models import RuntimeData, CPUProfile


c = pytest.fixture(lambda: APIClient())


def read_log(name):
    here = os.path.dirname(__file__)

    with open(os.path.join(here, name)) as fp:
        return fp.read()


@pytest.mark.django_db
def test_submit(c):
    from .submit import data as plain_data

    data = {
        'data': json.dumps(plain_data), # b64encode(json.dumps(plain_data).encode('utf-8')),
        'VM': 'cpython',
        'argv': 'test.py'
    }

    response = c.post('/api/log/', data=data)

    assert RuntimeData.objects.count() == 1
    rd = RuntimeData.objects.get(pk=response.data)
    assert rd.cpu_profile is not None
    assert rd.cpu_profile.data == plain_data


@pytest.mark.django_db
def test_profile(c):
    from .submit import data

    rd = RuntimeData.objects.create(name='test', vm='pypy')
    p = CPUProfile(data=data, runtime_data=rd, file=None)
    p.save()
    response = c.get('/api/log/%s/' % rd.pk)
    assert rd.pk == response.data['checksum']
