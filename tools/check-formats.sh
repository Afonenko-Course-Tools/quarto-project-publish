#!/usr/bin/env bash
# Единственные владельцы стиля: Prettier, StyLua, shfmt и Taplo.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
mode=${1:---check}
[[ "$mode" == --check || "$mode" == --write ]] || {
  printf '%s\n' 'Используйте --check или --write' >&2
  exit 2
}
for tool in prettier stylua luacheck yamllint actionlint shfmt shellcheck jq taplo; do
  command -v "$tool" >/dev/null || {
    printf 'Не найден инструмент: %s\n' "$tool" >&2
    exit 127
  }
done
inventory=$(mktemp)
trap 'rm -f -- "$inventory"' EXIT
git ls-files --cached --others --exclude-standard -z >"$inventory"
mapfile -d '' files <"$inventory"
prettier_files=() lua_files=() shell_files=() yaml_files=() workflow_files=() toml_files=()
for file in "${files[@]}"; do
  [[ -f "$file" ]] || continue
  case "$file" in
    */vendor/* | */node_modules/* | */generated/* | */_generated/* | _extensions/course-site/observability/bridge.*) continue ;;
  esac
  case "$file" in
    *.ts | *.js | *.cjs | *.mjs | *.json | *.yml | *.yaml) prettier_files+=("$file") ;;
  esac
  case "$file" in
    *.lua | .luacheckrc) lua_files+=("$file") ;;
    *.sh) shell_files+=("$file") ;;
    *.toml) toml_files+=("$file") ;;
  esac
  case "$file" in
    *.json) jq --slurp --exit-status 'length == 1' "$file" >/dev/null ;;
    *.yml | *.yaml) yaml_files+=("$file") ;;
  esac
  case "$file" in .github/workflows/*.yml | .github/workflows/*.yaml) workflow_files+=("$file") ;; esac
done
((${#prettier_files[@]})) && prettier "$mode" --config .prettierrc.json --ignore-path /dev/null "${prettier_files[@]}"
if ((${#lua_files[@]})); then
  if [[ "$mode" == --check ]]; then stylua --check "${lua_files[@]}"; else stylua "${lua_files[@]}"; fi
  luacheck --no-cache "${lua_files[@]}"
fi
if ((${#shell_files[@]})); then
  if [[ "$mode" == --check ]]; then shfmt -d -i 2 -ci "${shell_files[@]}"; else shfmt -w -i 2 -ci "${shell_files[@]}"; fi
  shellcheck --severity=style "${shell_files[@]}"
  for file in "${shell_files[@]}"; do bash -n "$file"; done
fi
if ((${#toml_files[@]})); then
  taplo lint --no-auto-config --no-schema "${toml_files[@]}"
  if [[ "$mode" == --check ]]; then
    taplo format --no-auto-config --check --option column_width=120 --option reorder_keys=false "${toml_files[@]}"
  else
    taplo format --no-auto-config --option column_width=120 --option reorder_keys=false "${toml_files[@]}"
  fi
fi
((${#yaml_files[@]})) && yamllint --strict -c .yamllint.yml "${yaml_files[@]}"
((${#workflow_files[@]})) && actionlint "${workflow_files[@]}"
