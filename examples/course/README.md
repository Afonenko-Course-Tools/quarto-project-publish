# Минимальный составной курс

Обязательные компоненты этого примера: course-site `v4.0.0` и QRC `v2.2.0`.
Core не требуется для составной публикации. Одна книга и один сайт с HTML и
Revealjs показывают native форматы, профили, общую bibliography и QRC.
Демонстрация по умолчанию использует full; student исключает control.qmd через
отдельный полный список book.chapters.

Для локальной установки из checkout:

```sh
quarto add ../.. --no-prompt
quarto add ../../../quarto-reference-catalog --no-prompt
(cd book && quarto add ../../../../quarto-reference-catalog --no-prompt)
(cd materials && quarto add ../../../../quarto-reference-catalog --no-prompt)
quarto render
```

Для GitHub установки используйте точные теги и namespace paths, показанные Quarto.
Готовый сайт выпускается как `composite-course.tar.gz`; его корень содержит
index.html и reference-catalog.json. Внутренние ссылки остаются относительными.
Невеб-форматы запускаются отдельно штатным `quarto render --to pdf`.
