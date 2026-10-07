---
type: plan
component: publisher
status: accepted-next
---

# Publisher: план владельца

Статус: подготовка шагов 1–2 выполнена; новое поведение ещё не реализовано. Выполнять пункт 6 и затем
пункты 12–13/17–18 [линейного плана](../../../quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
[Целевой контракт Core](../../../quarto-course/spec/authoring-model-next.md)
задаёт поля банка/работ/назначений. Quarto 1.11.5 / CUE 0.17.1;
широкую Windows CI matrix не добавлять.

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
