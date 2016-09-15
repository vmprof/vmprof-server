
from django.contrib import admin
from django.conf import settings

from rest_framework import routers
from vmprofile.views import MeView, RuntimeDataViewSet, TokenViewSet
from vmlog.views import (meta, trace, stitches,
        BinaryJitLogFileUploadView)
from django.conf.urls import url, include
from django.contrib.staticfiles import views as static
from webapp.views import index

router = routers.DefaultRouter()
router.register(r'log', RuntimeDataViewSet)
router.register(r'profile', RuntimeDataViewSet)
router.register(r'token', TokenViewSet, base_name="token")
#router.register(r'log/meta', MetaForestViewSet)
#router.register(r'log/trace', TraceViewSet)
#router.register(r'log/stitches', VisualTraceTreeViewSet)

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^api/', include(router.urls)),
    url(r'^api/user/', MeView.as_view()),
    url(r'^api/jitlog/(?P<profile>[0-9a-z]*)/?$', BinaryJitLogFileUploadView.as_view()),
    url(r'^api/log/meta/(?P<profile>[0-9a-z]*)/$', meta),
    url(r'^api/log/trace/(?P<profile>[0-9a-z]*)/$', trace),
    url(r'^api/log/stitches/(?P<profile>[0-9a-z]*)/$', stitches),
    url(r'^$', index),
    url(r'^mem/', include('vmmemory.urls')),
]

if settings.DEBUG:
    urlpatterns += [url(r'^$', static.serve, {'path': 'index.html', 'insecure': True})]
