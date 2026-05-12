# Honeking Reservation

整骨院チェーン(10店舗)向けの予約管理システム。

お客様はWeb上で「店舗→メニュー→日時→顧客情報」の4ステップで予約が完結。スタッフは管理画面でシフト・予約・メニューを管理。

## 参考イメージ

<https://yoyaku.aigorit.com/>

## 予約フロー(お客様側)

1. **店舗選択** — 約10店舗から選択
2. **メニュー選択** — 店舗ごとに個別のメニュー(骨盤矯正・マッサージ・鍼灸など)
3. **日時選択** — カレンダー式で希望日時を選択
4. **顧客情報入力・確認** — 氏名・電話番号などを入力して予約確定

## 技術スタック

| 領域 | 採用技術 |
|---|---|
| フレームワーク | Nuxt 4 (TypeScript) |
| UI | Nuxt UI + Tailwind CSS |
| ORM | Prisma |
| DB(開発・本番とも) | Supabase PostgreSQL(東京リージョン) |
| カレンダー(客側) | v-calendar |
| カレンダー(管理) | FullCalendar(Resource Timeline) |
| 認証(管理画面) | nuxt-auth-utils |
| バリデーション | VeeValidate + Zod |
| 実行環境(開発) | Docker Compose（ローカル）|
| 実行環境(本番) | Docker Compose on VPS |
| デプロイ先 | VPS(Xserver VPS / さくらVPS) |

## 前提ツール

- Node.js 20+
- Supabaseアカウント（無料）
- Git

## セットアップ

```bash
# 1. リポジトリ取得
git clone <このリポジトリ>
cd honeking-reservation

# 2. 依存インストール
npm install

# 3. Supabase でプロジェクト作成（無料）
#    ダッシュボードから DATABASE_URL / DIRECT_URL を取得しておく

# 4. 環境変数
cp .env.example .env
# .env を編集（Supabase 接続情報を貼り付け）

# 5. DBマイグレーション & 初期データ投入
npx prisma migrate dev
npx prisma db seed

# 6. 開発サーバー起動
npm run dev
# → http://localhost:3000
```

## 開発コマンド

```bash
# 開発サーバー起動（Supabase 直結）
npm run dev

# Prisma Studio（DB GUI）
npx prisma studio
# → http://localhost:5555

# マイグレーション作成
npx prisma migrate dev --name <変更名>

# 型再生成
npx prisma generate

# シード再投入
npx prisma db seed
```

## ディレクトリ構成(予定)

開発フェーズはローカルNuxtからSupabaseへ直結する構成。
Docker関連ファイルは本番デプロイ直前に追加する。

```
.
├─ .env.example
├─ nuxt.config.ts
├─ prisma/
│   ├─ schema.prisma
│   ├─ migrations/
│   └─ seed.ts
├─ app/
│   ├─ pages/                  # お客様側画面
│   │   ├─ index.vue           # 店舗選択
│   │   └─ stores/[id]/
│   │       ├─ menu.vue
│   │       ├─ calendar.vue
│   │       └─ confirm.vue
│   ├─ pages/admin/            # 管理画面
│   │   ├─ login.vue
│   │   ├─ dashboard.vue
│   │   ├─ schedule.vue
│   │   └─ reservations.vue
│   ├─ components/
│   └─ composables/
├─ server/
│   └─ api/
│       ├─ stores.get.ts
│       ├─ menus/[storeId].get.ts
│       ├─ availability.post.ts
│       └─ reservations.post.ts
└─ docker/                     # 本番デプロイ直前に追加
    ├─ Dockerfile
    └─ docker-compose.prod.yml
```

## データモデル概要

主要エンティティ:

- **Store** — 店舗(10店舗)
- **Bed** — 施術ベッド(店舗ごとに3〜4台)
- **Practitioner** — 施術者(店舗固定)
- **Menu** — メニュー(店舗ごとに個別)
- **BusinessHour** — 曜日別営業時間・休憩時間(固定)
- **Holiday** — 休業日
- **Shift** — 施術者のシフト
- **Customer** — 顧客
- **Reservation** — 予約(`storeId` + `bedId` + `practitionerId` + `menuId` + 時間帯)

予約の重複は **PostgreSQL `EXCLUDE` 制約** でDBレベルで防止。

## リリース計画

| フェーズ | 環境 | 月額 |
|---|---|---|
| Phase 1: 開発 | ローカルNuxt + Supabase Free | 0円 |
| Phase 2: ステージング | （将来検討・いったんスキップ） | — |
| Phase 3: 本番 | VPS + Docker Compose + Supabase Pro | 約5,500円 |

Supabase Freeは1週間アクセスがないと一時停止するが、開発中は管理画面からの再開で問題なし。
本番リリース時はSupabase Proに昇格（管理画面でボタン1つ、データ移行不要）。

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
                  ・東京リージョン     ・10GB まで無料
                  ・自動バックアップ   ・暗号化保管
                  ・PITR 7日間保持
```

役割:

- **VPS**: Nuxt アプリ本体を Docker で実行。HTTPS 終端も担当
- **Supabase Pro**: マネージド PostgreSQL。バックアップ・冗長化込み
- **Cloudflare**: DNS（無料）と前段 CDN。DDoS 緩和も自動
- **Cloudflare R2**: Supabase 自動バックアップとは別に、自前で取った dump を保管（10GB まで無料）
- **Let's Encrypt**: HTTPS 証明書を自動更新（無料）

## 月額運用費の内訳

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
| **合計** | | **約 ¥5,000 〜 5,500/月** |

### 標準構成（推奨）

- VPS を 2GB プランに変更（Docker + Node + Vite で 1GB はギリギリ）
- → **約 ¥6,000 〜 6,500/月**

### オプション

| 項目 | 月額目安 | 補足 |
|---|---:|---|
| 予約完了メール | ¥0 | Resend 月3,000通まで無料、整骨院規模なら余裕 |
| 予約確認 SMS | ¥1,000 〜 3,000 | Twilio 等。SMS は意外と高い |
| エラー監視（Sentry） | ¥0 | 月5,000 errors まで無料 |

### Supabase は Free ではなく Pro が必要な理由

| | Free | Pro |
|---|---|---|
| DB 容量 | 500MB | 8GB |
| **一時停止** | **1週間アクセスなしで停止** | **常時稼働** |
| バックアップ保持 | なし | 7日間 PITR |
| 同時接続 | 60 | 200 |

「一時停止」が致命的なので本番では Pro 必須。

## なぜ AWS ではなく VPS + Supabase か

| 観点 | VPS + Supabase | AWS フル構成 |
|---|---|---|
| 月額 | ¥5,500〜 予測可能 | ¥10,000〜30,000+ 月末まで読めない |
| 帯域料金 | 込み | アウトバウンド $0.114/GB、地味に効く |
| 運用負荷 | sshd / certbot / docker compose | VPC / SG / IAM / Route53 / ALB / ACM / ECS / RDS …（一人で見るのは厳しい） |
| トラブル時 | ググるとほぼ全部解決例あり | AWS 固有の罠が多い |

AWS の強み（オートスケール・グローバル展開）は整骨院チェーン規模（2〜10 店舗、月数千〜数万予約）では発揮されない。
Docker 化してあるので、必要になれば AWS / GCP / Azure へ後から移行可能。

## 落ちないようにするレベル別の選択肢

| レベル | 構成 | 月額追加 | 復旧時間 |
|---|---|---:|---|
| 0. 何もしない | VPS 1 台 | ¥0 | VPS 障害時は復旧待ち |
| **1. 自動再起動 + 監視（最低限）** | docker `restart: always` + UptimeRobot | ¥0 | アプリクラッシュは秒で復活 |
| **2. Cloudflare 前段（推奨）** | 上記 + Cloudflare 無料プラン | ¥0 | DDoS 対策、障害時の静的キャッシュ表示 |
| 3. VPS 2台 + DNS フェイルオーバー | VPS×2 + Cloudflare health check | +¥1,500 〜 2,000 | 自動切替（1〜2分） |
| 4. 本格 LB 構成 | VPS×2 + Cloudflare Load Balancer | +¥3,000 〜 5,000 | 自動切替（数秒） |

整骨院規模では **レベル 1 + 2 で十分**。
理由: VPS の SLA が 99.99%（年間ダウンタイム約 52 分）あり、DB は Supabase Pro が冗長化してくれているため、業務影響のあるダウンタイムはほぼ発生しない想定。

## スケーリング時の対応

| トリガー | 対応 | コスト増 |
|---|---|---:|
| DB 8GB 超（数十万件の予約） | Supabase Team プラン or 自前 PostgreSQL に移行 | +¥10,000 程度 |
| 同時接続 200 超 | VPS スペック upgrade（4GB） | +¥1,500 |
| ピーク時の重さ | Cloudflare Pro で CDN 強化 | +¥3,000 |

整骨院 5〜10 店舗規模なら、**数年は ¥5,500 構成のまま** 持つ想定。

## セキュリティ方針(法人運用)

- HTTPS強制(Let's Encrypt)
- 管理画面: IP制限 + 2FA
- Supabase接続情報（DB URL / API key）は`.env`のみで管理し、Gitに含めない
- サービスロールキーはサーバー側のみで使用、クライアントに露出させない
- 個人情報(電話番号・メール)はアプリ層でAES-256-GCM暗号化
- バックアップはSupabase自動バックアップと暗号化オフサイト（Cloudflare R2）
- SSH鍵認証のみ、UFW + fail2ban
- プライバシーポリシー・利用規約は公開前に整備

## ライセンス

Proprietary(社内利用)
