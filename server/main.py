# -*- coding: utf-8 -*-
import hashlib
import json
import zlib
from base64 import b64decode

from django.conf.urls import url, include
from django.contrib.staticfiles import views

from rest_framework import routers
from rest_framework.response import Response
from rest_framework import viewsets, serializers

from server.process import process

from .models import Log


class LogSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Log

    def get_data(self, obj):
        return json.loads(obj.data)


class LogViewSet(viewsets.ModelViewSet):
    queryset = Log.objects.all()
    serializer_class = LogSerializer

    def create(self, request):
        data = json.dumps(request.data)
        checksum = hashlib.md5(data).hexdigest()
        log, _ = self.queryset.get_or_create(
            data=data,
            checksum=checksum
        )

        return Response(log.checksum)

    def retrieve(self, request, pk=None):
        try:
            log = self.queryset.get(pk=pk)
            return Response(self.serializer_class(
                log, context={'request': request}
            ).data)
        except Log.DoesNotExist:
            return Response(status=404)


router = routers.DefaultRouter()
router.register(r'log', LogViewSet)


urlpatterns = [
    url(r'^api/', include(router.urls)),
    url(r'^$', views.serve, {'path': 'index.html', 'insecure': True}),
]
