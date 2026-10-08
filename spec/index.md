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
| [Подготовка авторства](../docs/authoring-next.md) | authoring-guide | publisher | accepted-next |
| [Контракт Publisher](contract.md) | contract | publisher | current |
| [Структура subprojects](subprojects.cue) | contract/schema | publisher | current |
| [Диагностика](../docs/diagnostics.md) | reference | publisher | current |
| [Целевой authoring contract Core](../../quarto-course/spec/authoring-model-next.md) | contract | core | accepted-next |
| [План владельца](../docs/plans/2026-10-08-implementation.md) | plan | publisher | accepted-next |
| [Карта сохранённой истории](../docs/history-index.md) | history-index | publisher | current |

Publisher владеет `subprojects`, размещением native outputs, collection/ownership и границей native child процесса. Quarto владеет metadata/profiles/форматами; Core владеет учебной моделью и отбором; QRC — адресами каталога.

Версия пакета определяется только
[`_extension.yml`](../_extensions/course-site/_extension.yml) **того же Git ref**.
Последний проверенный опубликованный tool tag — `v4.0.1`; его descriptor
содержит `4.0.1`. `main` до нового выпуска — **unreleased**, даже если
число в descriptor пока совпадает с предыдущим выпуском. Документация выпуска
читается из того же immutable tag, рабочий план не заменяет контракт этого tag.

Новая модель банка/assignments и минимум Quarto 1.11.5 / CUE 0.17.1 принимаются
по `accepted-next` одновременно с кодом, fixtures, README и выпуском владельца.
Этот индекс сам по себе не включает новый синтаксис. Существующие машинные
дескрипторы/workflow baseline пока сохраняются до соответствующего runtime шага.
