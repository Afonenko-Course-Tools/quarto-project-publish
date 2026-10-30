# Публичная native композиция Publisher

Publisher получает Core documents/roles/output coverage через публичную текущую
operation. NativeRun, private adapters, assembleRelease/validateRelease и
posthoc conditions ZIP rewriting из production orchestration удалены.
Живые course/assessment/adapter гарантии не заменяются каталогом: конфигурация
`course` получает `SITE.RELEASE_UNQUALIFIED` до принятия executable owner TS proof.
Обычный Publisher без Core сохраняет самостоятельный маршрут.

Корень с `course-core-runtime: native-ts` использует только Publisher pre/post
hooks: Publisher вызывает штатные Core `entrypoints/native-pre.ts/native-post.ts`.
Он начинает root Core после дочерних render. QRC и Navigation завершают изменения
HTML до root native-post. Не подключайте второй независимый Core hook к этому
же root: фазами управляет эта композиция.

Дочерний native проект использует собственный Download pre, Core native-pre,
рендер и collect. `collect` как последний HTML mutator должен предшествовать
Core native-post, затем идёт Download post `--native`. Родитель передаёт
`COURSE_SITE_DEFER_DOWNLOADS=1`, поэтому этот child post не упаковывает ZIP.
После копирования текущих страниц и QRC каталога родитель назначает финальные
Pages bases, reference catalog и sources→outputs; Download создаёт ZIP сразу
в конечном mount после final Core fence. Child output не переписывается;
второй ZIP и исправление README после упаковки отсутствуют.

Public catalog сверяется с native collection: ожидаемые HTML outputs должны
совпадать точно, повторные outputs запрещены. В `composition.json` сохраняется
`nativeOperations` с публичными catalogs/roles. Пересечения roots/output/mount,
source path и безопасная очистка продолжают проверяться Publisher.
`observeOperation` Download позволяет выполнить coverage check в том же Core
callback, без повторного whole-tree inspect/hash ради статуса.

Старый host `finalize-conditions.ts` и helper пока остаются историческим
непереключённым кодом; production compose их не вызывает. Их окончательное
удаление и перенос прежних condition-only controls идут общей следующей дельтой
с independently accepted A4 `materializeCondition`/closure. Owner-gate не считается
заменой условия, и этот old path не является вторым постоянным каноном.

`tests/site-public-operation.ts` проверяет настоящий root/child render, активный
Core обоих scopes, обычный ресурс root, final mounted README URLs, совпадение
конечного ZIP SHA256 с подготовленными Download bytes и адресный release-proof
отказ до собственной очистки. Запуск с `B2_ROOT_NATIVE=1`, immutable `CORE`,
точными `QRC`/`DOWNLOAD`, Quarto1.11.5. Старый CUE/private fixtures и весь Java/SP
не выдаются за пройденные этим bounded тестом.

Actual native QRC reference tokens/import bindings, condition-only closure,
fragment origins, default kind и actual full projection остаются следующей
дельтой после независимой приёмки Core A4. Plain native source→output ссылки
и окончательные mounted назначения проверены отдельно от этих gates.
