# Перенос проверок на текущую публичную композицию

Исторические исходники и проверки сохранены в Git. Удалённые входы не служат
fallback и не входят в установленный пакет.

| Прежний путь или проверка | Действующая гарантия |
| --- | --- |
| stageConditions/collectConditions/finalize-conditions, чтение и повторная упаковка ZIP | Удалены вместе с путём приёма старого архива. Core отдаёт текущий inventory; Download создаёт ZIP один раз. site-public-operation проверяет конечные адреса и exact ZIP bytes; site-owner-release conditions — отсутствие кода/build в condition-only |
| Legacy NativeRun/receipt v1 association | Публичная genuine operation и validateRelease с exact source/format/profile coverage. site-owner-release document-course/assessment/pl/pl-missing, Download public-runtime/model-receipts |
| Source/catalog/hash/currentness/symlink и input drift | Core текущая operation/inventory; Download public-inventory/public-runtime. Данные не берутся из legacy receipt или старого ZIP |
| Deferred/custom/ordinary links, fragment/query, student/full | QRC link-styles/imports/import-safety; site-public-operation и site-owner-release positive/full/conditions/default/revealjs/reveal-model проверяют итоговые README и ZIP |
| Проверки unsafe ZIP reader, повторной финализации и старого host manifest | Входы удалены: ZIP больше не читается и не перепаковывается. Эти проверки не выдаются за controls нового writer |
| Sibling missing против foreign call/import error | site-siblings использует настоящий production public.ts Download/QRC: отсутствие модуля, сохранение code/cause/stack и import-time failure |
| Child profiles и legacy release sidecar | site-child-profiles читает composition.nativeOperations, genuine Core release proof и catalog identity; collect завершает HTML до Core post |

Карта описывает владельцев проверок. Конкретные результаты и точные refs фиксируются
в отчёте выполнения; наличие строки в таблице само по себе не является PASS.
