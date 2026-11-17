# ROGUE FACTORY

工業 × ローグライク × 1v1 PvP。8×8の工場で採掘、コンベア搬送、精錬、弾薬製造を自動化し、敵の工場コアを破壊するWebゲームです。

## 現在の機能（初期アルファ）

- CPU戦、WebSocketオンライン1vs1（2人マッチング）
- 建設/回転/解体、スクラップ、電力不足、設備HP、修復、防衛
- 採掘機→ベルト→精錬機→ベルト→弾薬工場→砲台のリアルな輸送ライン
- 3分対戦、30秒ごとのローグライク研究選択、時間切れ判定
- Canvas演出：採掘の火花、放電、弾道/ミサイルの軌跡、衝撃波、爆発、破壊破片、ダメージ表示、勝利時の紙吹雪、画面振動
- CSS演出：稼働するベルト、発電機放電、精錬機の発光、砲台反動
- 効果音ON/OFF、エフェクト HIGH/LOW/OFF、低モーション設定への配慮
- PC/iPad/スマホ向けレスポンシブ画面
- 任意のNeon PostgreSQL試合履歴保存（DB未接続でも対戦可）

**未実装：** アカウント認証、ランク、マスタリー、ロボット出撃、PvE長期ローグライク、設計図共有、サーバーをまたぐマッチ同期。開発中のアルファです。

## 起動・テスト

Node.js 20以上で以下を実行します。

    npm install
    npm start

http://localhost:3000 を開いて「CPUと対戦」で遊びます。2人で同じURLに接続し「オンライン対戦」を押すとマッチングできます。

    npm test

## 操作

- 画面下の設備を選択して自分の工場の空きマスをクリック/タップし、設置
- 設備マスを選択後に「回転」または「解体」
- PCなら右クリックで回転、Rキーで回転、1〜0キーで設備を選択
- コア/設備の攻撃優先は右下から変更
- 研究カードは試合開始時と30秒ごとに選択（選ばなければ自動選択）
- エフェクト品質と効果音は画面右上

資源は向いている方向の設備かコンベアにしか渡せません。コンベア自身も矢印の方向に輸送します。砲台に弾薬が届くと敵を自動攻撃します。

## Renderへのデプロイ

リポジトリ直下に render.yaml を用意しています。mainブランチにコードをマージした後に、RenderのBlueprint画面でリポジトリを読み込み、設定を確認してApplyします。

Blueprint: https://dashboard.render.com/blueprint/new?repo=https://github.com/NekoNekoKoneKo222/ROGUE-FACTORY

単一Node WebサービスでHTTPとWebSocketの両方を配信します。ヘルスチェックは /health です。

Renderの無料プランはアイドル時のスリープ等でオンライン対戦が切れることがあります。常時稼働する競技環境には有料プランや専用のマッチサーバーが必要になる可能性があります。

## Neon（任意）

ROGUE FACTORY専用のNeon Postgresプロジェクトを作り、RenderのEnvironmentで DATABASE_URL に pooled 接続URLを設定してください。URLはGitHubへ書き込まないでください。

スキーマは sql/001_initial.sql にあります。direct 接続でSQLを実行するか、ローカルで DATABASE_URL を設定し npm run db:migrate を実行してください。既に動いているサービスへ追加した場合は設定保存後に再デプロイします。

DB未接続の場合、対戦自体は動きますが試合履歴が永続保存されません。現在は匿名マッチなのでユーザーを特定する認証機能はありません。

## 主なファイル

- public/index.html — 画面
- public/style.css — 工業UIと設備アニメーション
- public/app.js — 入力、通信、ゲーム状態、エフェクト連動
- public/effects.js — Canvas火花・ミサイル・爆発・効果音
- game/engine.js — サーバー権威の工業/電力/戦闘シミュレーション
- server.js — WebSocketマッチングとHTTP配信
- tests/engine.test.js — 自動テスト
- sql/001_initial.sql — マッチ履歴
- render.yaml — Render Blueprint

外部画像ファイルは必要なく、エフェクトはコードで描画しています。
