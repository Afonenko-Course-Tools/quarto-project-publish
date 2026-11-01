---
type: implementation-report
component: publisher
status: unreleased
---

# Перенос проверок Publisher на Core 9

Неуспешный CI кандидата 5.2.0 дошёл после публичной композиции, четырнадцати
owner modes и student/full release-composition до старой проверки private
`qualify`. Она извлекала удалённую функцию из текста исходника и читала прежний
внутренний Core model. Весь оставшийся канонический хвост рассмотрен как одна
миграция договоров, а не последовательность исправлений первого совпадения.

Действующие проверки используют отдельные genuine native operations root,
child и nested owner, public project contexts/materialization, текущие
condition/resource inventories и конечные HTML/ZIP/QRC/search. Старое глобальное
префиксирование model sources и private Body export не становятся публичным API.
Смысловые соответствия и честные ограничения записаны в
[карте проверок](../../tests/legacy-harness-mapping.md).

Child hooks завершают QRC и collect перед Core post. Нулевой preview вывод
проверяется настоящим public loader отказом; процессные ограничения preview
сохранены.

Новая проверка rootless композиции обнаружила утечку при student профиле и
`course.view: full` у native child. Publisher теперь до очистки результатов и
первого child render проверяет согласованность выбранной student/full аудитории,
`course.view` и native `course-core-projection` корня и компонентов. Отказ
`SITE.AUDIENCE_MISMATCH` сохраняет предыдущие output/ZIP bytes. Согласованные
student/full и custom profiles остаются допустимыми; generic компоненты не
получают обязательную Core проекцию. Финальный production отличается от прежнего
companion; новый точный ref и повторный CI обязательны.

Локальный хвост, независимая delta-рецензия и фактический повторный hosted CI
имеют отдельные свидетельства. Эта заметка сама по себе не подтверждает их
успех, установку курса, qualification P или готовность полного выпуска.


Финальная пара CI закрепляет independently reviewed Core 9.0.1 source
`c57babccdadbf72d02245c2d2d05c41948930ced` и опубликованный C 9.0.0 source
`eb35a5f16600915bdc78a41c21601e1ae92fe019`. Наличие pin Core не является заявлением
о публикации его тега: фактический readback фиксируется отдельно владельцем выпуска.
Core hook обрабатывает настоящую пустую cached-preview фазу без создания учебной
операции; строгие public API и требование genuine текущего результата сохраняются.

Эта финальная фаза не меняет production Publisher и ранее принятую I1 защиту.
Реальные course cached/clean/root/component/no-watch previews, независимая
рецензия пары и exact-final hosted CI имеют отдельные receipts. Обязательная
квалификация всех135 материалов/assignment/P/privacy остаётся gate курса и
программы; она не подменяется этими extension checks.
