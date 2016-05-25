# -*- coding: utf-8 -*-
import json
import urllib
import hashlib
import tempfile
import os
import lzma
import bz2

from django.conf.urls import url, include
from django.contrib import auth
from django.http.response import HttpResponseBadRequest

from log.models import BinaryJitLog
from profile.models import Log
from vmprof.log.parser import _parse_jitlog


from rest_framework import views
from rest_framework.response import Response
from rest_framework.parsers import FileUploadParser
from rest_framework import permissions
from rest_framework.serializers import BaseSerializer
from rest_framework import viewsets

def compute_checksum(file_obj):
    hash = hashlib.md5()
    for chunk in file_obj.chunks():
        hash.update(chunk)
    return hash.hexdigest()

class BinaryJitLogFileUploadView(views.APIView):
    parser_classes = (FileUploadParser,)
    permission_classes = (permissions.AllowAny,)

    def post(self, request, profile, format=None):
        file_obj = request.FILES['file']

        filename = file_obj.name
        if not filename.endswith('.bz2') and \
           not filename.endswith('.xz'):
            return HttpResponseBadRequest("must be either bzip2 or lzma compressed")

        checksum = compute_checksum(file_obj)

        user = request.user if request.user.is_authenticated() else None

        profile_obj = Log.objects.get(checksum=profile)
        log, _ = BinaryJitLog.objects.get_or_create(file=file_obj, checksum=checksum,
                                                    user=user, profile=profile_obj)

        return Response(log.checksum)

def get_reader(filename):
    if filename.endswith(".bz2"):
        return bz2.BZ2File(filename, "rb", 2048)
    elif filename.endswith(".xz"):
        return lzma.LZMAFile(filename)
    assert(0, "only bz2 and xz are supported!")

class BinaryJitLogSerializer(BaseSerializer):
    def to_representation(self, jlog):
        with get_reader(jlog.path) as fileobj: 
            jitlog = _parse_jitlog(fileobj)
            return jitlog.serialize('meta-info')

class MetaJitlogViewSet(viewsets.ModelViewSet):
    queryset = BinaryJitLog.objects.all()
    serializer_class = BinaryJitLogSerializer
    permission_classes = (permissions.AllowAny,)
