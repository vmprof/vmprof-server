import os
import sys
import base64
import requests


here = os.path.dirname(__file__)


prof = base64.b64encode(open(sys.argv[1], 'rb').read())
prof_sym = base64.b64encode(open(sys.argv[2], 'rb').read())


response = requests.post("http://127.0.0.1:8000/submit/", data={
    "prof": prof,
    "prof_sym": prof_sym
})

print response.content
