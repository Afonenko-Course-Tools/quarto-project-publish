# Publisher 5.2.0

Кандидат объединяет ранее независимо проверенную native B3 ветку
`0342fb7cd22e6c06aa345239c5d6e2ee6c3eb7ff` и main `a0fc543fb461d90b9f467dbe8b6a0b286a39311a`
с сохранением обеих Git историй. Исходные version-only snapshots сохранены.

Публичные owner/resource/condition гарантии B3 объединены с контекстом
наблюдения ABI 1 и прежними restricted env permissions из main. Publisher
сохраняет также main preview startup guard. Download не возвращает private
NativeRun fallback; его прежние harness проверки перенесены на actual public
операции и явный отказ старого carrier, mapping сохранён в tests.

Независимая приёмка объединения и настоящие CI окончательных SHA выполняются
отдельно. Этот файл не утверждает их прохождения. Новый immutable tag и release
создаются только после необходимых проверок; прежние опубликованные теги не
заменяются. Полный курс135, assignment/P/OCI/installed квалифицируются отдельно.
