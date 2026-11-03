# 🎷 Jazz Portfolio — <ruby>詳細実演デモガイド<rt>しょうさいじつえんでもがいど</rt></ruby>

> **<ruby>日本語ユーザー<rt>にほんごゆーざー</rt></ruby>および<ruby>開発チーム・ステークホルダー向け<rt>かいはつちーむ・すてーくほるだーむけ</rt></ruby>の<ruby>技術＆機能完全実演マニュアル<rt>ぎじゅつあんどきのうかんぜんじつえんまにゅある</rt>**
> 本ドキュメントは、Jazz Portfolioプロジェクトのフロントエンド（Next.js 15 App Router）、バックエンド（NestJS 11 REST API）、Prisma ORM、PostgreSQL、モノレポ<ruby>構造<rt>こうぞう</rt></ruby>、および<ruby>全機能<rt>ぜんきのう</rt></ruby>を<ruby>網羅的<rt>もうらてき</rt></ruby>かつ<ruby>詳細<rt>しょうさい</rt></ruby>にデモンストレーションするための<ruby>実演手順書<rt>じつえんてじゅんしょ</rt></ruby>です。

---

## <ruby>目次<rt>もくじ</rt></ruby>

1. [<ruby>デモの目的と全体概要<rt>でものもくてきとぜんたいがいよう</rt></ruby>](#1-デモの目的と全体概要)
2. [<ruby>事前準備と環境構築スクリプト<rt>じぜんじゅんびとかんきょうこうちくすくりぷと</rt></ruby>](#2-事前準備と環境構築スクリプト)
3. [<ruby>フロントエンド実演スクリプト<rt>ふろんとえんどじつえんすくりぷと</rt></ruby>（ユーザーUX & デザイン）](#3-フロントエンド実演スクリプトユーザーux--デザイン)
   - [3.1 Jazz<ruby>ローディング画面<rt>ろーでぃんぐがめん</rt></ruby>とHeroセクション](#31-jazzローディング画面とheroセクション)
   - [3.2 バックグラウンド<ruby>音楽プレイヤー<rt>おんがくぷれいやー</rt></ruby>（Zustand & Lazy Loading）](#32-バックグラウンド音楽プレイヤーzustand--lazy-loading)
   - [3.3 <ruby>多言語対応<rt>たげんごたいおう</rt></ruby>（i18n）とダイナミックフォント切り替え](#33-多言語対応i18nとダイナミックフォント切り替え)
   - [3.4 テーマチェンジャー（Dark & Light-Jazz）](#34-テーマチェンジャーdark--light-jazz)
   - [3.5 <ruby>動的ポートフォリオセクション<rt>どうてきぽーとふぉりおせくしょん</rt></ruby>（Skills, Experience, Education）](#35-動的ポートフォリオセクションskills-experience-education)
   - [3.6 ブログ / ジャーナル機能とタグ<ruby>検索<rt>けんさく</rt></ruby>](#36-ブログ--ジャーナル機能とタグ検索)
   - [3.7 スパム<ruby>防御機能付<rt>ぼうぎょきのうつき</rt></ruby>きコメントスレッド](#37-スパム防御機能付きコメントスレッド)
   - [3.8 お問い合わせフォームと<ruby>即時通知<rt>そくじつうち</rt></ruby>](#38-お問い合わせフォームと即時通知)
4. [<ruby>バックエンド実演スクリプト<rt>ばっくえんどじつえんすくりぷと</rt></ruby>（NestJS & Prisma）](#4-バックエンド実演スクリプトnestjs--prisma)
   - [4.1 Swagger API <ruby>対話型ドキュメント<rt>たいわがただキュメント</rt></ruby>](#41-swagger-api-対話型ドキュメント)
   - [4.2 Prisma ORM と PostgreSQL JSONB <ruby>多言語設計<rt>たげんごせっけい</rt></ruby>](#42-prisma-orm-と-postgresql-jsonb-多言語設計)
   - [4.3 安全な httpOnly Cookie JWT <ruby>認証フロー<rt>にんしょうふろー</rt></ruby>](#43-安全な-httponly-cookie-jwt-認証フロー)
   - [4.4 14<ruby>層<rt>そう</rt></ruby>スパム<ruby>防御<rt>ぼうぎょ</rt></ruby>エンジンとブロックリスト](#44-14層スパム防御エンジンとブロックリスト)
   - [4.5 グローバルバリデーションと<ruby>標準化<rt>ひょうじゅんか</rt></ruby>レスポンス](#45-グローバルバリデーションと標準化レスポンス)
   - [4.6 レート<ruby>制限<rt>せいげん</rt></ruby>（Throttler）とヘルスチェック](#46-レート制限throttlerとヘルスチェック)
5. [<ruby>管理画面<rt>かんりがめん</rt></ruby>（CMSアドミンパネル）<ruby>完全実演<rt>かんぜんじつえん</rt></ruby>](#5-管理画面cmsアドミンパネル完全実演)
   - [5.1 ログインと<ruby>保護ルート判定<rt>ほごるーとはんてい</rt></ruby>（Next.js Middleware）](#51-ログインと保護ルート判定nextjs-middleware)
   - [5.2 ダッシュボード統計（軽量カウントAPI）](#52-ダッシュボード統計軽量カウントapi)
   - [5.3 プロフィール<ruby>編集<rt>へんしゅう</rt></ruby>とS3<ruby>署名付<rt>しょめいつ</rt></ruby>きURLメディアアップロード](#53-プロフィール編集とs3署名付きurlメディアアップロード)
   - [5.4 カテゴリ＆アイテム<ruby>管理<rt>かんり</rt></ruby>（並び順変更・論理削除）](#54-カテゴリ＆アイテム管理並び順変更論理削除)
   - [5.5 音楽トラック<ruby>管理<rt>かんり</rt></ruby>とS3アップロード](#55-音楽トラック管理とs3アップロード)
   - [5.6 2<ruby>画面分割受信用インボックス<rt>がめんぶんかつじゅしんよういんぼっくす</rt></ruby>](#56-2画面分割受信用インボックス)
   - [5.7 システム<ruby>設定<rt>せってい</rt></ruby>＆メール配信コントロール](#57-システム設定＆メール配信コントロール)
6. モノレポ・CI/CD・AWS<ruby>インフラストラクチャ<rt>いんふらすとらくちゃ</rt></ruby>のデモ](#6-モノレポcicdawsインフラストラクチャのデモ)
   - [6.1 Turborepo <ruby>並列タスクキャッシュ<rt>へいれつたすくきゃっしゅ</rt></ruby>（FULL TURBO）](#61-turborepo-並列タスクキャッシュfull-turbo)
   - [6.2 AWSクラウド<ruby>構成アーキテクチャ<rt>こうせいあーきてくちゃ</rt></ruby>](#62-awsクラウド構成アーキテクチャ)
   - [6.3 GitHub Actions CI/CD パイプライン](#63-github-actions-cicd-パイプライン)
7. [<ruby>想定質問<rt>そうていしつもん</rt></ruby>と回答（Q&A<ruby>マスターガイド<rt>ますたーがいど</rt></ruby>）](#7-想定質問と回答qaマスターガイド)

---

## 1. <ruby>デモの目的と全体概要<rt>でものもくてきとぜんたいがいよう</rt></ruby>

本デモは、**Jazz Portfolio**が<ruby>備<rt>そな</rt></ruby>える「フルスタックWebアプリケーションとしての完成度」を<ruby>開発者<rt>かいはつしゃ</rt></ruby>・ステークホルダーに<ruby>実証<rt>じっしょう</rt></ruby>するために<ruby>設計<rt>せっけい</rt></ruby>されています。

### <ruby>全機能マップ<rt>ぜんきのうまっぷ</rt></ruby>

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          JAZZ PORTFOLIO SYSTEM                              │
├──────────────────────────────────────┬──────────────────────────────────────┤
│    PUBLIC PORTFOLIO (Next.js 15)     │      ADMIN CMS (Next.js + NestJS)     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ • Jazz Theme & Framer Motion         │ • httpOnly Cookie JWT Authentication │
│ • Persistent Music Player (Zustand)  │ • Profile & Bio Editor               │
│ • Multilingual (EN, VI, JA) i18n     │ • Category & Item Manager (Reorder)  │
│ • Dynamic Skills/Experience/Edu      │ • Music Track Manager (S3 Upload)    │
│ • Markdown Blog & Tag Filter         │ • Split-Screen Contact Inbox         │
│ • Threaded Comments + Spam Protection│ • Email & Feature Flag Controls      │
│ • Contact Form & Email Alerts        │ • System Stats & Audit Metrics       │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. <ruby>事前準備と環境構築スクリプト<rt>じぜんじゅんびとかんきょうこうちくすくりぷと</rt></ruby>

デモをスムーズに<ruby>進行<rt>しんこう</rt></ruby>するため、あらかじめローカル<ruby>環境<rt>かんきょう</rt></ruby>をセットアップします。

### Step 1: 依存関係のインストール

```bash
# プロジェクトルートで実行
pnpm install
```

### Step 2: 環境変数の設定

1. `packages/database/.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/jazz_db?schema=public"
   ```
2. `apps/api/.env`:
   ```env
   PORT=3001
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/jazz_db?schema=public"
   JWT_SECRET="dev-secret-key-make-it-long-and-secure-for-local-testing"
   JWT_EXPIRATION="24h"
   FRONTEND_URL="http://localhost:3000"
   ```
3. `apps/web/.env`:
   ```env
   NEXT_PUBLIC_API_URL="http://localhost:3001/api"
   ```

### Step 3: データベース初期化＆シードデータの自動生成

```bash
# Prisma Client 生成
pnpm --filter @jazz-portfolio/database db:generate

# DBスキーマの反映
pnpm --filter @jazz-portfolio/database db:push

# デモ用データの投入（初期管理者、プロファイル、スキル、カテゴリ、サイト設定）
pnpm --filter @jazz-portfolio/database db:seed
```

> **🔑 シードで生成される初期資格情報:**
> - **管理者ログインURL**: `http://localhost:3000/en/admin/login`
> - **ユーザー名**: `admin`
> - **パスワード**: `admin123`

### Step 4: 開発サーバーの起動

```bash
pnpm dev
```

- **フロントエンド Web**: `http://localhost:3000`
- **バックエンド REST API**: `http://localhost:3001/api`
- **Swagger API Docs**: `http://localhost:3001/api/docs`

---

## 3. <ruby>フロントエンド実演スクリプト<rt>ふろんとえんどじつえんすくりぷと</rt></ユーザーUX & デザイン）

### 3.1 Jazz<ruby>ローディング画面<rt>ろーでぃんぐがめん</rt></ruby>とHeroセクション

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. シークレットウィンドウで `http://localhost:3000/en` を開きます。
2. <ruby>画面初回訪問時<rt>がめんしょかいほうもんじ</rt></ruby>にジャズ風アニメーションローダー（サックス・音符アイコン）が表示され、スムーズにHeroセクションへ切り替わる様子を見せます。
3. リロードした際、`sessionStorage`（`first_visit` キー）によりローダーがスキップされ、即座にコンテンツが表示される仕様を説明します。

---

### 3.2 バックグラウンド<ruby>音楽プレイヤー<rt>おんがくぷれいやー</rt></ruby>（Zustand & Lazy Loading）

#### <ruby>実演手順<rt>じつえんてじゅn</rt></ruby>:
1. <ruby>画面最下部<rt>がめんさいかぶ</rt></ruby>に常駐するオーディオプレーヤーバーを示します。
2. ブラウザの自動再生制限をクリアするため「Unmute」プロンプトが表示され、クリックすることでBGMが再生される様子を見せます。
3. ヘッダーのリンクをクリックして `/en` -> `/ja` -> `/vi` へ<ruby>画面移動<rt>がめんいどう</rt></ruby>します。**音楽が一切途切れることなく再生し続ける**ことを実演します。
4. プレーヤー右側のプレイリストアイコンをクリックし、スライドアップする `PlaylistDrawer` から楽曲を切り替えます。

#### <ruby>技術的解説ポイント<rt>ぎじゅつてきかいせつぽいんと</rt></ruby>:
- **Zustand `persist` ミドルウェア**: 音量・ミュート設定・トラックインデックスを `localStorage` に保存。
- **パフォーマンス最適化**: `MusicPlayer` コンポーネントは Next.js `next/dynamic` (`ssr: false`) で遅延ロードされ、初期HTML生成（RSC）を妨げません。

---

### 3.3 <ruby>多言語対応<rt>たげんごたいおう</rt></ruby>（i18n）とダイナミックフォント切り替え

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. ヘッダー右上の国旗アイコンをクリックし、`EN (GB)` -> `JA (JP)` -> `VI (VN)` と切り替えます。
2. URLが `/en`, `/ja`, `/vi` へ変更され、ページリロードなし（SPAの滑らかさ）でテキストが切り替わることを示します。
3. **日本語表示（`/ja`）選択時**:
   - 見出しフォントが `Playfair Display` から明朝体 `Noto Serif JP` に変更。
   - 本文フォントが `Inter` から ゴシック体 `Noto Sans JP` に自動切換されるデザイン調整を提示します。

---

### 3.4 テーマチェンジャー（Dark & Light-Jazz）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. ヘッダーの月/太陽トグルアイコンをクリックします。
2. ダークスモーキー (`#0a0a0f`) から、上品なウォームペーパーカラーとゴールドアクセントの「Light-Jazz」テーマへとなめらかに移行するアニメーションを披露します。

---

### 3.5 <ruby>動的ポートフォリオセクション<rt>どうてきぽーとふぉりおせくしょん</rt></ruby>（Skills, Experience, Education）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. スクロールして `Experience` セクションおよび `Skills` セクションを表示します。
2. Framer Motion の `useInView` により、要素が画面に入るタイミングでカードが段階的（Staggered Animation）に浮き上がる視覚効果を実演します。
3. これらのデータは静的ハードコードではなく、後述の管理画面から動的に追加・編集・並び替えできる構造であることを強調します。

---

### 3.6 ブログ / ジャーナル機能とタグ<ruby>検索<rt>けんさく</rt></ruby>

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/en/blog` へ移動します（サイト設定でブログが有効化されている場合）。
2. Markdownでレンダリングされた記事一覧と読了予測時間（`readingMinutes`）の表示を見せます。
3. タグ（例: `jazz`, `typescript`）をクリックし、APIによるタグフィルタリング結果（`GET /api/blog?tag=typescript`）を表示します。

---

### 3.7 スパム<ruby>防御機能付<rt>ぼうぎょきのうつき</rt></ruby>きコメントスレッド

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. 記事詳細ページへ移動し、下部のコメントスレッドを表示します。
2. コメント入力フォームから名前・メールアドレス・本文を入力して送信します。
3. バックエンドの14層スパムシールド（SpamScore判定・IPハッシュ化・重複ハッシュ検知）により、「PENDING（承認待ち）」状態として安全に受け付けられるフローを解説します。

---

### 3.8 お問い合わせフォームと<ruby>即時通知<rt>そくじつうち</rt></ruby>

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. フッター手前の Contact セクションへ移動します。
2. お問い合わせフォームを入力して送信します。
3. フロントエンドで送信成功バナーが表示され、バックエンド経由で管理者宛てにメール通知（Resend / SMTP）がトリガーされる仕組みを説明します。

---

## 4. <ruby>バックエンド実演スクリプト<rt>ばっくえんどじつえんすくりぷと</rt></ NestJS & Prisma）

### 4.1 Swagger API <ruby>対話型ドキュメント<rt>たいわがただキュメント</rt></ruby>

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. ブラウザで `http://localhost:3001/api/docs` を開きます。
2. NestJS の `@nestjs/swagger` によって自動生成された完全な OpenAPI ドキュメントを提示します。
3. `GET /api/profile` の「Execute」ボタンをクリックし、実際にデータベースから返却されるJSONレスポンスを実演します。

---

### 4.2 Prisma ORM と PostgreSQL JSONB <ruby>多言語設計<rt>たげんごせっけい</rt></ruby>

#### <ruby>技術的解説<rt>ぎじゅつてきかいせつ</rt></ruby>:
`packages/database/prisma/schema.prisma` の設計思想を提示します：

```prisma
model Post {
  id          String   @id @default(uuid())
  slug        String   @unique
  title       Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  content     Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  tags        String[] @default([])
  status      String   @default("DRAFT")
  publishedAt DateTime? @map("published_at")
  isDeleted   Boolean  @default(false) @map("is_deleted")

  @@index([isDeleted, status, publishedAt(sort: Desc)])
  @@index([tags], type: Gin)
  @@map("posts")
}
```

- **JSONBカラム**: 多言語テキスト（英語・ベトナム語・日本語）を1行のレコード内に保存。複雑なリレーションテーブルとのJOINを不要にし、クエリパフォーマンスを最大化。
- **インデックス最適化**: 複合インデックスおよび `tags` 配列検索用の PostgreSQL **GIN インデックス**を適用。

---

### 4.3 安全な httpOnly Cookie JWT <ruby>認証フロー<rt>にんしょうふろー</rt></ruby>

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. デベロッパーツール（F12 -> Application -> Cookies）を開いた状態で `POST /api/auth/login` を実行します。
2. レスポンスヘッダー `Set-Cookie` により、`jazz_access_token` が `httpOnly`, `Secure`, `SameSite` 属性で安全にセットされる様子を見せます。

```
Set-Cookie: jazz_access_token=eyJhbGciOi...; Path=/; HttpOnly; Secure; SameSite=None
```

#### <ruby>セキュリティ効果<rt>せきゅりてぃこうか</rt></ruby>:
- JavaScript（`document.cookie` や `localStorage`）からトークンにアクセスできないため、**XSS（クロスサイトスクリプティング）攻撃によるログインセッション強奪を100%防止**します。

---

### 4.4 14<ruby>層<rt>そう</rt></ruby>スパム<ruby>防御<rt>ぼうぎょ</rt></ruby>エンジンとブロックリスト

#### <ruby>技術的解説<rt>ぎじゅつてきかいせつ</rt></ruby>:
`SpamShieldService` が行う14段階の自動検査アルゴリズムを解説します：
1. ハニーポット隠しフィールドの検証
2. 短時間連続投稿のレートリミット（IPハッシュベース）
3. 過去投稿との重複本文ハッシュ（SHA-256）チェック
4. 禁止ワード・ドメイン・IPブロックリスト（`comment_blocklist`）照合
5. スパムスコア計算（リンク数、過度な大文字、特定キーワードパターン）

---

### 4.5 グローバルバリデーションと<ruby>標準化<rt>ひょうじゅんか</rt></ruby>レスポンス

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. Swagger UI から必須パラメータを欠落させたり、未定義のフィールドを追加してリクエストを送信します。
2. NestJS の `ValidationPipe`（`whitelist: true`, `forbidNonWhitelisted: true`）により、不正なリクエストが自動的に弾かれる様子を実演します。
3. 成功時（`TransformInterceptor` による `{ data: ... }` 形式）およびエラー時（`HttpExceptionFilter` による統一エラー形式）のレスポンス構造がプロジェクト全体で一貫していることを示します。

---

### 4.6 レート<ruby>制限<rt>せいげん</rt></ruby>（Throttler）とヘルスチェック（AWS ALB<ruby>対応<rt>たいおう</rt></ruby>）

#### <ruby>技術的解説<rt>ぎじゅつてきかいせつ</rt></ruby>:
- **グローバルレート制限**: `@nestjs/throttler` を用いて、システム全体で1分間に100リクエスト（`ttl: 60000`, `limit: 100`）の制限を標準適用。DDoS攻撃やブルートフォース攻撃からインフラを保護します。
- **ヘルスチェックエンドポイント**: AWSデプロイ時、ロードバランサー（ALB）やECS/EC2がコンテナの健全性を確認するための `/api/health`（`HealthController`）が組み込まれていることを解説します。

---

## 5. <ruby>管理画面<rt>かんりがめん</rt></ruby>（CMSアドミンパネル）<ruby>完全実演<rt>かんぜんじつえん</rt></ruby>

### 5.1 ログインと<ruby>保護ルート判定<rt>ほごるーとはんてい</rt></ruby>（Next.js Middleware）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. 未ログイン状態で `http://localhost:3000/en/admin/profile` に直接アクセスを試みます。
2. Next.js ミドルウェアが未認証を検知し、自動的に `/en/admin/login` へリダイレクトする保護動作を示します。
3. ユーザー名 `admin` / パスワード `admin123` でログインを実行します。

#### <ruby>技術的解説<rt>ぎじゅつてきかいせつ</rt></ruby>:
- **Edge Routing セキュリティ**: 実際のJWTは APIサーバーの `httpOnly` クッキー（`jazz_access_token`）に保存されるため、フロントエンド（Next.js）からは読み取れません。代わりに、フロントエンドはログイン成功時に安全な `ADMIN_SESSION_MARKER_COOKIE`（セッションマーカー）を発行し、ミドルウェアはこのマーカーの有無で高速なEdgeリダイレクト判定を行っています。

---

### 5.2 ダッシュボード統計（軽量カウントAPI）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. ログイン後、ダッシュボード概要ページ（`/admin`）が表示されます。
2. 重いカテゴリツリー全体を取得せず、`GET /api/admin/stats` によってカテゴリ数・記事数・未承認コメント数が一瞬で表示される軽量設計を解説します。

---

### 5.3 プロフィール<ruby>編集<rt>へんしゅう</rt></ruby>とS3<ruby>署名付<rt>しょめいつ</rt></ruby>きURLメディアアップロード

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/admin/profile` タブを開きます。
2. 多言語（EN, VI, JA）のバイオテキストを編集して保存します。
3. アバター画像選択時、バックエンド（`POST /api/admin/media/presign`）から発行された S3 署名付きURL（Presigned URL）を利用して、**APIサーバーを経由せずブラウザからAWS S3へ直接画像がアップロードされる**高速仕組みを説明します。

---

### 5.4 カテゴリ＆アイテム<ruby>管理<rt>かんり</rt></ruby>（並び順変更・論理削除）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/admin/categories` タブを開きます。
2. ドラッグ＆ドロップまたは矢印操作でカテゴリの並び順を変更します。`PATCH /api/admin/categories/reorder` が送信され、画面が瞬時に更新（TanStack Query ミューテーションキャッシュ）される様子を見せます。
3. カテゴリの削除ボタンを押し、データベース上で物理削除ではなく安全な「論理削除（`isDeleted: true`）」が行われる仕様を示します。

---

### 5.5 音楽トラック<ruby>管理<rt>かんり</rt></ruby>とS3アップロード

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/admin/music` タブを開きます。
2. MP3 オーディオファイルをアップロードし、トラックタイトル・アーティスト名・プレイリスト順序を設定・保存します。
3. 公開ページの音楽プレイヤーに新トラックが即座に反映される流れを実演します。

---

### 5.6 2<ruby>画面分割受信用インボックス<rt>がめんぶんかつじゅしんよういんぼっくす</rt></ruby>

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/admin/contact` タブを開きます。
2. 左側に送信メッセージ一覧、右側に選択メッセージの詳細文言が表示されるデスクトップ最適化インボックス画面を披露します。
3. メッセージ選択時に `PATCH /api/admin/contact/:id/read` が走り、未読バッジがリアルタイムに更新される様子を見せます。

---

### 5.7 システム<ruby>設定<rt>せってい</rt></ruby>＆メール配信コントロール

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
1. `/admin/settings` タブを開きます。
2. お問い合わせフォームの有効/無効スイッチ、メールプロバイダー切替（Resend vs SMTP）を変更します。
3. 「テストメール送信」ボタンを押し、設定されたメールアドレス宛にテスト通知が正常送信されるかテストを実行します。

---

## 6. モノレポ・CI/CD・AWS<ruby>インフラストラクチャ<rt>いんふらすとらくちゃ</rt></ruby>のデモ

### 6.1 Turborepo <ruby>並列タスクキャッシュ<rt>へいれつたすくきゃっしゅ</rt></ruby>（FULL TURBO）

#### <ruby>実演手順<rt>じつえんてじゅん</rt></ruby>:
ターミナルを開き、以下を実行します：

```bash
# 1回目：全パッケージのフルビルド
pnpm build

# 2回目：コードに変更がない状態でのビルド実行
pnpm build
```

#### <ruby>実演効果<rt>じつえんこうか</rt></ruby>:
2回目のビルド実行時、Turborepoが `[FULL TURBO]` と表示し、数ミリ秒で全ビルドタスクが完了することを披露します。

---

### 6.2 AWSクラウド<ruby>構成アーキテクチャ<rt>こうせいあーきてくちゃ</rt></ruby>

本番環境のインフラトポロジーをスライドまたは図で説明します：

```
                      +-----------------------------------+
                      |      AWS Cloud Environment        |
                      +----------------─┬─────────────────+
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
+──────────────────────+                                 +──────────────────────+
│  AWS Amplify (CDN)   │                                 │   AWS EC2 (ARM64)    │
│  Next.js 15 App      │──────(HTTPS REST API)──────────>│   Docker NestJS API  │
│  (Port 80/443)       │                                 │   (Port 3001)        │
+──────────────────────+                                 +──────────┬───────────+
                                                                    │
                                                                    ▼
                                                         +──────────────────────+
                                                         │  AWS RDS PostgreSQL  │
                                                         │  (DB Instance 5432)  │
                                                         +──────────────────────+
```

- **Amplify**: Next.js 15 フロントエンドのグローバル CDN エッジ配信。
- **EC2 (Amazon Linux 2023 ARM64)**: Docker コンテナ上で動作する NestJS API。
- **RDS (PostgreSQL 16)**: 自動バックアップ・暗号化付きデータベース。
- **S3 + CloudFront**: 音声・画像メディアの高速グローバル配信。

---

### 6.3 GitHub Actions CI/CD パイプライン

#### <ruby>技術的解説<rt>ぎじゅつてきかいせつ</rt></ruby>:
- `ci.yml`: PR提出時に `lint` -> `type-check` -> `build` -> `test` を自動実行。
- `deploy-api.yml`: `main` ブランチマージ時に SSH 経由で EC2 へ接続し、Docker 再ビルドおよび Prisma マイグレーションを完全自動実行。

---

## 7. <ruby>想定質問<rt>そうていしつもん</rt></ruby>と回答（Q&A<ruby>マスターガイド<rt>ますたーがいど</rt></ruby>）

| 質問ジャンル | 想定される質問 | 推奨される回答 |
|---|---|---|
| **アーキテクチャ** | なぜ Monorepo (pnpm + Turborepo) なのか？ | WebとAPI間でTypeScript型（`@jazz-portfolio/shared`）やDB定義を100%共有でき、型安全な開発と高速ビルドが両立できるため。 |
| **セキュリティ** | JWTトークンを localStorage に入れない理由は？ | XSS攻撃によってJSからトークンが盗まれるリスクを回避するため。`httpOnly` クッキーを採用することでブラウザセキュリティの最高水準を確保しています。 |
| **パフォーマンス** | 多言語化によるレスポンス遅延はないか？ | DB側で PostgreSQL の `JSONB` を使用し、1リレーションで3言語分を保持するため、JOINによるクエリ遅延が一切発生しません。 |
| **拡張性** | 将来的に検索エンジンや大規模ブログ機能を追加する場合は？ | NestJSのモジュール設計により、Algolia/Elasticsearch連携やCQRSパターン（コマンド/クエリ分離）へ段階的に移行可能な設計になっています。 |

---

> **本実演ガイドを活用することで、技術的な深みとUI/UXの魅力を完璧に伝えるデモンストレーションを実施することができます。**
