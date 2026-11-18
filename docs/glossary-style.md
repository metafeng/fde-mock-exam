# 术语卡片编写规范

> 本项目 `data/glossary/` 下的 139 个术语就是按这份规范整理的。新增术语时照此编写。

读者：明天就要参加腾讯云 FDE 认证理论考试的考生。很多术语是第一次听说，需要在一个晚上快速「认词」——知道它是什么、和谁容易混、考试怎么考。

## 任务
为指定模块整理 **10–14 个核心术语**（概念、框架、清单名、方法名都算，例如「死亡谷」「PEV 交付闭环」「三态溯源」「Echo / Delta」「OAuth 2.1 与 PKCE」）。
挑选标准：考试最可能考、考生最可能陌生或混淆的。参考该模块的题库 JSON（看哪些概念被反复考）和课程原文。按重要性从高到低排序。

## 每个术语的字段（JSON 对象）

```json
{
  "term": "死亡谷",
  "aliases": ["L1→L2"],
  "plain": "大多数 AI 项目夭折的地方：Demo 做得很好，一接真实数据、真实权限、真实用户就推不动了。",
  "analogy": "像样板间装修得很漂亮，真住进去才发现水电没通。",
  "points": ["位置：L0–L4 成熟度框架中 L1（原型验证）→ L2（试点运行）之间", "原因：脏数据、权限打不通、一线不肯用", "穿越三动作：第一天接真实数据（100 条真数据胜过 10000 条理想数据）｜权限打通排在功能开发前｜找到真心愿意用的种子用户"],
  "confuse": "不是 L0→L1（那是把客户方案当需求的风险）；考题常把位置换成 L0→L1 或 L2→L3。",
  "mnemonic": "真数据、先权限、找种子",
  "src": "第 7 章 7.3"
}
```

- `term`：术语名，简短。
- `aliases`：其他写法或英文缩写（用于在题目里匹配相关题），没有就写 []。不要放太宽泛的词。
- `plain`：**一句大白话**（≤ 50 字），像跟完全没接触过的人解释。
- `analogy`：一个生活类比，帮助理解；实在没有合适的写 ""，不要硬凑。
- `points`：2–4 条关键要点，**必须与课程原文一致**（清单内容、顺序、数字、阈值不能错）。清单类术语要把清单完整列出。
- `confuse`：最容易和什么混、怎么区分、考题常见的干扰方式。1–2 句。
- `mnemonic`：帮助记清单/顺序的口诀，顺口、短；没有合适的写 ""。
- `src`：出处（章 + 小节）。

## 要求
- 内容只来自课程原文，不要编造。
- 不要写「课程中」「原文」。
- 输出合法 JSON 数组，追加到 `data/glossary/gX.json`（X 为模块编号 0–9），再运行 `python3 scripts/build.py` 校验。

## 图解 visual（图标化，少字）

另有 `example` 字段：2–3 句具体工作场景，收在「展开详细说明」里。

用户反馈：卡片字太多、看着费劲。要改成「一眼看懂」的图标图解。例如「下发策略」= 三个图标块：白名单图标「白名单 / 只放行名单内」、黑名单图标「黑名单 / 拦截名单内」、默认图标「默认 / 新应用初始状态」。

## 只改 visual 字段，其他字段（plain、points、example 等）一律不动

### 每个条目
`{"i": "图标名", "t": "标题", "d": "一句说明"}`
- `i`：必须是下面图标库里的名字，选**最能表意**的（白名单→listcheck，黑名单→listx，禁止→ban，人工审批→hand 或 signature，日志→scroll，时间/周期→timer 或 calendar，钱→money，AI→sparkle，Agent→bot，工具→wrench，接口→api，数据→database，用户→user/users，客户→building，评测→flask，指标→chart，权限→key/lock……）。同一张图里各条目图标尽量不重复。
- `t`：**≤ 6 个字**（英文缩写按 1 字算 2 个字母），名词或短语。
- `d`：**≤ 12 个字**，只说最关键的一点；能用数字就用数字（如「1–2 周」「≥80%」）。不要写完整句子，不要标点堆叠。
- 条目数 2–5 个（宁少勿多，只画核心结构）。

### 类型（保持原来选的 type，除非明显不合适）
- `flow` 先后步骤；`cycle` 循环；`stack` 分层（从上到下）；`levels` 逐级递进（可选 `mark: {"between":[i,j],"label":"≤4字"}`）；`grid` 并列要素。
- `compare`：`{"type":"compare","left":{"i":"图标","t":"≤6字","items":["≤10字", ...]},"right":{...}}`，每边 2–3 条，左右条目**一一对应**（第 1 条对第 1 条），方便对照。
- `note` 可选，≤ 16 个字，一句最关键的提醒（如「顺序不能跳」）。没有必要就不写。

### 准确性
内容（顺序、数字、名称）必须与课程原文一致；压缩字数时不能改变意思。

## 图标库（只能用这些名字）
user, users, loop, shield, shieldcheck, key, lock, door, flag, layers, trenddown, trendup, target, checklist, alert, search, funnel, steps, compass, bulb, plug, database, cloud, bot, code, palette, puzzle, coins, clock, calendar, book, file, chat, scale, valley, stop, sprout, megaphone, tools, toggle, list, server, rocket, cap, grid, gem, eye, zoom, swap, upload, music, listcheck, listx, ban, check, xcircle, gear, bell, mail, chart, money, hand, handshake, link, timer, trash, pen, send, inbox, archive, folder, tag, star, building, globe, cpu, terminal, api, workflow, sparkle, brain, ruler, flask, bug, wrench, refresh, play, pause, hourglass, thumbup, signature, badge, trophy, route, eyeoff, fingerprint, idcard, scroll, package, branch, home, phone, monitor, upgrade, minus, plus, question, split, merge, seed, megaphone2, glasses, mask, key2

