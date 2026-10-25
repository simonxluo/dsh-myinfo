<div align="center">

<img src="../icon.svg" width="108" alt="dsh-myinfo"/>

# dsh-myinfo

**[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 本机个人信息档案插件——我是谁、我做过什么、我身边有谁、我想通了什么、我有多少资产。**

[![version](https://img.shields.io/badge/version-0.5.0-0071e3)](https://github.com/simonxluo/dsh-myinfo/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-34c759)](https://github.com/simonxluo/dsh-myinfo/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5_0.2.1--rc.1-8957e5)](https://github.com/deepseek-ai/deepseek-harness)
[![platform](https://img.shields.io/badge/platform-Web_%7C_Desktop-8E8E93)](https://github.com/simonxluo/dsh-myinfo)

🇬🇧 [English](../README.md) · 🇨🇳 **简体中文** · 🇯🇵 [日本語](README.ja.md) · 🇪🇸 [Español](README.es.md)

</div>

---

## 目录

- [功能](#功能)
- [一份数据、五个入口](#一份数据五个入口)
- [安装](#安装)
- [隐私](#隐私)
- [文档](#文档)
- [本地开发](#本地开发)
- [许可](#许可)

---

## 功能

- **基本信息**：姓名 / 性别 / 出生日期（自动算年龄）/ 出生地 / 归属地 / 现居地
- **工作经历**：公司、职位、时间、内容、薪资（当前在职自动标记）
- **人际关系**：周围的人与和我的关系，分组 / 标签
- **人生感悟**：按日期归档的时间线
- **资产台账**：银行卡、支付宝、微信余额；股票账户余额与持仓（如同花顺 A 股持仓），按币种自动汇总

## 一份数据、五个入口

所有入口读写同一份本机文件（`$DSH_HOME/integrations/dsh-myinfo/data.json`，权限 0600，绝不离开本机）：

- **agent 工具**：`personal_identity` / `personal_career` / `personal_relations` / `personal_reflections` / `personal_assets`，聊天里直接记录与查询
- **主面板**（Apple 风格）：侧栏「个人档案」图标 → 整页档案（hero 头 + 分段控件五域）
- **资产速览浮窗**：右下角毛玻璃胶囊显示总资产，点开速览卡、一键跳主面板，每分钟自动刷新
- **右侧停靠面板**：会话右栏的档案摘要卡（主面板点「在右侧停靠」或从右栏引导页打开）
- **设置面板**：DSH 设置 → 「个人信息」，与主面板共用的五域表单
- **外观三态开关**：各表面的 🌗 → ☀️ → 🌙（跟随应用 → 浅色 → 深色）；手动档用字面量真实覆盖宿主主题，再点一下回到跟随应用

## 安装

```sh
# 网页端 / 桌面端插件页添加包名：
dsh-myinfo
# 或命令行：
dsh plugin --profile web add dsh-myinfo
```

## 隐私

仓库本身**不含任何个人数据**；运行期数据只写入 `$DSH_HOME`，已被 `.gitignore` 排除的本地文件也不会进入版本库。

## 文档

- [需求与数据建模](requirements.md)
- [控制流 / 数据流设计](design.md)
- [多模型 workflow 评审报告](workflow-report.md)

## 本地开发

```sh
npm test   # Host 端单元测试，使用临时目录，不触碰真实档案
```

## 许可

[MIT](../LICENSE)
