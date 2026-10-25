<div align="center">

<img src="../icon.svg" width="108" alt="dsh-myinfo"/>

# dsh-myinfo

**[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 向けローカル限定の個人プロファイルプラグイン——私は誰か、何をしてきたか、誰が周りにいるか、何を気づいたか、何を所有しているか。**

[![version](https://img.shields.io/badge/version-0.6.0-0071e3)](https://github.com/simonxluo/dsh-myinfo/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-34c759)](https://github.com/simonxluo/dsh-myinfo/blob/main/LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-%E2%89%A5_0.2.1--rc.1-8957e5)](https://github.com/deepseek-ai/deepseek-harness)
[![platform](https://img.shields.io/badge/platform-Web_%7C_Desktop-8E8E93)](https://github.com/simonxluo/dsh-myinfo)

🇬🇧 [English](../README.md) · 🇨🇳 [简体中文](README.zh.md) · 🇯🇵 **日本語** · 🇪🇸 [Español](README.es.md)

</div>

---

## 目次

- [機能](#機能)
- [ひとつのデータ、5つの入口](#ひとつのデータ5つの入口)
- [インストール](#インストール)
- [プライバシー](#プライバシー)
- [ドキュメント](#ドキュメント)
- [開発](#開発)
- [ライセンス](#ライセンス)

---

## 機能

- **基本情報** — 氏名 / 性別 / 生年月日（年齢を自動計算）/ 出身地 / 出身県 / 現住所
- **職歴** — 会社、役職、期間、業務内容、給与（現職を自動バッジ表示）
- **人間関係** — 周囲の人と自分との関係、グループ / タグ
- **人生の気づき** — 日付順にアーカイブされるタイムライン
- **資産台帳** — 銀行カード、Alipay / WeChat 残高、証券口座の現金と保有銘柄（同花順 A 株など）、通貨別に自動集計

## ひとつのデータ、5つの入口

すべての入口は同じローカルファイル（`$DSH_HOME/integrations/dsh-myinfo/data.json`、パーミッション 0600 —— 端末の外に出ることはありません）を読み書きします：

- **エージェントツール** — `personal_identity` / `personal_career` / `personal_relations` / `personal_reflections` / `personal_assets`。チャットから直接記録・照会
- **`personal_context`** — 1 回の呼び出しで個人コンテキストの摘要（身元・現職・周囲の人・最新の気づき・資産合計と主要保有銘柄）を取得し、会話中にリアルタイムで背景を把握
- **`personal_search`** — 6 ドメイン横断のあいまい検索（身元・職歴・周囲の人・気づき・資産口座・保有銘柄）。大文字小文字を区別しない部分一致、スペース区切りの複数キーワードは AND。ヒットは id・一致フィールド・抜粋付きで返り、1 つのキーワードで友人・会社・銘柄コード・タグを即思い出せる
- **メインパネル**（Apple テイストのカードダッシュボード）— サイドバーのプロフィールアイコンから 5 ドメインのカードグリッド（カード表面は摘要）。カードをクリックすると詳細ページへ、戻るカプセルでグリッドに復帰
- **資産オーバーレイ** — 右下のすりガラス風ピルに純資産総額を表示。クリックでクイックカード、ワンタップでメインパネルへ。毎分自動更新
- **右ドック** — セッション右ペインにドッキングされるコンパクトなプロフィール摘要（メインパネルの「右側にドッキング」またはドックのガイドページから）
- **設定セクション** — DSH 設定 → Personal Info。メインパネルと同じ 5 ドメインフォーム
- **外観 3 状態スイッチ** — 各表面の 🌗 → ☀️ → 🌙（アプリに従う → ライト → ダーク）。手動状態はリテラルトークンでホストテーマを実際に上書きし、3 回目のクリックでアプリ追従に戻ります

## インストール

```sh
# ウェブ / デスクトップのプラグインページでパッケージ名を追加：
dsh-myinfo
# または CLI から：
dsh plugin --profile web add dsh-myinfo
```

## プライバシー

リポジトリ自体に**個人データは一切含まれません**。実行時データは `$DSH_HOME` 配下のみに書き込まれ、`.gitignore` で除外されたローカルファイルがバージョン管理に入ることもありません。

## ドキュメント

- [要件とデータモデリング](requirements.md)
- [制御フロー / データフロー設計](design.md)
- [マルチモデル workflow レビューレポート](workflow-report.md)

## 開発

```sh
npm test   # ホスト側ユニットテスト。一時ディレクトリを使用し、実際の dossier には触れません
```

## ライセンス

[MIT](../LICENSE)
