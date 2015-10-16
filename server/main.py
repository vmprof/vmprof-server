# -*- coding: utf-8 -*-
import json
import urllib
import hashlib

from django.conf.urls import url, include
from django.contrib.staticfiles import views as static
from django.contrib import auth
from django.contrib import admin
from django.conf import settings

from rest_framework import views
from rest_framework import routers
from rest_framework import status
from rest_framework import permissions
from rest_framework import validators
from rest_framework import pagination
from rest_framework.response import Response
from rest_framework import viewsets, serializers
from rest_framework.authtoken.models import Token

from . import models
from . import serializers


class EntryViewSet(viewsets.ModelViewSet):
    queryset = models.Entry.objects.all()
    serializer_class = serializers.EntrySerializer
    permission_classes = (permissions.AllowAny,)


class LogViewSet(viewsets.ModelViewSet):
    queryset = models.Log.objects.select_related('user')
    serializer_class = serializers.LogSerializer

    def create(self, request):
        data = json.dumps(request.data)
        checksum = request.data.get('uid', hashlib.md5(data).hexdigest())
        user = request.user if request.user.is_authenticated() else None

        try:
            log = self.queryset.get(checksum=checksum)
        except self.queryset.model.DoesNotExist:
            log = self.queryset.create(
                checksum=checksum,
                user=user,
                vm=request.data['VM'],
                name=request.data['argv']
            )

        log.entries.create(data=data)

        return Response(log.checksum)

    def get_queryset(self):
        if not self.request.user.is_authenticated():
            return self.queryset

        if not bool(self.request.GET.get('all', False)) \
           and 'pk' not in self.kwargs:

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
        data = serializers.UserSerializer(self.request.user).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, format=None):
        username = request.data['username']
        password = request.data['password']

        user = auth.authenticate(username=username, password=password)

        if user is not None and user.is_active:
            auth.login(request, user)
            return Response(
                serializers.UserSerializer(user).data,
                status=status.HTTP_202_ACCEPTED)

        return Response(status=status.HTTP_403_FORBIDDEN)

    def put(self, request, format=None):
        serializer = serializers.UserRegisterSerializer(
            data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        auth.models.User.objects.create_user(
            serializer.data['username'],
            serializer.data['email'],
            serializer.data['password']
        )

        return Response(status=status.HTTP_201_CREATED)

    def delete(self, request, format=None):
        auth.logout(request)
        return Response(status=status.HTTP_200_OK)


class TokenViewSet(viewsets.ModelViewSet):
    serializer_class = serializers.TokenSerializer
    model = Token

    def get_queryset(self):
        return models.Token.objects.filter(user=self.request.user)

    def create(self, request):
        models.Token.objects.filter(user=self.request.user).delete()
        models.Token.objects.create(user=self.request.user)
        return Response(status=status.HTTP_201_CREATED)

    def list(self, request):
        serializer = self.serializer_class(self.get_queryset(), many=True)
        return Response(serializer.data)


router = routers.DefaultRouter()
router.register(r'entry', EntryViewSet)
router.register(r'log', LogViewSet)
router.register(r'token', TokenViewSet, base_name="token")

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^api/', include(router.urls)),
    url(r'^api/user/', MeView.as_view()),
    url(r'^$', static.serve, {'path': 'index.html', 'insecure': True}),
]

