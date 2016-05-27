
from django.contrib import admin
from django.conf import settings

from rest_framework import routers
from vmprofile.views import MeView, LogViewSet, TokenViewSet
from log.views import BinaryJitLogFileUploadView, MetaForestViewSet, TraceViewSet
from django.conf.urls import url, include
from django.contrib.staticfiles import views as static

router = routers.DefaultRouter()
router.register(r'log', LogViewSet)
router.register(r'profile', LogViewSet)
router.register(r'token', TokenViewSet, base_name="token")
router.register(r'log/meta', MetaForestViewSet)
router.register(r'log/trace', TraceViewSet)

urlpatterns = [
    url(r'^admin/', include(admin.site.urls)),
    url(r'^api/', include(router.urls)),
    url(r'^api/user/', MeView.as_view()),
    url(r'^api/jitlog/(?P<profile>[0-9a-z]+)/$', BinaryJitLogFileUploadView.as_view()),
]

if settings.DEBUG:
    urlpatterns += [url(r'^$', static.serve, {'path': 'index.html', 'insecure': True})]
