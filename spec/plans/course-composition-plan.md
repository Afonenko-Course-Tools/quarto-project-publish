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
