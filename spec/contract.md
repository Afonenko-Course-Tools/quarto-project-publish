---
type: contract
component: publisher
status: current
---

# Контракт Publisher

Текущий ref: **5.2.0** (unreleased); версия пакета задаётся
`_extensions/course-site/_extension.yml`.

Корень native проекта объявляет непустой `subprojects: [paths]`; структуру и файловые границы проверяет
[исполняемый TS-контракт](../_extensions/course-site/infrastructure/config.ts). Каждый путь относительный и обозначает папку
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

В Core 9 Publisher сохраняет отдельную genuine operation каждого владельца.
Источники в catalog/proof/document остаются относительными к этому owner:
например, root, `part` и `nested/second` имеют собственный `index.qmd` и разные
operation identities. Mounted URL получает путь компонента в конечном сайте;
этот URL не переписывает Core source, project root или raw check metadata.
Прежняя глобальная модель с префиксами `projects[].source` снята с текущего пути.
Guarded project contexts/materialization принадлежат public API Core; C проверяет
собственные check facts. Publisher не вводит свой параллельный model DTO.

Quarto определяет отказ native команды. Успешный stderr сам по себе не является
ошибкой; собственные и foreign ошибки сохраняют ID, оба потока и cause.
Strict warnings задаются штатным `fail-if-warnings` каждого публичного child
проекта. Подробные ID и действия — [диагностика](../docs/diagnostics.md),
подключение и команды — [README](../README.md).

## Банк и выбранная проекция

Область канонических задач включает native `exercise-bank: true` и эффективную
политику `statement-visibility: open|restricted`. У каждого `#exr-*`
свои обязательные difficulty/time; вне области остаётся обычный Quarto.
Страницы работ могут находиться вне банка. В выбранной книге сохраняется одна
экспортная идентичность; Publisher не объединяет самостоятельные проекты.

Student outputs не содержат restricted условий и их ссылок назначений, решений
обычных open задач, закрытых ключей и заметок преподавателя. Mounted resources,
HTML, search и каталоги QRC следуют той же текущей проекции. Гарантия ссылок
назначений проверяется реальным explicit assignment/P producer; ordinary
`.task-items` fixture не заменяет эту квалификацию и может сохранить неразрешённый
ID скрытой задачи без её Body. Обязательный открытый all135 gate описан в
[карте проверок](../tests/legacy-harness-mapping.md#обязательная-открытая-проверка-qualified-task-slots). Full использует
свой отдельный output. Native `repo-actions: [source]` ведёт к GitHub; source modal
и копирование raw QMD с закрытыми телами в student output не включаются.

У каждого публичного native проекта явно заданы `lang: ru` и
`fail-if-warnings: true`. Корневой CLI-флаг строгости не наследуется дочерними
scripts. Source JSON pass Core сохраняет самостоятельную политику предупреждений.
[Демонстрация](../examples/course/README.md) показывает Publisher/QRC без Core;
канонический банк для этого обычного native курса не требуется.

## Выходы Reveal и входы из индексов (unreleased)

Авторский фильтр `course-navigation` сохраняет в готовом Reveal JSON-контекст
постоянных ссылок: `text`, `href`, `scope` и URL-путь `path` от корня области.
Publisher меняет только `href` у `scope: course` на путь от текущего HTML к
корню композиции. Адреса `project` и репозитория сохраняются. Каталог размещения
вычисляется из текущего native output, без заданного количества `../` и без
публичных машинных путей. Авторские `repo-*`, профили и metadata не заменяются.

В standalone `course-navigation.course-url` задаёт публичный корень общего
курса, совпадающий с `website.site-url` общего сайта при его наличии.
`course-navigation.links[].href` задаётся как URL-путь с ведущим `/`, например
`/index.html` или `/theory/index.html`; это защищает авторские адреса от native
перебазирования относительных строк metadata по существующим файлам.
`scope: project` обозначает самостоятельный проект, `scope: course` — общий
сайт. Это адресные действия, а не новая карта учебных связей; QRC остаётся
владельцем конкретных межпроектных ссылок.

Только ссылки из штатных HTML индексов `index.html` на реальные Reveal HTML текущей сборки
получают `target="_blank"` и `rel="noopener noreferrer"` в браузере. Правило
исполняется после разрешения native/QRC href, учитывает query/fragment,
вложенные каталоги, переименованные outputs и URL-префикс публикации.
Обычные страницы и остальные адреса сохраняют поведение. Повторная обработка
не дублирует скрипт. Дополнительный список презентаций не вводится.

В полной композиции правило учитывает общие и дочерние текущие outputs.
Самостоятельный `collect.ts` также применяет правило к текущим native outputs,
даже без `COURSE_SITE_COLLECTION`. Hook с пустым текущим списком остаётся пустым;
сохранённые outputs другой попытки не становятся новыми целями. Для standalone
подключите collect после QRC и перед Core post-hook, если Core включён. Полная сборка проекта собирает
его индекс и презентации вместе; selected render не объявляет старые файлы
текущими результатами.

Для native HTML navbar/sidebar авторские общие выходы задаются абсолютными
HTTP(S) href от общего публичного корня. В полной композиции Publisher использует
корневой `course-navigation.course-url` либо `website.site-url` и переводит
только anchors native `#quarto-header`, `#quarto-sidebar`, `.quarto-navbar`,
`.quarto-sidebar`, совпавшие с origin и префиксом pathname этой базы, к текущему
корню результата. Нативное сокращение `index.html` в URL каталога сохраняет смысл
перехода. Standalone сохраняет публичные href. Обычные content/QRC anchors и
GitHub repo-actions не перебазируются; native metadata не меняются.

Quarto не передаёт проектные `website`/`book` в Lua metadata. Для Reveal общие
`repo-*` сохраняются также на верхнем уровне авторского YAML, а native
`website`/`book` ссылаются на те же значения через YAML anchors. Это один
авторский контекст репозитория; Publisher не вводит runtime metadata overlay.

Сам Reveal-документ с именем `index.html` не считается HTML индексом: его
внутренние ссылки на слайды сохраняют штатное поведение.

Для известного текущего Reveal output `deck/index.html` URL каталога `deck/`
также является входом в презентацию, включая query и fragment. Алиас вычисляется
только для реальных Reveal `index.html`, с той же проверкой origin; обычные
HTML каталоги и внутренние ссылки самой презентации сохраняют поведение.

## Исправление 5.1.1

Очистка предыдущего результата учитывает явно объявленные ресурсы из
`quarto inspect`, включая README. Необъявленные исходники и служебные
каталоги в output по-прежнему блокируют очистку; границы и запрет symlink
сохраняются. Core владеет правилами публичной и закрытой выдачи.

Явное объявление ресурса не разрешает очистку QMD, Rmd, notebooks и YAML
в output. Исключение для скопированных Markdown-ресурсов не меняет эту защиту.


## Публичная native операция B3

Текущий production compose использует Core/QRC/Download public modules и
штатные Core native CLI phases, как описано в
[публичной композиции](../docs/public-operation.md).
QRC/Navigation завершают HTML до Core native-post; ZIP создаётся один раз после
назначения final Pages base и успешной owner fence, сразу в конечном mount.
Posthoc ZIP rewriting не вызывается. Core catalog проверяет текущие роли и outputs;
Publisher сохраняет отдельные owner scopes и не объединяет самостоятельные курсы.

Effective per-document course/assessment/adapter гарантии проверяет Core
validateRelease и actual C public validator в той же operation. Root config не
заменяет этот proof. Отсутствующий validator даёт owner ADAPTER_UNQUALIFIED;
coarse SITE.RELEASE_UNQUALIFIED остаётся course без native Core. Ordinary proof
не предоставляет assignment intent. Открытый generated-resource + release
membership blocker перечислен в packet; полный выпуск не квалифицирован.
Исторические host finalize-conditions/helper удалены. Conditions ZIP создаёт
Download один раз из текущего Core inventory после окончательного назначения
адресов; чтение и повторная упаковка старого ZIP больше не поддерживаются.

## Контекст наблюдения (5.1.4, unreleased)

Канонический фасад сохраняет ABI 1 и добавляет к операциям
`attributes.extension_id: "course-site"`. Контекст `document_id` необязателен;
пакетные compose/publish и `addressNavigation` сохраняют общий контекст без
выбора одного документа из списка outputs. Это не меняет адресацию навигации,
состав текущих outputs и авторские metadata.

Только при активном контексте агента полный снимок окружения с явными
переопределениями проходит через `childEnv` и `clearEnv: true`. Поэтому удалённый устаревший
`COURSE_PERF_PARENT_SPAN_ID` не восстанавливается повторным наследованием Deno,
а рабочие переменные сохраняются. Parent context берётся из текущего активного
span. Identity-ответ (`off`, отсутствующий агент или недоступное чтение режима)
сохраняет исходные env overrides и native inheritance без нового полного чтения
env и без `clearEnv`; прежние разрешения не расширяются. Фасад сохраняет
исходные функции, Promise и переданное ему окружение. Новый общий runtime и полное семантическое покрытие Publisher
не заявляются.


Publisher до очистки output и child render проверяет student/full audience:
`course.view` корня и native компонентов и их `course-core-projection` должны
соответствовать выбранной аудитории (student → student, full → author).
Для custom profiles аудитория следует effective root view/projection; generic
nonCore компонент не обязан объявлять Core проекцию. Несогласованность даёт
`SITE.AUDIENCE_MISMATCH` с полем `course.view` или `course-core-projection` и
не изменяет предыдущую выдачу. Проверка не добавляет обхода источников или
собственной модели учебных данных.

## Общее меню курса (unreleased)

`course-navigation.enabled: true` в корне включает публичную композицию
`course-navigation/public.ts` → `composeNavigation`. Site передаёт `stage`,
текущие `outputs`, название сайта и участников `{id, mount, title}` из native
конфигурации и `subprojects`, начиная с корня. Компоненты без web-формата
не требуют HTML-входа и не добавляются в меню; полностью пустой web-результат
не изменяется. Отрисовка меню и оформление
принадлежат Navigation и теме; Site не импортирует их внутренние модули.
Вызов происходит после QRC и перед Core post-hook и окончательным созданием ZIP.
Это сохраняет привязку завершаемой операции к фактическому HTML.

Корень и HTML-компоненты должны включать фильтр Navigation и пустую штатную
navbar в `website` или `book`; Reveal подключает plugin. Результат использует
относительные ссылки, текущие индексные заголовки и порядок `subprojects`.
Без явного включения и в standalone действует прежний `addressNavigation`.
Пакет Navigation требуется только при включённой полной композиции; отсутствие
его публичного входа выдаёт `SITE.SIBLING_MISSING`, ошибки владельца сохраняются.

Для общей темы HTML выберите `format: course-theme-html` из того же комплекта
Course. Копии `styles/offline-fonts.scss` в каждом проекте больше не нужны.
Согласованная установка и проверка обоих профилей находятся в
`tests/site-composed-navigation.ts`.
