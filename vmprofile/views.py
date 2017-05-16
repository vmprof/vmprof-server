# -*- coding: utf-8 -*-
import io
import json
import hashlib
import datetime
try:
    from urlparse import urlparse as parse
except ImportError:
    from urllib import parse

from django.contrib import auth
from django.http import HttpResponse

from rest_framework import views
from rest_framework import status
from rest_framework import permissions
from rest_framework.permissions import AllowAny
from rest_framework import validators
from rest_framework.response import Response
from rest_framework import viewsets, serializers
from rest_framework.authtoken.models import Token
from rest_framework.parsers import FileUploadParser
from rest_framework.decorators import api_view, parser_classes
from rest_framework.decorators import permission_classes
from rest_framework.exceptions import ValidationError, APIException

from vmprofile.models import RuntimeData, CPUProfile
#from vmmemory.models import MemoryProfile

from webapp.views import json_serialize

from vmlog.serializer import STRFTIME_FMT

username_max = auth.models.User._meta.get_field('username').max_length
password_max = auth.models.User._meta.get_field('password').max_length
email_max = auth.models.User._meta.get_field('email').max_length


class UserSerializer(serializers.ModelSerializer):
    gravatar = serializers.SerializerMethodField()

    class Meta:
        model = auth.models.User
        fields = ['id', 'username', 'gravatar']

    def get_gravatar(self, obj):
        default = "https://avatars0.githubusercontent.com/u/10184195?v=3&s=200"
        size = 40

        email_bytes = obj.email.lower().encode('utf-8')
        gravatar_hash = hashlib.md5(email_bytes).hexdigest()
        gravatar_url = "http://www.gravatar.com/avatar/%s?" % gravatar_hash
        gravatar_url += parse.urlencode({'d': default, 's': str(size)})

        return gravatar_url


class UserRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(
        min_length=5,
        max_length=username_max,
        validators=[validators.UniqueValidator(queryset=auth.models.User.objects.all())]
    )
    email = serializers.EmailField(
        max_length=email_max,
        validators=[validators.UniqueValidator(queryset=auth.models.User.objects.all())]
    )
    password = serializers.CharField(min_length=6, max_length=password_max)


class RuntimeDataSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()
    jitlog_checksum = serializers.SerializerMethodField()

    class Meta:
        model = RuntimeData

    def get_jitlog_checksum(self, obj):
        if obj.jitlog:
            model = obj.jitlog.first()
            if model:
                return model.checksum
        return None

    def get_data(self, obj):
        if hasattr(obj, 'cpu_profile'):
            if obj.cpu_profile.data is None:
                raise Exception("lecay method, remove RuntimeDataSerializer")
            else:
                return json.loads(obj.cpu_profile.data)
        return "{}"

class RuntimeDataListSerializer(serializers.ModelSerializer):
    user = UserSerializer()

    class Meta:
        model = RuntimeData
        fields = ('user', 'created', 'vm', 'name', 'runtime_id',
                  'start_time', 'stop_time', 'arch', 'os',
                  'time_in_seconds', 'jitlog_id')


class RuntimeDataViewSet(viewsets.ModelViewSet):
    queryset = RuntimeData.objects.select_related('user')
    serializer_class = RuntimeDataListSerializer
    permission_classes = (AllowAny,)

    def get_serializer_class(self):
        if 'pk' in self.kwargs:
            return RuntimeDataSerializer
        return RuntimeDataListSerializer

    def create(self, request):
        # compatability! remove this at some point!
        data = request.data
        name = data['argv'][:255]
        vm = data['VM'][:32]
        user = request.user if request.user.is_authenticated() else None
        runtime = self.queryset.create(user=user, vm=vm, name=name, completed=True)
        data = json.dumps(data).encode('utf-8')
        CPUProfile.objects.create(data=data, runtime_data=runtime, file=None)
        return Response(str(runtime.runtime_id))

    def get_queryset(self):
        if not self.request.user.is_authenticated():
            return self.queryset

        if not bool(self.request.GET.get('all', False)) and 'pk' not in self.kwargs:
            return self.queryset.filter(user=self.request.user)
        return self.queryset


class UserPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        if request.method == "PUT":
            return True
        if request.method == "DELETE":
            return request.user.is_authenticated()
        if request.method == "GET":
            return request.user.is_authenticated()
        return False


class MeView(views.APIView):
    permission_classes = (UserPermission,)

    def get(self, request, format=None):
        data = UserSerializer(self.request.user).data
        return Response(data, status=status.HTTP_200_OK)

    def post(self, request, format=None):
        username = request.data['username']
        password = request.data['password']

        user = auth.authenticate(username=username, password=password)

        if user is not None and user.is_active:
            auth.login(request, user)
            return Response(UserSerializer(user).data, status=status.HTTP_202_ACCEPTED)

        return Response(status=status.HTTP_403_FORBIDDEN)

    def put(self, request, format=None):
        serializer = UserRegisterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        auth.models.User.objects.create_user(
            serializer.data['username'],
            serializer.data['email'],
            serializer.data['password']
        )

        return Response(status=status.HTTP_201_CREATED)

    def delete(self, request, format=None):
        auth.logout(request)
        return Response(status=status.HTTP_200_OK)


class TokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Token


class TokenViewSet(viewsets.ModelViewSet):
    serializer_class = TokenSerializer
    model = Token

    def get_queryset(self):
        return Token.objects.filter(user=self.request.user)

    def create(self, request):
        Token.objects.filter(user=self.request.user).delete()
        Token.objects.create(user=self.request.user)
        return Response(status=status.HTTP_201_CREATED)

    def list(self, request):
        serializer = self.serializer_class(self.get_queryset(), many=True)
        return Response(serializer.data)



class ObjectNotFound(APIException):
    status_code = 404
    default_detail = 'object was not found, check the request parameters'
    default_code = 'object not found'

@api_view(['POST'])
@permission_classes((AllowAny,))
def runtime_new(request):
    data = request.data
    name = data['argv'][:255]
    vm = data['VM'][:32]
    user = request.user if request.user.is_authenticated() else None
    rdat = RuntimeData.objects.create(user=user, vm=vm, name=name)
    rdat.save()
    return Response({'status':'ok','runtime_id': str(rdat.runtime_id)})

def try_get_runtimedata(request, rid):
    try:
        obj = RuntimeData.objects.get(pk=rid)
        return obj
    except RuntimeData.DoesNotExist:
        raise ObjectNotFound

@api_view(['POST'])
@permission_classes((AllowAny,))
def runtime_freeze(request, rid):
    runtimedata = try_get_runtimedata(request, rid)
    runtimedata.completed = True
    runtimedata.save()
    return Response({'status': 'ok'})

def extract_meta(rd):
    cpu = rd.cpu_profile
    strio = io.StringIO()
    json_serialize(strio, "metacpu {filename} {runtime_id}",
                             filename=cpu.file,
                             runtime_id=cpu.cpuprofile_id)
    strio.seek(0)
    jsondata = json.loads(strio.read())

    if 'error' in jsondata:
        raise ValidationError(jsondata['error'])

    start_time = jsondata.get('start_time', None)
    if start_time:
        rd.start_time = datetime.datetime.strptime(start_time, STRFTIME_FMT)
    end_time = jsondata.get('end_time', None)
    if end_time:
        rd.stop_time = datetime.datetime.strptime(end_time, STRFTIME_FMT)

    rd.arch = jsondata.get('arch', 'unknown')
    rd.os = jsondata.get('os', 'unknown')
    rd.save()

@api_view(['POST'])
@permission_classes((AllowAny,))
@parser_classes((FileUploadParser,))
def upload_cpu(request, rid):
    runtimedata = try_get_runtimedata(request, rid)
    if runtimedata.completed:
        raise ValidationError("the runtime data is already frozen, cannot upload any more files")

    file_obj = request.data['file']
    cpu = CPUProfile.objects.create(runtime_data=runtimedata, file=file_obj)
    # TODO spawn background task to propagate CPUProfile and MemoryProfile details
    # for now this is good enough I guess?

    try:
        extract_meta(runtimedata)
    except Exception as e:
        raise ValidationError("could not extract meta data for %s. exception: %s" % (rid, str(e)))

    return Response({'status': 'ok'})

@api_view(['GET'])
@permission_classes((AllowAny,))
def get_cpu(request, rid):
    rd = RuntimeData.objects.get(pk=rid)
    profile = rd.cpu_profile
    if profile.data is None:
        return load_cpu_json(request, rd)
    # legacy, used for old profiles
    return HttpResponse(profile.data, content_type="application/json")

def load_cpu_json(request, rd):
    response = HttpResponse(content_type="application/json")
    cpu = rd.cpu_profile
    json_serialize(response, "cpu {filename} {runtime_id}",
                             filename=cpu.file,
                             runtime_id=cpu.cpuprofile_id)
    return response
