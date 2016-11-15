import pytest

from django.contrib import auth
from vmprofile.models import RuntimeData, CPUProfile


@pytest.mark.django_db
def test_log_get_user(client):

    username = 'username'
    password = 'thepassword'

    user = auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    rd1 = RuntimeData.objects.create(user=user)
    rd2 = RuntimeData.objects.create(user=None)

    response = client.get('/api/log/')

    assert len(response.data['results']) == 2

    client.login(username=username, password=password)

    response = client.get('/api/log/')
    assert len(response.data['results']) == 1

    response = client.get('/api/log/?all=True')
    assert len(response.data['results']) == 2
