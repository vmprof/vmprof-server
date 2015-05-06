# -*- coding: utf-8 -*-
import hashlib
import json

from django.conf.urls import url, include
from django.contrib.staticfiles import views as static
from django.contrib import auth
from django.contrib import admin

from rest_framework import views
from rest_framework import routers
from rest_framework import status
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework import viewsets, serializers


from .models import Log


class LogSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Log

    def get_data(self, obj):
        return json.loads(obj.data)


class LogListSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Log

    def get_data(self, obj):
        j = json.loads(obj.data)
        del j['profiles']
        return j


class LogViewSet(viewsets.ModelViewSet):
    queryset = Log.objects.all()
    serializer_class = LogSerializer
    list_serializer_class = LogListSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request):
        data = json.dumps(request.data)
        checksum = hashlib.md5(data).hexdigest()
        log, _ = self.queryset.get_or_create(
            data=data,
            checksum=checksum
        )

        return Response(log.checksum)

    def list(self, request):
        serializer = self.list_serializer_class(self.queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        try:
            log = self.queryset.get(pk=pk)
            return Response(self.serializer_class(
                log, context={'request': request}
            ).data)
        except Log.DoesNotExist:
            return Response(status=404)


username_max = auth.models.User._meta.get_field('username').max_length
password_max = auth.models.User._meta.get_field('password').max_length
email_max = auth.models.User._meta.get_field('email').max_length


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = auth.models.User
        fields = ['id', 'username']


class UserRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=6, max_length=username_max)
    password = serializers.CharField(min_length=6, max_length=password_max)

    email = serializers.EmailField(max_length=email_max)


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


router = routers.DefaultRouter()
router.register(r'log', LogViewSet)

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^api/', include(router.urls)),
    url(r'^api/user/', MeView.as_view()),
    url(r'^$', static.serve, {'path': 'index.html', 'insecure': True}),
]
