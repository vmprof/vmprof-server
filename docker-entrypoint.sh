#!/bin/sh -x

if [ -n $SQLITE_DB -a ! -e $SQLITE_DB ]; then
    python3 manage.py migrate
fi

exec $@