# course-site: составной сайт из native проектов Quarto

Действующие правила: [индекс спецификаций](spec/index.md) и [контракт Publisher](spec/contract.md).
Текущий ref — кандидат **5.2.0**. Полный GREEN CI и публикация кандидата
ещё не подтверждены. Версия
определяется descriptor; код и документация опубликованного выпуска читаются
из одного immutable tag. Минимум — Quarto 1.11.5. Конфигурацию проверяет исполняемый TS-контракт владельца. Локальная разработка устанавливает расширение штатным
`quarto add` из согласованного checkout производителя.

После публикации версия 5.2.0 устанавливается из существующего
репозитория `quarto-project-publish`:

```bash
quarto add Afonenko-Course-Tools/quarto-project-publish@v5.2.0
quarto render --profile student
quarto preview --no-watch-inputs
quarto publish gh-pages --profile student
```

После публикации нового тега установка из GitHub выполняется командой
`quarto add Afonenko-Course-Tools/quarto-project-publish@v5.2.0`. Наличие тега
и готовность установленного курса проверяются отдельно.

Используйте фактический installation prefix, показанный `quarto add`. Ниже пути
для локальной установки без namespace. При установке GitHub добавьте namespace
между `_extensions/` и именем расширения. Core, QRC и course-site должны быть
установлены рядом в одном namespace корневого проекта. Компоненты устанавливают
собственные Core/QRC для самостоятельного render и preview.

Корневой `_quarto.yml`:

```yaml
lang: ru
fail-if-warnings: true
project:
  type: website
  output-dir: _site
  render: [index.qmd]
  pre-render: _extensions/course-site/entrypoints/pre.ts
  post-render: _extensions/course-site/entrypoints/post.ts
format: html
subprojects: [theory, slides]
```

У каждой части есть собственный `_quarto.yml`, native `output-dir` и post-render hook `../_extensions/course-site/entrypoints/collect.ts`: после QRC
и перед Core post-hook, если Core подключён. Например:

```yaml
lang: ru
fail-if-warnings: true
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
с выбранным student/full профилем требует эту же аудиторию у native частей;
при custom/default профилях согласованная аудитория следует effective конфигурации.
Несогласованные `course.view` или native `course-core-projection` дают
`SITE.AUDIENCE_MISMATCH` до очистки и child render. Расширение использует
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
[course-core]`. Для явного экспорта `course.id` задаётся один раз в корне
логического курса. В выбранной native книге банк включается отдельно через
`exercise-bank: true`; имя папки и `course.id` его не включают. Для ссылок
установите `reference-catalog`, добавьте
его фильтр и `reference-catalog.namespace`. Корневой course-site hook сам вызывает
Core native-pre/native-post и QRC full; дополнительные Core pre/post hooks в корне не нужны.
В частях настройте:

```yaml
lang: ru
fail-if-warnings: true
project:
  type: website
  output-dir: _output/default
  pre-render: _extensions/course-core/entrypoints/pre.ts
  post-render:
    - _extensions/reference-catalog/entrypoints/post.ts
    - ../_extensions/course-site/entrypoints/collect.ts
    - _extensions/course-core/entrypoints/post.ts
filters: [course-core, reference-catalog]
course: {view: full}
reference-catalog: {namespace: theory}
```

Для QRC каждый namespace должен быть уникален. Root `reference-catalog` задаёт
полную политику exports/imports сайта. Core проверяет результаты каждого native проекта.
Каждая часть сохраняет самостоятельную область нативных ID и свой QRC namespace.
`course.id` в корне обозначает логический курс для явного экспорта выбранного
банка; путь публикации и namespace не заменяют эту идентичность. Коллекции outputs и отчёты публичных операций самостоятельных частей сохраняются в
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

Текущий кандидат 5.2.0 сохраняет main наблюдение/preview и публичный B3 путь.
Точные контрольные commits Core/QRC/Download/C задаются [CI](.github/workflows/ci.yml)
того же Git ref. Целевой договор — Core 9 и PrairieLearn 9; старые матрицы не
подтверждают новую пару. Core включается через `filters: [course-core]`, старый
runtime-флаг не обязателен. Реальный CI, установка и публикация проверяются отдельно.

```bash
quarto run tests/performance.ts
quarto run tests/performance-context.ts
quarto run tests/site-project-native.ts
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


Локальные hooks с пустым списком текущих результатов не собирают коллекцию и не завершают release. Так Quarto может обслуживать существующий preview, не объявляя новую успешную сборку.

## Версии и обновление

Версия определяется descriptor того же Git ref. Текущий ref описывает кандидат 5.2.0;
изменения предыдущих выпусков сохранены ниже и в истории Git.
Документация и код выбранного выпуска читаются из одного ref.
Сохраните установленные `_extensions` в Git курса; при обновлении просмотрите diff и выполните проверки курса. Опубликованные
теги неизменяемы: исправления получают новую версию и новый тег.

## Готовая демонстрация

`examples/course` содержит один минимальный native курс: книгу, сайт с HTML/Revealjs, профили full/student и общий bibliography. Core необязателен; QRC включён явно. По умолчанию демонстрация full. Готовый результат выпускается asset `composite-course.tar.gz`; шаблон получает его по закреплённому Release URL, без автоматической пресборки.

## Метрики производительности

Значимые операции и явные обходы AST размечены локальным фасадом ABI 1.
В обычной сборке (`off`, по умолчанию) фабрики возвращают исходные функции:
агент, hooks, часы телеметрии и журналы не загружаются. Расширение самодостаточно.
Сбор метрик включается launcher проекта `quarto-course-performance`; установка
`COURSE_PERF_MODE` сама по себе агент не загружает и не обеспечивает валидные данные.
TypeScript использует wall time, Lua — CPU процесса; шкалы анализируются раздельно.
Counters обходов не являются числом посещённых AST-узлов.

Прежний `COURSE_BUILD_TRACE` удалён; для новых измерений используются фасады ABI 1.
Копии `observability/bridge.ts` и `bridge.lua` синхронизируются из проекта Performance.
Фасад сохраняет ABI 1 и передаёт `attributes.extension_id: "course-site"`.
`document_id` остаётся необязательным: пакетные compose, publish и
`addressNavigation`, обрабатывающие несколько outputs, не выбирают один
произвольный документ. Эта разметка не означает полного семантического
покрытия функций Publisher и не добавляет общий runtime.

Только при активном контексте агента граница дочерней команды передаёт полный
снимок окружения с явными переопределениями через `childEnv` и `clearEnv: true`. Рабочие переменные
сохраняются, а удалённый устаревший `COURSE_PERF_PARENT_SPAN_ID` не наследуется
повторно. Контекст родителя относится к текущему активному span.
При identity-ответе фасада (`off`, отсутствующий агент или недоступное чтение
режима) сохраняются прежние env overrides, native inheritance и разрешения:
полное чтение env и `clearEnv` не добавляются. Проверка
`quarto run tests/performance-noenv.ts` сохраняет исходные scoped permissions.

## Постоянная навигация и входы из индексов

Для Reveal подключите независимые filter/plugin `course-navigation` и задайте
`course-navigation.links` в native проектной конфигурации. URL-пути `href`
начинаются с `/`; `scope: project` ведёт в свою часть, `scope: course` — в общий
сайт. При самостоятельной сборке общий публичный корень задан через
`course-navigation.course-url`, совпадающий с `website.site-url` общего сайта.
Publisher вычисляет адреса полной композиции по текущим outputs.

Штатные `index.html` открывают реальные презентации текущей native сборки в
новой вкладке. Отдельный список целей не нужен. В standalone это обеспечивает
существующий `collect.ts`, подключённый последним post-render hook; metadata
репозитория остаются авторскими и используются native HTML source/issue actions.
Точные границы: [контракт](spec/contract.md). Нейтральная browser-проверка:

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:browser
```

`COURSE_CORE_PROVIDER` задаёт checkout с поставляемым `course-navigation`;
fixture устанавливает пакеты целиком, использует локальный HTTP и проверяет
student/full, composition/standalone, source/issue и сохранение индекса.

Native HTML navbar/sidebar могут использовать абсолютные общие course href.
В standalone они сохраняются; в полной композиции Publisher переводит только
native navigation anchors внутри базы `course-navigation.course-url` либо
`website.site-url` корня к текущему сайту. Обычные ссылки в содержимом и GitHub
repo-actions сохраняются. Верхнеуровневые `repo-*` для Reveal и native
`website`/`book` с теми же YAML anchors задают единый авторский контекст.

Browser CI использует Node 26.10.0, Playwright 1.62.1 из собственного lockfile
и закреплённый этой версией Chromium. Для локального готового браузера можно
задать `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; `CODEX_PRIMARY_RUNTIME_NODE_MODULES`
остаётся необязательным способом выбрать установленный набор Node packages.
Проверка включает directory URL реальной презентации (`deck/`) с query/fragment
и сохранением исходной вкладки, наряду с отрицательными сценариями.

## Исправление 5.1.1

Очистка предыдущего результата учитывает явно объявленные ресурсы из
`quarto inspect`, включая README. Необъявленные исходники и служебные
каталоги в output по-прежнему блокируют очистку; границы и запрет symlink
сохраняются. Core владеет правилами публичной и закрытой выдачи.

Явное объявление ресурса не разрешает очистку QMD, Rmd, notebooks и YAML
в output. Исключение для скопированных Markdown-ресурсов не меняет эту защиту.

## Исправление 5.1.2

Историческое исправление 5.1.2 согласовывало префиксы глобальной модели.
Текущий Core 9 использует отдельную операцию каждого владельца с local sources;
Publisher монтирует outputs и не переписывает эти sources. Project origins,
common files и check metadata остаются в области исходного owner. Прежняя
source-extraction проверка заменена настоящим installed public API контролем;
см. [карту миграции](tests/legacy-harness-mapping.md).

## Кандидат 5.1.5: повторная очистка Markdown

Необъявленный Markdown, скопированный Quarto по ссылке, допускается при очистке
только при наличии обычного безопасного source-файла с тем же относительным
путём вне output и точным совпадением bytes. Исходный файл сохраняется.
Отсутствующий, иной, не regular или symlink counterpart остаётся отказом;
прежние qmd/ipynb/Rmd/yaml и служебные/cache защиты не меняются.
Это доказательство восстанавливаемой копии, а не privacy/currentness публикации.
Новые manifests, global source walks и private Quarto API не вводятся.

## Общее меню курса

При `course-navigation.enabled: true` Site вызывает публичную композицию
Navigation из того же namespace установленных расширений. Установите согласованный
комплект Course с `course-navigation/public.ts`. В корне и HTML-компонентах
включите `filters: [course-navigation]` и `website.navbar: {}` либо `book.navbar: {}`.
Состав берётся из `subprojects`; отдельный список ссылок не нужен.
Правила standalone и явно заданных авторских ссылок сохраняются без включения
общей композиции. Подробности: [контракт](spec/contract.md#общее-меню-курса-unreleased).
