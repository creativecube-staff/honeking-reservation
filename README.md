# Honeking Reservation

整骨院チェーン向けの予約管理システム。

お客様は Web 上で「店舗 → メニュー → 日時 → 顧客情報・確認」の 4 ステップで予約が完結。完了時はメールで予約内容を自動送信。
店舗スタッフは管理画面で予約・シフト・物販・顧客を一括管理。

将来的に **LINE 公式アカウントの LIFF アプリ** として組み込む前提で、お客様側予約フローは **SPA(Single Page Application)** として実装(URL を変えずに内部ステートで遷移)。

## 参考イメージ

<https://yoyaku.aigorit.com/>

## 主な機能

### お客様側(SPA)

- **4 ステップ予約フロー** (店舗 → メニュー → 日時 → 顧客情報・確認 → 完了)
  - 店舗選択(`/`)以降は URL を変えずに内部ステートで遷移、`<KeepAlive>` でフォーム状態を保持しながら横スライドで切替
  - 完了時のみ `/complete/[code]` に遷移してリロード安全な確認画面を表示
- **ステップインジケータ**(共通コンポーネント、完了済ステップはクリックで戻れる、現在ステップはパルスアニメーション)
- **日時選択** — 時刻×曜日グリッドで `◯/△/要TEL` を表示(**15 分刻み**、中抜け休憩は区切り表示、SP は横スクロールなしの全幅表示)、`要TEL` は SP で `tel:` 起動。最終受付は各店の閉店時刻まで(施術は閉店後にはみ出し可)
- **会員機能** — メール認証付きの会員登録・ログイン・マイページ
  - 予約履歴の閲覧、店舗地図(Google Maps embed)
  - 氏名・電話・メアド・パスワードの変更
  - 退会(ゲスト顧客に格下げ、来店履歴は保持)
- **In-flow 認証モーダル** — 予約フロー中にログイン/新規会員登録できる `AuthModal`(別ページ遷移しないので SPA ステートが保持される)
- **LINE Login + LIFF 連携** — 「LINE でログイン」ボタンで OAuth 2.0 認証
  - PC ブラウザ: 通常の OAuth リダイレクト
  - LINE アプリ内ブラウザ: LIFF SDK が外部リダイレクトなしで完結
  - 既存メアド一致時はパスワード本人確認で紐付け、新規時は LINE プロフィール名 pre-fill 付きで登録
  - 予約フロー中の LINE 認証は `sessionStorage` で復帰し、確認ステップにジャンプ
- **予約受付期間 / 刻み** — 本日から **180 日先まで**、開始時刻は **15 分刻み**(`shared/reservationPolicy.ts` の `MAX_ADVANCE_DAYS` / `SLOT_STEP_MINUTES`)
- **個人情報** はアプリ層で AES-256-GCM 暗号化
- **予約完了メール** — Resend 経由で店舗ブランドロゴ + 店舗外観写真入りの HTML メールを自動送信

### 管理画面

- **salonboard 風 UI** — 白地ヘッダー + 横タブナビ(サイドバーなし)。ヘッダー左にロゴ、右上に**店舗スイッチャー**、右端 ▼ にアカウントメニュー(サイト表示 / ヘルプ / ログアウト)
- **店舗スコープ(アクセス境界)** — OWNER は全店、店長 / 受付 / 施術者は所属店舗のみ。スイッチャーで「管理者(全店) / 各店」を切替。操作系(予約・売上・シフト)は選択店舗に限定、顧客台帳は全店共通
- **予約・販売管理**
  - 一覧ビュー: ステータスタブ(予約済/完了/無断キャンセル/キャンセル)、店舗・ベッド・日付・検索フィルタ
  - スケジュールビュー: 店舗のベッド×時間軸ガントチャート(クリックで詳細遷移)
  - 手動予約作成、ステータス変更、予約変更履歴
- **物販・回数券販売**
  - 予約に紐付ける販売 / 予約なしの店頭販売
  - ゲスト購入モード(固定の「店頭ふらっと販売」顧客に集約)
  - 複数商品カート式、顧客の部分一致検索
- **顧客管理**
  - 会員区分タブ(本会員/仮登録/休眠/ゲスト/退会済)
  - 休眠顧客フィルタ(最終来店から N 日以上)
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
| DB(開発・本番とも) | Supabase PostgreSQL(東京リージョン) |
| カレンダー(客側) | 自作 時刻×曜日グリッド |
| カレンダー(管理) | 自作 TimeColumnCalendar(縦軸=時刻、横軸=スタッフ/ベッド) |
| 認証(管理画面) | nuxt-auth-utils + 2FA TOTP(Phase 6 で導入予定) |
| 認証(会員) | nuxt-auth-utils + メール認証 |
| バリデーション | Zod |
| メール送信 | Resend |
| ソーシャルログイン | LINE Login (OAuth 2.0) + LIFF SDK (`@line/liff`) |
| 実行環境(開発) | Docker Compose(ローカル) |
| 実行環境(本番) | Docker Compose on VPS |

## セットアップ

```bash
# 1. リポジトリ取得
git clone <このリポジトリ>
cd honeking-reservation

# 2. Supabase でプロジェクト作成(無料)
#    ダッシュボードから DATABASE_URL / DIRECT_URL を取得しておく

# 3. 環境変数
cp .env.example .env
# .env を編集:
#   - DATABASE_URL / DIRECT_URL(Supabase)
#   - RESERVATION_ENCRYPTION_KEY(`openssl rand -base64 32` で生成、本番ではバックアップ必須)
#   - NUXT_SESSION_PASSWORD(`openssl rand -base64 48` で生成)
#   - RESEND_API_KEY / RESEND_FROM_EMAIL / APP_BASE_URL(会員メール認証 + 予約完了メールで必要)
#   - LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET / LINE_LOGIN_CALLBACK_URL(LINE Login)
#   - NUXT_PUBLIC_LIFF_ID(LIFF アプリ ID。LINE 内蔵ブラウザでのリダイレクトレスログインに使う)

# 4. 開発サーバー起動(バックグラウンド)
docker compose up -d

# 5. DB マイグレーション & 初期データ投入
docker compose exec nuxt npx prisma migrate dev
docker compose exec nuxt npx prisma db seed

# → http://localhost:3000
# → 本番風アクセス: https://reserve.honeking.localhost / https://admin.honeking.localhost
```

## 開発コマンド

```bash
# 起動 / 停止
docker compose up -d
docker compose down

# .env / docker-compose.yml を編集したら必須(restart では再ロードされない)
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

### `restart` と `up -d` の使い分け(重要)

| 変更内容 | コマンド | 理由 |
|---|---|---|
| `Caddyfile` の中身だけ | `docker compose restart caddy` | Caddy が設定ファイルを再読込 |
| `.env` を編集 | `docker compose up -d --force-recreate` | restart では `env_file` が再ロードされない |
| `docker-compose.yml` を編集(ports / volumes / depends_on) | `docker compose up -d --force-recreate` | restart は既存コンテナを同じ設定で再起動するだけ |

覚え方: **restart = 同じ設定で再起動 / up = 設定を読み直してコンテナ作り直し**

## ローカルのリバースプロキシ構成

本番に近い「ホスト分離 + HTTPS + Basic 認証 + edge-served 404」をローカルでも再現するため、Caddy をリバースプロキシとして導入。

```
ブラウザ
  ↓ https://reserve.honeking.localhost / https://admin.honeking.localhost
Caddy(80/443、HTTPS は内部 CA で自動取得)
  ├─ admin ホスト: Basic 認証ゲート → /login or /dashboard/* を通す
  ├─ 越境パス: 静的 404 を edge で直接返す
  └─ Host ヘッダで振り分け
Nuxt(コンテナ内、3000)
```

| ホスト | 用途 | 認証 | 越境パスの扱い |
|---|---|---|---|
| `reserve.honeking.localhost` | お客様向け予約サイト | なし | `/dashboard*` / `/api/admin*` は edge で 404 |
| `admin.honeking.localhost` | 管理画面 | **Basic 認証 + アプリログイン**(多層防御) | allow-list 方式(`/login` `/dashboard*` `/api/admin*` `/api/_*` `/_nuxt*` `/__nuxt*` `/__vite*` 等のみ通す) |
| `localhost:3000` | Nuxt 直アクセス(HMR フォールバック) | なし | 全パスアクセス可 |

### 初回セットアップ手順

```bash
# 1. /etc/hosts に2行追加(sudo パスワード入力あり)
echo "127.0.0.1 reserve.honeking.localhost
127.0.0.1 admin.honeking.localhost" | sudo tee -a /etc/hosts

# 2. .env に Basic 認証用の認証情報を設定
#    ADMIN_USER=任意のユーザー名
#    ADMIN_PASSWORD_HASH=$$2a$$14$$...  ← bcrypt ハッシュ。$ は $$ にエスケープ必須
#    (ハッシュ生成: docker compose exec caddy caddy hash-password)

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

静的 404 ページ: `caddy/error-pages/404.html`(JS でホスト名を見てテーマ切替)

## URL 設計

### お客様側(reserve.honeking.jp)

```
/                                ← 店舗選択
/[storeSlug]                     ← SPA: メニュー → 日時 → 確認(URL を変えずに内部遷移)
/complete/[code]                 ← 完了画面(リロード安全)
/login                           ← 会員ログイン(host-aware)
/signup                          ← 会員登録
/me/*                            ← マイページ(予約履歴 / プロフィール / メアド変更 / パスワード / 退会)
/forgot-email/                   ← メアド忘れ
/verify-email/[token]            ← メアド認証
/password-reset/                 ← パスワードリセット
/auth/line/link                  ← LINE 連携時の既存会員パスワード本人確認
/auth/line/signup                ← LINE 連携経由の新規会員登録(LINE プロフィール pre-fill)
/api/auth/line/start             ← LINE Login 開始(OAuth リダイレクトフロー)
/api/auth/line/callback          ← LINE Login コールバック
/privacy.vue / /terms.vue        ← 法定文書
```

ホスト名で文脈が明示されてるため、`/reserve/` や `/menu/` などの冗長なプレフィックスは付けない(SEO 重視)。

`/[storeSlug]` 以降は **SPA としてフラット URL** で動作:
- 予約選択中はずっと `/[storeSlug]` 固定
- メニュー / 日時 / 確認の切替は `<Transition>` + `<KeepAlive>` で内部ステート遷移
- 設計理由: **LIFF (LINE) 組み込み想定で URL 変更を最小化**、Webview 内で滑らかに動作させる
- リロードするとメニュー選択からやり直しになる(SPA の宿命として許容)

`/[storeSlug]` はフラットな名前空間なので、店舗 slug が固定ルートと衝突しないよう `shared/reservedSlugs.ts` で予約済みワードをバリデーション。

### 管理画面側(admin.honeking.jp)

```
/                       ← /dashboard へ 302 リダイレクト
/login                  ← スタッフログイン(host-aware で会員ログインと同 URL を共用)
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

admin の全ページを `/dashboard/*` 配下に集約することで、新規ページ追加時に Caddy allow-list を増やす必要がなくなる(`/dashboard*` で網羅)。

`/login` のみホスト共有のため、`app/pages/login.vue` で `useRequestURL().hostname` を見て `Member/StaffLoginForm` を切り替える(host-aware)。

## ディレクトリ構成

```
.
├─ docker-compose.yml
├─ Caddyfile                              # ローカルリバースプロキシ設定
├─ caddy/error-pages/404.html             # 静的 404 ページ(host-aware テーマ切替)
├─ nuxt.config.ts                         # ファビコン等の <link> もここに集約
├─ prisma/
│   ├─ schema.prisma
│   ├─ migrations/
│   └─ seed.mjs
├─ app/
│   ├─ pages/
│   │   ├─ index.vue                      # 店舗選択(お客様トップ)
│   │   ├─ [slug]/index.vue               # 予約 SPA オーケストレータ(メニュー→日時→確認を内部遷移)
│   │   ├─ complete/[code].vue            # 予約完了画面
│   │   ├─ login.vue                      # ログイン(host-aware: 会員 / スタッフ両用)
│   │   ├─ signup.vue                     # 会員登録
│   │   ├─ me/                            # 会員マイページ(LINE 連携セクション含む)
│   │   ├─ forgot-email/ verify-email/ password-reset/  # 会員系認証フロー
│   │   ├─ auth/line/                     # LINE Login 連携フロー(link / signup)
│   │   ├─ privacy.vue / terms.vue
│   │   └─ dashboard/                     # 管理画面(admin ホスト専用)
│   │       ├─ index.vue                  # ダッシュボード
│   │       ├─ reservations/              # 予約・販売管理(一覧⇄スケジュール)
│   │       ├─ customers/                 # 顧客管理
│   │       └─ shifts/ stores/ staff/ menus/ products/ sales/ help/
│   ├─ components/
│   │   ├─ Auth/AuthModal.vue             # 予約フロー中の in-page ログイン/新規登録モーダル(LINE ボタン含む)
│   │   ├─ Reservation/                   # 予約 SPA の各ステップ + ステップインジケータ
│   │   │   ├─ StepIndicator.vue
│   │   │   ├─ MenuStep.vue
│   │   │   ├─ DateTimeStep.vue
│   │   │   └─ ConfirmStep.vue
│   │   ├─ Base/                          # 汎用(PillTabs, Pagination)
│   │   ├─ Calendar/                      # 縦軸=時刻のカレンダー
│   │   ├─ Login/                         # MemberLoginForm / StaffLoginForm(host-aware で切替)
│   │   └─ Admin/                         # 管理画面用
│   ├─ composables/
│   │   ├─ useMember.ts                   # 会員セッションのラッパー
│   │   ├─ usePermission.ts               # 権限チェック
│   │   ├─ useLiff.ts                     # LIFF SDK のラッパー(動的 import で SSR 回避)
│   │   └─ useStoreContext.ts             # 管理画面の店舗スイッチャー文脈(選択店舗を cookie 保持)
│   ├─ layouts/                           # default / admin
│   ├─ middleware/                        # 認証ガード
│   ├─ error.vue                          # Nuxt 共通エラーページ
│   └─ utils/format.ts                    # JST フォーマッタ + 円表記
├─ server/
│   ├─ api/
│   │   ├─ admin/                         # 管理 API(権限ガード、URL はそのまま)
│   │   ├─ member/                        # 会員 API(自分自身のみ、LINE 連携解除 API 含む)
│   │   ├─ auth/line/                     # LINE Login 用 API(start / callback / liff-login / link-password / signup / pending)
│   │   ├─ reservations.post.ts           # 予約作成(完了メール送信込み、180日上限チェック)
│   │   └─ availability.get.ts            # 公開 API(180日上限チェック)
│   └─ utils/
│       ├─ crypto.ts                      # AES-256-GCM 暗号化/復号
│       ├─ hash.ts                        # SHA-256 ハッシュ
│       ├─ mail.ts                        # Resend 送信ヘルパー
│       ├─ reservationMail.ts             # 予約完了メールテンプレート(ロゴ+店舗写真入り HTML)
│       ├─ lineLogin.ts                   # LINE Login OAuth + id_token 検証
│       ├─ storeScope.ts                  # 操作系 API の店舗スコープ解決 + 越権 403
│       └─ prisma.ts
└─ shared/
    ├─ permissions.ts                     # 権限定義
    ├─ storeAccess.ts                     # 店舗アクセス境界(OWNER=全店/他=自店)
    ├─ membership.ts                      # 会員区分判定
    ├─ reservationStatus.ts               # 予約ステータス表示ロジック
    ├─ reservationPolicy.ts               # 予約運用ポリシー定数(MAX_ADVANCE_DAYS=180 / SLOT_STEP_MINUTES=15)
    ├─ reservedSlugs.ts                   # 店舗 slug の予約済みワード
    ├─ memberTerms.ts                     # 会員規約・プライバシーポリシーのバージョン定数
    └─ schemas/                           # Zod スキーマ
```

## データモデル概要

主要エンティティ:

- **Store** — 店舗マスタ
- **Bed** — 施術ベッド(店舗ごとに 3〜4 台)
- **Practitioner** — スタッフ(施術者・受付・店長)。予約割当可否とログイン可否を分離
- **Menu** — メニュー(共通メニュー + 店舗特別メニューの 2 階建て、`availableUntil` で期間限定キャンペーン対応)
- **BusinessHour** / **Holiday** / **Closure** / **PublicHoliday** — 営業時間・休業
- **Shift** — 施術者シフト(ヘルプ先店舗指定可)
- **Customer** — 顧客(個人情報は AES-256-GCM 暗号化、検索は `*Hash` カラム)
  - 会員機能、退会日時、管理者用接客メモを保持
  - `lineUserId` (unique) / `lineDisplayName` で LINE アカウント連携を保持(マイページから連携・解除)
- **Reservation** — 予約 + **ReservationHistory** — 変更履歴
- **Product** / **ProductSale** — 商品マスタ + 販売記録(物販・回数券)
- **CustomerVoucher** / **VoucherUsage** — 回数券保有・消費

予約の重複は **PostgreSQL `EXCLUDE USING gist` 制約** で DB レベル防止(同じベッド・施術者の時間重複を不可能にする)。

## セキュリティ方針(法人運用)

- HTTPS 強制(Let's Encrypt 自動更新)
- 管理画面: IP 制限 + 2FA TOTP(Phase 6 で導入)
- 個人情報(氏名・電話・メール)はアプリ層で **AES-256-GCM 暗号化**
- 検索は **SHA-256 ハッシュ** で行い、暗号化値を復号せず比較
- Supabase 接続情報・暗号化キーは `.env` のみで管理、Git に含めない
- サービスロールキーはサーバー側のみで使用、クライアントに露出させない
- バックアップ: Supabase 自動バックアップ + Cloudflare R2 オフサイト
- SSH 鍵認証のみ、UFW + fail2ban
- プライバシーポリシー・利用規約は公開前に整備

## メール送信(Resend)

会員メール認証 / パスワードリセット / メアド変更 / **予約完了通知** の各シーンで Resend を使用。

```
.env で以下を設定:
- RESEND_API_KEY        : https://resend.com で発行
- RESEND_FROM_EMAIL     : "ほねキング整骨院 <noreply@honeking.jp>" 形式
- APP_BASE_URL          : メール本文のリンク用ベース URL
```

**予約完了メール** は [`server/utils/reservationMail.ts`](server/utils/reservationMail.ts) でテンプレート定義。ブランドロゴ + 店舗外観写真を埋め込んだ HTML / プレーンテキスト両方を送信。env が未設定でも予約自体は通る(警告ログを出してスキップ)。

## リリース計画

| フェーズ | 環境 | 月額 |
|---|---|---|
| Stage 1: 開発(現在) | ローカル Docker Compose + Supabase Free | 0 円 |
| Stage 2: ステージング | (いったんスキップ) | — |
| Stage 3: 本番 | VPS + Docker Compose + Supabase Pro | 約 5,500 円 |

Supabase Free は 1 週間アクセスがないと一時停止するため、本番は Supabase Pro 必須。
開発中は管理画面から数分で復帰できるため許容。

## 本番運用の構成

```
                          [ お客様ブラウザ / スマホ / LINE LIFF ]
                                    │ HTTPS
                                    ▼
                         [ Cloudflare 無料プラン ]
                         (DNS / DDoS 対策 / キャッシュ)
                                    │
                                    ▼
                    ┌────────────────────────────┐
                    │  VPS (さくら / ConoHa 2GB) │
                    │  または Oracle Cloud       │
                    │  Always Free (永続無料)    │
                    │  ・Docker Compose          │
                    │  ・Nuxt 4 (Node + Vite)    │
                    │  ・Let's Encrypt 証明書    │
                    └────────────────────────────┘
                           │                  │
                  接続情報 │                  │ オフサイトバックアップ
                           ▼                  ▼
                  [ Supabase Pro ]    [ Cloudflare R2 ]
                  (PostgreSQL)       (バックアップ)
                  ・東京リージョン     ・10GB まで無料
                  ・自動バックアップ   ・暗号化保管
                  ・PITR 7日間保持
```

## 月額運用費

### 最小構成(公開直後)

| 項目 | サービス | 月額 |
|---|---|---:|
| VPS(アプリ実行) | さくら / ConoHa / Xserver 1GB | ¥880 〜 1,500 |
| データベース | **Supabase Pro**(必須) | ¥3,750($25) |
| ドメイン | お名前.com 等(年払い) | ¥125 〜 250 |
| HTTPS 証明書 | Let's Encrypt | ¥0 |
| オフサイトバックアップ | Cloudflare R2(10GB まで無料) | ¥0 |
| DNS / DDoS 対策 | Cloudflare 無料プラン | ¥0 |
| 稼働監視 | UptimeRobot 無料 | ¥0 |
| メール送信 | Resend(月 3,000 通まで無料) | ¥0 |
| **合計** | | **約 ¥5,000 〜 5,500/月** |

### 標準構成(推奨)

VPS を 2GB プランに変更(Docker + Node + Vite で 1GB はギリギリ)
→ **約 ¥6,000 〜 6,500/月**

### Supabase は Free ではなく Pro が必要な理由

|  | Free | Pro |
|---|---|---|
| DB 容量 | 500MB | 8GB |
| **一時停止** | **1週間アクセスなしで停止** | **常時稼働** |
| バックアップ保持 | なし | 7日間 PITR |
| 同時接続 | 60 | 200 |

「一時停止」が致命的なので本番では Pro 必須。

## 残作業(今後やること)

実装済みの機能は本 README 上部の「主な機能」を参照。以下は **これからやる作業** のみ。

### 1. 店舗スコープ(アクセス境界)を全ページへ展開 (Phase 2/3)

店舗スコープの土台は実装済(OWNER=全店 / 他=自店、ヘッダーの店舗スイッチャー、ダッシュボード + 予約一覧 API のスコープ)。残りを横展開する。

- Phase 2: 予約・販売 / シフト / スケジュール / 売上 / 店舗設定 を選択店舗で絞る + 各 API に `resolveStoreScope` を入れる
- Phase 3: スタッフ / 商品の見える範囲の整理 + 仕上げ(顧客台帳は全店共通のまま)

> 管理画面 UI の salonboard 風刷新は **実装完了**(白地ヘッダー + 横タブ + 店舗スイッチャー + 右端アカウント▼、旧サイドバー廃止)。

### 2. メール → 予約自動取り込み機能

ホットペッパービューティー等の外部経路で来る予約通知メールを受信して、自動で当システムに登録する。

- 送信元・フォーマット・頻度は要ヒアリング
- 受信は SendGrid Inbound Parse / Postmark Inbound 等の Webhook 方式を推奨
- 失敗時は管理画面の「要確認」キューに退避

### 3. LINE Messaging API 統合(LINE Login + LIFF の続き)

LINE Login + LIFF は実装済み。次は通知系:

- LINE Messaging API で予約完了通知・前日リマインダーを push
- LINE 公式アカウントを開設し、リッチメニューに LIFF URL を仕込む
- ユーザーへの追加同意取得(プライバシーポリシーには将来形で記載済み)

### 4. Phase 6: 本番デプロイ

VPS(または Oracle Cloud Always Free)+ Supabase Pro 昇格 + Cloudflare R2 バックアップ + HTTPS。本番 Caddyfile は dev の `Caddyfile` を雛形に Let's Encrypt 有効化 + HSTS/CSP 追加 + IP allowlist + ホスト名差し替え。

デプロイ時の env 設定は以下を必ず確認:

- `NUXT_SESSION_COOKIE_SECURE=true`(dev では LAN IP HTTP 共有のため `nuxt.config.ts` で `false` に上書き中)
- `RESERVATION_ENCRYPTION_KEY` バックアップ必須(消失で過去顧客情報が永久に復号不能)
- `ADMIN_USER` / `ADMIN_PASSWORD_HASH` を本番用の強い値に変更
- `APP_BASE_URL` を本番ドメインに変更
- `RESEND_FROM_EMAIL` を独自ドメイン認証済アドレスに変更
- `LINE_LOGIN_CALLBACK_URL` を本番ドメインに変更し、LINE Developers Console の Callback URL にも追加
- LIFF Endpoint URL を本番ドメインに変更
- LINE Login Channel を **公開済み(Published)** に切り替え

### 5. 管理画面 2FA(TOTP)実装

スタッフログインに TOTP ベースの 2 要素認証を導入。`Practitioner.totpSecret` カラムは既に用意済み。Phase 6 と同タイミングで導入予定。

### 6. 本番公開前: 法務チェック

雛形ベースのプライバシーポリシー(v2.1)・会員規約(v1.1)を **行政書士または弁護士にレビュー依頼**。LINE 連携・暗号化・委託先記載などすでに整備済み。

## ライセンス

Proprietary(社内利用)
