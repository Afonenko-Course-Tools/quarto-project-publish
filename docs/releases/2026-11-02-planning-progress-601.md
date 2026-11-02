# Publisher6.0.1: видимое native планирование

До первого дочернего render Publisher проверяет workspace корня, native plan всех компонентов и разделение student/full outputs. Теперь эти прежние фазы печатают начало, завершение либо ошибку с owner path и elapsed wall: «Планирование корня», «Планирование компонента», «Проверка аудиторий». Последняя фаза может выполнять прежний inspect альтернативного профиля, если его конфигурация существует.

Изменение использует существующий progress wrapper. Аргументы/число native inspect, selectedSources, audience/output guards и native render commands не менялись; буферизация stdout/stderr не добавлена. Quarto initial resolution до входа Publisher hook этим не измеряется. Нельзя по одному прежнему общему151.254s приписать147s конкретному inspect; новые stage labels позволяют установить это при следующем разрешённом render.

Finite regression без native render проверяет порядок live start → существующий inspect → finish/wall для root+5children и альтернативных профилей (12 прежних inspect), а также timed error и сохранение точного failure object. Реальные streamed stdout/stderr проверяет существующий process-live-output control. Полный Java/benchmark/CI не повторялись этой source-only правкой.
