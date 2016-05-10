# -*- coding: utf-8 -*-
import json
import urllib
import hashlib

from django.conf.urls import url, include
from django.contrib import auth

from rest_framework import views
from rest_framework import status
from rest_framework import permissions
from rest_framework import validators
from rest_framework import pagination
from rest_framework.response import Response
from rest_framework import viewsets, serializers
from rest_framework.authtoken.models import Token

from .models import Log


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
        validators=[validators.UniqueValidator(queryset=auth.models.User.objects.all())]
    )
    email = serializers.EmailField(
        max_length=email_max,
        validators=[validators.UniqueValidator(queryset=auth.models.User.objects.all())]
    )
    password = serializers.CharField(min_length=6, max_length=password_max)


class LogSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Log

    def get_data(self, obj):
        return json.loads(obj.data)


class LogListSerializer(serializers.ModelSerializer):
    user = UserSerializer()

    class Meta:
        model = Log
        fields = ('checksum', 'user', 'created', 'vm', 'name')


class LogViewSet(viewsets.ModelViewSet):
    queryset = Log.objects.select_related('user')
    serializer_class = LogListSerializer
    permission_classes = (permissions.AllowAny,)

    def get_serializer_class(self):
        if 'pk' in self.kwargs:
            return LogSerializer
        return LogListSerializer

    def create(self, request):
        data = json.dumps(request.data)
        checksum = hashlib.md5(data).hexdigest()
        user = request.user if request.user.is_authenticated() else None
        log, _ = self.queryset.get_or_create(
            data=data,
            checksum=checksum,
            user=user,
            vm=request.data['VM'],
            name=request.data['argv']
        )

        return Response(log.checksum)

    def get_queryset(self):
        if not self.request.user.is_authenticated():
            return self.queryset

        if not bool(self.request.GET.get('all', False)) and 'pk' not in self.kwargs:
            return self.queryset.filter(user=self.request.user)
        return self.queryset


class UserPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        if request.method == "PUT":
            return True
        if request.method == "DELETE":
            return request.user.is_authenticated()
        if request.method == "GET":
            return request.user.is_authenticated()
        return False


class MeView(views.APIView):
    permission_classes = (UserPermission,)

    def get(self, request, format=None):
        data = UserSerializer(self.request.user).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, format=None):
        username = request.data['username']
        password = request.data['password']

        user = auth.authenticate(username=username, password=password)

        if user is not None and user.is_active:
            auth.login(request, user)
            return Response(UserSerializer(user).data, status=status.HTTP_202_ACCEPTED)

        return Response(status=status.HTTP_403_FORBIDDEN)

    def put(self, request, format=None):
        serializer = UserRegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        auth.models.User.objects.create_user(
            serializer.data['username'],
            serializer.data['email'],
            serializer.data['password']
        )

        return Response(status=status.HTTP_201_CREATED)

    def delete(self, request, format=None):
        auth.logout(request)
        return Response(status=status.HTTP_200_OK)


class TokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Token


class TokenViewSet(viewsets.ModelViewSet):
    serializer_class = TokenSerializer
    model = Token

    def get_queryset(self):
        return Token.objects.filter(user=self.request.user)

    def create(self, request):
        Token.objects.filter(user=self.request.user).delete()
        Token.objects.create(user=self.request.user)
        return Response(status=status.HTTP_201_CREATED)

    def list(self, request):
        serializer = self.serializer_class(self.get_queryset(), many=True)
        return Response(serializer.data)


class JitLogViewSet(viewsets.ModelViewSet):
    queryset = Log.objects.select_related('user')
    serializer_class = LogListSerializer
    permission_classes = (permissions.AllowAny,)

    def get_serializer_class(self):
        if 'pk' in self.kwargs:
            return LogSerializer
        return LogListSerializer

    def create(self, request):
        zlib_compressed_binary_data = request.data
        checksum = hashlib.md5(data).hexdigest()
        user = request.user if request.user.is_authenticated() else None
        log, _ = self.queryset.get_or_create(
            data=data,
            checksum=checksum,
            user=user,
            vm='pypy'
        )

        return Response(log.checksum)

    def get_queryset(self):
        if not self.request.user.is_authenticated():
            return self.queryset

        if not bool(self.request.GET.get('all', False)) and 'pk' not in self.kwargs:
            return self.queryset.filter(user=self.request.user)
        return self.queryset
