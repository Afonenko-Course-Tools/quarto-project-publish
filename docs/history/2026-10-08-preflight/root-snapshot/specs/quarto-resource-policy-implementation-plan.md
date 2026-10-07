> Исторический материал общего каталога. Актуальный маршрут: [план от 8 октября 2026](../quarto-course/docs/plans/2026-10-08-course-tools-implementation.md).
> Этот каталог не Git-репозиторий: нужные решения и исходные снимки сохранить у владельцев до очистки.
> Старые версии, ограничения публикации и статусы реализации не являются действующим контрактом.

# Производный ресурсный индекс и интеграция owner-session

> Для исполнителей: применять superpowers:subagent-driven-development; требования этапа уже согласованы, дополнительное интервью нужно только при нерешаемой семантической развилке.

**Цель:** заменить ручную ресурсную политику установленного consumer проверенным результатом той же попытки HTML-задачника, с одним выполнением движка.

**Архитектура:** Core разделяет prepare → native observation → finish и выводит ресурсные факты из нативного Pandoc AST. CUE определяет доступность; TS отвечает за файлы, пути, хеши и согласованность сессии. Publisher остаётся общим coordinator; минимальный контекст output позволяет использовать его обычный member render. Template связывает проверенные результаты с QRC, Print и штатным Download/ZIP.

**Стек:** существующие Quarto/Pandoc Lua, TypeScript/Deno, CUE, стандартные filesystem/crypto и зрелая библиотека/штатный инструмент ZIP.

**Спецификация:** общий план v59, §9 и §15; execution/next-production-resource-scope.md; execution/owner-session-design.md; execution/resource-policy-design.md. Этот файл уточняет техническую реализацию уже разрешённого этапа.

## Общие ограничения

- Один текущий авторский контракт, документация и примеры русские.
- Между книгами только QRC, без прямых include/copy чужих авторских QMD.
- Все исходники открыты; student/full управляет производными outputs.
- Нативные CLI/hooks/metadata/Pandoc AST; без своего Markdown/glob/ZIP parser, private Quarto API/cache и новой системы фаз/регистров.
- CUE — предметные predicates; потребители не повторяют их в TS.
- STYLE только предупреждает; новый blocking warning-channel не вводится.
- Только текущий PDF, без teacher PDF/архива выдач/Beamer/LMS импорта в этом этапе.
- Один настоящий запуск engine; captures используют --no-execute. No-execute не отключает hooks и shortcodes.
- Первоначальный owner support: HTML, ровно student либо full. Нет молчаливой поддержки дополнительных профилей/фильтров или произвольных зависимостей.
- Незавершённая resource closure, universal A9, адресный preview и временный native portal output не объявляются решёнными этим ограниченным этапом.
- Основные ветки/реальные курсы не изменять, PR оставлять draft, не объединять и не публиковать релизы.

## Точки ревью

1. Отсутствующий/повреждённый metadata handoff, locator, guard receipt либо неверный attempt/profile не превращает активную проверку в выключенную.
2. Общий публичный ресурс, встречающийся в закрытых заметках, остаётся разрешённым; closed-only baseline не получает молчаливого расширения через вычисленный публичный фрагмент.
3. Include effective base и одинаковые basename не объединяют разные источники; никакой подстановки dirname(include) вместо native root QMD.
4. Native-generated image/request lifecycle не отключает freeze всех авторских файлов или всего _generated.
5. ZIP paths/bytes, сырые service packages, переименованные копии и неполные observations проверяются до commit; finalizer failure сохраняет другие профили.

## Task 1: Встраиваемая owner-session

**Worktree:** worktrees/core-resource-policy, base 310b3c6118768bef4d62b2d3a771b5d387197d9d.

**Файлы:** owner-preflight/owner.ts и маленький session module при необходимости; owner-preflight/filter.lua; entrypoints/owner-{freeze,reconcile}.ts; infrastructure/hooks.ts; filter.lua; docs/owner-preflight.md; новый tests/owner-session.ts и прежний tests/owner-preflight.ts.

**Интерфейсы:**
- prepareOwner(root: string, options: {attemptId: string; profile: 'student' | 'full'; extension?: string}) → Promise<PreparedOwner>.
- activateOwner(prepared: PreparedOwner, options?: {output?: string}) → Promise<Record<string, unknown>>: готовая metadata overlay для обычного native render; идентичный locator для последнего freeze-hook.
- finishOwner(prepared: PreparedOwner) → Promise<OwnerResult>: проверка полного набора текущих observations и frozen bytes, без render.
- Standalone runOwner сохраняет текущий результат/error shape и использует эти же функции.
- PreparedOwner экспортируется как проверяемый handle со связью owner/attempt/profile/session hash; точные поля документировать после реализации, consumer не формирует их вручную.

- [x] Проверить чистую baseline установленного owner-preflight; фиксировать реальные версии и исключённые платформенные сценарии.
- [x] Написать red native test: prepare не исполняет cell, metadata handoff + обычный render + finish исполняет ровно один раз; отсутствие любой стороны handoff/receipt, stale result либо wrong profile не дают успешного finish.
- [x] Реализовать split без второй копии Publisher snapshot, global Deno.env и второго render. Сессия/locator/metadata/receipts строго связаны с текущими root, inputs, profile и invocation; present malformed state — ошибка.
- [x] Нативно подтвердить точную цепочку [course-core, course-presentation, project-download], включая скрытый full-only shortcode. Capture сохраняет raw facts и не передаёт скрытые requests downstream; generated requests обрабатываются только как точно принадлежащие Download, не blanket exclusion.
- [x] Подтвердить output override из доверенного caller, freeze до engine при source mutation, отсутствующий callback и отсутствие рекурсивного Core check.
- [x] Повторить covering suite, прежний owner-preflight/обычную activation, оформить docs и commit. Результат — отчёт с командами/red/green и фактическими границами, независимое ревью.

## Task 2: Минимальный контекст Publisher

**Worktree:** worktrees/publish-owner-context, base 40c043e542467c1e9b482e785fe99be8b330b5b0.

**Файлы:** domain/model.ts RenderContext, infrastructure/render.ts, tests/stages.ts и docs контракта/README.

**Интерфейс:** RenderContext.output: string — фактический абсолютный output текущего member, переданный его native render. Metadata files принадлежат конкретному build attempt, не общему namespace/index.

- [x] Red test: metadata callback получает точный output, отличный от source; две попытки с одной namespace используют разные overlay paths.
- [x] Добавить output и перенести overlays в существующий attempt directory. Никакого знания Core, нового env callback, нового этапа или смены порядка finalize.
- [x] Подтвердить stages и прежние publication/profile/PDF сценарии; commit и независимое ревью.

## Task 3: Нативные resource facts и CUE policy

**Worktree:** worktrees/core-resource-policy после Task 1.

**Файлы:** небольшой owner-preflight/resources.lua, resources.ts и resource-policy.cue; вызовы из existing filter/session lifecycle; tests/owner-resources.ts; docs/owner-preflight.md.

**Интерфейсы:** OwnerResourceIndex содержит owner root, attempt/profile/session identity, canonical owner-relative paths, SHA-256, source/generated/service origin и подтверждённые употребления. validateOwnerResources(prepared, options?: {selections?: string[]}) → Promise<OwnerResourceIndex>, доступно только после успешного finish; source/index bytes повторно проверяются перед использованием. Capture и actual observations используют одну нативную модель фактов.

- [x] Red cases: public+closed usage одного файла, closed-only файл, include/root base и одинаковые basename, permitted generated image, вычисленная ссылка на closed baseline, service package selection.
- [x] Извлекать Link/Image и разрешённые употребления штатными AST walks и существующей grading/visibility projection; не копировать её предикаты в TS и не добавлять авторский ресурсный YAML.
- [x] CUE валидирует факты, public union, closed-only ограничения и диагностику. Уже известный closed-only baseline не повышается до public через поздний вычисленный link; новая разрешённая иллюстрация допустима. Неизвестная невидимая private dependency без поддержанного selected adapter contract даёт unsupported, а не выдуманную приватность из имени каталога/profiles.
- [x] TS разрешает подтверждённые local targets по native effective base, проверяет containment/symlink/bytes; external/data/anchor не становятся filesystem paths. Canonical QMD/include и raw service package не выдаются как starter source; отдельный resource-QMD и unlinked starter files не запрещаются только из-за отсутствия AST ссылки.
- [x] Проверять native resources/configResources по назначению до member render, actual resources после engine и inputs/config/session hashes перед выдачей. Generated boundary узкая, без исключения всех _generated/source dirs.
- [x] Covering tests + native installed archive, docs/supported subset/unsupported cases, commit и независимое ревью. Неподтверждённые carriers/closure остаются явными техническими gate.

## Task 4: Установленный consumer и связанные draft PR

**Worktree:** worktrees/template-resource-policy, base b69ad0a46920bfadcc54dc877dd4d91f923f8e29.

**Файлы:** новый production resource probe/integration; installed test и workflow; fixture owner config/последний freeze-hook; current artifact bridge использует полученный index вместо ручного deniedProfiles. Существующая ручная fixture сохраняется только как историческая отрицательная проба и не выдаётся за production.

**Потребление:** Task 1 prepare/activate/finish и Task 3 validateOwnerResources; Task 2 RenderContext.output. Параметры и refs фиксируются exact commit/tree; installed extension проверяется по составу/байтам.

- [x] Red native consumer: Core-derived policy в student/full, один настоящий cell запуск, полный путь QRC → Print → штатный Download/ZIP на одной попытке; ручного policy.json в этом пути нет.
- [x] Thin beforeRender/metadata/finalize integration сохраняет attempt-bound reference, потому что finalize загружает модуль заново. Не вызывает runOwner. Другие members не получают owner metadata.
- [x] Ранний native selection gate, текущие hashes и поздний финальный gate обычных файлов/ZIP entry names+bytes. Использовать зрелый ZIP reader/штатный инструмент; nested unknown archives unsupported. PDF создаётся до ZIP, отказ не выдаёт старый результат за текущий.
- [x] Negative: closed/service resource, renamed private copy в ZIP, поздний private link, source/config/session mutation, missing observation; positive: общий публичный ресурс, разрешённый generated image, полный starter с не связанными ссылками файлами.
- [x] Stable/pre-release matrix на окончательных installed trees, один независимый whole-delivery review. Дополнительные проверки только при новом дефекте/изменении.
- [x] Создать связанные draft PR Core поверх #9, Publisher поверх #1, Template поверх #8. Обновить общий план фактическими доказательствами и остаточными gate; сохранить отчёт/замеры.

## Порядок и решения реализации

Tasks 1 и 2 работают в разных репозиториях и могут выполняться параллельно без общего изменяемого состояния; Task 3 следует за reviewed Task 1, Task 4 — после стабильных интерфейсов 1–3. Ревью каждой темы и финальных стыков обязательны.

Не вводится общий author private-dependency contract ради одного отрицательного fixture. Полнота невидимых adapter dependencies — отдельный gate; в текущем этапе поддерживаются факты нативного AST и известная принадлежность служебных артефактов. Если тест обнаруживает carrier без доказуемого происхождения, реализация его отклоняет и фиксирует границу.

## Task 5: Публичная граница служебного состояния Download

Добавлена по независимому ревью Task1: Core не должен читать имя/JSON внутренней заявки Download и самостоятельно удалять private transport. Это уточнение реализации принятого запрета на недокументированные возможности, без новых авторских требований. Task5 завершает исправление Task1 до его ресурсной интеграции.

**Worktree:** worktrees/download-ownership, base e00f34a40308380263d119c522e5c18a9381817b.

**Файлы:** _extensions/project-download/ownership.ts, README и focused native tests; прежняя авторская конфигурация/формат ZIP не меняются.

**Интерфейсы:** inspectOwnedRequests(root,sources) → protocol1/root/directory/files(path,source,resources,sha256), clearOwnedRequests(root,sources) → Promise<void>. Источники берутся из проверенных native inputs; provider владеет знанием transport и отвергает symlink/foreign/malformed entries. Core получает только подтверждённую mutable directory и вызывает public cleanup. Отсутствующий API даёт unsupported, не fallback на private JSON.

- [x] Native installed red→green, проверка current bytes/обычных requests/empty state/foreign/dangling symlink/точной очистки, прежние public сценарии.
- [x] Документировать provider-owned contract по-русски; отдельный scoped review и draft PR, exact pin в Core/Template CI.
- [x] Закрыть замечание Task1 о dangling active locator через lstat до fallback; устранить scratch absolute default в тесте.
- [x] Task1 scoped re-review после native регрессий; затем release ресурсной интеграции Task3.

Чистые новые CUE/resource modules Task3 могут готовиться во время review, без изменения shared lifecycle files, staging или commit. Связанная native интеграция остаётся после reviewed Task1+Task5.

## Уточнение: публичный runtime Presentation

Фактическая native сборка выявила необходимый provider adapter: Quarto копирует объявленные Presentation CSS/JS в публичный HTML, хотя сырые extension sources остаются service и не должны попадать в Downloads. Исключение по SHA, имени JS либо `site_libs` недопустимо. Это уточнение реализации существующего контракта, без нового авторского требования.

Одна публичная `course-presentation/html-dependency.json` является объектом настоящего `quarto.doc.add_html_dependency`, включая документированные marker attributes. Core замораживает descriptor, registration и source bytes и выводит отдельный CUE `runtimeEligibility`; обычный raw `allowed:false` сохраняется. Core observer, выполняющийся раньше Presentation, не объявляет свидетельство будущего вызова.

Consumer использует зрелый HTMLParser для текущего HTML каждого member: точные marked script/link, собственная установленная копия provider, фактический локальный destination и текущие SHA-256. Разрешение относится только к этому проверенному обычному файлу выдачи. Оно никогда не распространяется на ZIP, utility или произвольную переименованную копию с тем же hash. Неизвестные runtime carriers, трансформация/minification и transitive dependency closure остаются unsupported.

Native проверки запускаются последовательно на фактических stable/pre-release launcher и child. Обнаруженная конкуренция инициализации штатного runtime до начала теста не считается успешной проверкой и не исправляется обращением к private cache/importmap.

## Проверка окончательных refs — историческая запись до восстановления

Текущий итог находится в разделе «Восстановление в ChatGPT Work» ниже. Pending Task4 в этой и следующей записи относятся к прежнему checkpoint.

Core #10 local f0d2fc75 / remote 09f1967 / tree 8b99c66 reviewed после test-only CI follow-up. Все окончательные workflows зелёные: baseline 36908586206, strict real R/Jupyter 36908586237, owner/resource 36908586149 на Quarto 1.10.18 и 1.11.5. Legacy include/resource test теперь подтверждает canonical identity + CUE запрет raw selection до activation; true root/include ambiguity сохранена. Computed table использует results:asis, native plot — отдельную обычную display cell. Provider/API bytes неизменны.

Task4 заканчивает локальную actual stable полную пробу с сохранением выполненных случаев и installed file-byte revalidation после resume. Окончательная двухканальная матрица выполняется в strict CI с закреплёнными provider refs; повторная широкая локальная prerelease матрица перед той же remote проверкой не требуется. Локальный prerelease успех не объявляется. CI — обязательный gate, при отказе нужны scoped исправление/review и повтор затронутых проверок.

Focused native inspect объяснил отказ broad materials/**: full профиль дополнительно выбирает output student профиля, resources 15→27; Core корректно отклоняет изменённый frozen audit. Anchored ./materials/** или concrete local file и проверка inspect обоих профилей сохраняют штатный механизм без нового parser/registry/STYLE gate.

## Историческая точка продолжения и scoped review — 1 октября 2026

Все 16 local stable случаев Task4 прошли в трёх сегментах 4+5+7. Local prerelease не заявляется; uninterrupted aggregate сохранности другого профиля требует default двухканального CI. Template source checkpoint local `e3d6c6c56a19576f40e8ce3282a44ea591d87aad` сохранён в remote `acca8e73c3237bac8a3e91c7f1789ad04521b114`, ветка `feat/core-resource-consumer`; exact tree `fa18a818bda04d096d3e78f020625fae54e14895`, base remote parent #8 `a0997b67a64cd3f79ee0769ff804dd66523bb534`. Это checkpoint, не approved final consumer и пока не новый PR.

Task4 detailed review подтвердило два Important дефекта. Первый: starter file с target, совпадающим с Print PDF/resource, перезаписывает utility bytes и expected ZIP map. Требуются отказ от коллизии до copy и независимая ZIP→Print receipt/hash связь. Второй: повторный Core validator создаёт retained CUE transport после ранней service snapshot, поэтому exact renamed copy такого selected transport проходит старый final byte audit. Требуются current service bytes из известной Core-owned area после каждого successful validator и сохранение/rebinding текущего attempt без потери ранее добавленных Print receipts. Focused actual CUE/checkBytes RED воспроизведён, scoped fix выполняется. Авторских решений или новой policy/registry не нужно; Core provider API не меняется.

После scoped red→green нужны отдельное re-review этого delta, повторное interface review стыков, fast-forward remote checkpoint, draft Template PR и обязательный default strict CI на final refs. Не повторять уже принятые provider suites или все локальные 16 случаев без нового повода. Планы, refs, уже выполненные проверки и готовая инструкция новому Codex CLI сохраняются отдельно; текущие live agents/processes не являются переносимым контрактом.


## Восстановление в ChatGPT Work и Template draft PR — 1 октября 2026

Сохранившаяся изолированная рабочая копия проверена: local HEAD `0dc8f2d1459f4143463d8a7459227a5635d25c01`, tree `b03662d8bc02fb544bd9d9441cfb943f73aaa568`, tracked status чист. Коммиты `0048744` и `0dc8f2d` исправили оба Important дефекта и ложную коллизию `current.pdf`; прежнюю реализацию не повторяли. Scoped и whole-interface review на этом дереве Approved. Fresh archive/runtime и actual Print ZIP guards прошли; TS formatting/diff проверены. Общая проверка Markdown formatting не является проектным gate; широкий локальный fmt --check дополнительно обнаружил только переносы строк README, исходник не менялся.

Через fast-forward закреплён remote `2ce3a29cca93ca5a12a19f2210e5a79377ab9b23` с точным совпадением проверенного tree. Создан [Template draft PR #9](https://github.com/Afonenko-Course-Tools/quarto-template-course/pull/9) поверх `feat/artifact-consumer`/#8. Основные ветки и реальные курсы не менялись; merge/release не выполнялись.

Обязательная непрерывная CI завершилась успешно на этом remote HEAD: [resource consumer 36924132423](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/36924132423), [historical installed 36924132201](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/36924132201), [baseline 36924132240](https://github.com/Afonenko-Course-Tools/quarto-template-course/actions/runs/36924132240). Все три workflows — success. Default resource matrix прошла по 19 сценариев на фактических Quarto 1.10.18/1.11.5: пять разрешённых сборок/восстановлений и 14 ожидаемых отказов, без resume/skip/smoke. Независимый аудит завершённых логов подтвердил exact head/tree/provider pins, текущие artifact bytes, один owner engine и непрерывную сохранность полного набора файлов/SHA другого профиля. Historical installed — 13 сценариев + четыре guards на каждом канале; baseline student/full и external/check tests успешны. Task4 и весь ограниченный resource implementation plan завершены; весь общий план остаётся открытым.

Остаточные production-body/inventory/closure/A9/A11/portal/LMS gates общего плана сохраняются. Причина сбросов среды не установлена; перенос в Codex CLI для завершения текущей поставки не потребовался.


### Следующая техническая граница: портал

После source/review closure Task4 выполнена отдельная временная native feasibility проба P2, без изменения продуктовых репозиториев. Stable 1.10.18 подтвердил пустой outer render-set и один portal child внутри attempt output; public child/file events отсутствовали при успехе и намеренном finalizer отказе. Native profile route работает и сохраняет авторские config bytes. Прямой excluded-file render с --output-dir отказывает; metadata-file overlay не меняет render-set. Broad glob захватывает generated profile; native negative selection исключает его.

Отчёт `managed-portal-probe.md` и small command/events/hash JSON сохраняются вместе с доказательствами. Product portal API, actual owner-child checks, root QRC capture, arbitrary hooks/profile composition, ownership/preview/failure и prerelease gates остаются открытыми. Эта проба не расширяет claim ресурсной поставки и не завершает P2.
