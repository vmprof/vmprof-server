# -*- coding: utf-8 -*-
import hashlib
import time
import os
import socket
import uuid
from collections import defaultdict
from io import BytesIO

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
from vmprofile.models import RuntimeData
from jitlog.parser import _parse_jitlog
from jitlog.objects import MergePoint
from jitlog import constants as const
from webapp.views import json_serialize

from rest_framework import views
from rest_framework.response import Response
from rest_framework.parsers import FileUploadParser
from rest_framework import permissions
from rest_framework.serializers import BaseSerializer
from rest_framework import viewsets

from rest_framework.exceptions import ValidationError, APIException
from rest_framework.decorators import api_view, parser_classes
from rest_framework.decorators import permission_classes
from vmprofile.views import try_get_runtimedata

def compute_checksum(file_obj):
    hash = hashlib.md5()
    for chunk in file_obj.chunks():
        hash.update(chunk)
    return hash.hexdigest()

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

def _load_jitlog_model(request, jid):
    try:
        obj = BinaryJitLog.objects.get(pk=jid)
        return obj
    except ObjectDoesNotExist:
        raise Http404

    raise BadRequest

def meta(request, profile):
    jl = _load_jitlog_model(request, profile)

    response = HttpResponse(content_type="application/json")
    json_serialize(response, "meta {filename} {profile}",
                             filename=jl.file.path, profile=profile)
    return response

def trace(request, profile):
    jl = _load_jitlog_model(request, profile)

    if 'id' not in request.GET:
        raise Http404("mandatory GET parameter 'id' missing")
    uid = int(request.GET['id'])
    response = HttpResponse(content_type="application/json")
    json_serialize(response, "trace {filename} {profile} {uid}",
                             filename=jl.file.path, profile=profile, uid=uid)
    return response

def stitches(request, profile):
    jl = _load_jitlog_model(request, profile)

    if 'id' not in request.GET:
        raise Http404("mandatory GET parameter 'id' missing")
    uid = int(request.GET['id'])
    response = HttpResponse(content_type="application/json")
    json_serialize(response, "stitch {filename} {profile} {uid}",
                             filename=jl.file.path, profile=profile, uid=uid)
    return response

@api_view(['POST'])
@permission_classes((permissions.AllowAny,))
@parser_classes((FileUploadParser,))
def upload_jit(request, rid):
    runtimedata = try_get_runtimedata(request, rid)
    if runtimedata.completed:
        raise ValidationError("the runtime data is already frozen, cannot upload any more files")

    file_obj = request.data['file']

    filename = file_obj.name
    if not filename.endswith('.zip'):
        return HttpResponseBadRequest("must be gzip compressed")

    checksum = compute_checksum(file_obj)
    jitid = uuid.uuid4()
    log, _ = BinaryJitLog.objects.get_or_create(jitlog_id=jitid,\
                file=file_obj, checksum=checksum, profile=runtimedata)

    return Response({'status': 'ok', 'jid': log.pk})
