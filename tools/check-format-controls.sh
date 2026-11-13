#!/usr/bin/env bash
# Контроли запускают штатный gate и всегда удаляют новые исходники.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
paths=(tools/__quality_format.mjs tests/fixtures/__quality_format.lua tests/fixtures/__quality_format.sh tools/__quality_format.yml)
for file in "${paths[@]}"; do
  [[ ! -e "$file" ]] || {
    printf 'Контрольный путь занят: %s\n' "$file" >&2
    exit 1
  }
done
temporary=$(mktemp -d)
clean() {
  rm -f -- "${paths[@]}"
  rm -rf -- "$temporary"
}
trap clean EXIT
bash tools/check-formats.sh >"$temporary/positive.log" 2>&1 || {
  cat "$temporary/positive.log"
  exit 1
}
reject() {
  local marker=$1
  if bash tools/check-formats.sh >"$temporary/negative.log" 2>&1; then
    printf 'Gate пропустил контроль: %s\n' "$marker" >&2
    exit 1
  fi
  grep -Eq "$marker" "$temporary/negative.log" || {
    cat "$temporary/negative.log"
    exit 1
  }
  printf 'Отклонён: %s\n' "$marker"
  rm -f -- "${paths[@]}"
}
printf '%s\n' 'export const value={a:1};' >"${paths[0]}"
reject '__quality_format.mjs'
printf '%s\n' 'local value = misspelled_runtime()' 'return value' >"${paths[1]}"
reject 'undefined variable.*misspelled_runtime'
printf '%s\n' '#!/usr/bin/env bash' "echo \$QUALITY_CONTROL_VALUE" >"${paths[2]}"
reject 'SC2086'
printf '%s\n' 'key: first' 'key: second' >"${paths[3]}"
reject 'unique|repeated|duplicat'
printf '%s\n' '#!/usr/bin/env bash' 'echo QUALITY_TOOL_FAILURE >&2' 'exit 23' >"$temporary/prettier"
chmod +x "$temporary/prettier"
if PATH="$temporary:$PATH" bash tools/check-formats.sh >"$temporary/tool.log" 2>&1; then
  printf '%s\n' 'Gate пропустил сбой инструмента' >&2
  exit 1
fi
grep -q QUALITY_TOOL_FAILURE "$temporary/tool.log"
printf '%s\n' 'Отклонён: сбой инструмента'

mkdir "$temporary/missing"
for tool in bash dirname prettier; do
  ln -s "$(command -v "$tool")" "$temporary/missing/$tool"
done
if PATH="$temporary/missing" bash tools/check-formats.sh >"$temporary/missing.log" 2>&1; then
  printf '%s\n' 'Gate пропустил отсутствующий инструмент' >&2
  exit 1
fi
grep -q 'Не найден инструмент: stylua' "$temporary/missing.log"
printf '%s\n' 'Отклонён: отсутствующий инструмент'
