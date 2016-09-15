import io
import gzip
import math
import collections

import pandas
import numpy
import msgpack

from django.shortcuts import render, get_object_or_404
from django.core.urlresolvers import reverse
from django.core.files.base import ContentFile
from django import http
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.gzip import gzip_page
from django.utils.dateparse import parse_datetime

from vmmemory.models import MemoryProfile


class MsgpackResponse(http.HttpResponse):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("content_type", "application/x-msgpack")
        super(MsgpackResponse, self).__init__(*args, **kwargs)


class GzipMsgpackResponse(MsgpackResponse):
    def __init__(self, *args, **kwargs):
        super(GzipMsgpackResponse, self).__init__(*args, **kwargs)
        self.setdefault("Content-Encoding", "gzip")


@require_POST
@csrf_exempt
def submit_profile(request):
    data = msgpack.unpack(request)
    assert data['version'] in {1, 2}

    profile_run = MemoryProfile(
        project=data['project'],
        version=data['version'],
        max_memory_use=data['max_mem'],
        time_spent=data['duration'],
        profile_resolution=data['period'],
        top_level_function=data.get('top_level_function', ''),
    )
    if data['version'] >= 2:
        if 'start_date' in data:
            profile_run.start_date = parse_datetime(data['start_date'])
    profile_run.save()
    profile_run.cpu_profile.save("cpu.msgpack.gz", ContentFile(data['cpu_profile']))
    profile_run.memory_profile.save("mem.msgpack.gz", ContentFile(data['mem_profile']))
    profile_run.addr_name_map.save("addr_name_map.msgpack.gz", ContentFile(data['addr_name_map']))
    profile_run.save()
    return http.HttpResponse(reverse("cpu_profile", kwargs={"pk": profile_run.pk}))


def profiles_list(request):
    return render(request, "profiles/list.html", {'profiles': MemoryProfile.objects.all()})


def show_profile(request, profile_type, pk):
    profile = get_object_or_404(MemoryProfile, pk=pk)
    return render(request, "profiles/%s.html" % profile_type, {
        'profile': profile,
        'profile_fetch_url': reverse('api_fetch_%s' % profile_type, kwargs={'pk': profile.pk}),
        'addr_name_fetch_url': reverse('api_fetch_addr_name_map', kwargs={'pk': profile.pk}),
    })


def fetch_profile(request, attr, pk):
    profile = get_object_or_404(MemoryProfile, pk=pk)
    data = getattr(profile, attr)
    return GzipMsgpackResponse(data)


@gzip_page
def fetch_mem_profile(request, pk):
    profile = get_object_or_404(MemoryProfile, pk=pk)

    full_profile = msgpack.unpack(gzip.GzipFile(fileobj=profile.memory_profile))
    resampled_profile = resample_memory_profile(full_profile,
                                                float(request.GET.get('x0', 0)),
                                                float(request.GET.get('x1', 'inf')))
    resampled_profile['ntotal'] = len(full_profile)
    buf = io.BytesIO()
    msgpack.pack(resampled_profile, buf)
    buf.seek(0)
    return MsgpackResponse(buf)


def resample_memory_profile(memory_profile, start, end, window_size=100):
    start = int(max(0, start))
    end = int(min(len(memory_profile), end))
    window_size = min(window_size, end - start)

    df = pandas.DataFrame(memory_profile).rename(columns={0: 'trace', 1: 'mem'})
    bins = numpy.linspace(start, end, window_size, dtype='int')
    df = df.groupby(pandas.cut(df.index, bins, include_lowest=True, right=True))
    df = df.aggregate({
        'mem': ['mean', 'max'],
        'trace': aggregate_trace,
    })
    return {
        'x': list(bins[:-1]),
        'mean': list(df['mem']['mean'].values),
        'max': list(df['mem']['max'].values),
        'trace': list(df['trace']['aggregate_trace'].values),
    }


def aggregate_trace(traces):
    if traces.empty:
        return [], []

    iterator = iter(traces)

    common_prefix = tuple(next(iterator))
    frequencies = collections.defaultdict(int)
    frequencies[common_prefix] = 1

    for row in iterator:
        if not row:
            continue
        frequencies[tuple(row)] += 1
        common_prefix = common_prefix[:len(row)]
        for i, elem in enumerate(common_prefix):
            if elem != row[i]:
                common_prefix = common_prefix[:i]
                break

    most_frequent_trace, count = max(frequencies.items(), key=lambda k, v: v)
    return len(traces), common_prefix, count, most_frequent_trace[len(common_prefix):]
