# dsh-myinfo 设计文档（控制流 / 数据流 / 模块）

> 前置：数据建模见 `docs/requirements.md`（先建模，后设计）。版本 v0.4.2（v0.4.0 的 Apple 风格主面板/浮窗/右栏停靠 + 手动深浅外观；本版宿主主题集成：dsw token 挂接 + 亮度实算深浅判定）。

## 1. 模块划分

```
dsh-myinfo（Cordis bundle，一包两半）
├── index.js    插件入口：注册 agent 工具 + 挂载面板路由
├── store.js    数据层：加载/校验/原子保存/变更事务/派生视图 ★唯一写入通道
├── tools.js    agent 工具层：5 个工具的参数 schema + 执行 + Markdown 渲染
├── panel.js    面板 API 层：webServer 路由（GET 读 / POST 写）+ 访问控制
├── ids.js      id 生成（c/r/f/a/h 前缀递增）
├── client.js   Web UI（浏览器半）：设置页 5 页签面板
└── test/       Host 端单元测试（node test/host.test.mjs）
```

依赖方向（单向，无环）：

```
index.js ──▶ tools.js ──▶ store.js
    │            │            │
    └──▶ panel.js ─┴──────────┘
                    ids.js ◀─ (tools/panel)
client.js ──HTTP──▶ panel.js（不直接 import Host 模块）
```

## 2. 控制流

### 2.1 启动（插件装配）

```
Loader 读 cordis.patch.yml ──▶ 激活插件行 myinfo
  └─ apply(ctx)
       ├─ ctx.effect(() => ctx.tools.register(definition))   × 5   [inject: tools]
       └─ installPanelWeb(ctx)
            └─ ctx.inject(['webServer'], …)                        [可选依赖]
                 └─ webServer.register({ kind:'exact', path:'/_dsh/dsh-myinfo/panel' })
```

- 工具注册用 `ctx.effect`，卸载时自动反注册。
- webServer 是**可选注入**：headless/CLI profile 没有它时工具照常工作。

### 2.2 写路径（两个入口，一条事务）

**入口 A：agent 工具**

```
模型调用 personal_career{action:'add', entry}
  └─ tools.js execute()
       ├─ careerEntry(entry)        规范化+校验（StoreError 即拒绝）
       └─ upsertInto(listFn, kind, value, id)
            └─ store.mutate(fn)
                 ├─ loadProfile()   读 data.json（缺失→空白档案）
                 ├─ fn(profile)     业务变更（在这里分配 id、盖 updatedAt）
                 ├─ saveProfile()   临时文件(0600) → rename 原子替换
                 └─ notify listeners
       └─ 返回 {id, action, profile: profileView(...)}（render 出 Markdown 摘要）
```

**入口 B：设置页面板**

```
React 组件 POST {action:'career-save', entry, id}
  └─ panel.js handler
       ├─ ① 回环地址检查（socket.remoteAddress ∈ 127.0.0.1/::1）
       ├─ ② Host 头必须是 localhost 名（防 DNS rebinding 读）
       ├─ ③ POST 判定：Content-Type=application/json；Origin 若为 http(s) 须本机；Sec-Fetch-Site ∈ {same-origin, none}
       ├─ readJsonBody（≤256 KiB）
       └─ applyAction(body) ──▶ 与工具同一套校验器 + mutate 事务
            └─ 响应 {ok:true, value:{id, action}}；UI 随即 GET 刷新
```

**关键不变量**：校验（`*Entry()`）只发生在 mutate **之前**；mutate 内不再接触外部输入，保证"要么整体写入、要么不变"。

### 2.3 读路径

```
agent：工具 get/list ──▶ loadProfile() ──▶ profileView()（派生 age/current/倒序/totals）
UI   ：GET panel ──────▶ loadProfile() ──▶ profileView() ──▶ JSON
```

读路径无缓存：数据量（KB 级）下每次读文件的简单性优于失效管理。UI 刷新策略 = 自身提交成功后重新 GET（agent 改动不推送，面板手动刷新可见）。

### 2.4 UI 装配（浏览器半）

```
window.__ModuleLoader__.load({ id:'dsh-myinfo', factory })
  └─ factory(require)
       ├─ React = require('react')           （宿主模块表，不自带 React）
       └─ exports.apply(ctx)
            ├─ ctx.effect(() => subscribeLocale(ctx))   跟随界面语言（zh/en）
            ├─ settings.section（list）：设置页区块
            ├─ main（keyed，key='myinfo'）+ sidebar.panellist（list，同 id，order 20）
            │    中央整页档案；图标收 {size}，点击由宿主切面板（ctx.layout.selectPanel('myinfo') 亦可编程跳转）
            └─ shell.overlay（list，id='dsh-myinfo-overlay'）
                 右下角资产速览：胶囊态/卡片态均 position:fixed 自绘，pointer-events:auto，
                 毛玻璃 backdrop-filter，60s 定时刷新（组件 effect 内 setInterval，卸载清理）
```

组件内部：挂载时 GET 全量视图 → 每次提交后重新 GET；无本地副本的乐观更新（避免双写不一致）。
样式约定：全部 CSS 以 `dmi-` 前缀作用域化，由 `ensureStyle()` 在首次挂载时向 `document.head` 注入一次（幂等，卸载重挂不叠加）。颜色 token 经 `var(--dsw-alias-*)` 挂接宿主主题（Apple 色兜底），深浅判定按 `--dsw-alias-bg-base` 实算亮度，优先级 手动 > dsw 实算 > theme id 启发 > 系统偏好。

## 3. 数据流

### 3.1 主数据流（写入）

```
用户对话/面板表单
   │ 文本/表单字段
   ▼
tools.execute / panel.applyAction        （控制层）
   │ entry 原始对象
   ▼
store.*Entry() 校验器                     （规范化：去控制字符/trim/数字取整/日期格式）
   │ 规范化条目
   ▼
store.mutate()                            （事务：load → 变更 → save → notify）
   │ profile 完整对象
   ▼
data.json（0600，原子替换）                （唯一持久层）
   │
   ▼（任何下一次读取）
profileView()                             （派生：age / current / 排序 / totals）
   │
   ├──▶ 工具 output.render → Markdown     （给人看）
   └──▶ 面板 GET JSON → React 状态 → 表单  （给表单看）
```

### 3.2 id 数据流

```
新增请求(无 id) ──▶ ids.nextIdIn(list, kind, meta.idSeq) ──▶ 'c3'/'r2'/'a5'…
                    序号 = max(列表最大, 水位线) + 1，并回写水位线
更新/删除(带 id) ──▶ validId() 校验 ──▶ 命中条目；未命中 → StoreError（不静默新建）
                                    update 缺 id → StoreError（不会静默变成新增）
```

id 仅服务端生成；`meta.idSeq` 持久化水位线保证删除最大 id 后不复用旧 id。

### 3.3 资产汇总数据流

```
accounts[] ──┬─ kind=bank ──▶ totals[currency].bank   Σ balance
             ├─ kind=pay  ──▶ totals[currency].pay
             └─ kind=stock─▶ totals[currency].stock
holdings[]  ──────────────▶ totals.CNY.holdings       Σ shares×(price??costPrice??0)
                                                   ────────────────
                              totals[currency].grand = bank+pay+stock+holdings
```

约定：账户按其 currency 分桶；持仓市值暂记 CNY（非 A 股经账户币种体现，文档明示）。

### 3.4 安全边界数据流

```
浏览器(设置页) ──same-origin JSON──▶ panel 路由 ──▶ store        ✅
局域网请求     ──非回环───────────▶ 403                            ❌
外域页面       ──rebinding Host/跨站 Origin/Sec-Fetch-Site──▶ 403 ❌
agent 工具     ──进程内直调────────▶ store                        ✅
git           ──.gitignore 排除 data.json/本地数据──▶ 只提交代码文档 ✅
```

## 4. 关键设计决策

| # | 决策 | 理由 / 放弃的替代方案 |
|---|------|----------------------|
| D1 | 单 JSON 文件而非 SQLite | KB 级数据、零原生依赖、可直接备份；SQLite 对此规模是过度设计 |
| D2 | 工具与面板共用 store 校验 | 双入口一致性（NFR-4）；替代方案"面板走工具"会引入 webServer→tools 的反向依赖 |
| D3 | update 整体替换而非深合并 | 表单语义（清空字段=显式留空）；深合并会让"删除备注"无法表达 |
| D4 | 派生字段不落盘 | age/current/totals 随读取计算，避免"过了生日数据过期"类不一致 |
| D5 | webServer 可选注入 | headless profile 无 UI 也能用工具 |
| D6 | id 前缀 + max+1 | 人读友好（c3=career#3）、稳定、无 UUID 噪音 |
| D7 | 持仓挂账户（id 或名称）而非硬外键 | 允许"先记持仓后建账户"的口述顺序；展示层把 id 解析为账户名，孤儿持仓按原引用文本显示 |

## 5. 验证策略

| 层 | 手段 | 覆盖 |
|----|------|------|
| 数据层/工具层 | `node test/host.test.mjs`（临时 DSH_HOME） | 五域 CRUD、校验拒绝、排序、在职派生、年龄派生、汇总取整、upsert 不重复、0600 权限、Markdown 渲染 |
| 面板 API | 安装后 `curl 127.0.0.1:PORT/_dsh/dsh-myinfo/panel`（GET/POST + 跨站拒绝样本） | 路由可达、鉴权生效 |
| UI | 设置页人工/截图核对 | 5 页签渲染、表单往返 |
| 设计本身 | 多模型 workflow 交叉评审（见 docs/workflow-report.md） | 需求覆盖、幻觉检查、缺陷清单 |
