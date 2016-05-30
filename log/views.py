# -*- coding: utf-8 -*-
import json
import urllib
import hashlib
import tempfile
import base64
import os
from collections import defaultdict

from django.conf.urls import url, include
from django.contrib import auth
from django.http.response import HttpResponseBadRequest
from django.http import Http404
from django.shortcuts import get_object_or_404

from log.models import BinaryJitLog, get_reader
from vmprofile.models import Log
from vmprof.log.parser import _parse_jitlog
from vmprof.log.objects import MergePoint

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

class LogMetaSerializer(BaseSerializer):
    def to_representation(self, jlog):
        forest = jlog.decode_forest()
        traces = {}
        bridges = {}
        for id, trace in forest.traces.items():
            mp = trace.get_first_merge_point()
            mp_meta = { 'scope': 'unknown', 'lineno': -1, 'filename': '',
                    'type': trace.type, 'counter': trace.counter }
            traces[id] = mp_meta
            if mp:
                mp_meta['scope'] = mp.get_scope()
                lineno, filename = mp.get_source_line()
                mp_meta['lineno'] = lineno
                mp_meta['filename'] = filename
            # serialize all trace connections
            bridgemap = {}
            bridges[id] = bridgemap
            for bridge in trace.bridges:
                descr_nmr = hex(bridge[1])
                target_addr = hex(bridge[2])
                bridgemap[descr_nmr] = target_addr

        return {
            'resops': forest.resops,
            'traces': traces,
            'bridges': bridges
        }

class MetaForestViewSet(viewsets.ModelViewSet):
    queryset = BinaryJitLog.objects.all()
    serializer_class = LogMetaSerializer
    permission_classes = (permissions.AllowAny,)

def get_forest_for(jlog):
    return jlog.decode_forest()

class OperationSerializer(BaseSerializer):
    def to_representation(self, op):
        if isinstance(op, MergePoint):
            raise NotImplementedError
        else:
            dict = { 'num': op.opnum }
            if op.args: dict['args'] = op.args
            if op.result: dict['res'] = op.result
            if op.descr: dict['descr'] = op.descr
            if op.core_dump:
                dump = base64.b64encode(op.core_dump[1])
                dict['dump'] = dump.decode('utf-8')
            if op.descr_number:
                dict['descr_number'] = hex(op.descr_number)
            return dict


class StageSerializer(BaseSerializer):
    def to_representation(self, stage):
        op_serializer = OperationSerializer()
        ops = []
        merge_points = defaultdict(list)
        # merge points is a dict mapping from index -> merge_points
        stage_dict = { 'ops': ops }
        for op in stage.ops:
            op_stage_dict = op_serializer.to_representation(op)
            if isinstance(op, MergePoint):
                index = len(ops)
                merge_points[index].append(op_stage_dict)
                if len(merge_points) == 1:
                    # fast access for the first debug merge point!
                    merge_points['first'] = index
            else:
                ops.append(op_stage_dict)
        stage_dict['merge_points'] = dict(merge_points)
        return stage_dict

class TraceSerializer(BaseSerializer):
    def to_representation(self, trace):
        stages = {}
        dict = { 'args': trace.inputargs,
                 'stages': stages,
               }

        stage_serializer = StageSerializer()
        for markname, stage in trace.stages.items():
            stage_dict = stage_serializer.to_representation(stage)
            stages[markname] = stage_dict
        if trace.addrs != (-1,-1):
            dict['addr'] = (hex(trace.addrs[0]), hex(trace.addrs[1]))
        return dict


class TraceViewSet(viewsets.ModelViewSet):
    queryset = BinaryJitLog.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = TraceSerializer

    def get_object(self):
        if 'id' not in self.request.GET:
            raise Http404("mandatory id GET parameter missing")
        id = int(self.request.GET['id'], 16)
        queryset = self.get_queryset()
        filter = {}
        obj = get_object_or_404(queryset, **filter)
        self.check_object_permissions(self.request, obj)
        forest = get_forest_for(obj)
        trace = forest.get_trace_by_id(id)
        return trace
