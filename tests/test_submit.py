import os
import json
import pytest
from base64 import b64encode
from rest_framework.test import APIClient
from vmprofile.models import RuntimeData, CPUProfile

c = pytest.fixture(lambda: APIClient())

def new_runtime_data(c):
    data = { 'VM': 'cpython', 'argv': 'test.py' }
    response = c.post('/api/runtime/new', data=data)
    return response.data['runtime_id']

def upload_cpu_profile(c, rid, filename):
    with open(filename, 'rb') as fd:
        request = c.post('/api/runtime/upload/cpu/%s/add' % rid,
                         data={'name':filename, 'file': fd})
        ok = request.status_code == 200
        if not ok:
            return False
        ok = ok and request.json().get('detail', None) == None
        return ok

def freeze(c, rid):
    c.post('/api/runtime/%s/freeze' % rid)

@pytest.mark.django_db
def test_new_runtime_data(c):
    rid = new_runtime_data(c)
    assert RuntimeData.objects.count() == 1
    rd = RuntimeData.objects.get(pk=rid)
    try:
        rd.cpu_profile is None
        pytest.fail("must not have a cpu profile")
    except Exception:
        pass


@pytest.mark.django_db
def test_freeze(c):
    filename = os.path.join(os.path.dirname(__file__), 'test.prof')
    rid = new_runtime_data(c)
    assert upload_cpu_profile(c, rid, filename) == True
    freeze(c, rid)
    assert upload_cpu_profile(c, rid, filename) == False

@pytest.mark.django_db
def test_submit_legacy_api(c):
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
    assert rd.cpu_profile.data != {}

@pytest.mark.django_db
def test_get_cpu_profile_legacy_api(c):
    from .submit import data
    rd = RuntimeData.objects.create(name='test', vm='pypy')
    p = CPUProfile(data=json.dumps(data), runtime_data=rd, file=None)
    p.save()
    response = c.get('/api/log/%s/' % rd.pk)
    assert str(rd.pk) == response.data['runtime_id']

@pytest.mark.django_db
def test_cpu_profile(c):
    from .submit import data
    rd = RuntimeData.objects.create(name='test', vm='pypy')
    p = CPUProfile(data=json.dumps(data), runtime_data=rd, file=None)
    p.save()
    response = c.get('/api/log/%s/' % rd.pk)
    assert str(rd.pk) == response.data['runtime_id']
