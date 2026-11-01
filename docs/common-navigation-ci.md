# Проверка общего меню в CI

Код общей композиции зависит от [quarto-course #52](https://github.com/Afonenko-Course-Tools/quarto-course/pull/52).
Штатный workflow сейчас закреплён на более раннем Core и не запускает новый
`tests/site-composed-navigation.ts`. Локальная проверка использует согласованную
копию Course с публичным Navigation и темой.

Токен отправки PR не имеет права изменять workflow GitHub Actions. Полная правка
сохранена в [патче](common-navigation-ci.patch): закреплён коммит Course
`0d8e595e712dcf1125a93fea3a8dabb6ba3095cb`, подключён новый тест и каталог
браузера Playwright. До слияния примените патч с учётными данными, имеющими
разрешение `workflow`:

```sh
git apply docs/common-navigation-ci.patch
```

После применения выполните CI на итоговом коммите. Патч не заменяет реально
изменённый workflow и успешный запуск проверки. Если связанный PR Course
получит другой итоговый SHA, обновите обе ссылки на коммит в workflow.
