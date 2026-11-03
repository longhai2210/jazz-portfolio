# 🎷 Jazz Portfolio — <ruby>プロジェクトバイブル<rt>プロジェクトバイブル</rt></ruby>

> **<ruby>本ドキュメント<rt>ほんどきゅめんと</rt></ruby>はJazz Portfolioプロジェクトにおける<ruby>唯一<rt>ゆいいつ</rt></ruby>の「<ruby>真実<rt>しんじつ</rt></ruby>の<ruby>単一情報源<rt>たんいつじょうほうげん</rt></ruby>（Single Source of Truth）」です。**
> すべてのアーキテクチャ<ruby>決定<rt>けってい</rt></ruby>、<ruby>規約<rt>きやく</rt></ruby>、およびリファレンスがここに<ruby>記録<rt>きろく</rt></ruby>されています。
> <ruby>各実装フェーズ<rt>かくじっそうふぇーず</rt></ruby>ごとに<ruby>更新<rt>こうしん</rt></ruby>されます。

---

## <ruby>目次<rt>もくじ</rt></ruby>

1. [<ruby>プロジェクト概要<rt>ぷろじぇくとがいよう</rt></ruby>](#1-プロジェクト概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [<ruby>技術スタック<rt>ぎじゅつすたっく</rt></ruby>](#3-技術スタック)
4. [モノレポ<ruby>構造<rt>こうぞう</rt></ruby>](#4-モノレポ構造)
5. [デザインシステム](#5-デザインシステム)
6. [データベーススキーマ](#6-データベーススキーマ)
7. [APIエンドポイント](#7-apiエンドポイント)
8. [<ruby>認証<rt>にんしょう</rt></ruby>](#8-認証)
9. [<ruby>多言語対応<rt>たげんごたいおう</rt></ruby> (i18n)](#9-多言語対応-i18n)
10. [<ruby>音楽プレイヤー<rt>おんがくぷれいやー</rt></ruby>](#10-音楽プレイヤー)
11. [<ruby>管理画面<rt>かんりがめん</rt></ruby>（アドミンパネル）](#11-管理画面アドミンパネル)
12. [AWS<ruby>インフラストラクチャ<rt>いんふらすとらくちゃ</rt></ruby>](#12-awsインフラストラクチャ)
13. [CI/CDパイプライン](#13-cicdパイプライン)
14. [<ruby>環境変数<rt>かんきょうへんすう</rt></ruby>](#14-環境変数)
15. [<ruby>規約<rt>きやく</rt></ruby>と<ruby>標準<rt>ひょうじゅん</rt></ruby>](#15-規約と標準)
16. [<ruby>デプロイ手順書<rt>でぷろいてじゅんしょ</rt></ruby>（ランブック）](#16-デプロイ手順書ランブック)
17. [<ruby>意思決定記録<rt>いしけっていきろく</rt></ruby>（デシジョンログ）](#17-意思決定記録デシジョンログ)
18. [<ruby>関連ドキュメント<rt>かんれんどきゅめんと</rt></ruby>](#18-関連ドキュメント)

---

## 1. <ruby>プロジェクト概要<rt>ぷろじぇくとがいよう</rt></ruby>

**Jazz Portfolio**は、ジャズ<ruby>音楽<rt>おんがく</rt></ruby>の<ruby>美学<rt>びがく</rt></ruby>を<ruby>持<rt>も</rt></ruby>つ<ruby>多言語<rt>たげんご</rt></ruby>（<ruby>英語<rt>えいご</rt></ruby>、ベトナム<ruby>語<rt>ご</rt></ruby>、<ruby>日本語<rt>にほんご</rt></ruby>）<ruby>対応<rt>たいおう</rt></ruby>ポートフォリオウェブサイトです。<ruby>画面遷移時<rt>がめんせんいじ</rt></ruby>も<ruby>中断<rt>ちゅうだん</rt></ruby>されないバックグラウンド<ruby>音楽<rt>おんがく</rt></ruby>プレイヤー、スムーズなアニメーション、コンテンツ<ruby>管理<rt>かんり</rt></ruby>のための<ruby>管理画面<rt>かんりがめん</rt></ruby>を<ruby>備<rt>そな</rt></ruby>えています。

### <ruby>主要機能<rt>しゅようきのう</rt></ruby> (v1)

| <ruby>機能<rt>きのう</rt></ruby> | ステータス | <ruby>説明<rt>せつめい</rt></ruby> |
|---|---|---|
| ジャズテーマ | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | ダークでスモーキーなカラーパレット、真鍮/ゴールドのアクセント、ジャズ風ローディングアニメーション |
| <ruby>多言語対応<rt>たげんごたいおう</rt></ruby> | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | <ruby>国旗<rt>こっき</rt></ruby>アイコンによる<ruby>切替<rt>きりかえ</rt></ruby>（EN、VI、JA） |
| <ruby>音楽プレイヤー<rt>おんがくぷれいやー</rt></ruby> | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | 自動再生（ミュート開始）、<ruby>画面遷移間<rt>がめんせんいかん</rt></ruby>での<ruby>再生維持<rt>さいせいいじ</rt></ruby>、プレイリスト<ruby>対応<rt>たいおう</rt></ruby> |
| ポートフォリオセクション | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | Hero、About、Experience、Skills、Contact |
| ブログ / ジャーナル | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | フィーチャーフラグ<ruby>制御<rt>せいぎょ</rt></ruby>、MarkdownレンダリングとRSSフィード<ruby>対応<rt>たいおう</rt></ruby>の<ruby>多言語<rt>たげんご</rt></ruby>記事 |
| コメントシステム | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | 14<ruby>層<rt>そう</rt></ruby>スパム<ruby>防御<rt>ぼうぎょ</rt></ruby>シールドとブロックリストエンジンを<ruby>備<rt>そな</rt></ruby>えたモデレーション<ruby>機能<rt>きのう</rt></ruby><ruby>付<rt>つ</rt></ruby>きコメントスレッド |
| <ruby>管理画面<rt>かんりがめん</rt></ruby> | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | プロフィール、カテゴリ、<ruby>楽曲<rt>がっきょく</rt></ruby>、ブログ記事、コメントモデレーション、システム<ruby>設定<rt>せってい</rt></ruby><ruby>管理<rt>かんり</rt></ruby> |
| <ruby>動的<rt>どうてき</rt></ruby>カテゴリ | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | <ruby>管理画面<rt>かんりがめん</rt></ruby>からのカテゴリおよびアイテムの<ruby>追加<rt>ついか</rt></ruby>/<ruby>削除<rt>さくじょ</rt></ruby>（論理削除） |
| お<ruby>問<rt>と</rt></ruby>い<ruby>合<rt>あ</rt></ruby>わせフォーム | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | ハニーポット、<ruby>動的文字数制限<rt>どうてきもじすうせいげん</rt></ruby>、メール<ruby>通知機能<rt>つうちきのう</rt></ruby>を<ruby>備<rt>そな</rt></ruby>えた<ruby>公開<rt>こうかい</rt></ruby>メッセージ<ruby>送信<rt>そうしん</rt></ruby> |
| <ruby>管理者受信箱<rt>かんりしゃじゅしんばこ</rt></ruby> | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | フォームからの送信メッセージを<ruby>閲覧<rt>えつらん</rt></ruby>・<ruby>管理<rt>かんり</rt></ruby>する2画面分割インボックス |
| システム<ruby>設定<rt>せってい</rt></ruby> | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | お問い合せトグル、コンテンツフラグ、メールプロバイダー<ruby>設定<rt>せってい</rt></ruby>を<ruby>制御<rt>せいぎょ</rt></ruby>する<ruby>管理画面<rt>かんりがめん</rt></ruby><ruby>設定<rt>せってい</rt></ruby> |
| テーマチェンジャー | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | DarkテーマとLight-Jazzテーマを<ruby>滑<rt>なめ</rt></ruby>らかに<ruby>切<rt>き</rt></ruby>り<ruby>替<rt>か</rt></ruby>えるアニメーション<ruby>機能<rt>きのう</rt></ruby> |
| レスポンシブ | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | モバイルファースト、すべてのブレイクポイントに<ruby>対応<rt>たいおう</rt></ruby> |
| スクロールアニメーション | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | Framer Motionによるスクロール<ruby>表示<rt>ひょうじ</rt></ruby>、パララックス、<ruby>段階的<rt>だんかいてき</rt></ruby><ruby>表示<rt>ひょうじ</rt></ruby> |
| CI/CD | ✅ <ruby>完了<rt>かんりょう</rt></ruby> | GitHub Actions -> AWS (Amplify + EC2) |

### スコープ<ruby>外<rt>がい</rt></ruby> (v1)

- <ruby>複数管理者<rt>ふくすうかんりしゃ</rt></ruby> / ロール<ruby>管理<rt>かんり</rt></ruby>
- カスタムドメイン（デフォルトのAWS URLを<ruby>使用<rt>しよう</rt></ruby>）

---

## 2. アーキテクチャ

### ハイレベル<ruby>図<rt>ず</rt></ruby>

```
+-------------------------------------------------------------+
|                    MONOREPO (Turborepo + pnpm)              |
|                                                             |
|  +--------------+  +--------------+  +------------------+  |
|  |  apps/web     |  |  apps/api    |  |  packages/*      |  |
|  |  Next.js 15   |  |  NestJS 11   |  |  database        |  |
|  |  App Router   |  |  REST API    |  |  shared          |  |
|  |  Tailwind 4   |  |  Prisma ORM  |  |  config          |  |
|  |  Framer Motion|  |  JWT Auth    |  |                  |  |
|  |  next-intl    |  |  S3 SDK      |  |                  |  |
|  |  Zustand      |  |  Swagger     |  |                  |  |
|  +-------+------+  +-------+------+  +------------------+  |
|          |                  |                                |
+----------+------------------+--------------------------------+
           |                  |
     +-----v-----+     +------v------+
     |  AWS       |     |  AWS        |
     |  Amplify   |     |  EC2 + RDS  |
     |  (CDN)     |     |  (Docker)   |
     +-----------+     +------+------+
                              |
                    +---------v----------+
                    |  AWS S3 + CloudFront|
                    |  (Media Storage)    |
                    +--------------------+
```

### データフロー

1. **<ruby>公開<rt>こうかい</rt></ruby>ポートフォリオ:** Next.js (SSR) -> NestJS API -> PostgreSQL -> i18nレンダリングレスポンス
2. **<ruby>管理画面<rt>かんりがめん</rt></ruby>:** Next.js (CSR) -> JWT<ruby>認証<rt>にんしょう</rt></ruby> -> NestJS API -> PostgreSQL / S3
3. **<ruby>音楽再生<rt>おんがくさいせい</rt></ruby>:** Next.js -> Zustandストア -> `<audio>`エレメント -> CloudFront CDN -> S3
4. **メディアアップロード:** <ruby>管理画面<rt>かんりがめん</rt></ruby>フォーム -> APIからの署名付きURL -> S3への直接アップロード -> DBへのメタデータ保存

---

## 3. <ruby>技術スタック<rt>ぎじゅつすたっく</rt></ruby>

| <ruby>階層<rt>かいそう</rt></ruby> | <ruby>技術<rt>ぎじゅつ</rt></ruby> | バージョン | <ruby>選定理由<rt>せんていりゆう</rt></ruby> |
|---|---|---|---|
| モノレポ | Turborepo | ^2.5 | タスクキャッシュ、<ruby>並列実行<rt>へいれつじっこう</rt></ruby>、ワークスペース依存関係グラフ |
| パッケージマネージャー | pnpm | 9.x | ワークスペースプロトコル、ディスク<ruby>効率<rt>こうりつ</rt></ruby>、<ruby>厳格<rt>げんかく</rt></ruby>な依存関係解決 |
| フロントエンド | Next.js (App Router) | 15.x | SSR/SSG、React Server Components、ファイルベースルーティング |
| React | React | 19.x | <ruby>並行<rt>へいこう</rt></ruby>レンダリング、Suspense、<ruby>改善<rt>かいぜん</rt></ruby>されたハイドレーション |
| スタイリング | Tailwind CSS | 4.x | ユーティリティファースト、@themeデザインツリー、Tree-shaking |
| アニメーション | Framer Motion | 12.x | <ruby>宣言的<rt>せんげんてき</rt></ruby>API、レイアウトアニメーション、useInView、useScroll |
| i18n | next-intl | 4.x | App Routerネイティブ、ページリロードなし、ICUメッセージフォーマット |
| クライアント<ruby>状態<rt>じょうたい</rt></ruby> | Zustand | 5.x | 最小限のボイラープレート、オーディオ状態保存ミドルウェア |
| バックエンド | NestJS | 11.x | DI、デコレータ、モジュール構造、OpenAPI統合 |
| ORM | Prisma | 6.x | 型安全クエリ、マイグレーション、PostgreSQL JSONBサポート |
| データベース | PostgreSQL | 16.x | JSONBカラム、全文検索、堅牢なリレーショナルモデル |
| <ruby>認証<rt>にんしょう</rt></ruby> | Passport + JWT | latest | NestJS統合、ステートレス認証 |
| バリデーション | class-validator | 0.14.x | デコレータベースDTOバリデーション |
| ストレージSDK | @aws-sdk/client-s3 | 3.x | 署名付きURL、マルチパートアップロード、IAM統合 |

---

## 4. モノレポ<ruby>構造<rt>こうぞう</rt></ruby>

```
jazz-portfolio/
├── apps/
│   ├── web/          -> Next.js 15 フロントエンド (port 3000)
│   └── api/          -> NestJS 11 バックエンド (port 3001)
├── packages/
│   ├── database/     -> Prismaスキーマ、クライアント、マイグレーション、シード
│   ├── shared/       -> TypeScript型定義、定数、列挙型
│   └── config/       -> 共有 tsconfig, eslint, tailwind
├── infra/
│   └── docker/       -> Dockerfile, docker-compose
├── docs/
│   └── PROJECT_BIBLE.md  -> 本ファイル
├── .github/
│   └── workflows/    -> CI/CDパイプライン
├── turbo.json        -> Turborepoタスク設定
├── pnpm-workspace.yaml
└── package.json
```

### ワークスペース<ruby>依存関係<rt>いぞんかんけい</rt></ruby>

```
apps/web
  -> @jazz-portfolio/shared
  -> @jazz-portfolio/tsconfig

apps/api
  -> @jazz-portfolio/shared
  -> @jazz-portfolio/database
  -> @jazz-portfolio/tsconfig

packages/database
  -> @jazz-portfolio/tsconfig

packages/shared
  -> @jazz-portfolio/tsconfig
```

---

## 5. デザインシステム

### カラーパレット

| トークン | Hex | <ruby>用途<rt>ようと</rt></ruby> |
|---|---|---|
| `jazz-black` | `#0a0a0f` | ページ<ruby>背景<rt>はいけい</rt></ruby> |
| `jazz-dark` | `#111118` | カード<ruby>背景<rt>はいけい</rt></ruby>、ナビゲーション |
| `jazz-charcoal` | `#1a1a2e` | セクション<ruby>背景<rt>はいけい</rt></ruby> |
| `jazz-slate` | `#2a2a3e` | ボーダー、<ruby>区切り線<rt>くぎりせん</rt></ruby> |
| `jazz-muted` | `#4a4a5e` | 無効<ruby>状態<rt>じょうたい</rt></ruby> |
| `jazz-gold` | `#d4a574` | <ruby>主<rt>おも</rt></ruby>アクセント、<ruby>見出し<rt>みだし</rt></ruby> |
| `jazz-brass` | `#c9a96e` | サブアクセント |
| `jazz-amber` | `#e8b868` | ホバー<ruby>状態<rt>じょうたい</rt></ruby>、ハイライト |
| `jazz-copper` | `#b87333` | 第3アクセント |
| `jazz-blue` | `#16213e` | クールセクション<ruby>背景<rt>はいけい</rt></ruby> |
| `jazz-text` | `#e8e8f0` | <ruby>主要テキスト<rt>しゅようてきすと</rt></ruby> |
| `jazz-text-muted` | `#9898b0` | サブテキスト |
| `jazz-text-dim` | `#6a6a80` | 第3テキスト、キャプション |

### タイポグラフィ

| <ruby>用途<rt>ようと</rt></ruby> | フォント | フォールバック |
|---|---|---|
| <ruby>見出し<rt>みだし</rt></ruby> (EN/VI) | Playfair Display | serif |
| <ruby>見出し<rt>みだし</rt></ruby> (JA) | Noto Serif JP | serif |
| 本文 (EN/VI) | Inter | sans-serif |
| 本文 (JA) | Noto Sans JP | sans-serif |
| コード/等幅 | JetBrains Mono | monospace |

### アニメーション<ruby>戦略<rt>せんりゃく</rt></ruby>

| アニメーション | ライブラリ | トリガー |
|---|---|---|
| ジャズローディング画面 | Framer Motion + CSS | <ruby>初回訪問時<rt>しょかいほうもんじ</rt></ruby> (sessionStorage) |
| ページ<ruby>遷移<rt>せんい</rt></ruby> | Framer Motion AnimatePresence | ルート<ruby>変更時<rt>へんこうじ</rt></ruby> |
| スクロール<ruby>表示<rt>ひょうじ</rt></ruby> | Framer Motion useInView | 要素がビューポートに入った時 |
| パララックス<ruby>背景<rt>はいけい</rt></ruby> | Framer Motion useScroll | スクロール<ruby>位置<rt>いち</rt></ruby> |
| ホバーグロー | CSS transitions | マウスホバー |
| <ruby>段階的リスト<rt>だんかいてきりすと</rt></ruby> | Framer Motion staggerChildren | 親要素がビューポートに入った時 |
| 音楽ビジュアライザー | Canvas API or CSS | オーディオ<ruby>再生中<rt>さいせいちゅう</rt></ruby> |

---

## 6. データベーススキーマ

### エンティティ

#### `admin_users`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| username | VARCHAR (UNIQUE) | ログイン識別子 |
| password_hash | VARCHAR | bcryptハッシュ |
| created_at | TIMESTAMP | 自動 |
| updated_at | TIMESTAMP | 自動 |

#### `profiles`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 固定値: `default-profile` |
| name | JSONB | `{ en, vi, ja }` |
| title | JSONB | `{ en, vi, ja }` |
| introduction | JSONB | `{ en, vi, ja }` |
| bio | JSONB | `{ en, vi, ja }` |
| avatar_url | VARCHAR? | S3/CloudFront URL |
| background_url | VARCHAR? | S3/CloudFront URL |
| social_links | JSONB | `{ github, linkedin, ... }` |
| contact_info | JSONB | `{ email, phone, ... }` |
| updated_at | TIMESTAMP | 自動 |

#### `categories`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| name | JSONB | `{ en, vi, ja }` |
| slug | VARCHAR (UNIQUE) | URLフレンドリーな識別子 |
| type | VARCHAR | SKILL / EXPERIENCE / EDUCATION / CUSTOM |
| sort_order | INT | 表示順序 |
| is_active | BOOLEAN | 表示切替トグル |
| is_deleted | BOOLEAN | 論理削除フラグ |
| created_at | TIMESTAMP | 自動 |
| updated_at | TIMESTAMP | 自動 |

#### `category_items`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| category_id | UUID (FK) | categories.idを参照 |
| title | JSONB | `{ en, vi, ja }` |
| description | JSONB | `{ en, vi, ja }` |
| metadata | JSONB | 柔軟なデータ: 日付、レベル、会社名など |
| image_url | VARCHAR? | S3/CloudFront URL |
| sort_order | INT | 表示順序 |
| is_active | BOOLEAN | 表示切替トグル |
| is_deleted | BOOLEAN | 論理削除フラグ |
| created_at | TIMESTAMP | 自動 |
| updated_at | TIMESTAMP | 自動 |

#### `tracks`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| title | VARCHAR | 曲名 |
| artist | VARCHAR | アーティスト名 |
| s3_key | VARCHAR | S3オブジェクトキー |
| cloudfront_url | VARCHAR | 公開CDN URL |
| duration_seconds | INT | トラック再生時間 |
| sort_order | INT | プレイリスト順序 |
| is_active | BOOLEAN | プレイリストへの含め切り替え |
| created_at | TIMESTAMP | 自動 |
| updated_at | TIMESTAMP | 自動 |

#### `media`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| filename | VARCHAR | 元ファイル名 |
| s3_key | VARCHAR | S3オブジェクトキー |
| cloudfront_url | VARCHAR | 公開CDN URL |
| mime_type | VARCHAR | image/jpeg, audio/mpeg 等 |
| file_size_bytes | INT | ファイルサイズ |
| context | VARCHAR | PROFILE / CATEGORY / TRACK / GENERAL |
| created_at | TIMESTAMP | 自動 |

#### `contact_submissions`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 自動生成 |
| sender_name | VARCHAR(100) | 送信者名 |
| sender_email | VARCHAR(254) | 送信者メールアドレス |
| subject | VARCHAR(200) | メッセージ件名 |
| message_body | VARCHAR(5000) | サニタイズ済みメッセージ本文 |
| is_read | BOOLEAN | 既読ステータス |
| created_at | TIMESTAMP | 自動 |
| updated_at | TIMESTAMP | 自動 |

#### `site_settings`
| カラム | 型 | <ruby>備考<rt>びこう</rt></ruby> |
|---|---|---|
| id | UUID (PK) | 固定ID: `default` |
| is_contact_form_enabled | BOOLEAN | トップページのお問い合わせフォーム表示トグル |
| mail_provider | VARCHAR | `resend` または `smtp` |
| mail_from | VARCHAR | 送信元メールアドレス |
| mail_to | VARCHAR | 受信先メールアドレス |
| updated_at | TIMESTAMP | 自動 |

---

## 7. APIエンドポイント

### <ruby>一般公開エンドポイント<rt>いっぱんこうかいえんどぽいんと</rt></ruby>（<ruby>認証不要<rt>にんしょうふよう</rt></ruby>）

| メソッド | ルート | <ruby>説明<rt>せつめい</rt></ruby> |
|---|---|---|
| GET | /api/health | ヘルスチェック |
| GET | /api/profile | ポートフォリオプロフィールの取得 |
| GET | /api/categories | アイテム付きアクティブカテゴリ一覧の取得 |
| GET | /api/categories/:slug | アイテム付き単一カテゴリの取得 |
| GET | /api/tracks | アクティブトラック一覧（プレイリスト）の取得 |
| POST | /api/contact | お問い合わせメッセージ送信（レート制限あり） |
| GET | /api/settings/public | 公開サイト設定の取得 |

### <ruby>認証エンドポイント<rt>にんしょうえんどぽいんと</rt></ruby>

| メソッド | ルート | <ruby>説明<rt>せつめい</rt></ruby> |
|---|---|---|
| POST | /api/auth/login | ログイン、JWTを返却 |
| POST | /api/auth/refresh | JWTトークンのリフレッシュ |

### <ruby>管理者用エンドポイント<rt>かんりしゃようえんどぽいんと</rt></ruby>（JWT<ruby>必須<rt>ひっす</rt></ruby>）

| メソッド | ルート | <ruby>説明<rt>せつめい</rt></ruby> |
|---|---|---|
| PUT | /api/admin/profile | プロフィールの更新 |
| POST | /api/admin/categories | カテゴリの作成 |
| PUT | /api/admin/categories/:id | カテゴリの更新 |
| PATCH | /api/admin/categories/:id/reorder | カテゴリの並び順変更 |
| DELETE | /api/admin/categories/:id | カテゴリの論理削除 |
| POST | /api/admin/categories/:id/items | カテゴリアイテムの作成 |
| PUT | /api/admin/category-items/:id | カテゴリアイテムの更新 |
| DELETE | /api/admin/category-items/:id | カテゴリアイテムの論理削除 |
| POST | /api/admin/tracks | トラックの作成 |
| PUT | /api/admin/tracks/:id | トラックの更新 |
| DELETE | /api/admin/tracks/:id | トラックの削除 |
| PATCH | /api/admin/tracks/:id/reorder | トラックの並び順変更 |
| POST | /api/admin/media/presign | 署名付きアップロードURLの取得 |
| PUT | /api/admin/password | パスワードの変更 |
| GET | /api/admin/contact | お問い合わせ送信一覧の取得 |
| PATCH | /api/admin/contact/:id/read | お問い合わせ送信の既読化 |
| GET | /api/admin/settings/email | メール設定およびステータスの取得 |
| PUT | /api/admin/settings/email | メール設定の更新 |
| POST | /api/admin/settings/email/test | テスト通知メールの送信 |

---

## 8. <ruby>認証<rt>にんしょう</rt></ruby>

### フロー

```
1. 管理者が /[locale]/admin/login にてユーザー名とパスワードを送信
2. ブラウザが credentials: 'include' を指定して POST /api/auth/login を実行
3. NestJSが認証情報を検証 (bcryptで比較)
4. NestJSが httpOnly クッキー jazz_access_token をセット (JWT、JWT_EXPIRATION有効期限)
5. Webがミドルウェア制限用に non-httpOnly UXマーカー jazz_admin_session をセット
6. Nextミドルウェアがマーカーの無い /admin/* へのアクセスをブロック (login除く)
7. 管理者レイアウトが GET /api/auth/me でセッションを確認 (クッキーをAPIへ送信)
8. AdminApiClient呼び出しは credentials: 'include' を使用 (localStorage/ZustandにJWTを保存しない)
9. ログアウト: NestJSが jazz_access_token をクリア、Webが jazz_admin_session をクリア
```

JWTストラテジーは**クッキー**または `Authorization: Bearer` の両方を<ruby>許容<rt>きょよう</rt></ruby>します（Bearerはレガシー/オプショナルであり、クッキーがプライマリパスです）。

### セキュリティルール

- パスワードはbcrypt（12ソルトラウンド）でハッシュ化
- JWT秘密鍵: 最低64文字、環境変数に保存
- APIホスト上のhttpOnly `jazz_access_token`: JSからのXSSトークン盗難を防止
- CORS: 許可リストによる `credentials: true` (`FRONTEND_URL` / `CORS_ORIGINS`)
- クロスオリジン環境: `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true`
- レート制限: グローバルで 100リクエスト/分、ログイン試行は 5回/15分
- Helmet: 全APIレスポンスにセキュリティヘッダーを付与
- JWT `validate` は署名済みペイロードを信頼（デフォルトでリクエストごとのDBヒットなし）

### データ取得（Web）

| クライアント | 用途 | キャッシュ |
|---|---|---|
| `PublicApiClient` | ポートフォリオRSC / 公開GET | `revalidate` + タグ (`profile`, `categories`, `settings`, `music`) |
| `AdminApiClient` | CMSミューテーション & 認証済みGET | `cache: 'no-store'` + クッキー |

---

## 9. <ruby>多言語対応<rt>たげんごたいおう</rt></ruby> (i18n)

### <ruby>構成<rt>こうせい</rt></ruby>

- ライブラリ: next-intl（App Router統合）
- ルーティング: /en/..., /vi/..., /ja/... (デフォルト: /en)
- 翻訳ファイル: `apps/web/src/i18n/messages/{locale}.json`

### <ruby>規約<rt>きやく</rt></ruby>

- **キー命名:** ドット区切り、コンポーネントスコープ: `hero.greeting`, `common.home`
- **動的コンテンツ:** DBのJSONBフィールドを使用: `{ "en": "...", "vi": "...", "ja": "..." }`
- **フォント処理:** ロケールが `ja` の場合に日本語専用フォントを条件付きでロード

### <ruby>対応ロケール<rt>たいおうろけーる</rt></ruby>

| コード | 言語 | 国旗 | フォント (見出し) | フォント (本文) |
|---|---|---|---|---|
| en | 英語 | GB | Playfair Display | Inter |
| vi | ベトナム語 | VN | Playfair Display | Inter |
| ja | 日本語 | JP | Noto Serif JP | Noto Sans JP |

---

## 10. <ruby>音楽プレイヤー<rt>おんがくぷれいやー</rt></ruby>

### アーキテクチャ

- **遅延ロードMusic Chrome** — `MusicPlayer` + `PlaylistFetcher` は `isMusicEnabled` の時に `next/dynamic` (`ssr: false`) でロード
- **Zustandストア**による管理: currentTrack, isPlaying, isMuted, volume, playlist, currentTime
- **Persistミドルウェア**により volume, isMuted, currentTrackIndex を localStorage に保存（再生設定のみ — 認証情報は含めない）
- **自動再生ポリシー:** ミュート状態で開始 -> ミュート解除プロンプトを表示 -> ユーザー操作により音声有効化
- オーディオ設定: `preload="metadata"`（完全な事前ダウンロードを行わない）

### UIコンポーネント

| コンポーネント | 配置場所 | 説明 |
|---|---|---|
| MusicPlayer | 固定フッターバー | 再生/一時停止、トラック情報、音量、ミュート切替 |
| PlaylistDrawer | スライドアップパネル | 全トラックリスト、クリックして再生 |
| AudioVisualizer | プレイヤーバー内部 | 控えめな周波数ビジュアライゼーション |

### トラックストレージ

- オーディオファイルはS3に保存: `s3://jazz-portfolio-media/tracks/{uuid}.{ext}`
- グローバルCDNキャッシュのためにCloudFront経由で配信
- メタデータ（タイトル、アーティスト、再生時間、順序）はPostgreSQLの `tracks` テーブルに保存

---

## 11. <ruby>管理画面<rt>かんりがめん</rt></ruby>（アドミンパネル）

### ルート<ruby>構造<rt>こうぞう</rt></ruby>

```
/[locale]/admin/
  +-- login        -> ログインページ (公開)
  +-- page         -> ダッシュボード概要 (保護エリア; GET /api/admin/stats を使用)
  +-- profile      -> プロフィール編集 (保護エリア)
  +-- categories   -> カテゴリ管理 (保護エリア)
  +-- music        -> 音楽管理 (保護エリア)
  +-- contact      -> お問い合わせ受信箱 (保護エリア; ページネーション対応)
  +-- settings     -> パスワード + メール / お問い合わせ設定 (保護エリア)
```

### データ層

- **TanStack Query** プロバイダーは管理者レイアウトのみにスコープ限定
- `apps/web/src/hooks/admin/` 配下のフック (categories, tracks, profile, contact, settings, stats)
- UI分割: カテゴリ一覧/フォーム/アイテム; パスワード設定 vs メール設定フォーム
- ミューテーションエラーはUIバナーに表示（非表示の `console.error` にしない）

### <ruby>機能<rt>きのう</rt></ruby>

1. **ダッシュボード:** `GET /api/admin/stats` による軽量なカウント表示（全カテゴリツリーは取得しない）。
2. **プロフィール編集:** 多言語の名前、タイトル、イントロ、バイオを編集。アバターと背景のアップロード（署名付きS3; レスポンスフィールド `uploadUrl`）。
3. **カテゴリ管理:** カテゴリのCRUD、`PATCH` + `{ ids }` による並び順変更、論理削除/復元。
4. **カテゴリ群アイテム管理:** カテゴリ配下にネスト。多言語フィールド、メタデータ、画像を持つアイテムのCRUD。
5. **音楽管理:** トラックのS3へのアップロード、メタデータ編集、プレイリスト順序変更、有効/無効切替。
6. **お問い合わせ受信箱:** ページネーション付きリスト。詳細ごとに完全な `messageBody` を取得。
7. **設定:** パスワード変更 (`currentPassword`)、メールプロバイダー / お問い合わせフォームのトグル切り替え。

---

## 12. AWS<ruby>インフラストラクチャ<rt>いんふらすとらくちゃ</rt></ruby>

### リソース

| リソース | タイプ | スペック | 用途 |
|---|---|---|---|
| RDS | PostgreSQL 16 | db.t4g.micro, 20GB gp3 | データベース |
| EC2 | Amazon Linux 2023 | t4g.micro, ARM | NestJS API (Docker) |
| Amplify | ホスティング | GitHubからの自動デプロイ | Next.js フロントエンド |
| S3 | Standard | ライフサイクルルール | メディアストレージ |
| CloudFront | ディストリビューション | オリジン: S3バケット | メディアCDN |
| Route 53 | ホステッドゾーン | （カスタムドメイン追加時） | DNS |

### <ruby>概算月額コスト<rt>がいさんげつがくこすと</rt></ruby>

| リソース | 1年目 (無料枠) | 無料枠終了後 |
|---|---|---|
| RDS | ~$0 | ~$15 |
| EC2 | ~$0 | ~$7 |
| Amplify | ~$0-5 | ~$5 |
| S3 | ~$1 | ~$1-2 |
| CloudFront | ~$0 (1TB無料) | ~$5 |
| **合計** | **~$5-15/月** | **~$30-35/月** |

---

## 13. CI/CDパイプライン

### GitHub Actionsワークフロー

#### ci.yml -- すべてのPRおよびmainへのプッシュ時
1. コードのチェックアウト
2. pnpm + 依存関係のインストール
3. Prismaクライアントの生成
4. `pnpm turbo run lint type-check`
5. `pnpm turbo run build test` (ダミーの `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` を使用)

#### deploy-api.yml -- mainへのプッシュ時（バックエンド変更時）
1. EC2へSSH接続
2. 最新コードのGit Pull
3. Dockerコンテナの再ビルド
4. NestJSサービスの再起動
5. 未実行のPrismaマイグレーションの実行

#### deploy-web.yml -- Amplifyによる自動デプロイ
1. Amplifyがmainへのプッシュを検知
2. Next.jsプロダクションビルドを生成
3. Amplify CDNへデプロイ

---

## 14. <ruby>環境変数<rt>かんきょうへんすう</rt></ruby>

### バックエンド (apps/api/.env)

| 変数名 | 必須 | 説明 |
|---|---|---|
| PORT | はい | APIサーバーポート (デフォルト: 3001) |
| NODE_ENV | はい | development / production |
| DATABASE_URL | はい | PostgreSQL接続文字列 |
| JWT_SECRET | はい | JWT署名秘密鍵 (最低64文字) |
| JWT_EXPIRATION | はい | トークン有効期限 (例: 24h) |
| AWS_REGION | はい | AWSリージョン (例: ap-southeast-1) |
| AWS_S3_BUCKET | はい | S3バケット名 |
| AWS_CLOUDFRONT_DOMAIN | はい | CloudFrontディストリビューションドメイン |
| FRONTEND_URL | はい | CORS用フロントエンドURL (単一オリジン) |
| CORS_ORIGINS | いいえ | カンマ区切りの許可オリジンリスト (`FRONTEND_URL`を上書き) |
| COOKIE_SAME_SITE | いいえ | `none` (クロスオリジン web→api、デフォルト) または `lax` (Same-site) |
| COOKIE_SECURE | いいえ | `SameSite=None` の場合は `true` が必須 |
| MAIL_PROVIDER | いいえ | `resend` または `smtp` (デフォルト: `resend`) |
| MAIL_FROM | いいえ | フォールバック送信元メール (例: notifications@domain.com) |
| MAIL_TO | いいえ | フォールバック受信用メール (例: contact@domain.com) |
| RESEND_API_KEY | いいえ | MAIL_PROVIDERが `resend` の場合に必須 |
| SMTP_HOST | いいえ | MAIL_PROVIDERが `smtp` の場合に必須 |
| SMTP_PORT | いいえ | SMTPサーバーポート (デフォルト: 587) |
| SMTP_USER | いいえ | SMTPサーバー認証ユーザー名 |
| SMTP_PASS | いいえ | SMTPサーバー認証パスワード |

### フロントエンド (apps/web/.env)

| 変数名 | 必須 | 説明 |
|---|---|---|
| NEXT_PUBLIC_API_URL | はい | バックエンドAPIベースURL (ブラウザ用) |
| NEXT_PUBLIC_CDN_URL | いいえ | メディア用CloudFront URL |
| NEXT_PUBLIC_SITE_URL | いいえ | メタデータ/サイトマップ/robots用の正規サイトオリジン |
| REVALIDATE_SECRET | いいえ | `POST /api/revalidate` 用の共有秘密鍵 (キャッシュタグ無効化用) |

---

## 15. <ruby>規約<rt>きやく</rt></ruby>と<ruby>標準<rt>ひょうじゅん</rt></ruby>

### コードスタイル

- **TypeScript:** すべての場所で Strict モードを適用
- **フォーマット:** Prettier (シングルクォート、末尾カンマ、100文字幅)
- **リンティング:** TypeScriptプラグイン付き ESLint
- **命名規則:**
  - ファイル名: ケバブケース (例: `music-player.tsx`)
  - コンポーネント名: パスカルケース (例: `MusicPlayer`)
  - 関数/変数名: キャメルケース (例: `fetchData`)
  - DBテーブル名: スネークケース (例: `admin_users`)
  - 環境変数: 大文字スネークケース (例: `DATABASE_URL`)

### Git

- **ブランチ戦略:** main (本番), develop (ステージング), feature/*, fix/*
- **コミットフォーマット:** Conventional Commits (feat:, fix:, chore:, docs:)
- **PR必須:** すべての変更はCIチェックを通過するPR経由で行う

### API

- **プレフィックス:** すべてのルートは `/api` から始める
- **バージョニング:** v1では不要（将来破壊的変更がある場合は `/api/v2` を追加）
- **レスポンス形式:** 成功時 `{ data: T }`、エラー時 `{ statusCode, message, error }`
- **バリデーション:** すべてのDTOは class-validator デコレータで検証

---

## 16. <ruby>デプロイ手順書<rt>でぷろいてじゅんしょ</rt></ruby>（ランブック）

### 初回セットアップ

1. AWSリソースの構築 (RDS, EC2, S3, CloudFront, Amplify)
2. セキュリティグループおよびIAMロールの設定
3. EC2およびAmplify上での環境変数の設定
4. 本番RDSに対する初期Prismaマイグレーションの実行
5. 本番データベースへのシードデータ投入
6. Docker経由でのEC2へのAPIデプロイ
7. AmplifyとGitHubリポジトリの連携
8. デプロイの検証

### <ruby>定期デプロイ<rt>ていきでぷろい</rt></ruby>

1. mainブランチへのプッシュ
2. CIの自動実行
3. GitHub Actions SSH経由でのバックエンドデプロイ
4. Amplify自動ビルド経由でのフロントエンドデプロイ
5. ヘルスチェックエンドポイントの検証

---

## 17. <ruby>意思決定記録<rt>いしけっていきろく</rt></ruby>（デシジョンログ）

| 日付 | 決定事項 | 理由・背景 |
|---|---|---|
| 2026-07-12 | 多言語コンテンツへのJSONB採用 | 固定3言語 — 翻訳テーブルよりシンプル、PrismaのJSONBサポート |
| 2026-07-12 | Category + CategoryItem パターン | スキーマ変更なしで動的なセクションを構築するため |
| 2026-07-12 | 単一管理者構成、ロールテーブルなし | 管理者は1ユーザーのみで十分なため |
| 2026-07-12 | Next.js内への管理画面統合 (独立SPAにしない) | 認証ミドルウェアの共有、コード再利用、シンプルなデプロイ |
| 2026-07-12 | Redux/ContextではなくZustandを採用 | 最小限のボイラープレート、オーディオ用の保存ミドルウェア |
| 2026-07-12 | styled-componentsではなくTailwind CSS 4を採用 | @themeによるデザイントークン、優れたパフォーマンス、Tree-shaking |
| 2026-07-12 | 署名付きURLアップロード (ブラウザからS3へ直送) | APIサーバーの帯域幅負荷を軽減するため |
| 2026-07-12 | デフォルトAWS URL使用 (v1カスタムドメインなし) | 後からRoute 53経由で追加可能なため |
| 2026-07-12 | お問い合わせ情報の表示のみ、メールフォームなし(v1) | シンプル化; AWS SES等の設定を回避するため |
| 2026-07-19 | メール連携機能付きお問い合わせフォーム | インタラクティブなお問い合わせフォームと動的メール配信（Resend/SMTP）を追加 |
| 2026-07-19 | DBベースのメール設定ダッシュボード | メール設定とフォーム表示スイッチを単一行のSiteSettings DBテーブルへ移行、秘密鍵はenvで保持 |
| 2026-07-19 | テーマチェンジャー (Dark & Light-Jazz) | スムーズなアニメーションとLight-Jazzカスタムデザインをサポートするトグルスイッチ |
| 2026-07-20 | `@jazz-portfolio/shared` 内の共有 `ApiRoutes` | 管理画面パス/DTOの乖離を防止; NestコントローラーをHTTP SoTとして保持 |
| 2026-07-20 | `PublicApiClient` / `AdminApiClient` の分離 | ポートフォリオ用ISR+タグ; CMS用 `no-store` + クッキー — 単一クライアントで兼用しない |
| 2026-07-20 | ポートフォリオRSCでの React `cache()` + `Promise.all` | レイアウト/ページの重複プロフィール取得を排除; 順次TTFBを削減 |
| 2026-07-20 | 音楽表示等の `next/dynamic` 遅延ロード | 重要度の低いJS/Canvasをクリティカルパスから除外 |
| 2026-07-20 | 管理画面限定の TanStack Query 採用 | ミューテーションキャッシュ + 分割CMS UI; 公開ポートフォリオはRSCを維持 |
| 2026-07-20 | Prismaインデックス + 軽量選択 + リストページネーション | ホットフィルタのインデックス化; 公開音楽で `s3Key` を除外; 受信箱/メディアをページネーション化 |
| 2026-07-20 | httpOnly クッキー JWT (`jazz_access_token`) | localStorageのXSS脆弱性を排除; クロスオリジン用CORS認証情報 + SameSite |
| 2026-07-20 | CI lint → type-check → build → test | 静的解析だけでなく、リリース破損を確実に検知 |

---

## 18. <ruby>関連ドキュメント<rt>かんれんどきゅめんと</rt></ruby>

| ドキュメント | 目的 |
|---|---|
| [refactor_and_performance.md](./refactor_and_performance.md) | フェーズ1〜6のリファクタリングにおける根拠とベストプラクティス |
| [perf-notes.md](./perf-notes.md) | キャッシュタグ、再検証、ビルドメトリクス、Lighthouse手順 |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | デプロイ運用手順 |
| [backend_development_mastery.md](./backend_development_mastery.md) | Nestパターン詳細ガイド |
| [database_design_deepdive.md](./database_design_deepdive.md) | スキーマおよびクエリ設計 |
| [getting_started.md](./getting_started.md) | ローカル環境構築セットアップ |
