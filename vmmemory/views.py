from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.decorators import permission_classes
from rest_framework.permissions import AllowAny

from webapp.views import json_serialize
from vmprofile.models import RuntimeData

@api_view(['GET'])
@permission_classes((AllowAny,))
def get_memory(request, rid):
    start = float(request.GET.get('x0', 0))
    end = float(request.GET.get('x1', 'inf'))
    rd = RuntimeData.objects.get(pk=rid)
    profile = rd.cpu_profile
    if profile.data is not None:
        # legacy, used for old profiles
        raise Exception # TODO

    return load_memory_json(request, rd, start, end)

def load_memory_json(request, rd, start, end):
    response = HttpResponse(content_type="application/json")
    cpu = rd.cpu_profile
    json_serialize(response, "mem {filename} {runtime_id} {start} {stop}",
                             filename=cpu.file,
                             runtime_id=cpu.cpuprofile_id,
                             start=start, stop=end)
    return response
