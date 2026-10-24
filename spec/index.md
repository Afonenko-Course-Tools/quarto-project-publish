---
type: index
component: publisher
status: current
---

# Спецификации Publisher

`current` описывает контракт данного Git ref; `accepted-next` — согласованное
будущее изменение, ещё не заявленное реализованным. `historical` сохраняет
provenance и не задаёт активных требований. `type` различает contract/schema/API,
vocabulary, architecture, reference и plan; `component` указывает владельца.

| Документ | type | component | status |
| --- | --- | --- | --- |
| [Контракт Publisher](contract.md) | contract | publisher | current |
| [Структура subprojects](subprojects.cue) | contract/schema | publisher | current |
| [Диагностика](../docs/diagnostics.md) | reference | publisher | current |
| [Авторская модель Core](../../quarto-course/spec/index.md) | specification/index | course-core | current |
| [Результат реализации](../docs/releases/2026-10-08-implementation.md) | implementation-report | publisher | historical |
| [Карта сохранённой истории](../docs/history-index.md) | history-index | publisher | current |

Publisher владеет `subprojects`, размещением native outputs, collection/ownership и границей native child процесса. Quarto владеет metadata/profiles/форматами; Core владеет учебной моделью и отбором; QRC — адресами каталога.

Версия пакета определяется [descriptor](../_extensions/course-site/_extension.yml) того же Git ref.
Quarto 1.11.5 и CUE 0.17.1 согласованы с текущими правилами Core.
Текущий ref — **5.1.4**. Изменения после
выпущенного тега имеют статус **unreleased**.
Документация установленного выпуска читается из того же immutable tag, что и код.

## Исправление 5.1.2

Site согласованно проецирует источник каждого `ProjectFact` вместе с источником
его документа. Owner-relative пути и строгие проверки Core сохраняются.
Документация и код выбранного выпуска читаются из одного ref.

## Исправление 5.1.1

Очистка предыдущего результата учитывает явно объявленные ресурсы из
`quarto inspect`, включая README. Необъявленные исходники и служебные
каталоги в output по-прежнему блокируют очистку; границы и запрет symlink
сохраняются. Core владеет правилами публичной и закрытой выдачи.

## Кандидат 5.1.3

После полного QRC Site финализирует conditions ZIP существующими pure API;
исходные receipts и NativeRun сохраняются. До выпуска версия unreleased.

## Кандидат 5.1.4

Фасады ABI 1 передают `attributes.extension_id`; пакетная навигация и композиция
сохраняют общий контекст без произвольного `document_id`. Дочерняя команда
использует полный снимок окружения через `childEnv` и `clearEnv: true`.
Авторская модель, API Core 8.1 и Body v2 сохраняются; общий runtime не вводится.
Согласуемая матрица Core 8.2.3 / Site 5.1.4 / QRC 3.1.1 / Download 3.2.2 требует
отдельной проверки точных итоговых refs и установленного состава. До нового
выпуска версия остаётся unreleased; матрица сама по себе не является evidence.
