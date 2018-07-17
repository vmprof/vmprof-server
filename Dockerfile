#FROM alpine:3.7
# Using pre-built Pandas image since building Pandas from sources is too slow
FROM amancevice/pandas:0.22.0-python3-alpine

EXPOSE 8000
VOLUME /data
ENV SQLITE_DB=/data/vmprof.db

RUN apk add --no-cache python3 \
        py3-yaml py3-cryptography py3-six py3-requests sqlite py-pysqlite libunwind-dev uwsgi-python3 \
        gcc g++ musl-dev postgresql-dev python3-dev git py-psutil

COPY requirements /usr/src/requirements

RUN pip3 install -r /usr/src/requirements/testing.txt
RUN pip3 install -e git://github.com/vmprof/vmprof-python.git#egg=vmprof

COPY . /usr/src/vmprof-server
WORKDIR /usr/src/vmprof-server

COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000", "-v", "3"]

