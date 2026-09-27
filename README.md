# Составная публикация Quarto

Расширение собирает несколько проектов Quarto, размещает результаты в едином сайте и позволяет выпускать PDF-раздатку вместе с книгой и слайдами. Оно не требует учебной модели, QRC, темы БГУ или платформ оценивания.

## Установка и включение

```sh
quarto add Afonenko-Course-Tools/quarto-project-publish
```

Установка пассивна. Обработчики включаются явно в `_quarto.yml`:

```yaml
project:
  type: website
  output-dir: _site
  render: []
  pre-render: _extensions/project-publish/entrypoints/pre.ts
  post-render: _extensions/project-publish/entrypoints/post.ts
project-publish:
  home: book
  projects:
    book: {path: book, format: html}
    lectures: {path: lectures, format: revealjs}
    handouts: {path: handouts, format: pdf}
```

Каждый подпроект содержит собственный `_quarto.yml`. `home` выбирает HTML-проект с `index.html` и размещает его в корне. У остальных `mount` по умолчанию совпадает с именем; его можно задать явно. Формат по умолчанию — `html`; допустимы `html`, `revealjs`, `pdf`. PDF-подпроект публикует только PDF, без HTML-копии документа, LaTeX и промежуточных файлов.

При отсутствии `home` корневой проект самостоятельно создаёт `index.html`; перечислите его QMD в `project.render`. В корневом проекте исключайте исходники подпроектов из `project.resources`, если используете широкие шаблоны ресурсов. Не включайте `*_site*`, `.project-publish`, `_generated` и другие результаты в ресурсы.

Координатор при явно включённом `pre-render` очищает текущий `output-dir` целиком. Не храните там ручные файлы. Остальные профили не изменяются. Неудачный `render` не гарантирует сохранение предыдущего выходного каталога; предпросмотр хранит отдельный снимок последней успешной публикации. Корневой `--output-dir` поддерживается только как имя вложенного каталога проекта, например `_preview`; путь наружу отклоняется до очистки.

Ссылка из домашней книги: `[Скачать раздатку](handouts/topic.pdf)`. Из слайдов, размещённых в `lectures/`: `[Скачать раздатку](../handouts/topic.pdf)`. Вложенные страницы используют обычные относительные пути. PDF-файлы не коммитятся: их создаёт текущая сборка. Для формата `pdf` требуется доступный движок LaTeX, настроенный в подпроекте.

## Профили

`quarto render --profile student` передаёт выбранные профили всем подпроектам. Каждый подпроект обязан иметь соответствующий `_quarto-student.yml`; отсутствие считается ошибкой. Файлы могут содержать только `metadata: {}` при отсутствии отдельных настроек. Выходные каталоги всех профилей исключаются из снимка исходников и публикации; собственные промежуточные данные лежат в `.project-publish/`.

## QRC по выбору

```yaml
project-publish:
  integrations:
    - _extensions/reference-catalog/entrypoints/publication.ts
  # home и projects — как выше
reference-catalog:
  exports:
    book: "*"
```

QRC устанавливается отдельно. Интеграция передаёт его фильтры HTML-подпроектам и разрешает ссылки после сборки всех страниц. PDF-проекты остаются обычными файловыми ресурсами.

## Предпросмотр

Для составного сайта добавьте явно:

```yaml
project:
  preview:
    watch-inputs: false
    serve:
      cmd: "quarto run ../.project-publish/preview.ts --port {port} --host {host}"
      ready: "Публикация предпросмотр готов"
```

`quarto preview` показывает последнюю успешную сборку и пересобирает сайт при изменении исходников. При ошибке открытая страница сохраняется.

## Архитектура и проверки

`domain/contract.ts` содержит допустимые форматы, поля и типы ресурсов; `domain/model.ts` — интерфейсы. `application/workflow.ts` определяет подготовку и завершение сборки через порты. Адаптеры файлов, Quarto и публикации находятся в `infrastructure`; CLI — в `entrypoints`. Зависимостей от других расширений нет.

CUE-определение текущей конфигурации находится в `spec/publication.cue`; проверка `tests/schema.ts` сверяет его с допустимыми форматами TypeScript.

Интеграция экспортирует объект с необязательными `metadata(context)` и `finalize(context)`. Контекст метаданных: `root`, `namespace`, `format`, `config`. Контекст завершения: `root`, `stage`, `quarto`, `config`, `members`. Интеграции перечисляются явно и исполняются в указанном порядке; это доверенный код проекта. Они не должны менять чужие исходники или запускать дополнительную публикацию. Стабильный договор определён интерфейсом `Integration`.

```sh
quarto run tests/schema.ts
quarto run tests/profiles.ts
quarto run tests/publication.ts
quarto run tests/portal.ts
```

`tests/publication.ts` проверяет сборку без QRC/Core, HTML, Reveal, настоящие PDF и профили. `tests/portal.ts` проверяет повторную публикацию, переход от домашней книги к порталу, изменение размещения и корневой CLI `--output-dir`. Интеграция с QRC проверяется в его репозитории. Исходный код перенесён из `quarto-reference-catalog`; авторство и лицензия сохранены в истории Git.
