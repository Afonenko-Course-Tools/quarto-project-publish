# course-site: составной сайт из native проектов Quarto

Расширение устанавливается из существующего репозитория `quarto-project-publish`:

```bash
quarto add Afonenko-Course-Tools/quarto-project-publish@v4.0.1
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
subprojects: [theory, slides]
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

`subprojects` — непустой список относительных путей папок. Адрес части совпадает
с её нормализованным путём: `a/slides` публикуется в `a/slides/`. `./tasks` и
`tasks` обозначают одну часть и не могут входить в список вместе. Вложенные
пересекающиеся проекты, symlink и пересечение источников/outputs запрещены.
Прежняя конфигурация `course-site.projects`, `id`, `format` и `mount` удалена.
Служебное имя части выводится из пути и не является экспортным ID задания.

Профили `_quarto-student.yml` и `_quarto-full.yml` задают **native**
`project.output-dir`: в корне `_site-student` / `_site-full`, в частях
`_output/student` / `_output/full`. При использовании Course каждый профиль также
задаёт `course.view: student` / `full` в Course-проектах. Корень без Course metadata
берёт ожидаемый view каждого домена из разрешённой конфигурации его частей;
каждая часть выбирает собственную согласованную проекцию view. Расширение использует
`quarto inspect` для разрешённой конфигурации и передаёт выбранные профили в том же
порядке. Пересекающиеся output разных audience отклоняются до удаления файлов.
Если корень не выбирает профили, части сохраняют собственные native defaults,
environment и группы. Точный `QUARTO_PROFILE` нативного post-render сохраняется
в коллекции и ожиданиях Core, включая профили без YAML-файла. `files.config`
не используется для определения профилей: обычные metadata-files могут иметь
такое же имя. До cleanup проверяются разрешённые native student/full outputs:
они должны быть непересекающимися. При неизвестном implicit audience выбранный
output может точно совпадать с одной из этих проекций; частичное пересечение
отклоняется. Явный audience или разрешённый course.view также проверяется
против output другого audience.
Все выбранные исходные документы проверяются на containment и symlink перед
документным inspect, cleanup Publisher и рендером частей.

## Core и QRC

Модули опциональны. Для курса установите `course-core` и укажите `filters:
[course-core]`. Для явного экспорта course.id задаётся один раз в корне. Для ссылок установите `reference-catalog`, добавьте
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
course: {view: full}
reference-catalog: {namespace: theory}
```

Для QRC каждый namespace должен быть уникален. Root `reference-catalog` задаёт
полную политику exports/imports сайта. Core проверяет результаты каждого native проекта.
Каждая часть сохраняет самостоятельную область нативных ID и свой QRC namespace.
`course.id` в корне обозначает логический курс для явного экспорта выбранного
банка; путь публикации и namespace не заменяют эту идентичность. Полные
модели самостоятельных частей сохраняются локально в
`_generated/course-site/runs/<id>/`, вне сайта. Core не объединяет несвязанные
задания разных частей в один экспортный банк.

## Native поведение и ошибки

Полный native root render читает эффективный формат каждого выбранного документа
через `quarto inspect` с теми же профилями. Website может сочетать HTML и Revealjs;
front matter, directory metadata и пользовательские форматы сохраняют native смысл.
Два веб-формата одного документа отклоняются с предложением выбрать профиль.
HTML и PDF одной конфигурации не считаются двумя веб-форматами.

Обычная часть рендерится один раз без общего `--to`. Если у документов также
есть невеб-форматы и выбранный веб-формат первый, используется native
`--to default`; книга с единственным веб-форматом может выбирать его через
`--to`. Если website требует разных выбранных форматов и веб-формат не первый,
сборщик рендерит выбранные документы native командами, каждый один раз, и
сохраняет текущие outputs каждой команды. PDF и другие невеб-результаты не
создаются в этой веб-сборке: их собирают отдельно штатным `quarto render --to pdf`
или функциональным профилем. Часть только с одним невеб-форматом остаётся
самостоятельным native маршрутом готовых файлов.

Свежие outputs, ресурсы и search монтируются по путям папок; QRC строго связывает
текущие HTML и объединяет search. `.quarto`, `_freeze` и кеши движков сохраняются.
Текущий publishable output очищается перед сборкой. Сборки одного изменяемого
проекта одновременно не поддерживаются.

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

Для строгости предупреждений задайте штатный параметр каждого самостоятельного
публичного проекта — корня, книги и материалов:

```yaml
fail-if-warnings: true
```

Общий файл с этой настройкой можно подключить через существующий `metadata-files`
каждого проекта. Корневой `quarto render --fail-if-warnings` действует на свою
команду: этот CLI-флаг не наследуется дочерними процессами scripts. Publisher
использует native конфигурацию ребёнка. Если его `pandoc.log.warn` становится
ошибкой, composition прекращается до монтирования и фиксации итогового результата.
Политика JSON-экспорта Core остаётся самостоятельной.

Собственные ошибки Publisher имеют устойчивый ID, русский смысл и доступные
проект, документ, компонент, поле, связанные пути и действие автора.
[Справочник диагностики](docs/diagnostics.md) принадлежит этому расширению.
Внешний отказ Quarto сохраняет код завершения, stdout/stderr и исходную причину;
при передаче потоков вывод появляется один раз. Ошибки Core/QRC сохраняют свои
ID и причины. Неизвестная внутренняя ошибка сохраняет stack для отладки.

## Проверка

```bash
quarto run tests/site-paths.ts
quarto run tests/site-profiles.ts
quarto run tests/site-child-profiles.ts default
quarto run tests/site-child-profiles.ts group
quarto run tests/site-metadata-profiles.ts
quarto run tests/site-source-paths.ts
quarto run tests/site-collection.ts
quarto run tests/site-process.ts
quarto run tests/site-siblings.ts
quarto run tests/site-native.ts warnings
quarto run tests/site-native.ts
quarto run tests/site-domains.ts
quarto run tests/site-formats.ts
quarto run tests/site-effective-formats.ts
quarto run tests/site-web-selection.ts
quarto run tests/site-local.ts
```

Domain suite устанавливает полные payloads через настоящий `quarto add` из соседних
checkout `quarto-course` и `quarto-reference-catalog`; пути можно задать через
`COURSE_CORE_PROVIDER` и `QRC_PROVIDER`. Preview suite:
`quarto run tests/site-preview.ts <fixture-path>` после site-native suite. Для выбора
Quarto используйте `QUARTO=/absolute/path/to/quarto`; `XDG_CACHE_HOME` разделяется
между версиями, но сохраняется между командами одного сценария.
`COURSE_BUILD_TRACE` задаёт JSONL файл времени и exit codes inspect/render.

Локальные hooks с пустым списком текущих результатов не собирают коллекцию и не завершают release. Так Quarto может обслуживать существующий preview, не объявляя новую успешную сборку.

## Версии и обновление

Релиз `v4.0.1` соответствует версии в `_extension.yml`. Устанавливайте явный тег, как в команде выше, и сохраняйте установленные файлы `_extensions` в Git курса. Для обновления установите следующий опубликованный тег через `quarto add`, проверьте diff и выполните проверки курса. Опубликованные теги неизменяемы: исправления получают новую версию и новый тег.

## Готовая демонстрация

`examples/course` содержит один минимальный native курс: книгу, сайт с HTML/Revealjs, профили full/student и общий bibliography. Core необязателен; QRC включён явно. По умолчанию демонстрация full. Готовый результат выпускается asset `composite-course.tar.gz`; шаблон получает его по закреплённому Release URL, без автоматической пресборки.
