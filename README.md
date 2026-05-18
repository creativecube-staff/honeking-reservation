# Honeking Reservation

整骨院チェーン向けの予約管理システム。

お客様はWeb上で「店舗→メニュー→日時→顧客情報」の4ステップで予約が完結。
店舗スタッフは管理画面で予約・シフト・物販・顧客を一括管理。

## 参考イメージ

<https://yoyaku.aigorit.com/>

## 主な機能

### お客様側

- 4ステップの予約フロー（店舗 → メニュー → 日時 → 顧客情報・確認 → 完了）
- 日時選択は時刻×曜日グリッド（◯/△/要TEL）で空き状況を可視化
- 個人情報はAES-256-GCMでアプリ層暗号化
- **会員機能**: メール認証付きの会員登録・ログイン・マイページ
  - 予約履歴の閲覧
  - 氏名・電話・メアド・パスワードの変更
  - 退会（ゲスト顧客に格下げ、来店履歴は保持）

### 管理画面

- **予約・販売管理**
  - 一覧ビュー: ステータスタブ（予約済/完了/無断キャンセル/キャンセル）、店舗・ベッド・日付・検索フィルタ
  - スケジュールビュー: 店舗のベッド×時間軸ガントチャート（クリックで詳細遷移）
  - 手動予約作成、ステータス変更、予約変更履歴
- **物販・回数券販売**
  - 予約に紐付ける販売 / 予約なしの店頭販売
  - ゲスト購入モード（固定の「店頭ふらっと販売」顧客に集約）
  - 複数商品カート式、顧客の部分一致検索
- **顧客管理**
  - 会員区分タブ（本会員/仮登録/休眠/ゲスト/退会済）
  - 休眠顧客フィルタ（最終来店から N 日以上）
  - 詳細画面で来店履歴・物販販売・保有回数券・接客メモを一覧
- **シフト管理** (FullCalendar 風自作カレンダー、月/週/日/スタッフ別)
- **店舗管理** (基本情報・ベッド・特別メニュー・営業時間・店休日をタブで集約)
- **スタッフ管理** (役職テンプレート + 個別 permission overrides で権限制御)
- **メニュー・商品・売上管理**

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Nuxt 4.4 (TypeScript) |
| UI | Nuxt UI v4 + Tailwind CSS v4 |
| ORM | Prisma 6.19 |
| DB（開発・本番とも） | Supabase PostgreSQL（東京リージョン） |
| カレンダー（客側） | v-calendar |
| カレンダー（管理） | 自作 TimeColumnCalendar（縦軸=時刻、横軸=スタッフ/ベッド） |
| 認証（管理画面） | nuxt-auth-utils + 2FA TOTP（Phase 6 で導入予定） |
| 認証（会員） | nuxt-auth-utils + メール認証 |
| バリデーション | Zod |
| メール送信 | Resend |
| 実行環境（開発） | Docker Compose（ローカル） |
| 実行環境（本番） | Docker Compose on VPS |

## セットアップ

```bash
# 1. リポジトリ取得
git clone <このリポジトリ>
cd honeking-reservation

# 2. Supabase でプロジェクト作成（無料）
#    ダッシュボードから DATABASE_URL / DIRECT_URL を取得しておく

# 3. 環境変数
cp .env.example .env
# .env を編集：
#   - DATABASE_URL / DIRECT_URL（Supabase）
#   - RESERVATION_ENCRYPTION_KEY（`openssl rand -base64 32` で生成、本番ではバックアップ必須）
#   - NUXT_SESSION_PASSWORD（`openssl rand -base64 48` で生成）
#   - RESEND_API_KEY（会員メール認証で必要）

# 4. 開発サーバー起動（バックグラウンド）
docker compose up -d

# 5. DBマイグレーション & 初期データ投入
docker compose exec nuxt npx prisma migrate dev
docker compose exec nuxt npx prisma db seed

# → http://localhost:3000
```

## 開発コマンド

```bash
# 起動 / 停止
docker compose up -d
docker compose down

# .env / docker-compose.yml を編集したら必須（restart では再ロードされない）
docker compose up -d --force-recreate

# Caddyfile の中身だけ編集したとき
docker compose restart caddy

# ログ追跡
docker compose logs -f nuxt
docker compose logs -f caddy

# Prisma
docker compose exec nuxt npx prisma migrate dev --name <変更名>
docker compose exec nuxt npx prisma generate
docker compose exec nuxt npx prisma db seed

# パッケージ追加
docker compose exec nuxt npm install <package>

# コンテナ内シェル
docker compose exec nuxt sh
```

ホスト側で直接 `npm run dev` は実行しない。すべてコンテナ内で動かす。

### `restart` と `up -d` の使い分け（重要）

| 変更内容 | コマンド | 理由 |
|---|---|---|
| `Caddyfile` の中身だけ | `docker compose restart caddy` | Caddy が設定ファイルを再読込 |
| `.env` を編集 | `docker compose up -d --force-recreate` | restart では `env_file` が再ロードされない |
| `docker-compose.yml` を編集（ports / volumes / depends_on） | `docker compose up -d --force-recreate` | restart は既存コンテナを同じ設定で再起動するだけ |

覚え方: **restart = 同じ設定で再起動 / up = 設定を読み直してコンテナ作り直し**

## ローカルのリバースプロキシ構成

本番に近い「ホスト分離 + HTTPS + Basic 認証 + edge-served 404」をローカルでも再現するため、Caddy をリバースプロキシとして導入。

```
ブラウザ
  ↓ https://reserve.honeking.localhost / https://admin.honeking.localhost
Caddy（80/443、HTTPS は内部 CA で自動取得）
  ├─ admin ホスト: Basic 認証ゲート → /login or /dashboard/* を通す
  ├─ 越境パス: 静的 404 を edge で直接返す
  └─ Host ヘッダで振り分け
Nuxt（コンテナ内、3000）
```

| ホスト | 用途 | 認証 | 越境パスの扱い |
|---|---|---|---|
| `reserve.honeking.localhost` | お客様向け予約サイト | なし | `/dashboard*` / `/api/admin*` は edge で 404 |
| `admin.honeking.localhost` | 管理画面 | **Basic 認証 + アプリログイン**（多層防御） | allow-list 方式（`/login` `/dashboard*` `/api/admin*` `/api/_*` `/_nuxt*` `/__nuxt*` `/__vite*` 等のみ通す） |
| `localhost:3000` | Nuxt 直アクセス（HMR フォールバック） | なし | 全パスアクセス可 |

### 初回セットアップ手順

```bash
# 1. /etc/hosts に2行追加（sudo パスワード入力あり）
echo "127.0.0.1 reserve.honeking.localhost
127.0.0.1 admin.honeking.localhost" | sudo tee -a /etc/hosts

# 2. .env に Basic 認証用の認証情報を設定
#    ADMIN_USER=任意のユーザー名
#    ADMIN_PASSWORD_HASH=$$2a$$14$$...  ← bcrypt ハッシュ。$ は $$ にエスケープ必須
#    （ハッシュ生成: docker compose exec caddy caddy hash-password）

# 3. コンテナ起動
docker compose up -d --force-recreate

# 4. Caddy の内部 CA を macOS Keychain に信頼登録
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-ca.crt
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ./caddy-local-ca.crt
rm ./caddy-local-ca.crt

# 5. ブラウザを完全再起動してから https://reserve.honeking.localhost にアクセス
```

静的 404 ページ: `caddy/error-pages/404.html`（JS でホスト名を見てテーマ切替）

## URL 設計

### お客様側（reserve.honeking.jp）

```
/                                          ← 店舗選択
/[storeSlug]                               ← メニュー選択
/[storeSlug]/[menuId]                      ← 日時選択
/[storeSlug]/[menuId]/[startAt]/confirm    ← 顧客情報・確認
/complete/[code]                           ← 完了画面
/login                                     ← 会員ログイン（host-aware）
/signup / /me/* / /privacy / /terms など
```

ホスト名で文脈が明示されてるため、`/reserve/` や `/menu/` などの冗長なプレフィックスは付けない（SEO 重視）。

`/[storeSlug]/...` はフラットな名前空間なので、店舗 slug が固定ルートと衝突しないよう `shared/reservedSlugs.ts` で予約済みワードをバリデーション。

### 管理画面側（admin.honeking.jp）

```
/                       ← /dashboard へ 302 リダイレクト
/login                  ← スタッフログイン（host-aware で会員ログインと同 URL を共用）
/dashboard              ← ダッシュボード
/dashboard/reservations ← 予約・販売管理
/dashboard/customers    ← 顧客管理
/dashboard/shifts       ← シフト管理
/dashboard/stores       ← 店舗管理
/dashboard/staff        ← スタッフ管理
/dashboard/menus        ← メニュー管理
/dashboard/products     ← 商品管理
/dashboard/sales        ← 売上管理
/dashboard/help         ← ヘルプ
```

admin の全ページを `/dashboard/*` 配下に集約することで、新規ページ追加時に Caddy allow-list を増やす必要がなくなる（`/dashboard*` で網羅）。

`/login` のみホスト共有のため、`app/pages/login.vue` で `useRequestURL().hostname` を見て `Member/StaffLoginForm` を切り替える（host-aware）。

## ディレクトリ構成

```
.
├─ docker-compose.yml
├─ Caddyfile                              # ローカルリバースプロキシ設定
├─ caddy/error-pages/404.html             # 静的 404 ページ（host-aware テーマ切替）
├─ nuxt.config.ts
├─ prisma/
│   ├─ schema.prisma
│   ├─ migrations/
│   └─ seed.mjs
├─ app/
│   ├─ pages/
│   │   ├─ index.vue                      # 店舗選択（お客様トップ）
│   │   ├─ [slug]/                        # 予約フロー（メニュー → 日時 → 確認）
│   │   ├─ complete/[code].vue            # 予約完了画面
│   │   ├─ login.vue                      # ログイン（host-aware: 会員 / スタッフ両用）
│   │   ├─ signup.vue                     # 会員登録
│   │   ├─ me/                            # 会員マイページ
│   │   ├─ forgot-email/ verify-email/ password-reset/  # 会員系認証フロー
│   │   ├─ privacy.vue / terms.vue
│   │   └─ dashboard/                     # 管理画面（admin ホスト専用）
│   │       ├─ index.vue                  # ダッシュボード
│   │       ├─ reservations/              # 予約・販売管理（一覧⇄スケジュール）
│   │       ├─ customers/                 # 顧客管理
│   │       └─ shifts/ stores/ staff/ menus/ products/ sales/ help/
│   ├─ components/
│   │   ├─ Base/                          # 汎用（PillTabs, Pagination）
│   │   ├─ Calendar/                      # 縦軸=時刻のカレンダー
│   │   ├─ Login/                         # MemberLoginForm / StaffLoginForm（host-aware で切替）
│   │   └─ Admin/                         # 管理画面用
│   ├─ layouts/                           # default / admin
│   ├─ middleware/                        # 認証ガード
│   ├─ error.vue                          # Nuxt 共通エラーページ
│   └─ utils/format.ts                    # JST フォーマッタ + 円表記
├─ server/
│   ├─ api/
│   │   ├─ admin/                         # 管理 API（権限ガード、URL はそのまま）
│   │   ├─ member/                        # 会員 API（自分自身のみ）
│   │   └─ availability.get.ts            # 公開 API
│   └─ utils/                             # crypto, hash, mail, prisma, etc.
└─ shared/
    ├─ permissions.ts                     # 権限定義
    ├─ membership.ts                      # 会員区分判定
    ├─ reservationStatus.ts               # 予約ステータス表示ロジック
    ├─ reservedSlugs.ts                   # 店舗 slug の予約済みワード
    └─ schemas/                           # Zod スキーマ
```

## データモデル概要

主要エンティティ:

- **Store** — 店舗マスタ
- **Bed** — 施術ベッド（店舗ごとに3〜4台）
- **Practitioner** — スタッフ（施術者・受付・店長）。予約割当可否とログイン可否を分離
- **Menu** — メニュー（共通メニュー + 店舗特別メニューの2階建て）
- **BusinessHour** / **Holiday** / **Closure** / **PublicHoliday** — 営業時間・休業
- **Shift** — 施術者シフト（ヘルプ先店舗指定可）
- **Customer** — 顧客（個人情報はAES-256-GCM暗号化、検索は `*Hash`カラム）
  - 会員機能、退会日時、管理者用接客メモを保持
- **Reservation** — 予約 + **ReservationHistory** — 変更履歴
- **Product** / **ProductSale** — 商品マスタ + 販売記録（物販・回数券）
- **CustomerVoucher** / **VoucherUsage** — 回数券保有・消費

予約の重複は **PostgreSQL `EXCLUDE` 制約**でDBレベル防止（同じベッド・施術者の時間重複を不可能にする）。

## セキュリティ方針（法人運用）

- HTTPS強制（Let's Encrypt自動更新）
- 管理画面: IP制限 + 2FA TOTP（Phase 6 で導入）
- 個人情報（氏名・電話・メール）はアプリ層で**AES-256-GCM暗号化**
- 検索は**SHA-256ハッシュ**で行い、暗号化値を復号せず比較
- Supabase接続情報・暗号化キーは`.env`のみで管理、Gitに含めない
- サービスロールキーはサーバー側のみで使用、クライアントに露出させない
- バックアップ: Supabase自動バックアップ + Cloudflare R2 オフサイト
- SSH鍵認証のみ、UFW + fail2ban
- プライバシーポリシー・利用規約は公開前に整備

## リリース計画

| フェーズ | 環境 | 月額 |
|---|---|---|
| Stage 1: 開発（現在） | ローカル Docker Compose + Supabase Free | 0円 |
| Stage 2: ステージング | （いったんスキップ） | — |
| Stage 3: 本番 | VPS + Docker Compose + Supabase Pro | 約5,500円 |

Supabase Freeは1週間アクセスがないと一時停止するため、本番はSupabase Pro必須。
開発中は管理画面から数分で復帰できるため許容。

## 本番運用の構成

```
                          [ お客様ブラウザ / スマホ ]
                                    │ HTTPS
                                    ▼
                         [ Cloudflare 無料プラン ]
                         （DNS / DDoS 対策 / キャッシュ）
                                    │
                                    ▼
                    ┌────────────────────────────┐
                    │  VPS (さくら / ConoHa 2GB) │
                    │  ・Docker Compose          │
                    │  ・Nuxt 4 (Node + Vite)    │
                    │  ・Let's Encrypt 証明書    │
                    └────────────────────────────┘
                           │                  │
                  接続情報 │                  │ オフサイトバックアップ
                           ▼                  ▼
                  [ Supabase Pro ]    [ Cloudflare R2 ]
                  （PostgreSQL）      （バックアップ）
                  ・東京リージョン     ・10GBまで無料
                  ・自動バックアップ   ・暗号化保管
                  ・PITR 7日間保持
```

## 月額運用費

### 最小構成（公開直後）

| 項目 | サービス | 月額 |
|---|---|---:|
| VPS（アプリ実行） | さくら / ConoHa / Xserver 1GB | ¥880 〜 1,500 |
| データベース | **Supabase Pro**（必須） | ¥3,750（$25） |
| ドメイン | お名前.com 等（年払い） | ¥125 〜 250 |
| HTTPS 証明書 | Let's Encrypt | ¥0 |
| オフサイトバックアップ | Cloudflare R2（10GB まで無料） | ¥0 |
| DNS / DDoS 対策 | Cloudflare 無料プラン | ¥0 |
| 稼働監視 | UptimeRobot 無料 | ¥0 |
| メール送信 | Resend（月3,000通まで無料） | ¥0 |
| **合計** | | **約 ¥5,000 〜 5,500/月** |

### 標準構成（推奨）

VPSを2GBプランに変更（Docker + Node + Vite で1GBはギリギリ）
→ **約 ¥6,000 〜 6,500/月**

### Supabase は Free ではなく Pro が必要な理由

|  | Free | Pro |
|---|---|---|
| DB 容量 | 500MB | 8GB |
| **一時停止** | **1週間アクセスなしで停止** | **常時稼働** |
| バックアップ保持 | なし | 7日間 PITR |
| 同時接続 | 60 | 200 |

「一時停止」が致命的なので本番ではPro必須。

## 開発フェーズ

各フェーズが何を含むかの説明。

### Phase 1: 開発環境構築

Supabase 接続、Nuxt 雛形、Docker Compose 化（コンテナで全実行）、Nuxt UI v4、Prisma 6、`btree_gist` 拡張の有効化。

### Phase 2: データモデル構築

PostgreSQL の `EXCLUDE USING gist` 制約でダブルブッキングを DB レベルで防止、CHECK 制約で連絡先必須を保証、`PublicHoliday` で「祝日は日曜扱い」運用、シードデータ整備。

### Phase 3: お客様側予約フロー

「店舗選択 → メニュー選択 → 日時選択 → 顧客情報・確認 → 完了」の 4 ステップ。日時選択は時刻×曜日グリッドで `◯/△/要TEL` を表示。`AES-256-GCM` で個人情報暗号化、プライバシーポリシー整備。

### Phase 4: 管理画面の予約管理

予約一覧（検索・フィルタ・ページング）、予約詳細（ステータス変更・履歴）、手動予約作成、シフト日ビュー連動、ダッシュボードの予約サマリ。

### Phase 5: 会員機能 + 管理機能拡張

- 会員: 新規登録・メール認証・ログイン・マイページ・予約履歴・メアド/パス変更・退会
- 物販・回数券: 在庫管理・販売 / 消費・売上集計
- スタッフ管理 + 役職別権限テンプレート + 個別 permission overrides
- 顧客管理画面（会員区分タブ・休眠フィルタ・接客メモ・来店履歴）
- 予約・販売管理画面（ステータスピル形タブ・ベッドフィルタ・スケジュールビュー）
- 物販クイック販売（ゲスト購入モード・複数商品カート式）

### Phase 5.5: URL 設計の刷新 + ローカル本番再現

- お客様側 URL のフラット化: `/reserve/[slug]/menu/[id]/datetime/[at]/confirm` → `/[slug]/[id]/[at]/confirm`
- 管理画面 URL の刷新: `/admin/*` → `/dashboard/*`、`/admin/login` → `/login`（host-aware）
- ローカルに **Caddy リバースプロキシ** を導入、本番想定の「ホスト分離 + HTTPS + Basic 認証 + edge-served 404」を再現
- `shared/reservedSlugs.ts` で店舗 slug と固定ルートの衝突を防止
- 共有 `app/pages/login.vue` がホスト名を見て `Member/StaffLoginForm` を切り替え

### Phase 6: 本番デプロイ

VPS + Supabase Pro 昇格 + Cloudflare R2 バックアップ + HTTPS + 2FA（TOTP）。本番 Caddyfile は dev の `Caddyfile` を雛形に Let's Encrypt 有効化 + HSTS/CSP 追加 + IP allowlist + ホスト名差し替え。

デプロイ時の env 設定は以下を必ず確認:

- `NUXT_SESSION_COOKIE_SECURE=true`（dev では LAN IP HTTP 共有のため `nuxt.config.ts` で `false` に上書き中）
- `RESERVATION_ENCRYPTION_KEY` バックアップ必須（消失で過去顧客情報が永久に復号不能）
- `ADMIN_USER` / `ADMIN_PASSWORD_HASH` を本番用の強い値に変更

## ライセンス

Proprietary（社内利用）
