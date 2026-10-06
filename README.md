# course-site: составной сайт из native проектов Quarto

Расширение устанавливается из существующего репозитория `quarto-project-publish`:

```bash
quarto add Afonenko-Course-Tools/quarto-project-publish@v3.0.1
quarto render --profile student
quarto preview --no-watch-inputs
quarto publish gh-pages --profile student
```

Используйте фактический installation prefix, показанный `quarto add`. Ниже пути
для локальной установки без namespace. При установке GitHub добавьте namespace
между `_extensions/` и именем расширения. Core, QRC и course-site должны быть
установлены рядом в одном namespace корневого проекта. Компоненты устанавливают
собственные Core/QRC для самостоятельного render и preview.

Корневой `_quarto.yml`:

```yaml
project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
course-site:
  projects:
    - {id: theory, path: theory, format: html, mount: theory}
    - {id: slides, path: slides, format: revealjs, mount: slides}
```

У каждой части есть собственный `_quarto.yml`, native `output-dir` и последний
post-render hook `../_extensions/course-site/entrypoints/collect.ts`. Например:

```yaml
project:
  type: website
  output-dir: _output/default
  render: [index.qmd]
  post-render: ../_extensions/course-site/entrypoints/collect.ts
format: html
```

`id` является уникальным идентификатором части; `root` зарезервирован для главной.
`path` и `mount` — относительные непересекающиеся пути. Исходники, output и native
cache не могут пересекаться. Символические ссылки в этих путях запрещены.

Профили `_quarto-student.yml` и `_quarto-full.yml` задают **native**
`project.output-dir`: в корне `_site-student` / `_site-full`, в частях
`_output/student` / `_output/full`. При использовании Course каждый профиль также
задаёт `course.view: student` / `full` в Course-проектах. Корень без Course metadata
берёт ожидаемый view каждого домена из разрешённой конфигурации его частей;
части одного `course.id` должны выбирать один view. Расширение использует
`quarto inspect` для разрешённой конфигурации и передаёт выбранные профили в том же
порядке. Пересекающиеся output разных audience отклоняются до удаления файлов.
Default output также должен быть отдельным, если default не выбирает audience.

## Core и QRC

Модули опциональны. Для курса установите `course-core` и укажите `filters:
[course-core]`, `course.id`. Для ссылок установите `reference-catalog`, добавьте
его фильтр и `reference-catalog.namespace`. Корневой course-site hook сам вызывает
Core begin/finish и QRC full; дополнительные Core pre/post hooks в корне не нужны.
В частях настройте:

```yaml
project:
  type: website
  output-dir: _output/default
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render:
    - _extensions/course-core/entrypoints/post.ts
    - _extensions/reference-catalog/entrypoints/post.ts
    - ../_extensions/course-site/entrypoints/collect.ts
filters: [course-core, reference-catalog]
course: {id: theory-course}
reference-catalog: {namespace: theory}
```

Для QRC каждый namespace должен быть уникален. Root `reference-catalog` задаёт
полную политику exports/imports сайта. Core группирует результаты по `course.id`.
Части с общим course.id используют явную source identity `<project.id>/<source>`;
главная — `root/<source>`. Resource facts используют ту же source identity, сохраняя
реальный filesystem base для Body exports. Exercise/Assessment IDs внутри общего курса уникальны.
Разные форматы одного course.id не объединяются: Core отклоняет смешанный формат.
Полные модели сохраняются локально в `_generated/course-site/runs/<id>/`, вне сайта.

## Native поведение и ошибки

Полный native root render выполняет один `quarto render . --to <format>` каждой
части в постоянном исходном каталоге. Затем монтирует её свежие outputs, ресурсы и
search; QRC строго связывает текущие HTML и объединяет search. `.quarto`, `_freeze`
и caches движков сохраняются. Текущий publishable output очищается перед сборкой.
Сборки одного изменяемого проекта одновременно не поддерживаются.

Компонентный selected render/preview остаётся локальным. У корня выбранная
единственная `index.qmd` и первоначальный preview без output могут иметь native
полный scope и собрать части. Для просмотра без автоматического root rebuild
используйте `quarto preview --no-watch-inputs`; YAML `watch-inputs: false` не заменяет
этот CLI flag на проверенных версиях. Собственного preview server/watchers нет.

Ошибка любой native команды прекращает сборку. Retry создаёт новый run, прежние
records не используются; rollback не выполняется. Core results и post-hook records
описывают текущие данные, а успешность всей сборки подтверждает exit code native
команды, включая пользовательские hooks после course-site. Не публикуйте результат
ошибочной команды. `quarto publish --no-render` публикует уже имеющийся результат и
не выполняет новую проверку.

## Проверка

```bash
quarto run tests/site-paths.ts
quarto run tests/site-profiles.ts
quarto run tests/site-collection.ts
quarto run tests/site-native.ts
quarto run tests/site-domains.ts
quarto run tests/site-formats.ts
quarto run tests/site-local.ts
```

Domain suite устанавливает полные payloads через настоящий `quarto add` из соседних
checkout `quarto-course-capture` и `quarto-reference-catalog`; пути можно задать через
`COURSE_CORE_PROVIDER` и `QRC_PROVIDER`. Preview suite:
`quarto run tests/site-preview.ts <fixture-path>` после site-native suite. Для выбора
Quarto используйте `QUARTO=/absolute/path/to/quarto`; `XDG_CACHE_HOME` разделяется
между версиями, но сохраняется между командами одного сценария.
`COURSE_BUILD_TRACE` задаёт JSONL файл времени и exit codes inspect/render.

Native local hooks with an empty public output list do no collection or release finalization. This lets Quarto serve an existing preview without claiming a new successful native render.

## Версии и обновление

Релиз `v3.0.1` соответствует версии в `_extension.yml`. Устанавливайте явный тег, как в команде выше, и сохраняйте установленные файлы `_extensions` в Git курса. Для обновления установите следующий опубликованный тег через `quarto add`, проверьте diff и выполните проверки курса. Опубликованные теги неизменяемы: исправления получают новую версию и новый тег.
