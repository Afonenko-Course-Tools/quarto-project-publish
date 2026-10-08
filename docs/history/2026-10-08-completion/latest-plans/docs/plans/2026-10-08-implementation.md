---
type: plan
component: publisher
status: in-progress
---

# Publisher: план владельца

Статус: выпуск v5.0.0 выполнен на чистом проверенном main,
immutable release и native remote-tag install подтверждены. Шаги12–15
завершены; Course PR#4 OPEN/новый CI SUCCESS после удаления docs, шаги17–18 ожидаются.

## Изменения, документация и проверки

Изменить `_extensions/course-site/infrastructure/{config,files,collection,process}.ts`, `_extensions/course-site/application/compose.ts`, `_extensions/course-site/entrypoints/{pre,post,collect}.ts`; сверить существующий `_extensions/course-site/infrastructure/diagnostics.ts`. Оставить current outputs, effective formats/profiles, ownership и pre/post/collect API. Узкие SITE diagnostics получают component/project/input/output/field/hint. Module loader различает отсутствие sibling и отказ существующего модуля; чужой Core/QRC ID и cause остаются видимы. Native nonzero сохраняет tool/exitCode/stdout/stderr; forwarding не повторяет потоки. Exit 0 + stderr не превращается в ошибку, regex warning parser не добавляется. Guards symlink/overlap срабатывают до cleanup. Не добавлять registry, subprocess framework или дополнительный render.

Согласованно обновить `spec/subprojects.cue` только при реальном изменении контрактного поля, `README.md`, уточнить существующий `docs/diagnostics.md`, обновить `spec/contract.md` и этот план владельца, `examples/course/{_quarto.yml,book/_quarto.yml,materials/_quarto.yml}` и QMD. Fixtures `tests/site-domains.ts` сейчас генерируют старые упражнения без bank opt-in/time: перенести их на новый Core contract, сохранив ordinary render случаи отдельно. Student состав, mounted HTML/QRC/search и ресурсы не должны содержать restricted bank условия или closed части; full и выбранный экспорт получают свои корректные проекции.

Проверки из repo: `quarto run tests/site-paths.ts`, `site-source-paths.ts`, `site-effective-formats.ts`, `site-collection.ts`, `site-native.ts`, `site-domains.ts` (режимы default/resources/rootless/smoke), `site-profiles.ts`, `site-child-profiles.ts default`, `site-child-profiles.ts group`, `site-metadata-profiles.ts`, `site-web-selection.ts`, `site-formats.ts`, `site-local.ts`. Для `site-preview.ts` передать сохранённый root предыдущего native/domains запуска, как в `.github/workflows/ci.yml`. Провести standalone без Core/QRC и optional combined путь. Добавить focused проверку root CLI `--fail-if-warnings` и native настройки ребёнка; не обещать наследование root CLI флага всеми child scripts.

## Завершение

Оформить актуальный индекс спецификаций, README и собственный справочник
диагностик; примеры показывают правильную русскую авторскую разметку.
Старые plans/probes сохранить в Git до удаления из активной ветки.

Сверить свежие required checks и owner PR, слить в main и проверить merged SHA.
Выпустить новую версию с точными уже выпущенными зависимостями; готовую группу
демо, если она есть, выпускать отдельным проверенным asset. Старые Releases
не заменять. Финальная очистка веток только после общего маршрута:
main + служебная gh-pages, если используется, + heads OPEN automatic PR.
Здесь сохранить commit/PR/tag/SHA, фактические проверки и ссылки на готовые assets.


## Подготовка шагов 1–2 — 8 октября 2026

Общий старт: 02:36 Europe/Minsk; deadline: 11:36 (9 часов). Root назначил
документальной задаче reasoning ultra; модель исполнителя не менялась.

- Рабочая ветка: `feat/authoring-model-20261008`, создана в исходном checkout
  перед сохранением материалов; пользовательский `main` не сбрасывался.
- Preservation commit: `e53d5cd7a7f77022c97cdab0b5515e498c9e20fb`. Dirty/untracked планы сохранены до
  включения свежего `origin/main` `b7e6663e5674b657fcfa07d83ead8f650b3570ed`. Этот upstream соответствует
  опубликованному `v4.0.1` и является предком текущего рабочего дерева.
- [Карта истории, source provenance и восстановление](../history-index.md).
  Полные snapshot/source-state/SHA256 карты сохранены в Git commit
  `93b71e218e1ab187dfad6a9995a2e8d6afa01397`, затем убраны из active tree после координации.
  Исходники root остались без изменений; локальные и upstream owner планы
  сохранены отдельно с provenance refs.
- Один исходный worktree; существующие local heads не имеют уникальных
  коммитов относительно свежего origin/main. Ветки, теги и Releases сохранены.
- Ignored авторских материалов не обнаружено.
- CI: Core `v3.0.2`, QRC `4a636e11f88e29a40d81d8b05ead6ef2e7cb2e82`; demos: Publisher `v4.0.1`, QRC `v2.2.1`.
- README выделяет [текущий индекс](../../spec/index.md) и контракт; `main`
  явно unreleased. Типы/владельцы/status отделяют current и accepted-next.

OPEN PR: нет по свежему gh pr list; новые PR на этом этапе не создавались.
Tool Release `v4.0.1` подтверждён свежим `gh release list`, draft/prerelease
false. Демонстрации `demo-20261007-ru1` подтверждены тем же read-only запросом.

Фактическая проверка подготовки: свежий `git fetch origin --prune --tags`,
`gh pr list`, `gh release list`; SHA256 и bytes каждого сохранённого snapshot;
`git diff --check`/`git diff --cached --check`; ancestry `origin/main` и
отсутствие unresolved merge markers; локальные ссылки README/index/контрактов.
Runtime tests и CI здесь не запускались: код импортирован из опубликованного
upstream и не изменён исполнителем. Старые evidence/CI не принимаются за новые
проверки. Свежая runtime матрица принадлежит последующему пункту владельца.

Ruling: свежий upstream уже содержит диагностику 7 октября; дальнейший шаг
проверяет и дополняет реальный код, а не повторяет старый unchecked план.
Конфликтующие owner планы сохранены в обеих версиях; active historical текст
берётся из свежего upstream, а нынешний маршрут — только этот plan/accepted-next.
Цена ошибки — лишняя история, без потери исходных документов.

Ruling: после координации сохранённые historical snapshots и старые owner
plans/probes убраны из active tree; восстановимые SHA/paths указаны в карте истории.
Root и пользовательские worktrees не удалялись. Текущие spec/docs и план 8 октября
сохранены; transferred decisions закреплены в current/accepted-next контрактах.

Блокирующих расхождений для подготовки нет. Baseline ещё содержит Quarto 1.10.x
в workflows; удалить одновременно с runtime/README/examples на пункте владельца.
Следующий шаг ждёт новый текущий Core contract/Body; новые поля не заявлены
поддерживаемыми данным preflight. Merge в shared main, push, CI, release и
публикация не выполнялись.


## Подготовка документации пункта 6 — 8 октября 2026

Документационный исполнитель работает по принятым Core решениям; модель не
менялась. Добавлена [сохранённая подготовка авторства](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/d8bf688ebf33433dba236bb9761284a21f5a2899/docs/authoring-next.md) `accepted-next`,
ссылки из README и индекса. Существующие current API/контракты не объявлены
мигрированными до проверки runtime. Примеры на этой ветке предназначены для
следующей модели; native ordinary Quarto сохранён вне bank opt-in.

- Свежая проверка: `git diff --check`; 26 локальных Markdown-ссылок
  README/spec/docs/плана/README примеров существуют; 10 авторских YAML
  файлов успешно прочитаны. Проверка исключает generated/dependency деревья.
- Активные примеры не содержат старых kinds exam/handout, solution `for`,
  fixture sentinel/literal текста и Quarto 1.10.x. Русский lang сохраняется,
  публичные native проекты задают `fail-if-warnings: true`.
- Машинные descriptors/workflows и runtime/tests не изменялись этим исполнителем.
  Старые выпущенные dependency/demo/source pins сохранены как baseline;
  **новые release pins ожидают решения о версиях и фактических Releases**.

Full dependent suites/CI/render против меняющегося Core здесь не запускались.
Следующий runtime исполнитель выполняет команды выше, проверяет текущие
student/full outputs и выбранный экспорт, после чего документальная подготовка
переносится в current README/контракт. Merge/push/release/публикация не выполнены.


## Текущие контракты и release-pinned примеры — 8 октября 2026

Документальный commit: `0f914973b1a78f4ed59453a37f134025f73b7dda`.
Принята версия `v5.0.0`; descriptor подготовлен отдельным runtime
исполнителем. На момент этой записи новые Releases ещё не опубликованы;
merge/main, финальный CI, готовая release-сборка и публикация выполняются root
по линейному плану. Эта запись не подтверждает общий финальный integration gate.

- Правила подготовки перенесены в действующие README/spec/тематические docs.
  `current` описывает код того же ref; документация выпуска читается из того же
  immutable tag. В README/examples нет временных заявлений о доступности Release.
- `docs/authoring-next.md` удалён только после проверки точного Git blob
  `33adced2c72c8501ae2ab7ba6f5f3e569ca7cc5c` на commit
  `d8bf688ebf33433dba236bb9761284a21f5a2899`; восстановление записано в карте истории.
- Install/source/BUILD pins задают Core `v4.0.0`, Publisher `v5.0.0`, QRC `v3.0.0`
  и свою новую версию там, где эти зависимости используются. Native source-ссылки
  ведут на tool tag производителя; планируемый demo tag — `demo-20261008`,
  из того же clean producer SHA с `BUILD.sourceDirty: false`. Download не получает
  собственного demo Release. Механизм provenance/build runtime не менялся.
- Свежая статическая проверка: 13 YAML/front matter без повторных
  ключей, 23 существующих локальных Markdown-ссылок, 3 native
  source-конфигураций. У всех public base `_quarto.yml` — `lang: ru` и
  `fail-if-warnings: true`. Активные авторские документы не содержат Quarto 1.10,
  старой requirements карты/kinds, solution for и переходных contract ссылок.
- Канонический банк здесь не включён; ordinary native Quarto сохранён.
  Это проверка авторской разметки и ссылок, не native AST/render.
- `git diff --check` и staged whitespace — PASS. `deno fmt --check`
  существующих build/build-info scripts — PASS там, где они есть. Публичные
  API, runtime/tests/.github/CI этим документальным исполнителем не изменены.

Команды проверки и полные результаты: `/tmp/consumer-docs-final-20261008/verify.py`,
`bank-check.py`, `verify.log`, `bank-check.log`, `checks.json`, `bank-checks.json`.
Широкие native suites и release demo builds здесь не запускались параллельно:
их свежие результаты записывает отдельный integration исполнитель и root.

## Итоговый журнал 8 октября: проверенные выпуски и передача

Tool v5.0.0: source `215309b5c41669e56a857a1bc3e4f7f2ce782c5f`, PR#10 merged/main CI37722362758 SUCCESS, immutable Release406382948; actual native remote-tag install10 files exact bytes. Полная native composition/warnings/default/resources/rootless/child profiles/previews матрица прошла на frozen Core. CI использует фактически выпущенный совместимый QRC `v2.2.1`; ready composition отдельно собрана с QRC `v3.0.0`.
Ready demo-20261008: immutable Release406396300 на том же sourceSHA, BUILD.sourceDirty false, native build/check/downloaded archive equality PASS.

Шаг16: ожидает `https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4` / `fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c` / `SUCCESS — https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37742519419`; курс не merge/deploy/branch-cleanup. Шаги17/18 pending до actual before/after cleanup receipts и first durable history commit. Позднейший docs/history main не заменяет опубликованный producer/site sourceSHA.

Общий gate14/15 выполнен: Template PR19/CI37737745573 SUCCESS/MERGED, native publication main52316a7/gh-pages8dc11b5; actual Pages/live/CUA proof /tmp/template-patch-pages-20261008/.

Course16 native final PASS: Core 4.0.1/618 exact bytes, fixtures48+CUE8, student107.247/full120.018/student111.065/site0.358 all0, native bank href+11.1 both views, selected Body40.629s/root-only owner/real open-manual90/required-individual/0resources/noZIP, student178bytes unchanged and author43 unchanged. Actual proof /tmp/cybersecurity-core-patch-20261008/verified-final-native.json. Новый OPEN PR/head/required CI ещё ожидаются.

## Подтверждённый финальный журнал — 8 октября 2026, 07:19 UTC

Шаги 12–15 завершены: восемь текущих инструментов immutable выпущены,
штатная установка по тегам и native ready результаты проверены; Core 4.0.1
и demo-20261008-1 сохранены отдельно от предыдущей immutable линии.
[Template PR #19](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/19)
MERGED после [CI SUCCESS](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/37737745573).
Published source main `52316a762da3a9c054b5ac6a7a89620e46c7c150`,
native gh-pages `8dc11b599406f65af420aef39babdb15375df61b`. Пять clean-main
native gates и task publish exit 0; exact 63 Core/549 ready/599 site bytes,
61 HTML/2459 local links,22 HTTP/Pages built/Root CUA Source-search-catalog PASS.
[Руководство](https://afonenko-course-tools.github.io/quarto-template-course/).

Шаг 16: [новый PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) **OPEN**, прикреплён к задаче,
head `fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c`, tree `a9fdc3fe043bcaf75249dc2f7c839324287924e1`.
Сохранены пользовательские 9853/master8e histories; 701 одобренный путь
совпадает с Git bytes, включая все32 Course receipts/history files и8 raw logs.
Core 4.0.1 installed618 exact paths/bytes; NativeRun48/CUE8, student107.247/
full120.018/student111.065/site0.358s exit0; оба bank href/native11.1; Body40.629s,
root-only owner, real open/manual90-minute estimate, required/individual,
closed participant fields absent/resources0/noZIP. Student178bytes, author43
и runtime667 сохранены. Exact native proof: `/tmp/cybersecurity-core-patch-20261008/verified-final-native.json`.
[Required CI 37742519419](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37742519419) **SUCCESS** на exact head
fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c; публикационный uploader student
SKIPPED, merge/deploy не выполнялись. Шаг16 выполнен. Курс не merge/deploy/branch cleanup.

Шаги 17–18 pending: first durable nine-owner final history, fresh branch/tag/
Release/worktree guards, exact refs cleanup и final docs handoff ещё не выполнены.
Теги/Releases/source producer SHA, serving gh-pages, OPEN automatic heads
и все пользовательские worktrees/Course ветки сохраняются.

Подтверждение07:23 UTC: Course PR#4 остаётся OPEN; CI37742519419 completed SUCCESS
на headfd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c. Exact receipt: /tmp/cybersecurity-final-pr-20261008/verified-pr-ci.json.
Шаг16 выполнен;17–18 ещё pending.

## Прямое позднее указание: удалить Course docs — 07:33 UTC

По запросу пользователя каталог `/home/tolya/Cybersecurity/docs` полностью
удалён: 36 файлов перед удалением побайтно совпали с Git
`fd62bdb3de1d2c9fce8a51dde9fcb7636e58cb9c`; untracked/symlink материалов нет.
README,43 авторских источника и runtime667 не менялись. Старый owner plan и
технические snapshots остаются только в Git; Course docs не восстанавливать
и не создавать заново под другим путём. Действующая передача —
[PR #4](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/pull/4) и итоговый отчёт Core.
Фактический новый head `b6b085cf0541785d11159bd9a106cd131dfabaf0`, tree `f6a3732feca1bad1fd4c4ed4e533edbb6b230e5b`; PR OPEN.
Предыдущий CI37742519419/fd62 SUCCESS является историческим результатом.
Новый [CI 37743840665](https://github.com/BSU-RFCT-Afonenko-Courses/Cybersecurity/actions/runs/37743840665) **SUCCESS** на exact новом head;
шаг16 выполнен. Публикация SKIPPED, курс не merge/deploy. Шаги17–18 ещё pending.
Exact cleanup receipt: `/tmp/cybersecurity-docs-cleanup-20261008/verified-cleanup.json`.

Финальный актуальный gate07:37 UTC: PR4 OPEN/headb6b085cf0541785d11159bd9a106cd131dfabaf0,
CI37743840665 completed SUCCESS, deploy SKIPPED, docs ABSENT. Все36 удалённых
Course docs файлов восстановимы из Gitfd62, README/runtime667/author43 сохранены.
Шаг16 выполнен;17–18 pending. Exact receipt: /tmp/cybersecurity-docs-cleanup-20261008/verified-pr-ci.json.
