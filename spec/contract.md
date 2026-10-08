---
type: contract
component: publisher
status: current
---

# Контракт Publisher

Корень native проекта объявляет непустой `subprojects: [paths]`; структура задаётся
[subprojects.cue](subprojects.cue). Каждый путь относительный и обозначает папку
самостоятельного проекта. Размещение готовой части повторяет нормализованный путь.
Повторы, вложенные пересечения источников/outputs и symlink отклоняются до cleanup.
`course-site.projects` и отдельные id/mount/format части не поддерживаются.

Native Quarto определяет selected sources, эффективные форматы и профили.
Publisher сохраняет native defaults/groups при отсутствии root profile и записывает
фактический `QUARTO_PROFILE` post-hook; `files.config` не определяет профиль.
Student/full outputs не пересекаются. Один документ получает один выбранный
веб-формат и один native body render; неоднозначные веб-форматы отклоняются.
Невеб-форматы собираются отдельным штатным маршрутом.

Явные pre/post/collect hooks передают только текущие outputs успешных native
процессов. Сохранённые HTML и sidecar другой попытки не включаются автоматически.
Native caches сохраняются; очистка принадлежит текущему publishable output.
Параллельные сборки одного изменяемого проекта не поддерживаются.

Core/QRC опциональны и определяются в sibling installation namespace.
Core сохраняет самостоятельные области identity проектов, QRC получает явные
namespace/current outputs/search. Publisher не вводит общий экспортный банк
и не переопределяет public resource policy Core. Правила учебной модели принадлежат
[Core](../../quarto-course/spec/index.md), адресация —
[QRC](../../quarto-reference-catalog/docs/contract.md).

Quarto определяет отказ native команды. Успешный stderr сам по себе не является
ошибкой; собственные и foreign ошибки сохраняют ID, оба потока и cause.
Strict warnings задаются штатным `fail-if-warnings` каждого публичного child
проекта. Подробные ID и действия — [диагностика](../docs/diagnostics.md),
подключение и команды — [README](../README.md).

## Банк и выбранная проекция

Область канонических задач включает native `exercise-bank: true` и эффективную
политику `exercise-statement-visibility: open|restricted`. У каждого `#exr-*`
свои обязательные difficulty/time; вне области остаётся обычный Quarto.
Страницы работ могут находиться вне банка. В выбранной книге сохраняется одна
экспортная идентичность; Publisher не объединяет самостоятельные проекты.

Student outputs не содержат restricted условий и их ссылок назначений, решений
обычных open задач, закрытых ключей и заметок преподавателя. Mounted resources,
HTML, search и каталоги QRC следуют той же текущей проекции. Full использует
свой отдельный output. Native `repo-actions: [source]` ведёт к GitHub; source modal
и копирование raw QMD с закрытыми телами в student output не включаются.

У каждого публичного native проекта явно заданы `lang: ru` и
`fail-if-warnings: true`. Корневой CLI-флаг строгости не наследуется дочерними
scripts. Source JSON pass Core сохраняет самостоятельную политику предупреждений.
[Демонстрация](../examples/course/README.md) показывает Publisher/QRC без Core;
канонический банк для этого обычного native курса не требуется.
