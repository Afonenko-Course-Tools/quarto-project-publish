#!/bin/sh
exec __DENO__ run --no-config --no-lock -A __PROGRAM__ __TOOL__ __LOG__ "$@"
