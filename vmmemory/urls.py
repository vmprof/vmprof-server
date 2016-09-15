from django.conf.urls import url
from vmmemory import views

urlpatterns = [
    url(r'^submit/$', views.submit_profile, name='submit_profile'),
    url(r'^(?P<pk>[0-9]+)/mem/$', views.show_profile, {'profile_type': "mem"}, name='mem_profile'),
    url(r'^(?P<pk>[0-9]+)/cpu/$', views.show_profile, {'profile_type': "cpu"}, name='cpu_profile'),
    url(r'^api/(?P<pk>[0-9]+)/cpu/$',  views.fetch_profile, {'attr': "cpu_profile"}, name='api_fetch_cpu'),
    url(r'^api/(?P<pk>[0-9]+)/meta/$', views.fetch_profile, {'attr': "addr_name_map"}, name='api_fetch_addr_name_map'),
    url(r'^api/(?P<pk>[0-9]+)/mem/$', views.fetch_mem_profile, name='api_fetch_mem'),
    url(r'^$', views.profiles_list, name='profiles_list'),
]
