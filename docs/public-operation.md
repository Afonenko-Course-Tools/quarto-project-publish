# Публичная Native композиция Publisher

Обе Native ветви с Download и без него используют один
`Core.withNativePublication(expectation, selection, use)`. Core проверяет
семантические facts документов/course/assessment, coverage, audience и текущий
capture. Publisher сравнивает catalog с независимо выбранными Native sources,
текущими HTML outputs внутри callback. Форматы определяют конфигурация, профили
и документы дочернего Quarto. Native course без активного Core
сохраняет `SITE.RELEASE_UNQUALIFIED`; ordinary noCore проект самостоятельный.

PL активен по фактическому `publication.course.adapters`. При активном
PrairieLearn Publisher загружает sibling этого owner и вызывает только
`inspectPublication(publication)`. Установленный неактивный PL не запускается;
отсутствующий активный sibling — ошибка. Существующий module initialization
failure не скрывается. Full `validateCourse`, grading composition и seed relation
qualification не входят в обычную публикацию. Синтаксические parsers project
checks/materialization/seed targets остаются у PL.

Root с Core использует Publisher pre/post и штатные Core native-pre/native-post.
Подготовка PL course-export transport для ordinary публикации не запускается. Каждый child имеет свой
independently authored config/capture и owner-local sources. Child collect
завершает HTML/Navigation до Core post; Download post deferred. QRC и root
Navigation заканчивают HTML до root Core post. Модули открываются в sibling
namespace нужного owner, identities самостоятельных курсов не объединяются.

При Download callback сохраняет handle результата
`prepareNativeDownloads(publication, options)`. Только после успешного закрытия
Core вызывается одноразовый `publish()`: готовые bytes записываются сразу в
конечный mount с уже назначенными Pages URLs. При callback/closing rejection
сохранённый handle discarded; cleanup failure не маскирует исходную причину.
Draft не хранит live Core/PL capabilities. Discard после частичной записи не
удаляет outputs и не обещает rollback; manifest writer позволяет следующей
обычной cleanup убрать собственные имена. Повторный publish отказывает.

`resetDownloadRequests` в pre чистит только sidecars. Native preparation не
удаляет ZIP. При этом существующие Site `cleanOutput`, render и mount-copy
остаются ранними effects: closing failure не откатывает их. Гарантия boundary
касается отсутствия новых archive writes подготовленного draft до Core closing.

`composition.json` сохраняет public catalog/course и при активном PL plain owned
inspection data. Release proofs, validation counters и artifacts receipts из
этого контракта удалены. Catalog и inspection — данные результата, а не
assignment или grading readiness authority. Post-close методы borrowed view
не вызываются. Download упаковывает один раз, posthoc ZIP mutation отсутствует.

Existing `tests/site-owner-release.ts root-pl` содержит два независимых owners:
root с PL без Download и tasks child с Download, оба конфига authored до render.
ZIP entries/README/resources проверяют реальные final links, suffixes, anchors и
privacy. NoPL/inactive Native runtime этим одним запуском не квалифицируется.
Source/typed parser controls не заменяют Native acceptance. Остальные existing
fixtures сохраняют адресные privacy/coverage/path/currentness проверки.

Полный Java/SP, assignment/P, cache freshness, CI, установленный состав и
публикация требуют отдельных проверок. Explicit starter в author по-прежнему
получает `DOWNLOAD.STARTER_UNQUALIFIED`; extra render или перенос ZIP между
операциями для обхода этой границы не добавляется.
