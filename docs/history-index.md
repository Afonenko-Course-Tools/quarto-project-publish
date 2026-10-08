---
type: history-index
component: publisher
status: current
---

# Карта сохранённой истории

Предмет переноса: Композиция/subprojects/current outputs, ownership и native child profiles.
Действующие правила находятся в [индексе спецификаций](../spec/index.md), будущие
изменения — в [плане владельца](plans/2026-10-08-implementation.md). Старые snapshots,
plans/probes удалены только из active tree после проверки Git сохранения и
координации; корневые исходники и пользовательские worktrees не изменены.

Полная карта исходных путей, bytes и SHA256, checkout/refs/worktrees/OPEN PR,
точные root snapshots и обе версии owner plans находятся в commit
`93b71e218e1ab187dfad6a9995a2e8d6afa01397` под `docs/history/2026-10-08-preflight/`.
Восстановление отдельного файла не требует checkout/reset рабочего дерева:

```sh
git show 93b71e218e1ab187dfad6a9995a2e8d6afa01397:docs/history/2026-10-08-preflight/SOURCE-MAP.json
git show 93b71e218e1ab187dfad6a9995a2e8d6afa01397:docs/history/2026-10-08-preflight/source-state.json
```

Все перечисленные исходники имеют status `historical`; старые результаты CI,
версии и unchecked задачи не описывают сегодняшнее дерево. Ни одна local branch
не имела уникальных коммитов относительно свежего `origin/main`, все refs сохранены.
Исходный HEAD: `1f5c0f3890b71c98fa500933e322e2d5cf4b7df0`; fresh origin/main:
`b7e6663e5674b657fcfa07d83ead8f650b3570ed`. Каждому root/ignored snapshot соответствует SHA256:

| Исходный путь | SHA256 |
| --- | --- |
| `specs/quarto-tools-plan.md` | `2485df3eba93b328de3098ef9640e8af11347660c607aa409fb09a103a31fca8` |
| `specs/course-change-plan.md` | `8bafe4c4b7a9b693ad6c64712558d71a6a719722bcc99e1d0bf357965b24218e` |
| `specs/course-plan-review.md` | `316a8169b6e204696404a5d263c9c2483d8325c72387596b6842ec4f1ae91914` |
| `specs/quarto-resource-policy-implementation-plan.md` | `e3921939265418f3703b4408987d4618e32eb076fca0c7626312c0ff407a4471` |
| `specs/quarto-managed-portal-implementation-plan.md` | `f5e5d67949557d22c0e10e6c155a57a6c34ca3c081e67d84ea0737d424a281bf` |
| `specs/2026-10-04-refactoring-analysis.md` | `c7c04d58d8174d4e3e33b1c70174b7c5009be71af3e9f8ea361eaec24276fb61` |
| `specs/course-examples-release-plan.md` | `7ff128a08b4d88923e409c203405d644dd91c50ad017a9f628373c47973666fc` |
| `quarto-codex-handoff-2026-10-03.md` | `9b6ff65829c9c981d1de33cbc5fea9dc50623f4b70590e5b3f0882859785b070` |
| `local-evidence/refactoring-research-2026-10-07/RESULT.md` | `74e402c0a146067515884940d7c1a9a00f1f1e292ac90e3f2ca7074fbede8c2c` |
| `local-evidence/refactoring-research-2026-10-07/baseline-checks.json` | `81d1a5ef72b3333dfb5b6f59386d0e6c41322ee9690862226a6d367ee7d30c0a` |
| `local-evidence/refactoring-research-2026-10-07/composition-warnings.json` | `d033e5bde92ee682501edbf83f1b489fbe073b2aa429098f5cf6b5206561f189` |
| `local-evidence/refactoring-research-2026-10-07/native-override.json` | `be55ff4edce6dd7ddc1dc1f80f1b3ca7b439c6d9395ef5504d81da8c5ba606a2` |
| `local-evidence/refactoring-research-2026-10-07/native-source.json` | `19921bdc683ed318174d5ec854bccd7681eabe4eecd569cb822d83508cd68606` |
| `local-evidence/refactoring-research-2026-10-07/plan-validation.json` | `b77a17b858a9c21347f0f697e067f309c257700256265c09f9a6503ae55d1a18` |
| `local-evidence/refactoring-research-2026-10-07/remote-heads.json` | `d27807b7ec0d859973f4231950539609f983b6184ce6f18d4c3ee4807e69b082` |
| `local-evidence/refactoring-research-2026-10-07/source-baseline.json` | `168ffb52740026597f587b65842742fd3865e75661346b26027ce2826b827cda` |
| `local-evidence/refactoring-research-2026-10-07/warnings.json` | `4793211923664290dde5cf15e6db2c74a8afb766a22237cf8a11a17941cf1928` |

Owner plans до origin update и из опубликованного origin/main сохранены без
изменения bytes в `owner-snapshot/before-origin-update/` и `owner-snapshot/origin-main/`
того же commit. Их SHA256/sourceRef приведены в SOURCE-MAP.json.

Из active tree удалены только:

- `spec/plans/course-composition-plan.md` — Git ref `93b71e218e1ab187dfad6a9995a2e8d6afa01397`.
- `docs/history/2026-10-08-preflight/` — полный Git ref указан выше.

Перенесённые действующие решения: reuse native Quarto; текущий успешный native
run/outputs; независимые ID/QRC адреса; owner containment до cleanup; закрытые
тела/ресурсы не включаются в публичный payload; внешний exit/tool/потоки/cause
сохраняются; общей runtime/report/registry надстройки нет. Их нормативные
владельцы связаны из текущего spec index. Это описание фиксирует историческое
состояние подготовки; актуальные правила
банка/assignments теперь находятся в текущих контрактах Core и владельца.

## Подготовка авторства 8 октября

Переходный `docs/authoring-next.md` перенесён в действующие тематические документы.
Точные исходные bytes сохранены в Git: commit `d8bf688ebf33433dba236bb9761284a21f5a2899`,
blob `33adced2c72c8501ae2ab7ba6f5f3e569ca7cc5c`. Восстановление без изменения рабочего дерева:

```sh
git show d8bf688ebf33433dba236bb9761284a21f5a2899:docs/authoring-next.md
```

[Исходная подготовка](https://github.com/Afonenko-Course-Tools/quarto-project-publish/blob/d8bf688ebf33433dba236bb9761284a21f5a2899/docs/authoring-next.md) остаётся историей этого владельца.
