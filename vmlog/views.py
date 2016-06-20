# -*- coding: utf-8 -*-
import json
import urllib
import hashlib
import tempfile
import base64
import os
from collections import defaultdict
from vmprof.log import constants as const

from django.conf.urls import url, include
from django.contrib import auth
from django.http.response import HttpResponseBadRequest
from django.http import Http404
from django.shortcuts import get_object_or_404

from vmlog.models import BinaryJitLog, get_reader
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
        if not filename.endswith('.zip'):
            return HttpResponseBadRequest("must be gzip compressed")

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
            if trace.parent:
                mp_meta['parent'] = hex(trace.parent.unique_id)
            # serialize all trace connections
            bridgemap = {}
            bridges[id] = bridgemap
            for bridge in trace.bridges:
                descr_nmr = bridge.get_stitched_descr_number()
                target_addr = bridge.addrs[0]
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
            mp_dict = {}
            for sem_type, value in op.values.items():
                name = const.SEM_TYPE_NAMES[sem_type]
                mp_dict[name] = value
            return mp_dict
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
        source_code = {}
        for i,op in enumerate(stage.ops):
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
        source_code = {}
        dict = { 'args': trace.inputargs,
                 'stages': stages,
                 'code': source_code
               }

        stage_serializer = StageSerializer()
        for markname, stage in trace.stages.items():
            stage_dict = stage_serializer.to_representation(stage)
            stages[markname] = stage_dict

            merge_points = stage_dict.get('merge_points', None)
            if merge_points:
                for index, mps in merge_points.items():
                    if index == 'first': continue
                    for mp in mps:
                        if 'filename' in mp and 'lineno' in mp:
                            # both filename and line number is known, try to extract it from the uploaded data
                            filename = mp['filename']
                            lineno = mp['lineno']
                            indent, line = trace.forest.get_source_line(filename, lineno)
                            if line:
                                if filename not in source_code:
                                    source_code[filename] = {}
                                lines = source_code[filename]
                                assert lineno not in lines
                                lines[lineno] = (indent,line)
        #
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
        obj = get_object_or_404(queryset, **self.kwargs)
        self.check_object_permissions(self.request, obj)
        forest = get_forest_for(obj)
        trace = forest.get_trace_by_id(id)
        return trace


class VisualTraceTreeSerializer(BaseSerializer):
    def to_representation(self, trace):
        stitches = {}
        errors = []
        d = { 'root': hex(trace.unique_id),
              'stitches': stitches,
            }

        worklist = [trace]
        while worklist:
            trace = worklist.pop()
            hex_unique_id = hex(trace.unique_id)
            stage = trace.get_stage('asm')
            if not stage:
                continue
            oplist = []
            for i,op in enumerate(stage.get_ops()):
                descr_nmr = hex(op.get_descr_nmr() or 0)
                if op.is_guard():
                    target = trace.forest.get_stitch_target(op.get_descr_nmr())
                    if target:
                        to_trace = trace.forest.get_trace_by_id(target)
                        if to_trace:
                            worklist.append(to_trace)
                            target = hex(to_trace.unique_id)
                        else:
                            errors.append("No 'asm' stage of trace (0x%x)" % target)
                            target = '0x0'
                    else:
                        target = '0x0'
                    oplist.append(','.join(['g',str(i), descr_nmr, target]))
                if op.opname == "label":
                    oplist.append(','.join(['l',str(i), descr_nmr]))
                if op.opname == "jump":
                    oplist.append(','.join(['j',str(i), descr_nmr]))
                if op.opname == "finish":
                    oplist.append(','.join(['f',str(i), descr_nmr]))
            stitches[hex(trace.unique_id)] = oplist
        if errors:
            d['errors'] = errors
        return d

class VisualTraceTreeViewSet(TraceViewSet):
    serializer_class = VisualTraceTreeSerializer
