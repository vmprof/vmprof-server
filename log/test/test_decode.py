import os
import json
import pytest

from log.models import BinaryJitLog
from django.test import TestCase

@pytest.mark.django_db
class TestBinaryJitLogDecode(TestCase):
    fixtures = ['log/test/fixtures.yaml']

    def test_parse(self):
        bjl = BinaryJitLog.objects.get(checksum='1111')
        forest = bjl.decode_forest()

    def test_get_meta_for_jitlog(self):
        response = self.client.get('/api/log/meta/1111/')
        jsondata = response.data
        traces = jsondata['traces']
        assert len(jsondata) == 3
        assert 'resops' in jsondata and 'traces' in jsondata
        assert 'bridges' in jsondata
        assert len(jsondata['resops']) > 0
        assert len(traces) > 20
        # this is the jitlog for richards. there must be the scope 'schedule'
        for id, trace in traces.items():
            if trace.get('scope', '') == 'schedule':
                break
        else:
            pytest.fail("profile did not contain the function name schedule")

    def test_get_trace_missing_id(self):
        response = self.client.get('/api/log/trace/1v1/') # missing id
        assert response.status_code == 404

    def test_get_trace_as_json(self):
        response = self.client.get('/api/log/trace/1v1/?id=0')
        assert response.status_code == 200
        assert response.data != {}
