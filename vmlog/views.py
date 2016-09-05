# -*- coding: utf-8 -*-
import json
import urllib
import hashlib
import tempfile
import base64
import time
import os
from collections import defaultdict
from jitlog import constants as const

from django.conf.urls import url, include
from django.contrib import auth
from django.http.response import HttpResponseBadRequest
from django.http import Http404
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from vmlog.models import BinaryJitLog, get_reader
from vmlog.serializer import (VisualTraceTreeSerializer, LogMetaSerializer,
        TraceSerializer)
from vmprofile.models import Log
from jitlog.parser import _parse_jitlog
from jitlog.objects import MergePoint


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
        if not filename.endswith('.zip'):
            return HttpResponseBadRequest("must be gzip compressed")

        checksum = compute_checksum(file_obj)

        user = request.user if request.user.is_authenticated() else None

        if profile.strip() == "":
            profile_obj = None
        else:
            profile_obj = Log.objects.get(checksum=profile)
        log, _ = BinaryJitLog.objects.get_or_create(file=file_obj, checksum=checksum,
                                                    user=user, profile=profile_obj)

        return Response(log.checksum)

class JsonExceptionHandlerMixin(object):
    def handle_exception(self, exc):
        if isinstance(exc, Http404):
            code = 404
        elif isinstance(exc, BadRequest):
            code = 400
        else:
            code = 500
        msg = 'internal server error'
        if hasattr(exc, 'args') and len(exc.args) > 0:
            msg = exc.args[0]
        return JsonResponse({'code': code, 'message': msg}, status=code)

#    def get_object(self):
#        if 'id' not in self.request.GET:
#            raise Http404("mandatory GET parameter 'id' missing")
#        id = int(self.request.GET['id'])
#        queryset = self.get_queryset()
#        obj = get_object_or_404(queryset, **self.kwargs)
#        self.check_object_permissions(self.request, obj)
#        trace = forest.get_trace_by_id(id)
#        if not trace:
#            raise Http404("trace with id %d does not exist in forest %s" % (id, obj.checksum))
#        return trace

#class MetaForestViewSet(JsonExceptionHandlerMixin, viewsets.ModelViewSet):
#    queryset = BinaryJitLog.objects.all()
#    serializer_class = LogMetaSerializer
#    permission_classes = (permissions.AllowAny,)
#
#class VisualTraceTreeViewSet(TraceViewSet):
#    serializer_class = VisualTraceTreeSerializer

def json_serialize(serializer, cmd, kwargs):
    filename = "cache.socket"
    if os.path.exists(filename):
        client = socket.socket( socket.AF_UNIX, socket.SOCK_DGRAM)
        client.connect(filename)
        client.send(command)
        json = client.recv()
        return json
    else:
        serializer = clazz()
        forest.parser_classes

def meta(request, profile):
    try:
        jl = BinaryJitLog.objects.filter(checksum=profile)
    except BinaryJitLog.ObjectDoesNotExist:
        raise Http404

    serializer = LogMetaSerializer()
    content = json_serialize(serializer, "meta {filename} {profile}",
                             filename=jl.file.path, profile=profile)
    return JsonResponse(content)

def trace(request, profile):
    try:
        jl = BinaryJitLog.objects.filter(checksum=profile)
    except BinaryJitLog.ObjectDoesNotExist:
        raise Http404

#        if 'id' not in self.request.GET:
#            raise Http404("mandatory GET parameter 'id' missing")
#        id = int(self.request.GET['id'])
#        queryset = self.get_queryset()
#        obj = get_object_or_404(queryset, **self.kwargs)
#        self.check_object_permissions(self.request, obj)
#        trace = forest.get_trace_by_id(id)
#        if not trace:
#            raise Http404("trace with id %d does not exist in forest %s" % (id, obj.checksum))
#        return trace
    serializer = LogMetaSerializer()
    content = json_serialize(serializer, "trace {filename} {profile}",
                             filename=jl.file.path, profile=profile)
    return JsonResponse(content)

def stitches(request, profile):
    try:
        jl = BinaryJitLog.objects.filter(checksum=profile)
    except BinaryJitLog.ObjectDoesNotExist:
        raise Http404

    serializer = LogMetaSerializer()
    content = json_serialize(serializer, "stitches {filename} {profile}",
                             filename=jl.file.path, profile=profile)
    return JsonResponse(content)


