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
Изменения main после выпущенного тега — **unreleased**.
Документация установленного выпуска читается из того же immutable tag, что и код.
