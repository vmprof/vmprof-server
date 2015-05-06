import pytest
import json

from rest_framework import status

from django.contrib import auth

from server.main import UserRegisterSerializer


def test_user_register_serializer():

    data = {
        'username': 'testuser',
        'email': 'test@gmail.com',
        'password': 'asdasdaas'
    }

    serializer = UserRegisterSerializer(data=data)
    assert serializer.is_valid()


def test_user_register_serializer_errors():

    data = {
        'username': '',
        'email': 'test@gmail.com',
    }

    s = UserRegisterSerializer(data=data)
    s.is_valid()

    assert unicode(s.fields['username'].error_messages['blank']) \
        in s.errors['username']
    assert unicode(s.fields['password'].error_messages['required']) \
        in s.errors['password']


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


@pytest.mark.django_db
def test_user_register(client):

    data = {
        'username': 'testuser',
        'email': 'test@gmail.com',
        'password': 'asdasdaas'
    }

    response = client.put('/api/user/', json.dumps(data), content_type='application/json')
    assert response.status_code == status.HTTP_201_CREATED
    assert not response.data


@pytest.mark.django_db
def test_user_logout(client):

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

    client.login(username=username, password=password)

    assert client.post('/api/user/', data).status_code == status.HTTP_202_ACCEPTED
    assert client.delete('/api/user/')
    assert client.get('/api/user/').status_code == status.HTTP_403_FORBIDDEN
