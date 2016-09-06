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

from django.core.exceptions import ObjectDoesNotExist
from django.conf.urls import url, include
from django.contrib import auth
from django.http.response import HttpResponseBadRequest
from django.http import Http404
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404

from vmlog.models import BinaryJitLog, get_reader
from vmlog.serializer import (VisualTraceTreeSerializer, LogMetaSerializer,
        TraceSerializer, BadRequest)
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

def json_serialize(serializer, cmd, **kwargs):
    filename = "cache.socket"
    if os.path.exists(filename):
        client = socket.socket( socket.AF_UNIX, socket.SOCK_DGRAM)
        client.connect(filename)
        client.send(command)
        json = client.recv()
        return json
    else:
        # should never be hit in production!!
        from twisted.test import proto_helpers
        from forestcache.cache import CacheProtocol
        prot = CacheProtocol()
        prot.transport = proto_helpers.StringTransport()
        command = cmd.format(**kwargs)
        prot.lineReceived(command.encode('utf-8'))
        return prot.transport.value().decode('utf-8')


def _load_jitlog_model(request, checksum):
    try:
        objs = BinaryJitLog.objects.filter(checksum=checksum)
        if len(objs) != 1:
            raise BadRequest("checksum has several jit logs")
        # authentication? we do not implement that yet?
        return objs[0]
    except ObjectDoesNotExist:
        raise Http404

    raise BadRequest


def meta(request, profile):
    jl = _load_jitlog_model(request, profile)

    content = json_serialize(LogMetaSerializer(), "meta {filename} {profile}",
                             filename=jl.file.path, profile=profile)
    # can't use JsonResponse, must be a dict. not string (safe=False would be another option)
    return HttpResponse(content, content_type="application/json")

def trace(request, profile):
    jl = _load_jitlog_model(request, profile)

    if 'id' not in request.GET:
        raise Http404("mandatory GET parameter 'id' missing")
    uid = int(request.GET['id'])
    content = json_serialize(TraceSerializer(), "trace {filename} {profile} {uid}",
                             filename=jl.file.path, profile=profile, uid=uid)
    # can't use JsonResponse, must be a dict. not string (safe=False would be another option)
    return HttpResponse(content, content_type="application/json")

def stitches(request, profile):
    jl = _load_jitlog_model(request, profile)

    if 'id' not in request.GET:
        raise Http404("mandatory GET parameter 'id' missing")
    uid = int(request.GET['id'])
    content = json_serialize(VisualTraceTreeSerializer(), "stitch {filename} {profile} {uid}",
                             filename=jl.file.path, profile=profile, uid=uid)
    # can't use JsonResponse, must be a dict. not string (safe=False would be another option)
    return HttpResponse(content, content_type="application/json")


