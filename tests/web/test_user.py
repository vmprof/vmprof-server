import pytest

from django.contrib import auth
from rest_framework import status


@pytest.mark.django_db
def test_user_get(client):

    username = 'username'
    password = 'thepassword'

    auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    assert client.get('/api/user/').status_code == status.HTTP_403_FORBIDDEN

    client.login(username=username, password=password)

    assert client.get('/api/user/').data['username'] == username


@pytest.mark.django_db
def test_user_login(client):

    username = 'username'
    password = 'thepassword'

    auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    data = {
        'username': username,
        'password': password
    }

    assert client.get('/api/user/').status_code == status.HTTP_403_FORBIDDEN
    assert client.post('/api/user/', data).status_code == status.HTTP_202_ACCEPTED
    assert client.get('/api/user/').status_code == status.HTTP_200_OK
