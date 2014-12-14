# -*- coding: utf-8 -*-
import hashlib

from base64 import b64decode

from django.conf.urls import url, include
from django.contrib.staticfiles import views

from rest_framework import routers
from rest_framework.response import Response
from rest_framework import viewsets, serializers

from .models import Log

from vmprof.process.addrspace import AddressSpace, Profiles
from vmprof.process.reader import (
    read_prof, read_ranges, read_sym_file, LibraryData
)


def present_function_items(log, func=None):
    period, profiles, symmap = read_prof(log.prof)
    libs = read_ranges(symmap)

    for lib in libs:
        lib.read_object_data()
    libs.append(
        LibraryData(
            '<virtual>',
            0x8000000000000000L,
            0x8fffffffffffffffL,
            True,
            symbols=read_sym_file(str(log.prof_sym)))
    )

    libs.sort()
    profiles = Profiles(AddressSpace(libs).filter(profiles))

    functions = []

    if func:
        items, total = profiles.generate_per_function(func)
        items = items.items()
        items.sort(key=lambda i: -i[1])
    else:
        items = profiles.functions.items()
        items.sort(key=lambda i: -i[1])
        total = len(profiles.profiles)

    for name, count in items:
        segments = name.split(":")

        functions.append({
            "id": name,
            "file": segments[1],
            "name": segments[2],
            "line": segments[3],
            "time": int(float(count) / total * 100)
        })

    return functions


class LogSerializer(serializers.ModelSerializer):
    functions = serializers.SerializerMethodField()

    class Meta:
        model = Log
        fields = ('checksum', 'functions')

    def get_functions(self, obj):
        function = self.context['request'].GET.get('function')
        return present_function_items(obj, function)


class LogViewSet(viewsets.ModelViewSet):
    queryset = Log.objects.all()
    serializer_class = LogSerializer

    def create(self, request):
        prof = b64decode(request.POST['prof'])
        prof_sym = b64decode(request.POST['prof_sym'])

        checksum = hashlib.md5(prof + prof_sym).hexdigest()

        try:
            log = self.queryset.get(checksum=checksum)
        except Log.DoesNotExist:
            log = self.queryset.create(prof=prof, prof_sym=prof_sym)

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
