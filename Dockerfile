#FROM alpine:3.7
FROM amancevice/pandas:0.22.0-python3-alpine

EXPOSE 8000

RUN apk add --no-cache python3 \
        py3-yaml py3-cryptography py3-six py3-requests sqlite py-pysqlite libunwind-dev uwsgi-python3 \
        gcc g++ musl-dev zlib-dev python3-dev git

COPY . /usr/src/vmprof-server

#RUN pip3 install raven==5.3.1
RUN pip3 install -r /usr/src/vmprof-server/requirements/docker.txt

RUN pip3 install -e git://github.com/vmprof/vmprof-python.git#egg=vmprof

#RUN cp -pr /usr/src/vmprof-server/vmprof3/src/vmprof /usr/lib/python3.6/site-packages/

VOLUME /data
ENV SQLITE_DB=/data/vmprof.db

WORKDIR /usr/src/vmprof-server
#RUN pip3 install vmprof3/src/vmprof
#RUN python3 manage.py migrate

CMD ["python3", "manage.py", "runserver", "0.0.0.0:8000", "-v", "3"]

