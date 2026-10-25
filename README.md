# dsh-myinfo

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 个人信息管理插件：把「我是谁、我做过什么、我身边有谁、我想通了什么、我有多少资产」沉淀成一份本机档案。

- **基本信息**：姓名 / 性别 / 出生日期（自动算年龄）/ 出生地 / 归属地 / 现居地
- **工作经历**：公司、职位、时间、内容、薪资（当前在职自动标记）
- **人际关系**：周围的人与和我的关系，分组 / 标签
- **人生感悟**：按日期归档的时间线
- **资产台账**：银行卡、支付宝、微信余额；股票账户余额与持仓（如同花顺 A 股持仓），按币种自动汇总

三个界面入口 + agent 工具共用同一份数据（`$DSH_HOME/integrations/dsh-myinfo/data.json`，权限 0600，绝不离开本机）：

- **agent 工具**：`personal_identity` / `personal_career` / `personal_relations` / `personal_reflections` / `personal_assets`，聊天里直接记录与查询；
- **主面板**（Apple 风格）：侧栏「个人档案」图标 → 整页档案（hero 头 + 分段控件五域）；
- **资产速览浮窗**：右下角毛玻璃胶囊显示总资产，点开速览卡、一键跳主面板，每分钟自动刷新；
- **设置面板**：DSH 设置 → 「个人信息」，与主面板共用的五域表单。

设计文档见 [docs/requirements.md](docs/requirements.md)（需求与数据建模）与 [docs/design.md](docs/design.md)（控制流/数据流/模块），并经多模型 workflow 交叉评审（[docs/workflow-report.md](docs/workflow-report.md)）。

## 安装

```sh
# 网页端 / 桌面端插件页添加包名：
dsh-myinfo
# 或命令行：
dsh plugin --profile web add dsh-myinfo
```

本地开发：`npm test`（Host 端单元测试，使用临时目录，不触碰真实档案）。

## 隐私

仓库本身**不含任何个人数据**；运行期数据只写入 `$DSH_HOME`，已被 `.gitignore` 排除的本地文件也不会进入版本库。
