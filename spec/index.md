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
| [Исполняемая проверка subprojects](../_extensions/course-site/infrastructure/config.ts) | contract/runtime | publisher | current |
| [Диагностика](../docs/diagnostics.md) | reference | publisher | current |
| [Авторская модель Core](../../quarto-course/spec/index.md) | specification/index | course-core | current |
| [Результат реализации](../docs/releases/2026-10-08-implementation.md) | implementation-report | publisher | historical |
| [Карта сохранённой истории](../docs/history-index.md) | history-index | publisher | current |

Publisher владеет `subprojects`, размещением native outputs, collection/ownership и границей native child процесса. Quarto владеет metadata/profiles/форматами; Core владеет учебной моделью и отбором; QRC — адресами каталога.

Версия пакета определяется [descriptor](../_extensions/course-site/_extension.yml) того же Git ref.
Целевой Quarto — 1.11.5; исполняемая проверка конфигурации принадлежит TS-модулю Publisher.
Текущий ref — кандидат **5.2.0**; полный GREEN CI и выпуск ещё не подтверждены. Изменения после
выпущенного тега имеют статус **unreleased**.
Документация установленного выпуска читается из того же immutable tag, что и код.

## Текущий публичный договор

Core 9 использует native TS по умолчанию. Publisher сохраняет отдельную
операцию каждого owner и её release proof; обычный проект без Core остаётся
самостоятельным. Project/Workspace/DocumentFormat/DocumentPlan выводятся из
конструкторов и действующих TS-операций владельца, отдельные ручные interfaces
их формы не поддерживаются.

QRC завершает адресацию до фиксации Core, затем Download создаёт ZIP один раз
в конечном месте. Старые NativeRun и host finalize-conditions не являются
входами текущего пакета. [Карта переноса проверок](../tests/legacy-harness-mapping.md)
связывает действующие гарантии с их владельцами и отделяет удалённые входы.

Сохранены ABI 1 и контекст наблюдения, native профили, guards путей и outputs,
политика student/full, восстановимые Markdown-копии и preview. Подробности —
[контракт](contract.md) и [публичная композиция](../docs/public-operation.md).
Исторические кандидаты и прежние матрицы сохранены в Git и
[указателе истории](../docs/history-index.md); они не подтверждают текущий выпуск.
