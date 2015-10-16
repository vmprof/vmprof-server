import json
import hashlib

from django.contrib import auth
from django.conf import settings
from django.utils import dateformat

from rest_framework import serializers
from rest_framework import validators
from rest_framework.reverse import reverse
from rest_framework.authtoken.models import Token

from .models import Log, Entry


username_max = auth.models.User._meta.get_field('username').max_length
password_max = auth.models.User._meta.get_field('password').max_length
email_max = auth.models.User._meta.get_field('email').max_length


class UserSerializer(serializers.ModelSerializer):
    gravatar = serializers.SerializerMethodField()

    class Meta:
        model = auth.models.User
        fields = ['id', 'username', 'gravatar']

    def get_gravatar(self, obj):
        default = "https://avatars0.githubusercontent.com/u/10184195?v=3&s=200"
        size = 40

        gravatar_hash = hashlib.md5(obj.email.lower()).hexdigest()
        gravatar_url = "http://www.gravatar.com/avatar/%s?" % gravatar_hash
        gravatar_url += urllib.urlencode({'d': default, 's': str(size)})

        return gravatar_url


class UserRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(
        min_length=5,
        max_length=username_max,
        validators=[validators.UniqueValidator(
            queryset=auth.models.User.objects.all())]
    )
    email = serializers.EmailField(
        max_length=email_max,
        validators=[validators.UniqueValidator(
            queryset=auth.models.User.objects.all())]
    )
    password = serializers.CharField(min_length=6, max_length=password_max)


class EntriesField(serializers.RelatedField):
    def to_representation(self, value):
        return {
            "id": value.id,
            "created_at": dateformat.format(
                value.created_at,
                settings.DATETIME_FORMAT),
            "url": reverse('entry-detail', args=[value.pk]),
        }


class LogSerializer(serializers.ModelSerializer):
    entries = EntriesField(many=True, read_only=True)

    class Meta:
        model = Log


class EntrySerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Entry

    def get_data(self, obj):
        return json.loads(obj.data)['profiles']


class TokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Token
