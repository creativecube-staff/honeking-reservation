# CLAUDE.md

AIアシスタント(Claude)がこのプロジェクトで作業する際の指示書。新しいセッションを開始したら、まずこのファイルを読んで文脈を把握すること。

## プロジェクトの本質

整骨院チェーン向けの予約管理システム。
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
| フロント/バック統合 | **Nuxt 4.4.4** (TypeScript) ※`app/` ディレクトリ構造 |
| UI | **Nuxt UI v4** + **Tailwind CSS v4** |
| ORM | **Prisma v6.19.3** ※v7 は破壊的変更(`prisma.config.ts` 必須化)のため意図的に採用しない |
| DB | Supabase PostgreSQL(開発・本番とも東京リージョン) |
| カレンダー | v-calendar(客側) / FullCalendar Resource Timeline(管理) |
| 認証 | nuxt-auth-utils + 2FA(TOTP) |
| バリデーション | VeeValidate + Zod |
| 実行環境 | 開発・本番ともに Docker Compose(開発: ローカル / 本番: VPS) |

技術選定の議論はすでに完了しているため、勝手に別技術(Next.js・Laravel・microCMS等)を提案しない。

## 確定済みの仕様

### 店舗・リソース

- **2 店舗から開始**(将来拡張想定):
  - 流山おおたかの森整骨院: 4 ベッド
  - 松戸駅東口整骨院: 6 ベッド
- 施術者: **メイン所属店舗あり**(`Practitioner.storeId`)。**人手不足時のヘルプ運用**として、`Shift.workStoreId` を指定すればその日 1 日だけ他店舗で勤務可。null ならメイン店舗で勤務(Phase 3.5 で拡張)
- メニュー: **共通メニュー + 店舗特別メニュー**の 2 階建て(Phase 3.5 で再設計)
  - 共通メニュー: `Menu.storeId IS NULL`、全店舗で自動的に利用可能、「メニュー管理」画面で管理
  - 店舗特別メニュー: `Menu.storeId = X`、その店舗だけのメニュー、店舗詳細「メニュー」タブで管理
  - 共通メニュー間の name 重複は部分 unique index `Menu_common_name_unique` で防止
  - 表示期間: `availableFrom` / `availableUntil` (両方 nullable・任意)。両方 null なら常時表示。例: オープン記念キャンペーンメニュー。お客様側は予約対象日が期間内のときのみ表示する
- 指名制: **なし**(施術者は自動割当)
- 営業時間(両店共通):
  - 月〜金: 9:30 - 12:30 + 15:00 - 20:30(中抜け休憩 12:30-15:00)
  - 土日: 9:30 - 12:30 + 15:00 - 18:00(中抜け休憩 12:30-15:00)
  - 営業時間は **1 日に複数レンジを持てる**モデル(`BusinessHour`)。中抜け休憩は 2 つのレンジで表現する。「休憩」という特殊概念は持たない
- 定休日: **なし**(365日営業)

### 「祝日 = 日曜扱い」運用ルール

店舗の実運用では国民の祝日も営業するが、土日と同じ短縮営業時間 (9:30 - 18:00) になる。スキーマ:

- `Holiday`: 店休日(営業しない)
- `PublicHoliday`: 国民の祝日(全店共通・営業はする)
- アプリ層が予約枠計算時、`PublicHoliday` 該当日は `BusinessHour[dayOfWeek=0]`(日曜)を引く

### 予約の制約

1 件の予約 = 1 ベッド + 1 施術者 + 1 メニュー + 時間帯。
ダブルブッキング防止は PostgreSQL の `EXCLUDE USING gist + tsrange` で **DB レベル保証**。

```sql
EXCLUDE USING gist (bedId WITH =, tsrange(startAt, endAt, '[)') WITH &&)
WHERE (status <> 'CANCELLED');
-- practitioner 版も同形
```

- 半開区間 `[)` で隣接時刻(例: 14-15 と 15-16)は重ならない
- CANCELLED 予約は除外(同枠を再予約可能)
- `btree_gist` 拡張は Step 1-5 で migration により有効化済

### Customer の個人情報暗号化

- `name`, `phone`, `email` はアプリ層で **AES-256-GCM 暗号化**
- 検索のため `nameHash` / `phoneHash` / `emailHash` (sha256) を併設、unique 制約で重複登録防止
- DB レベル CHECK 制約: `phoneHash IS NOT NULL OR emailHash IS NOT NULL`(連絡先必須)
- 比較・検索は **hash 値**で行う(暗号化済み値は復号しないと比較できないため)

### セキュリティ(法人運用で必須)

- 個人情報(氏名・電話・メール)はアプリ層で AES-256-GCM 暗号化
- HTTPS は Let's Encrypt で強制
- 管理画面: IP制限 + 2要素認証(TOTP)
- Supabase の接続情報(DB URL / API key)は `.env` のみで管理、Git に含めない
- サービスロールキーはサーバー側のみで使用、クライアントに露出させない
- バックアップは Supabase 自動バックアップ + 暗号化オフサイト(Cloudflare R2)
- `.env` は絶対に Git コミットしない
- **Claude Code / Cursor から `.env` を技術的にブロック済**(`.claude/settings.json` permission deny + `.cursorignore`)

## 段階的リリース計画

```text
Stage 1: ローカル Nuxt(Docker) + Supabase Free → 0円(現在ここ)
Stage 2:(ステージング・将来検討、一旦スキップ)
Stage 3: VPS + docker-compose.prod + Supabase Pro → 約4,500円/月(本番公開時)
```

Supabase Free は **1週間アクセスなしで一時停止**する点に注意(本番では必ず Pro)。
開発中は一時停止しても管理画面から数分で復帰可能なため許容する。

## コミュニケーションルール

- **言語**: 日本語で応答(コード・変数名は英語)
- **簡潔に**: 冗長な説明を避ける
- **複雑な変更前に計画を提示**: ユーザーの承認後に実装
- **承認なしに実装を走らせない**: 特に DB スキーマ・アーキテクチャ変更時
- **進捗状況を毎回明示**: 各応答で「直前完了 / 現在地 / 次の一手」を簡潔に書く

## 禁止事項(重要)

- **勝手に README・ドキュメントを生成・変更しない**(ユーザーの明示依頼時のみ)
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
4. TypeScript の型を厳密に付ける(`any` 禁止)

### 個人情報を扱うコード

- **必ず暗号化処理を通す**
- ログに個人情報を出力しない
- エラーメッセージに個人情報を含めない
- 比較・検索は **hash 値**(`*Hash` カラム)で行う

## データモデル方針

主要テーブル(Phase 5 までで拡張済):

- `Store` - 店舗マスタ
- `Bed` - ベッド(Store に紐づく)
- `Practitioner` - スタッフ(施術者・受付・店長)。`isAssignable` で予約割当可否、`canLogin` でログイン可否を分離
- `Menu` - メニュー(共通メニュー `storeId IS NULL` + 店舗特別メニューの 2 階建て)
- `BusinessHour` - 曜日別営業時間レンジ(1 日に 1 つ以上、中抜け休憩は 2 レンジで表現)
- `Holiday` - 終日休み(1 日まるごと営業しない日)
- `Closure` - 部分閉店(イレギュラーで一定時間だけ休み、同日複数行可)
- `PublicHoliday` - 国民の祝日(全店舗共通・営業はする / 日曜扱い運用)
- `Shift` - 施術者シフト(`workStoreId` でヘルプ先店舗を指定)
- `Customer` - 顧客(個人情報は暗号化済み値、検索は `*Hash` カラム)
  - 会員機能: `passwordHash` / `emailVerifiedAt` で本会員と仮登録を判定
  - `withdrawnAt`: 退会日時(退会後もデータは残し、ゲスト顧客に格下げ)
  - `note`: 管理者専用の接客メモ(PII を書かない前提のため暗号化なし)
  - 「店頭ふらっと販売用」固定 Customer を `server/utils/guestCustomer.ts` で lazy-create
- `Reservation` - 予約(Store + Bed + Practitioner + Menu + 時間帯)
- `ReservationHistory` - 予約変更履歴(時間 / メニュー / 担当 / ベッド / ステータスの変更を記録)
- `Product` - 商品マスタ(`kind=PRODUCT` 物販 / `kind=VOUCHER` 回数券)
- `ProductSale` - 販売記録(予約紐付け任意、ゲスト購入は固定 Customer)
- `CustomerVoucher` - 顧客保有の回数券(残回数管理)
- `VoucherUsage` - 予約での回数券消費(1 予約 = 0 or 1 枚)
- 会員系: `EmailVerificationToken` / `PasswordResetToken` / `EmailChangeToken`
- `enum ReservationStatus` - `CONFIRMED` / `CANCELLED` / `NO_SHOW`
  - 「完了」は status=CONFIRMED かつ endAt 過去 のアプリ層判定(`shared/reservationStatus.ts`)
- `enum ProductKind` - `PRODUCT` / `VOUCHER`
- `enum Role` - `OWNER` / `MANAGER` / `RECEPTIONIST` / `PRACTITIONER`

全エンティティ `id: Int @id @default(autoincrement())` を採用(UUIDには変えない)。
`createdAt` / `updatedAt` は必要なテーブルに付与済(ほぼ全テーブル)。

すべての FK は `onDelete: Restrict`。物理削除は防ぎ、不要レコードは `isActive: false` の論理削除で表現。

## 権限 (shared/permissions.ts)

役職テンプレート × 個別 permission overrides で最終的な権限を解決。

- `OWNER` / `MANAGER`: 全権限
- `RECEPTIONIST`: 予約・販売・シフト閲覧 + 顧客閲覧
- `PRACTITIONER`: 自分のシフト・予約 + 物販販売

権限名は `<resource>:<action>` 形式 (`reservation:view`, `customer:edit`, `sale:edit` など)。
ページ側は `definePageMeta({ requirePermission: 'xxx:yyy' })` で宣言、サーバ側は `requirePermission(event, 'xxx:yyy')` で検証。

## URL 設計

### お客様側予約フロー (Phase 3)

```text
/                                                            ← 店舗選択
/reserve/[storeId]/menu                                      ← メニュー選択
/reserve/[storeId]/menu/[menuId]/datetime                    ← 日時選択
/reserve/[storeId]/menu/[menuId]/datetime/[startAt]/confirm  ← 顧客情報・確認
/reserve/complete/[code]                                     ← 完了画面
```

### 会員マイページ (Phase 5)

```text
/signup / /login / /forgot-email / /verify-email/[token] / /password-reset/[token]
/me                       ← マイページトップ
/me/profile               ← 氏名・電話の編集
/me/email-change          ← メアド変更(リンク認証)
/me/password              ← パスワード変更
/me/reservations          ← 自分の予約履歴
/me/withdraw              ← 退会(ゲスト格下げ + withdrawnAt 記録)
```

### 管理画面

```text
/admin                    ← ダッシュボード
/admin/reservations       ← 予約・販売管理(一覧⇄スケジュールビュー切替)
/admin/customers          ← 顧客管理(会員区分タブ・休眠フィルタ)
/admin/customers/[id]     ← 顧客詳細(基本情報・来店履歴・販売・回数券)
/admin/shifts             ← シフト管理(月/週/日/スタッフ別)
/admin/stores             ← 店舗管理(ベッド・特別メニュー・営業時間)
/admin/staff              ← スタッフ管理(ログイン情報・権限)
/admin/menus              ← 共通メニュー管理
/admin/products           ← 商品マスタ
/admin/sales              ← 売上管理
```

URL に状態を載せる方針(リロードに強く、シェア可能、戻るボタンが自然に動く)。
フィルタ・タブ・並び順・ページなどはすべてクエリパラメータで表現する。

## 共通ユーティリティ / コンポーネント

- `app/utils/format.ts` - JST 日付フォーマッタ + 円表記。Nuxt の auto-import 経由で全画面から利用。
- `shared/membership.ts` - 顧客の会員区分判定 + バッジ表示クラス。
- `shared/reservationStatus.ts` - DB ステータス → 表示ステータスの変換(`displayStatus`)。
- `shared/permissions.ts` - 権限名定義 + 役職別デフォルト。
- `app/components/Base/PillTabs.vue` - ピル形タブボタン(顧客タブ・予約ステータスタブで利用)。
- `app/components/Base/Pagination.vue` - 一覧画面の共通ページネーション。
- `app/components/Calendar/TimeColumnCalendar.vue` - 縦軸=時刻のカレンダー(シフト・スケジュールビューで流用)。

## 重要なコマンド

開発フェーズは Docker Compose で Nuxt コンテナを起動し、DB は Supabase へ直接接続する。
本番フェーズでは別途 `docker-compose.prod.yml` を VPS 上で動かす。

```bash
# 開発サーバー起動(バックグラウンド)
docker compose up -d

# ★ .env を編集したらこれが必須(restart では再ロードされない)
docker compose up -d --force-recreate

# ログ追跡
docker compose logs -f nuxt

# 停止
docker compose down

# パッケージ追加(コンテナ内で実行 → host の package.json / package-lock.json も更新)
docker compose exec nuxt npm install <package>

# Prisma 関連
docker compose exec nuxt npx prisma migrate dev --name <変更名>
docker compose exec nuxt npx prisma migrate dev --create-only --name <変更名>  # SQL のみ生成(EXCLUDE 等の手動編集用)
docker compose exec nuxt npx prisma generate
docker compose exec nuxt npx prisma db seed                                    # 冪等にシード再投入
docker compose exec nuxt npx prisma format

# 既存テーブルにデータがあると migrate dev が対話確認で止まるため、自動承認するときは:
yes | docker compose exec -T nuxt npx prisma migrate dev --name <変更名>

# コンテナ内シェル(デバッグ用)
docker compose exec nuxt sh
```

**注意**:

- ホスト側で直接 `npm run dev` は実行しない。すべてコンテナ内で動かす。
- `.env` を編集したら **`docker compose up -d --force-recreate`** が必須(restart では env_file が再ロードされない)。

## 現在のフェーズと進捗

- [x] 技術選定・アーキテクチャ決定
- [x] データモデル設計
- [x] **Phase 1 開発環境構築 完了**(Supabase 接続、Nuxt 雛形、Docker 化、Nuxt UI v4、Prisma 6、btree_gist)
- [x] **Phase 2 データモデル構築 完了**(EXCLUDE / CHECK 制約、PublicHoliday、シードデータ)
- [x] **Phase 3 お客様側予約フロー 完了**(店舗選択→メニュー→日時(時刻×曜日グリッド、◯/△/要TEL)→確認→完了、AES-256-GCM 暗号化、プライバシーポリシー)
- [x] **Phase 4 管理画面の予約管理 完了**(一覧・検索・フィルタ・ページング、詳細・ステータス変更、手動予約作成、シフト日ビュー連動、ダッシュボード予約サマリ)
- [x] **Phase 5 会員機能 + 管理機能拡張 完了**
  - 会員: 新規登録・メール認証・ログイン・マイページ・予約履歴・メアド/パス変更・退会
  - 物販・回数券: 在庫管理・販売 / 消費・売上集計
  - スタッフ管理 + 役職別権限テンプレート
  - 顧客管理画面: 一覧(会員区分タブ・休眠フィルタ)、詳細(接客メモ・来店履歴・販売・回数券)
  - 予約・販売管理画面: ステータスピル形タブ・ベッドフィルタ・スケジュールビュー(ベッド×時間軸)
  - 物販クイック販売: ゲスト購入モード・複数商品カート式・顧客の部分一致検索
- [ ] **Phase 6 本番デプロイ**(VPS + Supabase Pro 昇格 + Cloudflare R2 バックアップ + HTTPS + 2FA)
  - ⚠️ デプロイ時に **`NUXT_SESSION_COOKIE_SECURE=true`** を `.env` に必ず設定すること(dev では LAN IP HTTP 共有のため `nuxt.config.ts` で `false` に上書き中)
  - ⚠️ **`RESERVATION_ENCRYPTION_KEY`** はバックアップ必須(消失で過去顧客情報が永久に復号不能)
  - 2FA(TOTP)実装も Phase 6 範囲

## 参考資料

- [Nuxt docs](https://nuxt.com/)(Nuxt 4 系)
- [Nuxt UI docs](https://ui.nuxt.com/)(v4 系)
- [Prisma docs](https://www.prisma.io/docs)(v6 系を参照)
- [Supabase docs](https://supabase.com/docs)
- [FullCalendar Resource Timeline](https://fullcalendar.io/docs/resource-timeline-view)
- [個人情報保護委員会](https://www.ppc.go.jp/)
