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
