import os
import socket
from django.shortcuts import render

def index(request):
    ctx = {}
    return render(request, 'webapp/index.html', ctx)

def json_serialize(response, cmd, **kwargs):
    filename = "cache.socket"
    command = cmd.format(**kwargs) + '\r\n'
    if os.path.exists(filename):
        client = socket.socket( socket.AF_UNIX, socket.SOCK_STREAM)
        client.connect(filename)
        client.send(command.encode('utf-8'))
        while True:
            data = client.recv(4096)
            if data == b"":
                break
            response.write(data.decode('utf-8'))
    else:
        # should never be hit in production!!
        from twisted.test import proto_helpers
        from vmcache.cache import CacheProtocol
        prot = CacheProtocol()
        prot.transport = proto_helpers.StringTransport()
        prot.lineReceived(command.encode('utf-8'))
        response.write(prot.transport.value().decode('utf-8'))
