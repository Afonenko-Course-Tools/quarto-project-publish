> Исторический план/исследование. Актуальный маршрут от 8 октября 2026: [план владельца](../../docs/plans/2026-10-08-implementation.md).
> Исходный текст сохранён без правок; его старые статусы и конфликтующие правила не действуют.
> Нужные материалы сохранить в Git до удаления из активной ветки.

# Состав курса и нативные форматы Quarto

План слоя составной публикации в `quarto-project-publish`. В установленном курсе этот слой представлен прежним `course-site`; его пути не определяют организацию актуальных исходников. При начальном обновлении подтвердить владельца координатора и зависимости по актуальной ветке, затем выполнять изменения в публичном механизме публикации.

Общие решения, ограничения и порядок выпуска: [межрепозиторный план](../../../specs/course-change-plan.md). Перед изменением поведения — анализ актуальной архитектуры и необходимый рефакторинг. Поддерживается только актуальный авторский формат без обратной совместимости; публичные функции Quarto переиспользуются. Код, спецификации, README и примеры обновляются согласованно в соответствующем PR.

### Этап 2 Простой состав курса и нативные форматы

- [ ] Ввести YAML-ключ `subprojects` со списком путей. Прежняя форма отклоняется без aliases и переходной поддержки.
- [ ] Выводить адрес размещения и служебную идентификацию подпроекта из нормализованного относительного пути; не использовать путь как устойчивый экспортный ключ задания. Отдельный `mount` не вводить.
- [ ] Читать эффективный формат каждого документа ребёнка с теми же профилями, с которыми он рендерится, и учитывать его front matter. Сохранять сочетание HTML и Revealjs внутри website и нативные ограничения book; не принуждать весь подпроект к одному формату через общий `--to`.
- [ ] Выбирать единственный веб-формат эффективной конфигурации документа; при нескольких веб-форматах у одного документа выдавать диагностику с предложением выбрать конфигурацию или профиль. HTML и PDF в одной конфигурации не являются неоднозначностью веб-сборки.
- [ ] Определять веб-форматы, включая пользовательские расширения, по нативной модели Quarto. Невеб-форматы собирать отдельным поддерживаемым маршрутом.
- [ ] Сохранить проверки пересечений источников и outputs до очистки каталогов.
- [ ] Сохранить сборку нативных книг и презентаций, связывание QRC и выбранную область общего поиска.
- [ ] Сохранять одни условия и устойчивые ID общих заданий в `student/full`. Дополнительные контрольные файлы определяются списками включения профилей; тип `control` сам по себе не удаляет упражнение из рендера или экспортного условия.
- [ ] Для книги вынести полные списки `book.chapters` в `_quarto-student.yml` и `_quarto-full.yml`, не оставляя объединяемый общий список глав в базовой конфигурации. Для website/default-проекта использовать `project.render` с учётом штатного объединения списков и правил исключения.
- [ ] Проверять состав ресурсов вместе с составом файлов: изображения и вложения контрольных, локальный full-site и LMS-пакеты не должны автоматически копироваться в студенческую публикацию.

Проверки результата: строковая и словарная форма `format`; профиль меняет формат; HTML-страница и Revealjs-документ в одном website; front matter переопределяет формат; два веб-формата одного документа; нативные форматы book; `a/slides` и `b/slides`; `./task` и `task`; вложенные пересекающиеся проекты; symlink; output внутри другого источника; переименование каталога; GitHub Pages с префиксом имени репозитория.

Самостоятельный рендер ребёнка может ограниченно откладывать ссылки на соседние проекты. Итоговая публикация должна проверять их полностью. QRC поддерживает ссылки в HTML и Revealjs; подготовка PDF или экспорт в платформу имеет отдельный маршрут.

Согласование ссылок: [план QRC](../../../quarto-reference-catalog/docs/plans/course-reference-plan.md).


## Архитектура и реализация 6–7 октября 2026

Актуальная база `v3.0.1` (`b88b572`) уже использует `_extensions/course-site`, постоянные исходные каталоги и native caches. Опциональные зависимости — sibling Core native-run/release/validate и QRC publish; старый publisher с overlays и owner-preflight отсутствует. QRC namespace остаётся авторским, независимым от папки. Публикация не объединяет самостоятельные области ID в экспортный банк.

- [x] Корневой `subprojects: [paths]`, нормализация адресов, служебный ID из пути; прежний `course-site.projects` отклоняется.
- [x] Эффективные документные форматы через публичный inspect с профилями/front matter/custom bases; диагностика двух веб-форматов.
- [x] Один native render части без общего --to для обычного смешанного HTML/Revealjs; native default/sole-web выбор для web+nonweb и редкий selected-file маршрут. Каждый документ рендерится один раз.
- [x] Текущие outputs и Core runs сохраняются после каждого успешного selected процесса; QRC получает общий свежий набор.
- [x] Сохранены проверки пересечений/символических ссылок до cleanup, уточнён native Reveal plugin.yml в site_libs для повторной сборки.
- [x] README, тесты и структурная CUE-схема мигрированы; QRC пример переведён на subprojects.
- [ ] Полная локальная матрица Core/QRC/course-site после согласованных изменений Core; затем review/CI, PR и выпуск.

Локально прошли paths/profiles/collection/effective-formats, нативные book + mixed website HTML/Reveal, smoke current outputs/assets/search и PDF-first nested QRC circular links. В последнем тесте trace подтверждает ровно один body render каждого выбранного документа, PDF не создаётся. Cache для локальных проверок — writable XDG_CACHE_HOME. HTTP-тесты требуют разрешённых локальных sockets. Релиз и push здесь ещё не выполнялись.

Демонстрационная группа examples/course проверена с установленной поставкой course-site4.0.0 и QRC2.2.0: root, book full3chapters, mixed HTML/Reveal2docs, общий bibliography, strict full QRC10links/6pages. Кандидат asset composite-course.tar.gz. Broad native-all, selected root local и Core/QRC domain smoke прошли; entrypoints прошли Deno typecheck, CUE и diff check. Финальный provenance/asset rebuild выполняется после merge на закреплённых зависимостях.

### Исправления независимого ревью, 7 октября

- [x] Native child profile.default/group больше не сравниваются с пустыми профилями корня: разрешённые profile files из публичного inspect используются для audience safety, точный post-render QUARTO_PROFILE — для коллекции, Core loading и assembleRelease. Дополнительные content-only профили без YAML сохраняются; неожиданный профиль с конфигурационным файлом отклоняется.
- [x] Все selected files проверяются на lexical containment, symlink каждого компонента и обычный файл до первого документного inspect и cleanup Publisher. Список берётся из native project inspect, который сам читает Markdown для определения selected inputs; собственный project.render/Markdown parser не добавлен.
- [x] Native regressions default full и group web/content с Core и без него воспроизвели ошибки до исправления; explicit external QMD symlink без Core воспроизвёл ошибочную успешную публикацию. После исправления regressions проходят; native collector сохраняет точные профили, финальный member release согласован с ними.

Проверки этого исправления: paths, audience profiles, collection, child default/group, source paths, effective formats, PDF-first mixed selection, native smoke и повторный formats; entrypoint typecheck/CUE/diff check. CI включает новые regressions. Полная межрепозиторная матрица и повторное независимое ревью остаются у координатора перед merge/release; push здесь не выполнялся.

### Повторное ревью: metadata-files и фактический native context

Прежний вывод configuredProfiles из files.config удалён: native project inspect включает metadata-files в тот же список и убирает само поле metadata-files; полного публичного способа отличить такие записи нет. Исключение по имени файла или собственный YAML profile parser не применяется. Теперь только фактический QUARTO_PROFILE native post-render определяет полный набор профилей коллекции/Core/release; явно переданные корневые профили должны присутствовать в том же порядке. Дополнительные native default/group профили, с YAML или без него, сохраняются как фактические данные нативного hook.

До cleanup audience safety сравнивает разрешённые native student/full output projections: пара должна быть непересекающейся, частичное пересечение selected output отклоняется. Если explicit audience или разрешённый course.view известен, selected output проверяется против другого audience. При неизвестном child default/group selected output может точно совпадать с одной канонической проекцией. Это сохраняет native default full без вывода профиля по названию metadata include. Список files.config больше не участвует в идентичности профилей.

Нативный RED: metadata-files [_quarto-shared.yml] без active profiles приводил к current collection mismatch. GREEN regression также включает audience-named _quarto-full.yml с output-dir и проверяет, что content-visible when-profile=full не активируется: два запуска сохраняют profiles []. Проверки canonical output pair/equality/partial overlap добавлены к audience suite. Default/group Core + plain child, collection explicit expectation, source symlink и mixed PDF-first route повторяются перед коммитом; CI включает metadata regression.

### Проверка CI-контракта Core 3, 7 октября

Сбой BODY.WORK_REQUIRED в site-domains resources подтверждён на чистой поставке: тест передавал два works producer без выбора. Проверка обновлена на явные sec-part/sec-second и courseId, по одному work/question/resource в каждом пакете; runtime Publisher не менялся. Буквальная последовательность всех 18 команд CI прошла локально целиком с exit 0 на Quarto1.11.5 за ~553с (9мин13с). Чистый layout содержит только Publisher4224cd2+исправление теста, Coreaa91437 (v3.0.0 source), QRCv2.1.0, без provider overrides. SHA256 установленного Core producer в root/part/second совпадает с источником aa91437. Пройдены full native/domain/resources/rootless, formats/local и оба preview. GitHub matrix1.10.18/1.11.5 требует повторного запуска после push координатором; локальная проверка не объявляет её зелёной.


### Выпуск и проверка 7 октября

PR 8 слит после полной локальной 18-командной native CI-матрицы (553 с) и обеих
успешных CI-проверок 1.10.18/1.11.5. Неизменяемый v4.0.0 опубликован из
1f5c0f3890b71c98fa500933e322e2d5cf4b7df0; компактный bundle установлен штатным
Quarto, draft assets скачаны и побайтно проверены до публикации. Независимая
ready-демонстрация demo-20261007 построена из того же чистого SHA на точных
релизных зависимостях;8 HTML/135 локальных ссылок проверены. BUILD и RELEASE
receipts сохранены в local-evidence/implementation-2026-10-06. Следующий шаг
потребителя — локальная финальная проверка документации и курса; Publisher
больше не требует изменений для этой миграции.

## План рефакторинга диагностики 7 октября 2026

**Цель:** ошибки составной сборки показывают компонент, путь, причину и действие,
сохраняя ID и исходный вывод зависимостей. **Архитектура:** entrypoints →
inspect/validate → child render/collection → copy → optional Core/QRC.
**Основание:** [общий план](../../../specs/course-change-plan.md#исследование-и-план-рефакторинга-7-октября-2026).
**Средства:** текущие Deno/Quarto, без общего error runtime. Для выполнения —
subagent-driven-development либо executing-plans по выбранному способу.
База main `1f5c0f3`; signatures pre/post/collect и optional sibling API сохраняются.

### S1 Ошибки configuration/path/current-result

Создать: `_extensions/course-site/infrastructure/diagnostics.ts` с локальной
`diagnostic(code, message, context?, cause?) → Error & {code:string}`.
Изменить: `config.ts`, `files.ts`, `collection.ts`, `application/compose.ts`.
Новые ID нынешних неименованных guards: `SITE.CONFIG_INVALID`,
`SITE.SUBPROJECT_INVALID`, `SITE.OUTPUT_OVERLAP`, `SITE.FORMAT_AMBIGUOUS`,
`SITE.COLLECTION_INVALID`, `SITE.CURRENT_RESULT_MISSING`, `SITE.SIBLING_MISSING`.

- [ ] Дополнить tests/site-paths.ts, site-source-paths.ts, site-effective-formats.ts,
  site-collection.ts: ожидаемый ID, project/input/output и поле; валидный вариант
  сохраняет текущие outputs. Symlink/overlap отклоняются до cleanup.
- [ ] Перевести сообщения существующих guards и передать доступный контекст;
  не менять path/format/profile предикаты или порядок операций.
- [ ] В module(name,path) отличить отсутствующий sibling от ошибки исполнения
  существующего модуля: сохранить cause, не объявлять любую ошибку отсутствием
  пакета. Ошибки Core/QRC не получать новый SITE ID вместо своего исходного ID.
- [ ] Каждый названный test выполнить как `quarto run tests/<имя>.ts`;
  ожидается PASS. Проверка изменений и отдельный коммит.

### S2 Однократный внешний вывод и hook boundary

Изменить: `infrastructure/process.ts`, `entrypoints/pre.ts`, `post.ts`, `collect.ts`;
tests: `tests/site-native.ts`, `site-domains.ts`.
`quarto(args,cwd,env={},forward=false) → Promise<string>` сохраняется.
Внутренний external failure хранит tool/exitCode/stdout/stderr и факт forwarding.

- [ ] Зафиксировать native child nonzero с различимыми stdout/stderr/ID:
  потоки сохранены, текст не повторяется при forward true, итоговая сборка
  не завершается успешно и не выдаёт старый результат за новый.
- [ ] Оформить узкую границу ожидаемых ошибок hook; неизвестные ошибки сохраняют
  stack. Не добавлять subprocess library или парсер stderr; public trace fields
  args/cwd/elapsedMs/exitCode остаются прежними.
- [ ] Выполнить native/domain проверки и существующие profile/web-selection
  regressions, без дополнительных child renders. Проверка изменений и коммит.

### S3 Штатная строгость самостоятельных публичных проектов

Изменить: README, примеры конфигурации; проверка: `tests/site-native.ts`.
Не добавлять course-site warning option, CLI forwarding engine или regex.

- [ ] Зафиксировать два сценария: корневой CLI `--fail-if-warnings` сам по себе
  не наследуется child process; native `fail-if-warnings: true` ребёнка с
  pandoc.log.warn даёт nonzero и прекращает composition до итогового результата.
- [ ] Объяснить автору native настройку каждого самостоятельного публичного
  проекта либо существующий shared metadata-files; root flag не обещает общей
  политики всех scripts. Не менять глобальную строгость CI инструментов.
- [ ] Проверить оба сценария на 1.10.18/1.11.5; installed Core source export
  сохраняет собственную JSON policy. Проверка изменений и коммит документации/регрессии.

### S4 Русский справочник и финальная матрица

Создать: `docs/diagnostics.md`; изменить: README, активные spec/руководства,
examples/course root/book/materials `_quarto.yml` и пояснения.

- [ ] Справочник содержит ID, доступный контекст и действие автора без invalid
  QMD. У самостоятельных demo-проектов задать lang ru; source и folder links
  используют native параметры выбранного выпуска, без переписывания HTML.
- [ ] Выполнить существующую CI-матрицу на обеих версиях с сохранёнными
  dependencies; standalone Publisher без Core/QRC и optional combined путь
  продолжают работать. Отрицательные fixtures остаются tests.
- [ ] Проверка изменений, PR и выпуск изменённого инструмента из проверенного merged SHA;
  новый demo release и pinned consumer выполняются по общему плану групп.
