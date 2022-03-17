# Using pre-built Pandas image since building Pandas from sources is too slow
FROM amancevice/pandas:0.22.0-python3-alpine

EXPOSE 8000
VOLUME /data

RUN apk add --no-cache python3 \
        py3-yaml py3-cryptography py3-six py3-requests sqlite py-pysqlite libunwind-dev uwsgi-python3 \
        gcc g++ musl-dev linux-headers postgresql-dev python3-dev git

COPY requirements /usr/src/requirements

RUN pip3 install -r /usr/src/requirements/base.txt
RUN pip3 install -e git+https://github.com/vmprof/vmprof-python.git#egg=vmprof
RUN pip3 install gunicorn

COPY . /usr/src/vmprof-server
WORKDIR /usr/src/vmprof-server

COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

ENV DJANGO_SETTINGS_MODULE=webapp.settings.in_house_docker
ENV SQLITE_DB=/data/vmprof.db
ENV DATABASE_URL="sqlite:///$SQLITE_DB"

RUN set -x \
    find . -name '__pycache__' -type d | xargs rm -rf && \
    python3 -c 'import compileall, os; compileall.compile_dir(os.curdir, force=1)' && \
    export SECRET_KEY='build_secret' && \
    python3 manage.py check && \
    python3 manage.py collectstatic --noinput && \
    python3 manage.py compress

CMD ["/usr/bin/gunicorn", "webapp.wsgi:app", "--bind", "0.0.0.0:8000", "--log-file", "-"]
