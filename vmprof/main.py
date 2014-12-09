# -*- coding: utf-8 -*-
import hashlib

from django.conf.urls import url
from django.http import HttpResponse, HttpResponseNotFound
from django.contrib.staticfiles import views
from django.views.generic import View

from .models import Log


class Submit(View):
    def post(self, request):
        prof = request.POST['prof']
        prof_sym = request.POST['prof_sym']

        checksum = hashlib.md5(prof).hexdigest()

        try:
            Log.objects.get(checksum=checksum)
        except Log.DoesNotExist:
            log = Log.objects.create(prof=prof, prof_sym=prof_sym)

        return HttpResponse(log.checksum)


class LogView(View):
    def get(self, request, checksum):
        try:
            log = Log.objects.get(checksum=checksum)
            return HttpResponse(log.checksum)
        except Log.DoesNotExist:
            return HttpResponseNotFound()


urlpatterns = [
    url(r'submit/', Submit.as_view()),
    url(r'(?P<checksum>[0-9a-f]{32})/', LogView.as_view()),
    url(r'$', views.serve, {'path': 'index.html', 'insecure': True}),
]
