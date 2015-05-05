import pytest

from rest_framework import status

from server.main import RegisterSerializer


def test_register_serializer():

    data = {
        'username': 'testuser',
        'email': 'test@gmail.com',
        'password': 'asdasdaas'
    }

    serializer = RegisterSerializer(data=data)
    assert serializer.is_valid()


def test_register_serializer_errors_1():

    data = {
        'username': '',
        'email': 'test@gmail.com',
    }

    s = RegisterSerializer(data=data)
    s.is_valid()

    assert unicode(s.fields['username'].error_messages['blank']) \
        in s.errors['username']
    assert unicode(s.fields['password'].error_messages['required']) \
        in s.errors['password']


@pytest.mark.django_db
def test_register(client):

    data = {
        'username': 'testuser',
        'email': 'test@gmail.com',
        'password': 'asdasdaas'
    }

    response = client.post('/api/register/', data)
    assert response.status_code == status.HTTP_201_CREATED
    assert not response.data
