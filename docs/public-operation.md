# Публичная native композиция Publisher

Core проверяет каждый effective document/course/assessment через текущий
validateRelease, включая metadata только из QMD без root course. Actual C public
validator выполняет свой business договор. Catalog coverage сама по себе proof
не заменяет. Course без активного native Core сохраняет SITE.RELEASE_UNQUALIFIED;
обычный noCore Publisher остаётся независимым.

Core 9 использует native TS по умолчанию: при `filters: [course-core]` старый
`course-core-runtime: native-ts` не обязателен. Это выбирает технический маршрут,
но не заменяет текущую операцию, проверку outputs или release proof Core.
Явно чужой runtime и недопустимая проекция отклоняются. В дочернем проекте
`collect.ts` должен завершить HTML перед Core post-hook, который фиксирует
окончательные outputs; изменение HTML после фиксации остаётся ошибкой.

Publisher открывает модули нужного owner в том же installed namespace. Child
operation нельзя проверять validator другого root только потому, что parent
импортировал собственный Download. Проекты не склеиваются в одну course identity.
Полная коллекция сохраняет exact expectedDocuments source/format и ordered
native profiles; op expectation и фактические outputs проверяются вместе.

Root с native-ts использует только Publisher pre/post. Publisher вызывает
штатные Core native-pre/native-post; после pre при установленном C вызывает его
public prepareNativeAdapter. Raw C filter должен быть подключён до Core early.
Root начинает Core после child renders. Для нескольких существующих sequential
child calls public withNativeCaptureScope объединяет их той же generation;
нового render или metadata parser не добавляется. Каждый child collect завершает
HTML/Navigation до его Core post. Child Download post deferred.

QRC и root Navigation заканчивают HTML до root Core post. Затем public Download
создаёт ZIP непосредственно в final mount после child final fence. Child native
output не переписывается. Plain source→output URLs, self-download и fragment
resources назначаются до единственного README writer/упаковки. Production compose
не вызывает posthoc conditions ZIP mutation.

composition.json сохраняет nativeOperations с public catalog, release proof и
числом validation passes. У owner с Download выполняется один проход: без PL —
Core `validateRelease`, с установленным PL — public C `inspectPublication` с
настоящим Core proof. Selected PL отражён в `proof.validatedAdapters`; ordinary
publication проверяет metadata/assessment/project/common sources, не запускает
полную grading composition и не даёт assignment прав.

У owner без Download сохраняется отдельный Publisher маршрут: NoPL — один Core
проход; selected PL — Core с actual C descriptor и затем actual C.validateCourse,
два прохода. `root-pl` проверяет этот путь отдельно. Метрики before/after явно
сохраняют дополнительные local fences; actual tests проверяют отсутствие нового
inspect/discovery/hash.
Ordinary proof не выдаётся за assignment intent или квалификацию exporter.

`tests/site-owner-release.ts` использует actual root/child hooks, temporary
installed layout и current Core/C public APIs. Его случаи: per-document mixed
course, invalid test policy, missing validator, noPL/PL positive, HTML full,
condition-only, default kind, reveal owner/resources, ordinary reveal model отказ,
sequential captures и coarse inactive-course gate. Final mounted README, suffixes,
anchors, privacy и exact source coverage проверяются в этих случаях.

Текущий ref остаётся кандидатом: полный Java/SP, установленный состав, CI и
публикация проверяются отдельно. Исторические host finalize-conditions и reader
старого ZIP удалены: Publisher больше не переупаковывает готовый архив и не
принимает legacy receipt вместо текущей операции. Гарантии и действующие
проверки перечислены в [карте переноса](../tests/legacy-harness-mapping.md).

Full fixture с kind=full не квалифицирует произвольный Java bank: explicit
kind=starter в author получает DOWNLOAD.STARTER_UNQUALIFIED. Сохраняется отдельный
actual negative; typed assignment student condition/поддержанный маршрут и actual
early/full135 должен принять ROOT. Production не запускает extra render и не
переносит opaque ZIP между operation для обхода этой границы.
