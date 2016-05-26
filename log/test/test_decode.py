


import os
import json
import pytest

from log.models import BinaryJitLog
from django.test import TestCase

class TestBinaryJitLogDecode(TestCase):
    fixtures = ['log/test/fixtures.yaml']

    @pytest.mark.django_db
    def test_parse(self):
        bjl = BinaryJitLog.objects.get(checksum='1111')
        jl = bjl.decode_jitlog()
