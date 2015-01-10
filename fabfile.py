import uuid

from fabric.api import *
from fabric.contrib import files


PATH = "/var/www/vmprof"
TARBALL = "https://github.com/vmprof/vmprof-server/archive/master.tar.gz"

ENV_PIP = "virtualenv/bin/pip"
ENV_PYTHON = "virtualenv/bin/python"
ENV_UWSGI = "virtualenv/bin/uwsgi"


def deploy():

    target = "/tmp/%s.tar.gz" % uuid.uuid4()
    run("wget %s -O %s" % (TARBALL, target))

    run("mkdir -p %s" % PATH)

    with cd(PATH):

        if files.exists("uwsgi.pid"):
            run("%s --stop uwsgi.pid" % ENV_UWSGI)

        run("rm vmprof -rf ")
        run("mkdir vmprof")

        run("tar -xf %s -C vmprof --strip-components=1" % target)
        run("virtualenv virtualenv")

        run("%s install -r vmprof/requirements/production.txt" % ENV_PIP)

        run("mkdir -p vmprof/static")

        run("%s vmprof/manage.py collectstatic -c --noinput" % ENV_PYTHON)
        run("%s vmprof/manage.py migrate" % ENV_PYTHON)

        run("%s --ini vmprof/uwsgi.ini" % ENV_UWSGI)
