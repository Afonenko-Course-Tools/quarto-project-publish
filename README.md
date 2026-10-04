# Составная публикация Quarto

Расширение собирает несколько проектов Quarto, размещает результаты в едином сайте и позволяет выпускать PDF-раздатку вместе с книгой и слайдами. Оно не требует учебной модели, QRC, темы БГУ или платформ оценивания.

## Установка и включение

```sh
quarto add Afonenko-Course-Tools/quarto-project-publish
```

Команды установки из GitHub создают каталоги `_extensions/Afonenko-Course-Tools/…`; пути обработчиков ниже учитывают это пространство имён. Локальная установка из checkout может создавать короткие пути `_extensions/reference-catalog/…` и `_extensions/project-publish/…`; такие пути используются в локальных тестах и примерах и должны соответствовать фактическим установленным каталогам.

Установка пассивна. Обработчики включаются явно в `_quarto.yml`:

```yaml
project:
  type: website
  output-dir: _site
  render: []
  pre-render: _extensions/Afonenko-Course-Tools/project-publish/entrypoints/pre.ts
  post-render: _extensions/Afonenko-Course-Tools/project-publish/entrypoints/post.ts
project-publish:
  home: book
  projects:
    book: {path: book, format: html}
    lectures: {path: lectures, format: revealjs}
    handouts: {path: handouts, format: pdf}
```

Каждый подпроект содержит собственный `_quarto.yml`. `home` выбирает HTML-проект с `index.html` и размещает его в корне. У остальных `mount` по умолчанию совпадает с именем; его можно задать явно. Формат по умолчанию — `html`; допустимы `html`, `revealjs`, `pdf`. PDF-подпроект публикует только PDF, без HTML-копии документа, LaTeX и промежуточных файлов.

При отсутствии `home` корневой проект самостоятельно создаёт `index.html`; перечислите его QMD в `project.render`. В корневом проекте исключайте исходники подпроектов из `project.resources`, если используете широкие шаблоны ресурсов. Не включайте `*_site*`, `.project-publish`, `_generated` и другие результаты в ресурсы.

Координатор при явно включённом `pre-render` очищает текущий `output-dir` целиком. Не храните там ручные файлы. Остальные профили не изменяются. Неудачный `render` не гарантирует сохранение предыдущего выходного каталога; предпросмотр хранит отдельный снимок последней успешной публикации. Корневой `--output-dir` поддерживается только как имя вложенного каталога проекта, например `_preview`; путь наружу отклоняется до очистки.

Ссылка из домашней книги: `[Скачать раздатку](handouts/topic.pdf)`. Из слайдов, размещённых в `lectures/`: `[Скачать раздатку](../handouts/topic.pdf)`. Вложенные страницы используют обычные относительные пути. PDF-файлы не коммитятся: их создаёт текущая сборка. Для формата `pdf` требуется доступный движок LaTeX, настроенный в подпроекте.

## Управляемый портал

Для новой страницы навигации, которая публикуется только после общих проверок, включите `portal` вместо `home`:

```yaml
project:
  type: website
  output-dir: .project-publish/native
  render: []
  pre-render: _extensions/Afonenko-Course-Tools/project-publish/entrypoints/pre.ts
  post-render: _extensions/Afonenko-Course-Tools/project-publish/entrypoints/post.ts
format: html
project-publish:
  portal: index.qmd
  output-dir: _site
  projects:
    book: {path: book, format: html}
```

`portal` выбирает один обычный QMD в корне; child создаёт `index.html`. Каталоги исходников подпроектов и публичный результат не должны пересекаться. `project.output-dir` обязательно равен `.project-publish/native`: это отдельная служебная область stock Quarto. Окончательный каталог выбирает `project-publish.output-dir`, одно имя внутри корня. Audience profile задаёт, например, `project-publish.output-dir: _site-student`; исходные root/profile configs сохраняются побайтово. `portal` несовместим с `home`. Без `portal` прежний native-root/home режим и его правила очистки остаются прежними.

Поддержанный запуск с проверкой до stock cleanup:

```sh
quarto run _extensions/Afonenko-Course-Tools/project-publish/entrypoints/render.ts --profile student
```

Обёртка передаёт настоящие stdout и stderr native render в соответствующие потоки CLI по мере сборки. Перенаправление `> render.log 2>&1` сохраняет оба потока; успешная сборка с выводом только в stderr тоже оставляет непустой журнал. Вызовы `inspect` и `--version` остаются внутренним capture для разбора данных. Native warning и ненулевой exit по-прежнему приводят к отказу с исходной диагностикой и кодом дочерней команды в сообщении.

Обёртка принимает только необязательный `--profile` с comma-separated именами и запрещает `--output-dir` и другие native overrides **до запуска render**. Обычный `quarto render --profile student` с декларативной private конфигурацией также допустим. Прямой stock вызов с публичным `--output-dir` не обеспечивает сохранность прежнего выпуска: Quarto очищает выбранный output раньше pre-render, поэтому отказ из hook уже опоздает. Symlink и каталоги storage/output в другой файловой системе отклоняются при preflight; используйте обёртку, чтобы проверить их до native cleanup.

Координатор готовит принадлежащий попытке native profile `publish-portal` только в snapshot, проверяет actual render selection через `quarto inspect` и фиксирует SHA-256 control и подключённых config files. Native `inspect.files.config` определяет подключённые файлы; bundled `stdlib/yaml` читает в них только декларацию `profile`, чтобы отклонить зарезервированное имя, которое Quarto убирает из effective config. Собственного YAML merge, profile selection или glob parser нет. Авторский `_quarto-publish-portal.yml`/`.yaml`, включение этого имени в profile groups/default или его ручной выбор запрещены. Дополнительный profile действует только на portal child; owner audience и profiles участников сохраняются. Его control исключается из native resources. При широком `resources: ["**/*"]` авторские исходники/configs тоже могут быть выбраны Quarto: их разрешённость проверяет интеграция владельца ресурсов. Publisher не вводит учебную политику видимости.

Текущий portal output начинает чистый private stage; затем размещаются участники и выполняются ordered finalizers. До commit новый public не создаётся. Отказ beforeRender, portal/member render или finalizer сохраняет полный набор файлов и bytes прежнего выпуска и другого профиля. Failed stage→public rename восстанавливает backup прежнего выпуска. Если само восстановление отказало, ошибка указывает сохранённый `.project-publish/output-<attemptId>`; cleanup и следующий render не удаляют этот recovery backup. Восстановите его явно перед новой попыткой. После успешного commit отказ удаления старого backup сохраняет новый выпуск и сообщает путь оставшегося backup.

Поддерживается один активный render на root. Hooks и интеграции — доверенный код: свои записи они делают в attempt outputs или stage. Два rename при commit допускают краткий промежуток отсутствия public; crash recovery и произвольные параллельные записи не являются частью этого договора. Дополнительные author hooks могут выполняться в outer и portal child; `PROJECT_PUBLISH_MEMBER=1` отмечает child и предотвращает повторный запуск entrypoints координатора.

Для managed preview настройте команду относительно private native output:

```yaml
project:
  preview:
    watch-inputs: false
    serve:
      cmd: "quarto run ../preview.ts --port {port} --host {host}"
      ready: "Публикация предпросмотр готов"
```

Preview пересобирает managed сайт через тот же preflight. При отказе он продолжает отдавать последнюю успешную страницу и сохраняет текущий опубликованный выпуск.

## Профили

`quarto render --profile student` передаёт выбранные профили всем подпроектам. Каждый подпроект обязан иметь соответствующий `_quarto-student.yml`; отсутствие считается ошибкой. Файлы могут содержать только `metadata: {}` при отсутствии отдельных настроек. Выходные каталоги всех профилей исключаются из снимка исходников и публикации; собственные промежуточные данные лежат в `.project-publish/`.

## QRC по выбору

```yaml
project-publish:
  integrations:
    - _extensions/Afonenko-Course-Tools/reference-catalog/entrypoints/publication.ts
  # home и projects — как выше
reference-catalog:
  exports:
    book: "*"
```

QRC устанавливается отдельно. Интеграция передаёт его фильтры HTML-подпроектам и разрешает ссылки после сборки всех страниц. PDF-проекты остаются обычными файловыми ресурсами.

## Предпросмотр

Для составного сайта добавьте явно:

```yaml
project:
  preview:
    watch-inputs: false
    serve:
      cmd: "quarto run ../.project-publish/preview.ts --port {port} --host {host}"
      ready: "Публикация предпросмотр готов"
```

`quarto preview` показывает последнюю успешную сборку и пересобирает сайт при изменении исходников. При ошибке открытая страница сохраняется.

## Архитектура и проверки

`domain/contract.ts` содержит допустимые форматы, поля и типы ресурсов; `domain/model.ts` — интерфейсы. `application/workflow.ts` определяет подготовку и завершение сборки через порты. Адаптеры файлов, Quarto и публикации находятся в `infrastructure`; CLI — в `entrypoints`. Зависимостей от других расширений нет.

CUE-определение текущей конфигурации находится в `spec/publication.cue`; проверка `tests/schema.ts` сверяет его с допустимыми форматами TypeScript.

Интеграция экспортирует по умолчанию объект с одним или несколькими обработчиками `beforeRender(context)`, `metadata(context)`, `finalize(context)` и необязательным `onFailure(context)`. Договор определён интерфейсом `Integration` в `domain/model.ts`.

Все обработчики получают `root`, `sourceRoot`, `attemptId`, `profiles`, `config`, `members`. `root` — исходный корень проекта; `sourceRoot` — отдельный снимок этой попытки. Каждый `members[].path` указывает в снимок. Профили и эффективная конфигурация фиксируются перед сборкой; каждому вызову передаются отдельные копии данных. Модули интеграций и их относительные импорты также загружаются из снимка. `metadata` участника дополнительно получает `namespace`, `format`, `output` — фактический абсолютный каталог результата текущего подпроекта, переданный его native render через `--output-dir`. Это не путь исходников и не итоговый каталог публикации. Metadata overlays хранятся в каталоге конкретной попытки `.project-publish/builds/<attemptId>/`, поэтому повторные сборки одной namespace не перезаписывают overlays друг друга; `finalize` — `stage`, `quarto` (версия Quarto).

В managed режиме каждый context дополнительно содержит `portal: {input, output, renderProfiles, control, controlHash, configHashes}` — фактические абсолютные пути и native selection текущего child. Portal вызывает `metadata` с `format: html`, собственным `output` и **без member namespace**; интеграция использует собственный configured root namespace. Member callbacks сохраняют прежнюю семантику. Portal selection подготовлена до `beforeRender`, control и configs проверяются повторно перед render и commit.

Сначала выполняются все `beforeRender` в порядке списка интеграций. Их отказ останавливает попытку до рендера первого подпроекта. Затем для каждого подпроекта вызываются `metadata` и обычный Quarto render. После сборки корня и всех подпроектов каждый `finalize` выполняется в том же порядке: он может проверять или дополнять общий `stage`. Например, проект может перечислить владельца правил ресурсов, QRC, адаптер PDF, упаковку ZIP и проверку результата. PDF-адаптер после QRC должен находиться после него в списке; обычные PDF-подпроекты из `projects` продолжают собираться независимо до финализации.

Интеграции — доверенный код проекта. Они не должны менять чужие исходники или запускать дополнительную публикацию. Правила видимости ресурсов, учебная модель и способы получения PDF/ZIP принадлежат соответствующим интеграциям: координатор их не определяет.

`onFailure` позволяет сохранить ограниченную диагностику текущей попытки во внешний каталог. Зарегистрированные обработчики вызываются в порядке интеграций и ожидаются до удаления снимка или private stage при отказе подготовки, metadata, portal/member render, сохранения состояния, preview, staging, finalizer или commit. Контекст содержит отдельную копию обычных данных и `failure: {phase, operation, error: {name, message}}`; `namespace`, `format`, `output`, `stage` передаются, когда известны. Возврат обработчика игнорируется. Все обработчики выполняются даже при отказе одного из них, затем выполняются откат и очистка. Исходная ошибка сохраняется первой причиной; ошибки диагностики и очистки добавляются в `AggregateError`. Диагностические файлы не подтверждают успешную сборку и не дают разрешений владельца ресурсов.

Обработчик регистрируется после загрузки интеграций из снимка. Начальные ошибки конфигурации, копирования, inspect или загрузки модулей до регистрации, аварийное завершение процесса, отказ позднего outer hook после успешной очистки и ошибка в ходе успешной очистки не покрываются этим callback. Повреждённое сохранённое состояние отклоняется до загрузки обработчиков.

При возобновлении попытки список обработчиков проверяется до импорта модулей: выбранные профили должны совпадать с текущим запросом `QUARTO_PROFILE`, а штатный `quarto inspect` должен подтвердить интеграции из конфигурации самого снимка. Изменение текущей корневой конфигурации не заменяет этот список. Если проверка отказала, обработчики не импортируются; ошибка проверки добавляется к исходному отказу, затем выполняется разрешённая очистка. В одной текущей попытке используется закрытая регистрация уже загруженных интеграций. Поля `failure.error` всегда содержат отдельные строки; объектные значения нестандартной ошибки заменяются безопасным описанием, а исходные значения ошибок сохраняются в причинах итогового отказа.

Перед финализацией координатор проверяет, что профиль, конфигурация и выходной каталог соответствуют подготовленной попытке. При их изменении нужен новый render. Отказ финализации или замены каталога удаляет stage, снимок, состояние и предварительный выходной каталог этой попытки; другие профили сохраняются. Повреждённое сохранённое состояние отклоняется до операций с принадлежащими ему путями. Старое неполное состояние следует заменить новым render.

При native корневом портале Quarto создаёт предварительный `output-dir` перед вызовом post-render. Это не гарантирует отсутствие временно доступных файлов до финализации. Очистка относится к отказам координатора и его интеграций; аварийное завершение процесса или ошибка самого корневого render, при которой post-render не вызван, требует нового render для очистки.

```sh
quarto run tests/schema.ts
quarto run tests/process-cli.ts
quarto run tests/profiles.ts
quarto run tests/publication.ts
quarto run tests/portal.ts
quarto run tests/stages.ts
quarto run tests/managed-portal.ts
quarto run tests/failure-hooks.ts
quarto run tests/failure-error-values.ts
quarto run tests/native-failure-diagnostics.ts
```

`tests/publication.ts` проверяет сборку без QRC/Core, HTML, Reveal, настоящие PDF и профили. `tests/portal.ts` проверяет повторную публикацию, переход от домашней книги к порталу, изменение размещения и корневой CLI `--output-dir`. `tests/stages.ts` проверяет точный output в metadata, изоляцию overlays двух попыток одной namespace, порядок обработчиков, отдельные копии контекста, загрузку модулей из снимка, отказы до и после render, изменение профиля/конфигурации/вывода и безопасное отклонение повреждённых путей состояния. Его маркеры финализации не заменяют проверку реальных PDF/ZIP в потребителе. Интеграция с QRC проверяется в его репозитории. Исходный код перенесён из `quarto-reference-catalog`; авторство и лицензия сохранены в истории Git.

`tests/managed-portal.ts` проверяет actual native root selection и один проход тела, ресурсы, metadata portal/member, неизменность configs, populated releases при отказах before/child/member/outer/finalizer, отсутствие ранних public events, rollback/backup recovery, control/config/state drift, symlink guards, profile conflicts, CLI preflight и HTTP preview с последним успешным снимком.

`tests/failure-hooks.ts` проверяет порядок диагностики и очистки, отдельные контексты, ошибки обработчиков и восстановление публикации с явно обозначенным тестовым CLI. `tests/native-failure-diagnostics.ts` устанавливает расширение и проверяет настоящие portal/member child отказы после Pandoc: точные входные bytes и JSON тела сохраняются до очистки, два прежних профиля сохраняются без изменений. Эти диагностические тесты не являются приёмкой Core или исходного учебного корпуса.

`tests/failure-error-values.ts` проверяет строковый дескриптор и сохранение исходных причин при нестандартных JavaScript-ошибках, отказе rollback или логирования. Его CLI и состояния явно тестовые; настоящий Native не запускается.

`tests/process-cli.ts` запускает настоящий CLI Publisher с явно тестовым native executable: stderr-only и оба потока при успехе, вывод до завершения child, warning, ненулевой exit и сохранение внутреннего JSON capture. Это проверка границы потоков и ошибок; настоящий native render проверяют остальные интеграционные тесты.
