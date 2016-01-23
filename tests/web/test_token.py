import pytest

from rest_framework import status
from rest_framework.authtoken.models import Token

from django.contrib import auth


@pytest.mark.django_db
@pytest.mark.xfail
def test_token_get(client):

    username = 'username'
    password = 'thepassword'

    user = auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    token = Token.objects.create(user=user)

    assert client.get('/api/token/').status_code == status.HTTP_403_FORBIDDEN
    client.login(username=username, password=password)
    response = client.get('/api/token/')

    assert len(response.data) == 1
    assert response.data[0]['key'] == token.key
    assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
@pytest.mark.xfail
def test_token_create(client):

    username = 'username'
    password = 'thepassword'

    user = auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    client.login(username=username, password=password)

    assert client.post('/api/token/').status_code == status.HTTP_201_CREATED
    assert Token.objects.filter(user=user).count() == 1
    assert client.post('/api/token/').status_code == status.HTTP_201_CREATED
    assert Token.objects.filter(user=user).count() == 1


@pytest.mark.django_db
@pytest.mark.xfail
def test_token_use(client):

    username = 'username'
    password = 'thepassword'

    user = auth.models.User.objects.create_user(
        username,
        'username@vmprof.com',
        password
    )

    token = Token.objects.create(user=user)

    response = client.get('/api/token/', **{'HTTP_AUTHORIZATION': "Token %s" % token.key})
    assert response.status_code == status.HTTP_200_OK
