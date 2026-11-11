# Техническое завершение Publisher

Локальная партия поверх `db96733`, без заявления выпуска. Планирование
назначений и проверка пересечений остаются до cleanup/render. Local post-render
отделён от полной композиции; native owner publication получает один явный
контекст конечного размещения. Recoverable Markdown проверяется тем же сравнением
bytes с исходником. Публичный positional API чтения collection сохранён;
внутренний helper получает единый ожидаемый profile context.

Синтаксические ошибки JSON inspect, active state, navigation context и итогового
каталога имеют source/field и исходный `SyntaxError` в cause. Ошибка active state
сохраняет `SITE.COLLECTION_INVALID`; неизвестные программные и foreign tool
ошибки не переименовываются. Проверка native inspect отклоняет malformed JSON
до render/mount.

Проверены 21 существующий публичный suite и новая native cache matrix. Последняя
исполняет настоящий Publisher с дочерним Quarto проектом, сохраняя кеши между
шестью сборками: cold/warm, изменения QMD/frontmatter/include/resource/Sass,
add/delete/rename, смена output-dir и student/full/student. Текущая выдача
обновилась, удалённые outputs не остались в mount, full-only текст отсутствует
в следующей student выдаче. Ошибка native cache на этом сценарии не обнаружена;
executable engine/freeze остаются областью отдельной матрицы Core.

Проверки mixed HTML/Reveal распознают native DOM и скрипт Reveal, а не слово
`reveal.js`: нынешний обычный HTML Quarto содержит это слово в комментарии JS.
Минимальный Quarto-only пример подтверждает корректность document format.
Это исправление теста не меняет формат или bytes сайта.

Полный production quality gate проверяет все 14 собственных TS файлов и один
browser JS, unsafe типы, structural budgets и зависимости без baseline.
Полный paired замер Java/SP оформляется на согласованном immutable составе;
время малой mutation matrix не выдаётся за ускорение полного курса.
