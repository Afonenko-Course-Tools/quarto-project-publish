# Минимальный составной курс

Обязательные компоненты этого примера: course-site `v5.0.0` и QRC `v3.0.0`.
Core не требуется для составной публикации. Одна книга и один сайт с HTML и
Revealjs показывают native форматы, профили, общую bibliography и QRC.
Демонстрация по умолчанию использует full; student исключает control.qmd через
отдельный полный список book.chapters.

Установка закреплённых выпусков штатным механизмом Quarto:

```sh
task install
task render
```

Taskfile устанавливает QRC в каждый native проект; ручная настройка путей не нужна.
Готовый сайт выпускается как `composite-course.tar.gz`; его корень содержит
index.html и reference-catalog.json. Внутренние ссылки остаются относительными.
Невеб-форматы запускаются отдельно штатным `quarto render --to pdf`.

`task render` записывает `_site/BUILD.json`: точная ревизия производителя,
закреплённые зависимости и версия Quarto. Архив `composite-course.tar.gz` выпускается
в отдельном immutable Release `demo-20261008`.
Tool tag `v5.0.0` и demo tag указывают на один clean producer commit.

Каждый самостоятельный проект задаёт `lang: ru` и native
`fail-if-warnings: true`. Корневой CLI-флаг строгости не наследуется дочерними
scripts; для общей политики подключайте shared metadata-files в каждом проекте.
HTML и книга используют native `repo-url`, `repo-branch`, `repo-subdir` и
`repo-actions: [source]`. Ссылки на папки находятся в native navbar/sidebar,
у Revealjs исходник доступен через native footer. Все ссылки закреплены на
выбранном выпуске производителя; готовый HTML не переписывается.
[Справочник ошибок Publisher](../../docs/diagnostics.md).

Источники этой группы используют v5.0.0 и Quarto 1.11.5.
Готовый asset допускается к публикации только с
точным producer commit и `sourceDirty: false` в `BUILD.json`.
В этих проектах Core банк не включён: native exr/exm/sol сохраняют обычные правила Quarto.
