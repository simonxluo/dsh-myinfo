# dsh-myinfo 多模型交叉评审报告

- **Workflow**：`myinfo-design-audit`（DeepSeek Harness workflow 编排，4+1 个 agent）
- **时间**：2026-10-24 · **对象**：v0.1.0 全仓（docs ×2 + Host ×5 + client.js + 测试 + 仓库文件）
- **目的**：需求覆盖核查、设计-实现一致性、对抗性缺陷挖掘、交叉裁决去幻觉

## 1. 评审编排与模型

| 阶段 | 评审者 | 模型 | 职责 |
|------|--------|------|------|
| ① 需求与数据建模 | req-A | glm-5.3（默认） | 五域需求逐条对照字段表/功能表单 |
| ① 需求与数据建模 | req-B | step-5-preview | 独立复审，两份文档口径一致性 |
| ② 设计与实现一致性 | cons | step-5-preview | design.md 每条声明逐行核对代码 |
| ③ 对抗性缺陷猎手 | hunter | glm-5.3-flash | 先跑测试再专找未覆盖问题，给最小触发输入 |
| ④ 交叉裁决 | judge | glm-5.3 | 逐条用 read/grep/本地复现核实，剔除幻觉与重复 |

4/4 个评审 agent 全部完成（无失败/超时）。

## 2. 幻觉核查结论

- 原始发现 **33 条**，裁决阶段逐条对照真实文件与 git 历史核实（含 `npm pack --dry-run`、从 app.asar 解包核对宿主校验代码、14 组行为复现实验）。
- **完全幻觉：0 条**（rejected 为空）。两处引用瑕疵被降格保留：一处文件名/行号指向错误但结论在相邻代码成立；若干行号一行之差。
- 重复项合并 8 组后确认 **24 条**：major 7 / minor 10 / nit 7（其中 1 条为评审者自标的正面确认）。

## 3. 确认问题清单与修复状态（v0.2.0 全部处理）

### Major（7/7 已修复）

| # | 问题 | 修复 |
|---|------|------|
| M1 | README/design 引用的 workflow-report.md 不存在（交付要求 (c) 无落地） | 本文件即是 |
| M2 | design 声称"id 永不复用"但实现会复用 | `meta.idSeq` 水位线（ids.js/store.js），回归测试覆盖 |
| M3 | 面板编辑工作经历把 salary.currency 静默重置为 CNY | 表单增加币种输入，payload 携带 currency |
| M4 | 无 stock 账户时持仓明细完全不渲染 | 持仓表提升为独立区块，孤儿持仓可见 |
| M5 | update 漏传/传非字符串 id 静默变成 add | 三个 CRUD 工具 update 前置校验 id，缺 id 抛 StoreError |
| M6 | startDate/endDate 接受 2025-13-45 等不可能日期 | when() 增加月 01-12、日 01-31 数值校验 |
| M7 | 读路径兜底不严（数组元素→数字键对象；字符串余额拼接污染 totals） | normalizeProfile 过滤数组元素 + 数字字段 Number() 收敛 |

### Minor（10/10 已处理）

| # | 问题 | 修复 |
|---|------|------|
| m1 | 资产聚合口径两文档矛盾；stock balance 语义未定义（双计风险） | requirements §2.3 明确：balance=可用资金；持仓市值恒记 CNY |
| m2 | 无 endDate≥startDate 校验；在职唯一性未声明 | 跨字段校验 + §2.3 声明允许多条在职 |
| m3 | 删除账户产生孤儿持仓且无处置规则 | §2.3 声明弱引用规则；UI 显示原引用文本 |
| m4 | 坏 JSON 返回 500 且泄露解析器细节 | panel catch 按 error.kind 分流：bad-json→400、too-large→413，消息固定 |
| m5 | store.js 死代码（ID_PREFIX/nextId）与死机制（subscribe 无订阅者） | 删除；注释与 design.md 同步改为"提交后重取" |
| m6 | patch 参数 `additionalProperties:{type:'string'}` 超出宿主 JSON Schema 子集 | 改为 `true`（白名单在 execute 内强制） |
| m7 | requirements 字段表漏 holdings.notes 与四类 updatedAt | 字段表补齐 + 统一说明 |
| m8 | D7 承诺"视图层名称匹配"未实现（持仓表显示 a4 这类 id） | 工具渲染与 UI 表格均做 id→账户名解析 |
| m9 | line() 把对象存成 "[object Object]" | 非字符串类型直接抛 StoreError |
| m10 | 余额无范围校验 | money() 增加 |值| < 1e13 护栏 |

### Nit（6/7 已修复，1 条为正面确认无需修复）

| # | 问题 | 修复 |
|---|------|------|
| n1 | ageOf 用 UTC 日界，东八区生日凌晨少 1 岁 | 改本地时区年月日比较 |
| n2 | 感悟正文框标签误用"备注"；默认日期 UTC 取前一天 | 新增"正文"键；默认日期取本地时区 |
| n3 | 原子保存缺 fsync | rename 前 fsync 临时文件 |
| n4 | files 不含 docs/test，发布包 README 链接 404 | files 增加 docs/*.md 与测试 |
| n5 | design 无样式约定；<style> 每次挂载叠加 | design §2.4 补约定；ensureStyle() 幂等单次注入 |
| n6 | 413 先 destroy 可能截断响应体 | 等 response finish/close 再 destroy |
| n7 | 正面确认：.gitignore/测试隔离/数字框空串守卫/进程内并发安全 | 无需修复（记录在案） |

## 4. 需求覆盖交叉结论

四位评审者独立核对五域需求，**missing 仅 1 项**（即 M1：workflow 报告未落地），修复后五域全部闭环：基本信息（含年龄派生）✅ / 工作经历（含薪资、在职标记）✅ / 人际关系 ✅ / 人生感悟按时间归纳 ✅ / 资产台账（银行卡、支付宝微信、股票账户、同花顺持仓、按币种合计）✅；交付 (a)(b)(c)(d) 四项全部落地。

## 4.1 安装后实机验证追加发现（v0.2.0 内修复）

workflow 之后的真机端到端（直接调用注册后的 `personal_*` 工具）暴露了一个评审与单测都漏掉的缺陷：

- **渲染解包缺陷（major 级）**：add/update/delete 动作返回 `{id, action, profile}` 包装对象，而 output.render 期望 profileView，导致变更类调用的聊天渲染报 `Cannot read properties of undefined`（写入本身成功）。单测直接调 render 传 profileView，绕过了该路径。已修复：渲染入口统一 `v.profile ?? v` 解包，并新增走工具真实输出路径的回归用例。

## 5. 回归验证

- `node test/host.test.mjs`：原有断言 + 10 组回归用例全部通过（id 水位线、不可能日期、跨字段校验、类型拒绝、update 缺 id、金额范围、读路径兜底、字符串余额收敛、数组条目剔除、渲染解包）。
- 安装后实机验收（desktop profile）：5 工具全部注册 ✅；identity/career/relations/reflections/assets 五域读写与 Markdown 渲染 ✅；持仓账户名解析（id→名称）✅；市值与按币种合计 ✅；id 水位线（删 c2 后新增得 c3）✅；面板 GET/POST ✅；跨站写拒绝（evil origin → 403 untrusted）✅；测试数据已全部清理还原。


## 6. v0.4.1/v0.4.2 设置页主题缺陷评审（2026-10-25）

- **触发**：用户报告设置页按钮与文字布局被破坏。Playwright 用真实 client.js 模块复现：宿主深色 + 主题 id 不含 "dark"（如 midnight）时 autoDark 误判浅色，深色文字叠宿主深色底。
- **v0.4.1 修复**（子 agent 执行，commit 1f7f6f5）：颜色 token 挂接 `var(--dsw-alias-*, Apple兜底)` 双层结构；autoDark 增加 dsw 令牌亮度实算与快照判据；Chip 空 tone 残类清理。
- **跨模型评审**（step-5-preview + glm-5.3-flash，均 pass-with-issues）：确认 CSS token 结构正确、`判定与渲染解耦`论断成立（判错 class 不再影响颜色，仅阴影字面量）、报告症状在真实宿主结构下已消除。发现两个 major：真实宿主令牌挂在 body（非 documentElement）且快照权威判据是 active.colorScheme，v0.4.1 的两条自动判定分支在真实宿主为死代码；以及 parseColorLuminance 测试未入库（minor）。
- **v0.4.2 修复**：autoDark ① 改读 `getComputedStyle(document.body)`（回退 documentElement）② 增加 `snap.active.colorScheme` 判据；删除死 token --dmi-bg-opaque；hero 卡硬编码蓝边令牌化；parseColorLuminance 11 例 + autoDark 结构断言入库（test/host.test.mjs）；校验页新增 realhost 模式（令牌挂 body + data-ds-dark-theme + 真实快照形状）复刻宿主结构复验通过。
- **残余已知项**（nit，接受）：--dmi-shadow 明暗两套字面量未 token 化（判错 class 时阴影深浅轻微错配，颜色不受影响）；dsw 变量声明为空串的病理场景无 CSS 兜底（宿主不会产生）。

## 7. v0.4.3 右栏停靠面板布局修复（2026-10-25）

- **触发**：用户报告「DSH 内嵌面板的个人档案内容布局异常」。代码审查确诊：`MyInfoDock` 的「打开完整档案」按钮与空态文字被错误嵌进 `.dmi-stats` 网格容器（`display:grid`），按钮被拉伸为网格单元与统计卡混排。
- **根因**：v0.4.0 新增 dock 表面时从未被视觉验证——校验页 surface 不含 dock，且桩 ctx 不提供 `sidebarRightTabs` 服务，dock 注册分支在所有验证中都被跳过。
- **修复**：统计网格只放统计卡；空态与按钮各自独立成行。全仓审计其余 `.dmi-stats/.dmi-grid` 容器子元素均合规（仅此一处违例）。
- **验证补口**：校验页新增 `surface=dock`（含 320px 窄列模拟 + sidebarRightTabs 桩），realhost 深色模式截图确认布局正确；单测全绿。

## 8. v0.5.0 三处真实宿主回归修复（2026-10-25）

真实应用反馈：三个插件侧栏标签行高低不齐、☀️/🌙 切换「点了没反应」。harness 计算样式取证发现：

1. **CSS 缺分号（v0.4.1 回归）**：`--dmi-bg-elev:...))` 与 `--dmi-shadow:` 两行拼接少 `;`，自定义属性把下一条声明整段吞进值里 → 真实应用所有卡片背景透明、大阴影未定义（`DIAG card-bg=rgba(0,0,0,0)`、`--dmi-shadow=""`）。补分号修复。
2. **手动主题切换双重失效**：① `.dmi-dark` 只换兜底字面量，真实宿主 body 上永远有 dsw 变量 → 视觉恒定；② 面板组件不订阅主题变化，点击只重渲染按钮自身。改为三层 token：`auto-dark`（dsw 链跟随宿主）/ `force-light` / `force-dark`（纯字面量真实覆盖，页面表面补底色）；新增 `useThemeTick()` 让 Section/Panel/Dock/Overlay 全部响应切换；按钮三态化（🌗 自动 → ☀️ 浅色 → 🌙 深色，title 提示当前态与次态）。harness 实测：dsw=dark 环境点击后 class `dmi-force-light`（bg 255,255,255,.96）→ `dmi-force-dark`（bg 30,30,35,.97）。
3. **刷新无反馈**：`load()` 现置 busy，四处刷新按钮显示瞬时「…」并短暂禁用。

侧栏标签修复（另两仓库）：dsh-ssh-manager v1.1.1 与 @local/easy2learn-panel v1.0.1 的 `sidebar.panellist` occupant 由 36×36 嵌套 `<button>`（非法 HTML，宿主行 min-height 36px+padding 7px 被撑到 ~50px）改为按宿主 `props.size`（16/18）渲染的纯 SVG；宿主 PanelRow 自带点击处理。harness 以宿主真实 kB3qhq_* 规则复验：四行行高 `[36,36,36,36]`、无嵌套按钮、图标不超标。

## 9. v0.6.0 卡片式主面板 + personal_context 摘要工具（2026-10-25）

主面板由「分段控件平铺」重构为 Apple 风卡片仪表盘：五域各一张卡（渐变圆角图标 + 主摘要 + 次行说明 + ›），点击进域详情页（返回胶囊 + 大标题 + 弹簧滑入动画），详情复用既有 TabBody 编辑组件。新增 `personal_context` 工具：一次调用返回身份/当前在职/身边的人/最新感悟/资产合计与主要持仓的紧凑摘要及 Markdown 渲染，供对话实时装载用户个人上下文。harness 实测：卡片 ×5、点「工作经历」→ detail-title=工作经历 back=true、返回后 cards=5；修复 CardIcon 把图标工厂当 React 组件传参导致 svg width="[object Object]" 的问题（改为直接调用工厂取元素）。

## 10. v0.6.1 卡片网格比例修复（2026-10-25）

用户反馈（宽窗口截图取证）：中央列 ~1100px 时 `auto-fill(236px)` 排出 4-5 列单行，五张卡变成 ~230×70 的细长条挤在页面顶部，下方大片空白——不是布局 bug 而是比例失衡。修复：卡片改纵向布局（渐变图标在上 + 17px 大号统计 + 次行说明，› 绝对定位右侧居中），网格 `minmax(min(100%,264px),1fr)` + `max-width:920px`，`.dmi-page>*` 统一 `max-width:960px` 居中（系统设置式的居中文档版式）。harness 三档实测：1100px → 3 列×2 行（296px 卡）、796px → 3 列、448px（窄中央列/右栏开启）→ 单列 384px 纵排卡。

## 11. v0.7.0 右栏停靠面板可交互 + 浮窗避让（2026-10-25）

用户反馈：右栏「不能直接交互查看，每次都跳到主面板」。两层原因：① 资产浮窗（viewport 级 fixed、z-index 9990）压在右栏区域上，右栏下半部的点击全落在浮窗胶囊/速览卡的「打开完整档案」上 → 误触 selectPanel 跳转；② 停靠面板本身是纯摘要 + 单一跳转按钮的设计。修复：浮窗每 400ms 探测宿主 dock 根节点的 [data-sidebar-right-open] 状态属性，右栏打开即整体隐藏；停靠面板改为栏内导航——摘要块（基本资料卡/统计网格/持仓卡）可点击展开对应域详情（复用 TabBody，支持编辑），另加 工作经历/人际关系/人生感悟 三个快捷胶囊，「打开完整档案」保留为显式跳转。harness 实测：dock-overlay-hidden=true、点摘要 → back+detail、返回后摘要恢复、docknav 点人生感悟 → 栏内时间线。

## 12. v0.7.1 右栏摘要改用域卡片（2026-10-25）

用户反馈：右栏应是「有标题、详细内容页面框」，而不是灰色小胶囊按钮。停靠面板摘要视图改为复用主面板的 DomainCard（渐变图标 + 标题 + 大号摘要 + ›，窄列单列堆叠），点卡片在栏内展开对应域详情页（v0.7.0 的栏内导航保留），删除 dmi-docknav 胶囊与旧摘要块/统计网格；「打开完整档案」保留。harness 实测：五卡 292px 单列、dock-detail back/body、dock-back-cards=5、浮窗避让不受影响。

## 13. v0.7.2 编辑表单渲染修复（2026-10-25）

用户反馈：点「编辑」拿不到原始信息。根因：全部表单用直接调用模式 `Field({…}, Input({…}))`/`Select({…}, options…)`，而组件只读 `props.children`（直接调用时 children 是第二个位置参数、props.children 恒为 undefined）——表单只渲染标签，输入框从未渲染（v0.2.0 起所有五个页签的编辑/新增表单全部如此，此前的 e2e 只覆盖展示渲染，未覆盖表单）。修复 Field/Select 签名为 (props, children)。harness 新增表单回归链：基本信息卡 → 编辑 → form-fields=9、首输入框值"张三"。
