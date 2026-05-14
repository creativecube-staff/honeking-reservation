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

本番に近い「ホスト分離 + HTTPS + edge-served 404」をローカルでも再現するため、Caddy をリバースプロキシとして導入。

```
ブラウザ
  ↓ https://reserve.honeking.localhost / https://admin.honeking.localhost
Caddy（80/443、HTTPS は内部 CA で自動取得）
  ↓ Host ヘッダで振り分け
Nuxt（コンテナ内、3000）
```

| ホスト | 用途 | 越境パスの扱い |
|---|---|---|
| `reserve.honeking.localhost` | お客様向け予約サイト | `/admin*` / `/api/admin*` は edge で静的 404 |
| `admin.honeking.localhost` | 管理画面 | 公開向けページ・API は edge で静的 404 |
| `localhost:3000` | Nuxt 直アクセス（HMR フォールバック） | 全パスアクセス可 |

### 初回セットアップ手順

```bash
# 1. /etc/hosts に2行追加（sudo パスワード入力あり）
echo "127.0.0.1 reserve.honeking.localhost
127.0.0.1 admin.honeking.localhost" | sudo tee -a /etc/hosts

# 2. コンテナ起動
docker compose up -d --force-recreate

# 3. Caddy の内部 CA を macOS Keychain に信頼登録
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-ca.crt
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ./caddy-local-ca.crt
rm ./caddy-local-ca.crt

# 4. ブラウザを完全再起動してから https://reserve.honeking.localhost にアクセス
```

静的 404 ページ: `caddy/error-pages/404.html`（JS でホスト名を見てテーマ切替）

## ディレクトリ構成

```
.
├─ docker-compose.yml
├─ nuxt.config.ts
├─ prisma/
│   ├─ schema.prisma
│   ├─ migrations/
│   └─ seed.mjs
├─ app/
│   ├─ pages/
│   │   ├─ index.vue                      # 店舗選択
│   │   ├─ reserve/                       # 予約フロー
│   │   ├─ signup.vue / login.vue         # 会員登録・ログイン
│   │   ├─ me/                            # 会員マイページ
│   │   └─ admin/                         # 管理画面
│   │       ├─ reservations/              # 予約・販売管理（一覧⇄スケジュール）
│   │       ├─ customers/                 # 顧客管理
│   │       ├─ shifts/ stores/ staff/ menus/ products/ sales/
│   ├─ components/
│   │   ├─ Base/                          # 汎用（PillTabs, Pagination）
│   │   ├─ Calendar/                      # 縦軸=時刻のカレンダー
│   │   └─ Admin/                         # 管理画面用
│   ├─ layouts/                           # default / admin
│   ├─ middleware/                        # 認証ガード
│   └─ utils/format.ts                    # JST フォーマッタ + 円表記
├─ server/
│   ├─ api/
│   │   ├─ admin/                         # 管理 API（権限ガード）
│   │   ├─ member/                        # 会員 API（自分自身のみ）
│   │   └─ availability.get.ts            # 公開 API
│   └─ utils/                             # crypto, hash, mail, prisma, etc.
└─ shared/
    ├─ permissions.ts                     # 権限定義
    ├─ membership.ts                      # 会員区分判定
    ├─ reservationStatus.ts               # 予約ステータス表示ロジック
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

## 開発フェーズの進捗

- [x] Phase 1: 開発環境構築（Supabase接続、Nuxt雛形、Docker化、btree_gist）
- [x] Phase 2: データモデル構築（EXCLUDE/CHECK制約、シードデータ）
- [x] Phase 3: お客様側予約フロー（4ステップ予約・AES暗号化・プライバシーポリシー）
- [x] Phase 4: 管理画面の予約管理（一覧・詳細・手動作成・シフト連動）
- [x] Phase 5: 会員機能 + 管理機能拡張（会員マイページ・顧客管理・物販販売・スケジュールビュー）
- [ ] Phase 6: 本番デプロイ（VPS + Supabase Pro + Cloudflare R2 + HTTPS + 2FA）

## ライセンス

Proprietary（社内利用）
