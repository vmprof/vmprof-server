import os
import json
import pytest

from vmlog.models import BinaryJitLog
from django.test import TestCase

@pytest.mark.django_db
class TestBinaryJitLogDecode(TestCase):
    fixtures = ['vmlog/test/fixtures.yaml']

    def test_parse(self):
        bjl = BinaryJitLog.objects.get(checksum='richards')
        forest = bjl.decode_forest()

    def test_parse_log_with_source_code(self):
        bjl = BinaryJitLog.objects.get(checksum='1v1')
        forest = bjl.decode_forest()
        assert dict(forest.source_lines['/a.py']) == {
            1: (4,'a = b + c')
        }
        assert dict(forest.source_lines['/b.py']) == {
            25: (8, 'def wait_for_me():'),
            26: (12, 'yield 13'),
            27: (12, 'a,b,c = call.me(1,2,3) # here is a comment'),
            33: (12, '@hello there'),
        }

    def test_get_meta_for_jitlog(self):
        response = self.client.get('/api/log/meta/richards/')
        jsondata = response.data
        traces = jsondata['traces']
        assert 'resops' in jsondata and 'traces' in jsondata
        assert 'bridges' in jsondata
        assert 'machine' in jsondata
        assert 'word_size' in jsondata
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

    def test_get_visual_trace(self):
        response = self.client.get('/api/log/stitches/1v1/?id=1')
        assert response.status_code == 200
        assert response.data == {
            'root': '0x1',
            'stitches': {
                '0x1': ['g,1,0x1234,0x2', 'j,2,0x11'],
                '0x2': []
            }
        }
