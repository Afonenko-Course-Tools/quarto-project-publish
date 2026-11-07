#!/usr/bin/bash
set -eu
if [[ "$1" == json ]]; then
  printf '{"native":"точный JSON"}\n'
  printf 'JSON_WARNING\n' >&2
  exit 0
fi
printf 'OUT_FIRST\n'
printf 'ERR_FIRST\n' >&2
while [[ ! -f "$LIVE_GATE" ]]; do sleep 0.02; done
printf 'OUT_LAST\n'
printf 'ERR_LAST\n' >&2
if [[ "$1" == fail ]]; then exit 9; fi
