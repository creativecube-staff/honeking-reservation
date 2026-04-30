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
| 実行環境(開発) | Node.js 直接 |
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
| Phase 3: 本番 | VPS + Docker Compose + Supabase Pro | 約4,500円 |

Supabase Freeは1週間アクセスがないと一時停止するが、開発中は管理画面からの再開で問題なし。
本番リリース時はSupabase Proに昇格（管理画面でボタン1つ、データ移行不要）。

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
