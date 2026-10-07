---
type: history
component: publisher
status: historical
---

# Сохранение исходных материалов 8 октября 2026

Предмет владельца: Composition/subprojects/current outputs, ownership и нативные профили.

Исходный общий каталог `/home/tolya/course-tools` не является Git-репозиторием.
Полные снимки mixed документов сохранены без изменения bytes; исходные пути,
размеры и SHA256 записаны в [SOURCE-MAP.json](SOURCE-MAP.json). Все эти документы
исторические: старые statuses, версии, запреты и незакрытые задачи не заменяют
[текущий план владельца](../../plans/2026-10-08-implementation.md) и согласованный
Core `authoring-model-next.md`. Корневые исходники не удалены и не изменены.

Содержательные направления переноса:

| Источник | Материал для владельца |
| --- | --- |
| `specs/quarto-tools-plan.md` | История контрактов и межрепозиторных границ; это не актуальный нормативный владелец |
| `specs/course-change-plan.md` | Согласования композиции, ресурсов, QRC и исследования диагностики 6–7 октября |
| `specs/course-plan-review.md` | Предыдущие архитектурные проверки границ и идентичности |
| `specs/quarto-resource-policy-implementation-plan.md` | Resource facts и границы ownership/Download |
| `specs/quarto-managed-portal-implementation-plan.md` | Publisher managed portal и передача фактических namespace в QRC |
| `specs/2026-10-04-refactoring-analysis.md` | Архитектурный анализ предыдущего этапа |
| `specs/course-examples-release-plan.md` | Группы готовых демонстраций и provenance ресурсов |
| `quarto-codex-handoff-2026-10-03.md` | Восстановимый снимок общего handoff до нынешнего маршрута |
| `local-evidence/refactoring-research-2026-10-07/*` | Небольшие substantive отчёты исследования; прежние проверки не подтверждают сегодняшнее дерево/CI |

[Source state](source-state.json) фиксирует checkout, refs, worktrees и OPEN PR
после свежего fetch, до создания рабочей ветки. Все существовавшие local heads
имеют 0 уникальных коммитов относительно свежего `origin/main`; они не удалены.
Все четыре владельца имеют один рабочий checkout, дополнительных worktrees нет.

QRC ignored `deno.lock` сохранён как снимок локального воспроизводимого состояния,
не включён в runtime. Cloud ignored `BUILD.json` сохранён как историческая
provenance: `sourceDirty:true`, Core 3.0.0, Cloud 2.1.0 и full; он не доказывает
успешность новой сборки. Остальные Cloud `_book` файлы — восстанавливаемые native
HTML/assets, не авторские источники; они оставлены на месте, без очистки.

Ruling: исторические документы пока остаются в `docs/history` и прежних owner
plan paths до координации очистки; сохранение выполнено до любой будущей deletion.
Текущий индекс не делает эти тексты нормативными. Цена отсрочки — временная
дублирующая история в активном дереве, без изменения runtime.
