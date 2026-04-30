# CLAUDE.md

AIアシスタント(Claude)がこのプロジェクトで作業する際の指示書。新しいセッションを開始したら、まずこのファイルを読んで文脈を把握すること。

## プロジェクトの本質

整骨院チェーン(10店舗)向けの予約管理システム。
お客様はWebで4ステップ予約、スタッフは管理画面でシフト・予約を管理。

参考: <https://yoyaku.aigorit.com/>

## 開発者プロフィール

- **事業主**: 法人(整骨院運営)
- **開発者**: 1名(本人)
- **経験**: VPS運用の基本は経験あり(sshd/ufw/certbotなど)
- **予算**: 月2万円以下(目標は5,500円程度)

## 技術スタック(変更禁止・変更時は必ず相談)

| 領域 | 採用技術 |
|---|---|
| フロント/バック統合 | Nuxt 4 (TypeScript) |
| ORM | Prisma |
| DB | Supabase PostgreSQL(開発・本番とも東京リージョン) |
| UI | Nuxt UI + Tailwind CSS |
| カレンダー | v-calendar(客側) / FullCalendar Resource Timeline(管理) |
| 認証 | nuxt-auth-utils |
| バリデーション | VeeValidate + Zod |
| 実行環境 | 開発・本番ともに Docker Compose（開発: ローカル / 本番: VPS） |

技術選定の議論はすでに完了しているため、勝手に別技術(Next.js・Laravel・microCMS等)を提案しない。

## 確定済みの仕様

### 店舗・リソース
- 店舗数: 約10店舗
- ベッド数: 店舗ごとに異なる(3〜4台)
- 施術者: **店舗固定**(複数店舗掛け持ちなし)
- メニュー: **店舗ごとに個別**(解釈B)
- 指名制: **なし**(施術者は自動割当)
- 休憩時間: **固定**

### 予約の制約
1件の予約 = 1ベッド + 1施術者 + 1メニュー + 時間帯
ダブルブッキング防止は PostgreSQL の `EXCLUDE USING gist` で実装する。

### セキュリティ(法人運用で必須)
- 個人情報(電話番号・メール)はアプリ層でAES-256-GCM暗号化
- HTTPSは Let's Encrypt で強制
- 管理画面: IP制限 + 2要素認証(TOTP)
- Supabaseの接続情報（DB URL / API key）は `.env` のみで管理し、Gitに含めない
- サービスロールキーはサーバー側のみで使用し、クライアントに露出させない
- バックアップはSupabase自動バックアップと暗号化オフサイト（Cloudflare R2）
- `.env` は絶対に Git コミットしない

## 段階的リリース計画

```
Phase 1: ローカルNuxt + Supabase Free → 0円（現在ここ）
Phase 2: （ステージング・将来検討、一旦スキップ）
Phase 3: VPS + Docker Compose + Supabase Pro → 約4,500円/月（本番公開時）
```

Supabase Freeは**1週間アクセスなしで一時停止**する点に注意（本番では必ずPro）。
開発中は一時停止しても管理画面から数分で復帰可能なため許容する。

## コミュニケーションルール

- **言語**: 日本語で応答(コード・変数名は英語)
- **簡潔に**: 冗長な説明を避ける
- **複雑な変更前に計画を提示**: ユーザーの承認後に実装
- **承認なしに実装を走らせない**: 特にDBスキーマ・アーキテクチャ変更時

## 禁止事項(重要)

- **勝手にREADME・ドキュメントを生成・変更しない**(ユーザーの明示依頼時のみ)
- **`.env` / `.env.*` を読まない・書かない**
- **`.ssh` 配下にアクセスしない**
- **テストコードを確認なしに削除・コメントアウトしない**
- **動作するコードを理由なくリファクタリングしない**
- **読んでいないファイルを変更しない**

## 作業時の振る舞い

### DBスキーマ変更時
1. 変更理由を明示
2. 既存データへの影響を説明
3. マイグレーション手順を提示
4. **承認を得てから** `prisma migrate` を提案

### 新機能追加時
1. 既存コードを先に読む
2. 影響範囲を明示
3. 既存の命名規約・フォルダ構成に従う
4. TypeScriptの型を厳密に付ける(`any` 禁止)

### 個人情報を扱うコード
- **必ず暗号化処理を通す**
- ログに個人情報を出力しない
- エラーメッセージに個人情報を含めない

## データモデル方針

テーブル構成:
- `Store` - 店舗マスタ
- `Bed` - ベッド(Storeに紐づく)
- `Practitioner` - 施術者(Storeに紐づく)
- `Menu` - メニュー(Storeに紐づく、店舗ごと個別)
- `BusinessHour` - 曜日別営業時間
- `Holiday` - 休業日
- `Shift` - 施術者シフト
- `Customer` - 顧客
- `Reservation` - 予約(Store+Bed+Practitioner+Menu+時間帯)

全エンティティ `id: Int @id @default(autoincrement())` を採用(UUIDには変えない)。
`createdAt` / `updatedAt` は必要なテーブルのみ付与。

## 重要なコマンド

開発フェーズは Docker Compose で Nuxt コンテナを起動し、DB は Supabase へ直接接続する。
本番フェーズでは別途 `docker-compose.prod.yml` を VPS 上で動かす。

```bash
# 開発サーバー起動（バックグラウンド）
docker compose up -d

# ログ追跡
docker compose logs -f nuxt

# 停止
docker compose down

# パッケージ追加（コンテナ内で実行 → host の package.json / package-lock.json も更新される）
docker compose exec nuxt npm install <package>

# Prisma 関連（Step 1-4 以降）
docker compose exec nuxt npx prisma studio          # DB GUI
docker compose exec nuxt npx prisma migrate dev --name <変更名>
docker compose exec nuxt npx prisma generate
docker compose exec nuxt npx prisma db seed

# コンテナ内シェルに入る（デバッグ用）
docker compose exec nuxt sh
```

**注意**: ホスト側で直接 `npm run dev` は実行しない。すべてコンテナ内で動かす。

## 現在のフェーズと進捗

- [x] 技術選定・アーキテクチャ決定
- [x] データモデル設計(完了)
- [x] README.md / CLAUDE.md 整備
- [ ] Supabase Freeプロジェクト作成（dev用）
- [ ] Nuxt雛形作成
- [ ] Prismaセットアップ・Supabase接続
- [ ] 初期データ(seed)投入
- [ ] お客様側4画面実装
- [ ] 空き枠計算ロジック実装
- [ ] 管理画面実装
- [ ] セキュリティハードニング
- [ ] VPS デプロイ用 docker-compose.prod.yml 整備（本番直前）
- [ ] Supabase Pro昇格（本番直前）
- [ ] 本番リリース

## 参考資料

- [Nuxt docs](https://nuxt.com/)（Nuxt 4系）
- [Prisma docs](https://www.prisma.io/docs)
- [Supabase docs](https://supabase.com/docs)
- [FullCalendar Resource Timeline](https://fullcalendar.io/docs/resource-timeline-view)
- [個人情報保護委員会](https://www.ppc.go.jp/)
