#!/bin/sh

if [ -n $SQLITE_DB -a ! -e $SQLITE_DB ]; then
    RUN python3 manage.py migrate
fi

