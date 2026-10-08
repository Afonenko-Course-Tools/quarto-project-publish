---
type: implementation-report
component: quarto-project-publish
status: completed
updated: 2026-10-08
---

# Publisher: внедрение 8 октября 2026

Это отчёт проверенных операций. Нормативные правила принадлежат
[текущим спецификациям](../../spec/index.md) того же ref; контракт выпуска
читается по точному immutable тегу.

Выпущен [v5.0.0](https://github.com/Afonenko-Course-Tools/quarto-project-publish/releases/tag/v5.0.0), source SHA
`215309b5c41669e56a857a1bc3e4f7f2ce782c5f`, immutable Release ID `406382948`.
[PR #10](https://github.com/Afonenko-Course-Tools/quarto-project-publish/pull/10)
прошёл проверки и слит с сохранением истории; дерево merged main равно tested PR head.
[Main CI](https://github.com/Afonenko-Course-Tools/quarto-project-publish/actions/runs/37722362758)
завершился SUCCESS на указанном source SHA до публикации.

CI: Core `v4.0.0`, совместимый QRC `v2.2.1`; ready: Publisher `v5.0.0`, QRC `v3.0.0`, Quarto 1.11.5.
Штатный remote-tag `quarto add` прошёл: все **10** установленных
пути и bytes совпали с upstream `_extensions` этого Git object, без overlay
и лишних файлов. Draft assets были скачаны и сверены до immutable публикации.

Полная native composition/warnings/default/resources/rootless/child profiles/previews матрица прошла на frozen Core. CI использует фактически выпущенный совместимый QRC `v2.2.1`; ready composition отдельно собрана с QRC `v3.0.0`.

Готовые группы выпущены в отдельном immutable
[demo-20261008](https://github.com/Afonenko-Course-Tools/quarto-project-publish/releases/tag/demo-20261008)
на том же producer SHA; `BUILD.sourceDirty:false`. Native build, HTML, resources,
sourceLinks и actual outputs прошли; полный ready map совпал с downloaded archive.

| Группа | Asset | Файлов | Archive SHA-256 |
| --- | --- | ---: | --- |
| composition | `composite-course.tar.gz` | 130 | `713620d92f6a6baafcf118ec0a0b6c0be95e801a84ae14fcbdca1aa4f94314c5` |

Native sourceRef — собственный tool tag, catalog source — demo tag; оба
указывают на тот же source SHA. Старые immutable tags/assets сохранены.

Нативный Windows прогон не заявляется. Узкие path/CUE-TEMP исправления Core 4.0.0
подтверждены fixtures; чужие warning streams сохраняются с фактическим exit.
Подробные receipts и общий результат — [центральный отчёт Core](https://github.com/Afonenko-Course-Tools/quarto-course/blob/main/docs/releases/2026-10-08-implementation.md).

Первый сохранённый owner history checkpoint: `2e761ba3e087f2e143c61bad25c263a25b809219`.
Шаг 17 выполнен; actual before/after receipt: `3 LOCAL / 1 REMOTE; main, all tags/Releases, serving gh-pages и API-confirmed OPEN bot heads сохранены`.
Более поздний docs/history main не переименовывает опубликованный source SHA.

Восстановление финальных снимков: [SOURCE-MAP](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/2e761ba3e087f2e143c61bad25c263a25b809219/docs/history/2026-10-08-completion/SOURCE-MAP.json). После проверки exact Git blobs только этот новый датированный snapshot-каталог удаляется из active docs; архивный commit остаётся reachable. Последние планы и cleanup receipts: [Git checkpoint](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/8d1c650bc92b37edeb0630d71de6f9c5737118ce/docs/history/2026-10-08-completion/final-journals/2026-10-08-implementation.md); [общая квитанция](https://github.com/Afonenko-Course-Tools/quarto-course/blob/35ab45a60d3859c4aa584499e4a49c5b8b6f14bf/docs/history/2026-10-08-completion/final-cleanup/03-verified-cleanup.json).
