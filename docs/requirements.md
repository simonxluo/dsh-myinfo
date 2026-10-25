# dsh-myinfo 需求文档（含数据建模与功能表单）

> 版本：v0.4.3 · 状态：已实现并通过单元测试（含多模型 workflow 评审回归项）；评审记录见 `docs/workflow-report.md`

## 1. 需求分析

### 1.1 背景与目标

用户希望在 DeepSeek Harness（DSH）里有一个**专门的个人信息管理插件**：把散落在聊天、记忆、笔记里的个人事实沉淀为一份结构化档案，agent 与用户本人都能读写：

- **agent 侧**：通过工具在对话中随时记录/查询（"我之前在哪工作过？""我妈叫什么来着？""我招行卡里还有多少？"）。
- **用户侧**：在 DSH 设置页有一个面板，像填表一样查看和编辑，不依赖对话。

### 1.2 信息域（五域）

| # | 信息域 | 用户原话关键词 | 归纳 |
|---|--------|----------------|------|
| 1 | 基本信息 | 年龄、名称、性别、出生地、归属地、现居地 | 单例档案头；年龄由生日派生，不单独存储 |
| 2 | 工作经历 | 过去的公司/职位/工作内容；当前在职公司/内容/薪资 | 条目列表；`endDate` 空 = 在职；薪资结构化（数额/币种/周期/备注） |
| 3 | 人际关系 | 周围的人有哪些、和自己的关系 | 条目列表；关系是相对"我"的称谓 |
| 4 | 人生感悟 | 按时间归纳 | 条目列表；以 `date` 为主时间轴，倒序归档 |
| 5 | 资产 | 银行卡存款、支付宝/微信余额、股票账户余额、同花顺持仓 | 账户列表（三类）+ 持仓列表（归属某股票账户）+ 按币种汇总 |

### 1.3 非功能需求

| 编号 | 需求 | 设计响应 |
|------|------|----------|
| NFR-1 | 隐私：档案不离开本机 | 单文件 JSON，落在 `$DSH_HOME/integrations/dsh-myinfo/data.json`，权限 0600，目录 0700；不入 git（见 `.gitignore`） |
| NFR-2 | 面板不可被局域网/网页访问 | 路由仅接受回环来源；`Host` 头必须是 localhost 名（防 DNS rebinding）；POST 强制 JSON + Origin/Sec-Fetch-Site 校验（防跨站写） |
| NFR-3 | 数据不会写坏 | 原子替换保存（临时文件 + rename）；校验失败即拒绝、不落盘 |
| NFR-4 | 双入口一致 | agent 工具与设置页面板走同一套校验与变更事务（`store.mutate`） |
| NFR-5 | 兼容 DSH 0.2.x | 无原生依赖；`engines.dsh >= 0.2.1-rc.1` |

### 1.4 边界（明确不做）

- 不做自动抓取银行/支付宝/券商数据（无官方 API，风险高）；余额由用户口述或 agent 从已有对话记录中代填，面板手动维护。
- 不做交易、下单等写操作；持仓只读记录。
- 不做多用户/云同步。

## 2. 数据建模

### 2.1 顶层结构（data.json，version 1）

```
profile
├── identity      基本信息（单例对象）
├── career[]      工作经历（条目数组）
├── relations[]   人际关系（条目数组）
├── reflections[] 人生感悟（条目数组）
├── assets
│   ├── accounts[]   资产账户（银行卡/支付软件/股票账户）
│   └── holdings[]   证券持仓（归属某个股票账户）
└── meta          createdAt / updatedAt
```

### 2.2 实体字段表

**identity（基本信息）** — 全部字符串，可空：

| 字段 | 含义 | 约束 | 派生 |
|------|------|------|------|
| name | 姓名 | ≤120 字符 | |
| gender | 性别 | ≤120 | |
| birthDate | 出生日期 | `YYYY-MM-DD` | **age**（周岁，视图层计算） |
| birthplace | 出生地 | ≤120 | |
| origin | 归属地 | ≤120 | |
| residence | 现居地 | ≤120 | |
| phone / email | 联系方式 | ≤120 | |
| notes | 备注 | ≤2000 | |

**career（工作经历）**：

| 字段 | 含义 | 约束 |
|------|------|------|
| id | 主键 | `c1, c2…`（服务端生成） |
| company / title | 公司 / 职位 | 必填，≤120 |
| location | 工作地点 | ≤120 |
| startDate | 入职时间 | 必填，`YYYY`/`YYYY-MM`/`YYYY-MM-DD` |
| endDate | 离职时间 | 可空；**空 = 在职**（派生 `current`） |
| content | 工作内容 | markdown，≤20000 |
| salary.amount | 金额 | 数字或空；四舍五入到分 |
| salary.currency | 币种 | 默认 `CNY` |
| salary.period | 周期 | `monthly`/`annual`/`hourly`/`total`/`other` |
| salary.notes | 说明 | ≤500 |
| updatedAt | 修改时间 | ISO 时间戳 |

> 所有列表条目（career / relations / reflections / accounts / holdings）均携带服务端生成的 `updatedAt`（ISO 时间戳，每次保存刷新）；id 由服务端按前缀+序号分配，并持久化序号水位线——删除后不复用旧 id。

**relations（人际关系）**：

| 字段 | 含义 | 约束 |
|------|------|------|
| id | 主键 | `r1, r2…` |
| name | 姓名 | 必填 |
| relation | 与我的关系 | 必填（如 母亲/大学室友/前同事） |
| group | 分组 | 默认 `其他`（家人/朋友/同事/同学…） |
| contact | 联系方式 | ≤200 |
| notes | 备注 | markdown ≤4000 |
| tags[] | 标签 | 字符串数组 |

**reflections（人生感悟）**：

| 字段 | 含义 | 约束 |
|------|------|------|
| id | 主键 | `f1, f2…` |
| date | 日期 | 必填 `YYYY-MM-DD`；列表按其倒序 |
| title | 标题 | ≤200 |
| content | 正文 | 必填 markdown ≤20000 |
| tags[] | 标签 | 字符串数组 |

**assets.accounts（资产账户）**：

| 字段 | 含义 | 约束 |
|------|------|------|
| id | 主键 | `a1, a2…` |
| kind | 账户类型 | `bank` 银行卡 / `pay` 支付宝、微信等 / `stock` 股票账户 |
| name | 名称 | 必填（如 招商银行、支付宝、同花顺） |
| mask | 尾号/标识 | ≤32（如 `尾号 8888`） |
| balance | 余额 | 必填数字（可为负） |
| currency | 币种 | 默认 `CNY` |
| notes | 备注 | ≤500 |

**assets.holdings（证券持仓，如同花顺账户的股票）**：

| 字段 | 含义 | 约束 |
|------|------|------|
| id | 主键 | `h1, h2…` |
| account | 归属账户 | 必填（账户 id 或名称，如 `a3`/`同花顺`） |
| code / name / market | 代码 / 名称 / 市场 | code 必填 |
| shares | 股数 | 必填 > 0，4 位小数 |
| costPrice | 成本价 | 数字可空 |
| price | 最新价 | 数字可空；市值 = shares × (price ?? costPrice ?? 0) |
| notes | 备注 | ≤300 |

### 2.3 口径约定

- **stock 账户 balance 的语义 = 现金/可用资金**（不含证券市值），避免与持仓市值双计；券商总资产请在备注说明。
- **持仓市值统一按 CNY 计入合计**；非 CNY 标的请换算成 CNY 后填写 price。
- **在职**：endDate 为空即"在职"，允许多条并存（兼职/顾问）；UI 以徽标逐条标记。
- **持仓→账户为弱引用**（账户 id 或名称）：删除账户不级联删除持仓；未匹配到账户的"孤儿持仓"在明细表按原引用文本展示。

### 2.4 派生视图（不落盘，读取时计算）

- `identity.age`：由 birthDate 按本地时区计算周岁。
- `career[].current`：`endDate` 为空即在职；列表按 startDate 倒序。
- `reflections[]`：按 date 倒序。
- `assets.totals`：账户按各自 currency 分桶聚合 `{bank, pay, stock}`；持仓市值统一计入 CNY 桶的 `holdings`；`grand` = 三类余额 + 持仓市值（桶内求和）。

### 2.5 实体关系（ER 概览）

```
identity (1)
career (N)          ── 按时间倒序，endDate 空 = 当前工作
relations (N)
reflections (N)     ── date 时间轴
assets.accounts (N) ─┬─ kind ∈ {bank, pay, stock}
                     └─< assets.holdings (N)  holding.account → account(id|name)
```

## 3. 功能表单

### 3.1 agent 工具（5 个）

| 工具 | 动作 | 说明 |
|------|------|------|
| `personal_identity` | `get` / `patch` | 读取 / 部分更新基本信息；patch 只认已知字段 |
| `personal_career` | `list` / `add` / `update` / `delete` | 工作经历 CRUD；update 按 id 整体替换 |
| `personal_relations` | `list` / `add` / `update` / `delete` | 人际关系 CRUD |
| `personal_reflections` | `list` / `add` / `update` / `delete` | 人生感悟 CRUD（按日期） |
| `personal_assets` | `get` / `save-account` / `delete-account` / `save-holding` / `delete-holding` | 资产台账；save-* 不带 id = 新增，带 id = 更新 |

所有工具输出结构化 JSON，并同时渲染中文 Markdown 摘要（聊天里直接可读）。

### 3.2 设置页面板（5 个页签）

| 页签 | 内容 | 表单 |
|------|------|------|
| 基本信息 | 档案头 + 年龄展示 | 9 个字段的编辑表单（保存 = identity-patch） |
| 工作经历 | 倒序列表，在职徽标，薪资 | 公司/职位/地点/起止/内容/薪资 表单 |
| 人际关系 | 分组卡片 | 姓名/关系/分组/联系方式/备注/标签 表单 |
| 人生感悟 | 按年分组的时间线 | 日期/标题/正文/标签 表单 |
| 资产 | 合计卡片 + 三类账户 + 持仓明细表 | 账户表单（类型/名称/尾号/余额/币种）、持仓表单（账户/代码/名称/市场/股数/成本/现价） |

### 3.2.1 主面板与浮窗（v0.3.0 新增，Apple 风格）

| 表面 | 挂载点 | 内容 |
|------|--------|------|
| 中央主面板「个人档案」 | `sidebar.panellist`（图标）+ `main`（keyed，id=`myinfo`） | 整页档案：hero 头（姓名/年龄/现居地/总资产）+ 五段分段控件 + 五域内容（与设置页共用组件与表单） |
| 资产速览浮窗 | `shell.overlay` | 右下角胶囊显示总资产；点击展开毛玻璃速览卡（四类资产 + 更新时间），一键跳转主面板；每 60s 静默刷新 |
| 右侧停靠面板 | `sidebarRightTabs.register`（id=`dsh-myinfo-dock`，kind=`myinfo.profile`）+ `sidebar.right.pane.tab[.title]` | 会话右栏的窄列档案摘要（基本资料卡 + 资产统计 + 持仓前 5），从引导页或主面板「在右侧停靠」打开 |
| 深色手动开关 | localStorage（`dsh-myinfo.theme`） | 主面板/设置页/浮窗卡三处 ☀️/🌙 按钮；手动值优先，清除即恢复自动；自动判定链 = `--dsw-alias-bg-base` 实算亮度 > theme 服务 id 启发（含 dark 判深、light/day/default 前缀判浅）> 系统偏好 |

视觉语言：SF 字体栈、毛玻璃材质（backdrop blur + saturate）、hairline 分隔、iOS 分段控件、颜色 token 经 `var(--dsw-alias-*)` 挂接宿主主题（Apple 色兜底），明暗主题 = 手动开关 > dsw token 亮度实算 > theme id 启发 > 系统偏好。

### 3.3 记录时机（给 agent 的使用约定）

| 场景 | 动作 |
|------|------|
| 用户自述家乡、生日、搬家 | `personal_identity patch` |
| 聊到入职/离职/调薪 | `personal_career add/update` |
| 提到家人朋友同事 | `personal_relations add` |
| 发出感悟/复盘 | `personal_reflections add`（date=当天） |
| 报余额、查资产、持仓变动 | `personal_assets save-*` / `get` |
