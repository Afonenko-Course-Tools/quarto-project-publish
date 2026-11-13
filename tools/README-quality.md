# Проверка качества собственного production-кода

Локальная проверка и CI используют одни блокирующие команды:

```sh
npm ci --ignore-scripts
npm run check-quality
npm run check-quality:controls
```

`scope` в `eslint.config.mjs` задаёт production-каталоги. Все существующие и
новые tracked/untracked `.ts`, `.js`, `.cjs`, `.mjs` обнаруживаются автоматически.
Vendor, node_modules, generated и _generated не входят в собственный код.
Пустой scope и `strict: false` запрещены. Структурные правила действуют на весь
собственный production-код: `complexity <= 30`, `max-depth <= 5`, `max-params <= 5`.
Исключение PL — существующий именованный ABI `renderPublicBody` с семью аргументами.
Списка успешно прошедших старых файлов, baseline и подавлений нет.

Typed ESLint проверяет `no-explicit-any`, `no-unsafe-type-assertion`,
`no-unsafe-assignment`, `no-unsafe-argument`, `no-unsafe-call`,
`no-unsafe-member-access`, `no-unsafe-return`, `switch-exhaustiveness-check`.
`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck` и inline отключения ESLint
завершают gate ошибкой. Линтер печатает конкретные диагностики и считает
предупреждения ошибками. Типизация не заменяется произвольными any или stub API.

Для TypeScript строится строгая программа из реального `deno info --json`
graph, `deno types`, Quarto import map и фактических публичных providers.
`CORE`, `PL`, `QRC`, `DOWNLOAD`, `SITE`, `COURSE_PERFORMANCE_SOURCE` позволяют
указать source roots; существующая переданная import map сохраняет приоритет.
Проверяются диагностики собственных production `.ts`. Декларации `.d.ts`
обслуживают реальные типы потребителей; `skipLibCheck` пропускает их отдельную
семантическую проверку. Полные существующие Deno/source gates сохраняются.

JavaScript проверяется отдельной строгой `allowJs/checkJs` программой с
действующим `typecheck/javascript.json` либо `typecheck/browser.json` и настоящими
DOM/Node declarations. Deno globals в браузерный JS не подмешиваются. Структурные
и typed правила одинаково действуют на обнаруженный собственный JS. PL
`application/native-validators.js` — standalone AJV artifact генератора; его
воспроизводимость и потребляющий декларации API проверяются существующими
контрактами generated validators, а не линтером минифицированного output.

TypeScript в npm devDependencies — совместимый peer parser/ESLint. Это отдельная
зависимость линтера; системный `tsc`, Compiler API, установленный CLI и Quarto/Deno
сохраняют продуктовые проверки. Точная версия host TypeScript не требуется.
TypeScript 7.0.2 фактически отвергнут текущим parser peer `<6.1.0`; принудительная
установка с `--force` или `--legacy-peer-deps` не используется.

Dependency-cruiser проверяет разрешаемый статический TS/JS import graph,
публичные границы providers и runtime cycles. Type-only цикл допускается;
импорт внутренних provider modules запрещён и для type-only связи. Динамически
вычисленный импорт не объявляется статически доказанным. Lua, Python и shell
сохраняют собственные существующие language-server/typechecker/lint gates;
прохождение TS graph не означает проверку всего Lua или dynamic graph.

`check-quality:controls` сначала требует чистый production gate, затем по одному
создаёт новые временные production-файлы и запускает ту же `check-quality`
команду. Независимо проверяются каждое правило typed/structural набора, запрет
подавления, malformed AST, цикл и импорт внутренностей. Выход должен быть
ненулевым с диагностикой именно проверяемого правила. Файлы удаляются в `finally`.
Эту команду нельзя запускать одновременно с другим source gate того же checkout.
В CI она обязательна после положительного gate. Итоговый JSON положительного
входа сообщает TS/JS/structural counts и реальные версии parser/ESLint/compiler.


Все новые собственные файлы обнаруживаются из Git tracked/untracked и обходом
собственных каталогов typecheck; coverage.json фиксирует исходный состав и два
делегированных bridge, а не ограничивает новые входы старым списком. Новые `.mjs`
production проходят тот же строгий checkJs и typed ESLint; helpers `.mjs` и
`eslint.config.mjs` проходят строгий Node checkJs и ESLint без inline отключений.
Node include автоматически находит новые tools/tests `.mjs` и config `.mjs`;
отдельный отрицательный helper с TS2322 проверяется в check-quality:controls. Deno lint охватывает
TS/JS tests и tools, включая `.mjs`.

`npm run check:formats` проверяет все собственные TS/JS/JSON/YAML через Prettier,
Lua через StyLua и Luacheck, shell через shfmt, ShellCheck и `bash -n`, TOML через
`taplo lint --no-schema` и `taplo format`, YAML через
yamllint и workflow через actionlint. Каждый формат имеет одного владельца стиля.
`npm run format` применяет этот стиль; канонические observability bridge, vendor
и generated принадлежат своим владельцам. Luacheck знает только реальные
`pandoc`/`quarto`, callbacks fixtures и декларацию Pandoc; unused warnings включены.
LuaLS остаётся обязательным отдельным сильным gate `npm run check:types -- --lua`.

Для JSON проверяется ровно одно синтаксически корректное значение; jq не
проверяет уникальность JSON-ключей. YAML сохраняет style и duplicate/syntax rules;
длина строк и оформление комментариев принадлежат Prettier. `truthy` проверяет
значения, ключ `on` в GitHub Actions допускается.

`npm run check:formats:controls` проверяет новый неформатированный `.mjs`, новый
Lua с ошибкой имени runtime, shell с SC2086, YAML с повтором ключа и отсутствующий CLI, а также сбой реального
CLI через подставленный executable. Контроли запускаются последовательно с gates
того же checkout, временные исходники удаляются через trap. Инструменты ставятся
стандартными package managers в CI; локальная команда ничего не устанавливает.


TOML обнаруживается тем же Git tracked/untracked списком, включая `stylua.toml`.
Taplo — единственный владелец стиля TOML: без сетевых схем и авто-конфигурации,
ширина 120, порядок ключей сохраняется. CI устанавливает стандартный
`@taplo/cli@0.7.0`; локально используется установленный CLI. Контроли нового TOML
отдельно проверяют формат и синтаксическую ошибку. Новый YAML `flag: yes`
подтверждает ненулевой выход `yamllint --strict` и для предупреждения `truthy`.

ESLint 10 используется с поддерживающим его typescript-eslint; scoped overrides
minimatch в ESLint и typescript-estree устраняют диагностированные npm audit
замечания без подмены runtime API курса и без принудительного обхода peer checks.
