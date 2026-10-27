<div align="center">

<img src="icon.svg" width="108" alt="dsh-myinfo"/>

# dsh-myinfo

**A local-first personal dossier for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — who I am, what I've done, who's around me, what I've figured out, and what I own.**

[![version](https://img.shields.io/badge/version-0.10.0-0071e3)](https://github.com/simonxluo/dsh-myinfo/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-34c759)](https://github.com/simonxluo/dsh-myinfo/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5_0.2.1--rc.1-8957e5)](https://github.com/deepseek-ai/deepseek-harness)
[![platform](https://img.shields.io/badge/platform-Web_%7C_Desktop-8E8E93)](https://github.com/simonxluo/dsh-myinfo)

🇬🇧 **English** · 🇨🇳 [简体中文](docs/README.zh.md) · 🇯🇵 [日本語](docs/README.ja.md) · 🇪🇸 [Español](docs/README.es.md)

</div>

---

## Contents

- [Features](#features)
- [One data source, five surfaces](#one-data-source-five-surfaces)
- [Install](#install)
- [Privacy](#privacy)
- [Documentation](#documentation)
- [Development](#development)
- [License](#license)

---

## Features

- **Identity** — name / gender / birth date (age computed automatically) / birthplace / origin / residence
- **Career** — company, title, period, work content, salary (current job auto-badged)
- **Relationships** — people around you and their relation to you, with groups and tags
- **Reflections** — life notes archived on a dated timeline
- **Assets** — bank cards, Alipay / WeChat balances, stock-account cash and holdings (e.g. THS A-share positions), totaled per currency; `refresh-prices` pulls free Tencent quotes (A-share / HK / US) in one call to refresh every holding's live price and market value — tickers only, never account info. Since v0.10.0 the assets panel, dashboard card and overlay pill also track holdings **live**: a session-aware poller hits the free feed every 3 s during market hours (idle off-hours; prices stay in memory) and re-prices positions and totals in real time, A-share style (red = up, green = down)

## One data source, five surfaces

Everything reads and writes one JSON dossier (default `$DSH_HOME/integrations/dsh-myinfo/data.json`, mode 0600; set the plugin config `dataFile` to relocate it — e.g. onto an agentfs/JuiceFS mount, which syncs the raw data to cloud storage):

- **Agent tools** — `personal_identity` / `personal_career` / `personal_relations` / `personal_reflections` / `personal_assets`; record and query straight from chat
- **`personal_context`** — one call returns the whole personal-context digest (identity, current job, key relations, latest reflection, asset totals with top holdings), so the agent picks up your background in real time during a conversation
- **`personal_search`** — fuzzy keyword search across all six domains (identity / career / relations / reflections / accounts / holdings); case-insensitive substring match, space-separated keywords are AND-ed, hits return ids, matched fields and snippets — recall anyone, any company, any stock code, any tag from a single keyword
- **Main panel** (Apple aesthetic, card dashboard) — the sidebar Profile icon opens a card grid: each domain is a card with its summary up front; click a card to dive into the full detail page (back capsule to return)
- **Asset overlay** — a frosted pill in the bottom-right corner shows your net total; click it for a quick card and a one-tap jump to the panel; refreshes itself every minute
- **Right dock** — a compact profile digest docked into the session's right pane (「Dock to right」 on the main panel, or the dock's guide page)
- **Settings section** — DSH settings → Personal Info, sharing the same five-domain forms
- **Appearance** — the 🌗 → ☀️ → 🌙 three-state switch (follow app → light → dark) on every surface; manual states override the host theme with literal tokens and really take effect, and the third click returns to follow-app

## Install

```sh
# add by package name on the web / desktop plugin page:
dsh-myinfo
# or from the CLI:
dsh plugin --profile web add dsh-myinfo
```

## Privacy

The repository itself ships **no personal data**; runtime data lives under `$DSH_HOME` by default (relocated only if you configure `dataFile` — a synced mount is your explicit choice), and local files excluded by `.gitignore` never enter version control.

## Documentation

- [Requirements & data modeling](docs/requirements.md)
- [Control-flow / data-flow design](docs/design.md)
- [Multi-model workflow review reports](docs/workflow-report.md)

## Development

```sh
npm test   # host-side unit tests against a temp dir; never touches your real dossier
```

## License

[MIT](LICENSE)
