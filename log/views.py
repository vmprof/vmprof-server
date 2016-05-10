# -*- coding: utf-8 -*-
import json
import urllib
import hashlib

from django.conf.urls import url, include
from django.contrib import auth

from log.models import BinaryJitLog

from rest_framework import views
from rest_framework.response import Response
from rest_framework.parsers import FileUploadParser


class BinaryJitLogFileUploadView(views.APIView):
    parser_classes = (FileUploadParser,)

    def post(self, request, filename, format=None):
        file_obj = request.FILES['file']
        binary_data = request.data
        checksum = hashlib.md5(data).hexdigest()
        user = request.user if request.user.is_authenticated() else None

        profile_checksum = request.GET['profile']

        log, _ = self.queryset.get_or_create(file=binary_data, checksum=checksum,
                                             user=user, profile=profile_checksum)

        return Response(log.checksum)
