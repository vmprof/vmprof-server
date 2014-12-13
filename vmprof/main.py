# -*- coding: utf-8 -*-
import hashlib

from base64 import b64decode

from django.conf.urls import url
from django.http import HttpResponse, HttpResponseNotFound, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.staticfiles import views
from django.views.generic import View

from .models import Log

from vmprof.process.addrspace import AddressSpace, Profiles
from vmprof.process.reader import (
    read_prof, read_ranges, read_sym_file, LibraryData
)


class Submit(View):

    def post(self, request):
        prof = b64decode(request.POST['prof'])
        prof_sym = b64decode(request.POST['prof_sym'])

        checksum = hashlib.md5(prof + prof_sym).hexdigest()

        try:
            log = Log.objects.get(checksum=checksum)
        except Log.DoesNotExist:
            log = Log.objects.create(prof=prof, prof_sym=prof_sym)

        return HttpResponse(log.checksum)


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

    response = {
        "checksum": log.checksum,
        "functions": []
    }

    if func:
        items, total = profiles.generate_per_function(func)
        items = items.items()
        items.sort(key=lambda i: -i[1])
    else:
        items = profiles.functions.items()
        items.sort(key=lambda i: -i[1])
        total = len(profiles.profiles)

    for name, count in items:
        names = name.split(":")

        response["functions"].append({
            "name": name,
            "funcname": names[2],
            "time": int(float(count) / total * 100)
        })

    return response


class LogView(View):
    def get(self, request, checksum, func=None):
        try:
            log = Log.objects.get(checksum=checksum)
            response = present_function_items(log, func)

            return JsonResponse(response)
        except Log.DoesNotExist:
            return HttpResponseNotFound()


urlpatterns = [
    url(r'^submit/$', csrf_exempt(Submit.as_view())),

    url(r'^(?P<checksum>[0-9a-f]{32})/$', LogView.as_view()),
    url(r'^(?P<checksum>[0-9a-f]{32})/(?P<func>.+)/$', LogView.as_view()),
    url(r'^$', views.serve, {'path': 'index.html', 'insecure': True}),
]
