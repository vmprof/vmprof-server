
from django.contrib import admin
from django.conf import settings

from rest_framework import routers
from vmprofile.views import MeView, RuntimeDataViewSet, TokenViewSet
from vmlog.views import (meta, trace, stitches, upload_jit)
from vmprofile.views import runtime_new, runtime_freeze
from vmprofile.views import upload_cpu, get_cpu
from vmmemory.views import get_memory
from django.conf.urls import include, re_path
from django.contrib.staticfiles import views as static
from webapp.views import index

router = routers.DefaultRouter()
router.register(r'log', RuntimeDataViewSet)
router.register(r'profile', RuntimeDataViewSet)
router.register(r'token', TokenViewSet, basename="token")

urlpatterns = [
    re_path(r'^$', index, name='index'),
    re_path(r'^admin/', admin.site.urls),
    #
    re_path(r'^api/', include(router.urls)),
    #
    re_path(r'^api/user/', MeView.as_view()),
    #
    re_path(r'^api/runtime/new/?$', runtime_new),
    re_path(r'^api/runtime/(?P<rid>[0-9a-z-]*)/freeze/?$', runtime_freeze),
    re_path(r'^api/runtime/upload/jit/(?P<rid>[0-9a-z-]*)/add/?$', upload_jit),
    re_path(r'^api/runtime/upload/cpu/(?P<rid>[0-9a-z-]*)/add/?$', upload_cpu),
    # legacy api
    re_path(r'^api/jitlog/(?P<rid>[0-9a-z-]*)/?$', upload_jit),
    #
    re_path(r'^api/jit/meta/(?P<profile>[0-9a-z-]*)/?$', meta),
    re_path(r'^api/jit/trace/(?P<profile>[0-9a-z-]*)/?$', trace),
    re_path(r'^api/jit/stitches/(?P<profile>[0-9a-z-]*)/?$', stitches),

    re_path(r'^api/flamegraph/(?P<rid>[0-9a-z-]*)/get/?$', get_cpu),
    re_path(r'^api/memorygraph/(?P<rid>[0-9a-z-]*)/get/?$', get_memory),
]

if settings.DEBUG:
    urlpatterns += [re_path(r'^$', static.serve, {'path': 'index.html', 'insecure': True})]
