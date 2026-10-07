# Publisher: план владельца

Статус: следующий этап, реализация не начата. Выполнять пункт 6 и затем
пункты 12–13/17–18 [линейного плана](../../../quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
[Целевой контракт Core](../../../quarto-course/spec/authoring-model-next.md)
задаёт поля банка/работ/назначений. Quarto 1.11.5 / CUE 0.17.1;
широкую Windows CI matrix не добавлять.

## Изменения, документация и проверки

Изменить `_extensions/course-site/infrastructure/{config,files,collection,process}.ts`, `_extensions/course-site/application/compose.ts`, `_extensions/course-site/entrypoints/{pre,post,collect}.ts`; создать `_extensions/course-site/infrastructure/diagnostics.ts`. Оставить current outputs, effective formats/profiles, ownership и pre/post/collect API. Узкие SITE diagnostics получают component/project/input/output/field/hint. Module loader различает отсутствие sibling и отказ существующего модуля; чужой Core/QRC ID и cause остаются видимы. Native nonzero сохраняет tool/exitCode/stdout/stderr; forwarding не повторяет потоки. Exit 0 + stderr не превращается в ошибку, regex warning parser не добавляется. Guards symlink/overlap срабатывают до cleanup. Не добавлять registry, subprocess framework или дополнительный render.

Согласованно обновить `spec/subprojects.cue` только при реальном изменении контрактного поля, `README.md`, создать `docs/diagnostics.md`, обновить `spec/plans/course-composition-plan.md`, `examples/course/{_quarto.yml,book/_quarto.yml,materials/_quarto.yml}` и QMD. Fixtures `tests/site-domains.ts` сейчас генерируют старые упражнения без bank opt-in/time: перенести их на новый Core contract, сохранив ordinary render случаи отдельно. Student состав, mounted HTML/QRC/search и ресурсы не должны содержать restricted bank условия или closed части; full и выбранный экспорт получают свои корректные проекции.

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
