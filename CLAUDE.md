# CLAUDE.md

AIアシスタント(Claude)がこのプロジェクトで作業する際の指示書。新しいセッションを開始したら、まずこのファイルを読んで文脈を把握すること。

## プロジェクトの本質

整骨院チェーン向けの予約管理システム。
お客様はWebで4ステップ予約、スタッフは管理画面で予約・販売・顧客を管理。

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
| ソーシャルログイン | LINE Login (OAuth 2.0) + LIFF SDK (`@line/liff`)。会員アカウントと `Customer.lineUserId` で紐付け。LINE 内蔵ブラウザでは LIFF SDK が外部リダイレクトなしで完結。PC ブラウザでは OAuth リダイレクトに自動 fallback |
| 実行環境 | 開発・本番ともに Docker Compose(開発: ローカル / 本番: VPS) |

技術選定の議論はすでに完了しているため、勝手に別技術(Next.js・Laravel・microCMS等)を提案しない。

## 確定済みの仕様

### 店舗・リソース

- **2 店舗から開始**(将来拡張想定):
  - 流山おおたかの森整骨院: 4 ベッド
  - 松戸駅東口整骨院: 6 ベッド
- スタッフ: **メイン所属店舗あり**(`Staff.storeId`)。出勤予定は `Staff.baseShiftDays`(曜日マスタ)+ 店舗の `BusinessHour` で表現する。日々のイレギュラー(その日だけ休む等)は予約・販売画面で個別調整する想定。Shift テーブルは廃止済み(2026-05-28)
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
  - **最終受付 = その日の最後のレンジの終了時刻**。お客様はその時刻まで予約開始でき、施術は閉店後にはみ出てよい(担当は基本シフト曜日に出勤しているスタッフ。`Staff.baseShiftDays.includes(effectiveDow)` で判定し、施術終了が営業時間を超えても可)。中抜け休憩前のレンジは従来どおり休憩前に施術が終わる枠のみ
- 定休日: **なし**(365日営業)

### 「祝日 = 日曜扱い」運用ルール

店舗の実運用では国民の祝日も営業するが、土日と同じ短縮営業時間 (9:30 - 18:00) になる。スキーマ:

- `Holiday`: 店休日(営業しない)
- `PublicHoliday`: 国民の祝日(全店共通・営業はする)
- アプリ層が予約枠計算時、`PublicHoliday` 該当日は `BusinessHour[dayOfWeek=0]`(日曜)を引く

### 予約の制約

1 件の予約 = 1 ベッド + 1 スタッフ + 1 メニュー + 時間帯。
ダブルブッキング防止は PostgreSQL の `EXCLUDE USING gist + tsrange` で **DB レベル保証**。

```sql
EXCLUDE USING gist (bedId WITH =, tsrange(startAt, endAt, '[)') WITH &&)
WHERE (status <> 'CANCELLED');
-- staffId 版も同形（no_double_booking_staff）
```

- 半開区間 `[)` で隣接時刻(例: 14-15 と 15-16)は重ならない
- CANCELLED 予約は除外(同枠を再予約可能)
- `btree_gist` 拡張は Step 1-5 で migration により有効化済

### 予約受付期間

- **本日から 180 日先まで** が予約可能(`shared/reservationPolicy.ts` の `MAX_ADVANCE_DAYS`)
- お客様 UI(`DateTimeStep`): 上限超で「次の週 →」を disabled + 注記表示
- サーバ側(`/api/availability` / `/api/reservations.post`): 上限超は 400 で拒否
- 変更したい場合は `MAX_ADVANCE_DAYS` 一箇所を直すだけで全体反映

### 予約枠の刻み

- お客様が選べる予約開始時刻は **15 分刻み**(`shared/reservationPolicy.ts` の `SLOT_STEP_MINUTES = 15`)。Hot Pepper Beauty に合わせた
- 空き計算(`/api/availability`)もダブルブッキング制約(DB の `EXCLUDE`)も「実際の時間帯の重なり」で判定するため、この定数を変えるだけで刻みを変更できる(30分等に戻すのも一箇所)
- お客様 UI(`DateTimeStep`)はサーバが返す slots をそのまま行にするので、刻み変更に自動追従。中抜け休憩で時刻が飛ぶ箇所には休憩の区切り行を表示

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
- **コードコメントは日本語で書く**: 関数の意図・なぜそうしたか・将来の注意点などはすべて日本語。`// LINE Login の callback` のような短い注釈も日本語で(変数名・型名のみ英語)。既存コードのコメントも基本日本語に揃っているので、新規追加・修正時も日本語で統一すること
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

### Vue template のスコープ制限(よくハマる)

Vue 3 の template 内では **`window` / `document` / `localStorage` / `navigator` 等のブラウザ global がデフォルトでアクセスできない**(`Math` / `Date` / `JSON` / `console` 等のホワイトリスト globals のみ通る)。

```vue
<!-- ❌ NG: window が undefined になりクラッシュ -->
<button @click="() => window.print()">印刷</button>

<!-- ✅ OK: script setup 側に関数化 -->
<script setup lang="ts">
function handlePrint() {
  if (import.meta.client) window.print()
}
</script>
<button @click="handlePrint">印刷</button>
```

ブラウザ API を使う処理はすべて `<script setup>` 側に切り出すルール。

### Host-aware ページパターン

`reserve.honeking.*` と `admin.honeking.*` の 2 ホスト構成だが、Nuxt はファイルベースルーティングのためホストで分岐できない。**両ホストで URL パスが共有される必要があるページ**(例: `/login`)は、`useRequestURL().hostname` で振り分ける。

```vue
<!-- app/pages/login.vue -->
<script setup lang="ts">
const url = useRequestURL()
const isAdminHost = computed(() => url.hostname.startsWith('admin.'))
definePageMeta({ layout: false })
</script>

<template>
  <NuxtLayout v-if="!isAdminHost" name="default">
    <LoginMemberLoginForm />
  </NuxtLayout>
  <LoginStaffLoginForm v-else />
</template>
```

各ホスト専用のフォーム実装は `app/components/Login/{Member,Staff}LoginForm.vue` に切り出し済み。

新しい共有ページを足すときは同パターンで(ただし基本は **ホストごとに別 URL パス**にするほうが simpler、共有は最終手段)。

### 個人情報を扱うコード

- **必ず暗号化処理を通す**
- ログに個人情報を出力しない
- エラーメッセージに個人情報を含めない
- 比較・検索は **hash 値**(`*Hash` カラム)で行う

## データモデル方針

主要テーブル(Phase 5 までで拡張済):

- `Store` - 店舗マスタ
- `Bed` - ベッド(Store に紐づく)
- `Staff` - 店舗で働く人(店舗モードのスタッフ管理で扱う)。`name` / `gender` / `role`(表示用) / `displayOrder` / `assignOrder` / `baseShiftDays`(出勤曜日 Int[]) / `isActive` / `isAssignable` を持つ。ログイン情報は持たない
- `Login` - 管理画面のログインアカウント(Staff とは完全独立・リレーション無し)。`username` / `passwordHash` / `passwordEnc` / `role`(認証用 Role) / `permissions` / `totpSecret` / `lastLoginAt` / `isActive`
- `LoginHistory` - 認証履歴(`loginId` で Login と紐付け、`onDelete: SetNull`)
- `Menu` - メニュー(共通メニュー `storeId IS NULL` + 店舗特別メニューの 2 階建て)
- `BusinessHour` - 曜日別営業時間レンジ(1 日に 1 つ以上、中抜け休憩は 2 レンジで表現)
- `Holiday` - 終日休み(1 日まるごと営業しない日)
- `Closure` - 部分閉店(イレギュラーで一定時間だけ休み、同日複数行可)
- `PublicHoliday` - 国民の祝日(全店舗共通・営業はする / 日曜扱い運用)
- `Customer` - 顧客(個人情報は暗号化済み値、検索は `*Hash` カラム)
  - 会員機能: `passwordHash` / `emailVerifiedAt` で本会員と仮登録を判定
  - `withdrawnAt`: 退会日時(退会後もデータは残し、ゲスト顧客に格下げ)
  - `note`: 管理者専用の接客メモ(PII を書かない前提のため暗号化なし)
  - **`lineUserId`** (unique, nullable): LINE Login で取得する LINE ユーザー識別子。マイページから連携・解除可能
  - **`lineDisplayName`** (nullable): 連携時点の LINE プロフィール表示名(マイページ「LINE と連携中」表記用)
  - 「店頭ふらっと販売用」固定 Customer を `server/utils/guestCustomer.ts` で lazy-create
- `Reservation` - 予約(Store + Bed + Staff + Menu + 時間帯)
- `ReservationHistory` - 予約変更履歴(時間 / メニュー / 担当 / ベッド / ステータスの変更を記録、`changedByLoginId` で操作者を記録)
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

役職テンプレート × 個別 permission overrides で最終的な権限を解決。役職と権限は `Login.role` / `Login.permissions` を見る(Staff 側の `role` は表示用ラベル)。

- `OWNER` / `MANAGER`: 全権限
- `RECEPTIONIST`: 予約・販売 + 顧客閲覧
- `PRACTITIONER`: 予約閲覧 + 物販販売

権限名は `<resource>:<action>` 形式 (`reservation:view`, `customer:edit`, `sale:edit` など)。
ページ側は `definePageMeta({ requirePermission: 'xxx:yyy' })` で宣言、サーバ側は `requirePermission(event, 'xxx:yyy')` で検証。
旧 `shift:view` / `shift:edit` permission は廃止済み(Shift テーブルごと撤去)。

### 店舗スコープ(アクセス境界) - shared/storeAccess.ts

役職(=操作権限)とは別軸で「どの店舗を見られるか」を制御する。Phase 1(土台 + ダッシュボード)まで実装済。

- `OWNER`: 全店舗。ヘッダーの店舗スイッチャー(`.store-switcher`)で「管理者(全店まとめ)」と各店を切替
- `MANAGER`(店長) / `RECEPTIONIST` / `PRACTITIONER`: 所属店舗(`Login.storeId`)のみ。スイッチャーは自店固定
- 判定: `canAccessAllStores(role)`(= OWNER のみ true)
- サーバ: `server/utils/storeScope.ts` の `resolveStoreScope(event, storeId)` で越権を 403 にし、絞るべき storeId(null=全店)を返す。操作系 API で使う
- クライアント: `app/composables/useStoreContext.ts`(`useStoreContext()`)が選択中店舗を保持(cookie `admin_store`)。**店舗切替時はダッシュボードに自動遷移**(切替後のスコープで意味を成さない可能性があるため)
- セッション: ログイン時に `User.storeId` を保存(`server/api/admin/login.post.ts`)。`Login` テーブル参照
- **顧客台帳は全店共通**(誰でも検索可・スコープ対象外)。操作系(予約・売上等)のみ店舗で絞る
- 役職ごとの細かい権限差は permissions.ts が担当。店舗スコープとは別軸

## URL 設計

### お客様側予約フロー(SPA 化済み)

```text
/                                       ← 店舗選択
/[storeSlug]                            ← 予約 SPA(メニュー → 日時 → 確認 を URL 固定で内部遷移)
/complete/[code]                        ← 完了画面(リロード安全)
```

ホスト `reserve.honeking.jp` で文脈が明示されてるため、`/reserve/` などのプレフィックスは付けない(SEO・URL の短さ重視)。

**LIFF 組み込み想定で SPA 化済み**:

- `/[storeSlug]` 一枚にメニュー/日時/確認の 3 ステップを内部ステートで集約
- `<Transition>` + `<KeepAlive>` で横スライド切替、フォーム状態は KeepAlive で保持
- 完了時のみ `/complete/[code]` へ通常遷移
- リロード = メニュー選択からやり直し(SPA の宿命として許容)
- 関連: [[reservation_flow_spa_for_liff]] memory

`/[storeSlug]` はフラットな名前空間なので、**店舗 slug が固定ルート(`/me`, `/login`, `/auth`, `/complete` 等)と衝突しないよう** `shared/reservedSlugs.ts` でバリデーション。**新しい固定ルートを `app/pages/` 直下に追加するたび、このリストにも 1 行追加すること**。

### LINE Login / LIFF 連携(実装済み)

```text
/api/auth/line/start                    ← OAuth 認可開始(state 署名 cookie + 戻り先 cookie)
/api/auth/line/callback                 ← OAuth コールバック(分岐: 既存連携 / 既存メアド一致 / 新規)
/api/auth/line/liff-login (POST)        ← LIFF SDK から id_token を受け取って同じ分岐をする版
/api/auth/line/pending (GET)            ← 連携待ち情報の取得
/api/auth/line/link-password (POST)     ← 既存会員にパスワード本人確認で紐付け
/api/auth/line/signup (POST)            ← LINE 経由の新規会員作成 + 紐付け
/api/member/line-unlink (POST)          ← 連携解除(マイページから)

/auth/line/link                         ← パスワード本人確認フォーム
/auth/line/signup                       ← LINE プロフィール pre-fill 付き会員登録
```

- LINE 連携情報は `Customer.lineUserId` / `lineDisplayName`
- 予約フロー中の LINE 認証復帰は `sessionStorage` キー `honeking_pending_reservation` で復元 → 確認ステップに自動ジャンプ
- LIFF SDK は `app/composables/useLiff.ts` でラップ(動的 import で SSR 回避)
- LINE Login のサーバ実装は `server/utils/lineLogin.ts`

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

`admin.honeking.jp` ホストの直下に以下を配置。ホスト名で「これは管理画面」が明示されてるため、URL に余計な `/admin/` プレフィックスは付けない。

```text
/                         ← /dashboard へ 302 リダイレクト（Caddy で完結）
/login                    ← スタッフログイン（reserve ホストの会員ログインと同 URL、host-aware）
/dashboard                ← ダッシュボード
/dashboard/reservations   ← 予約・販売管理(一覧⇄スケジュールビュー切替)
/dashboard/customers      ← 顧客管理(会員区分タブ・休眠フィルタ)
/dashboard/customers/[id] ← 顧客詳細(基本情報・来店履歴・販売・回数券)
/dashboard/stores         ← 店舗管理(ベッド・特別メニュー・営業時間)
/dashboard/staff          ← 店舗モードのスタッフ管理(店舗で働く人/名前・性別・役職・表示順・振り分け順・基本シフト)
/dashboard/accounts       ← 全店モードのログイン管理(Login テーブル/OWNER のみ)
/dashboard/menus          ← 共通メニュー管理
/dashboard/products       ← 商品マスタ
/dashboard/sales          ← 売上管理
/dashboard/help           ← ヘルプ
```

ファイル配置:

- 全 admin ページ: `app/pages/dashboard/...`
- ログインだけは `app/pages/login.vue`(両ホスト共有、host-aware で `app/components/Login/StaffLoginForm.vue` / `MemberLoginForm.vue` を切替)

サーバ API は `server/api/admin/*` のまま(URL に出ないし、これを変えると変更ファイルが倍以上になる)。

新しい admin 固定ページを足すときは `app/pages/dashboard/*` 配下に作る → 自動的に `/dashboard/*` で公開されるので追加対応不要(Caddy の allow-list は `/dashboard*` で網羅済み)。

`/dashboard` は `shared/reservedSlugs.ts` に登録済みなので、店舗 slug と衝突する心配なし。

URL に状態を載せる方針(リロードに強く、シェア可能、戻るボタンが自然に動く)。
フィルタ・タブ・並び順・ページなどはすべてクエリパラメータで表現する。

## 共通ユーティリティ / コンポーネント

- `app/utils/format.ts` - JST 日付フォーマッタ + 円表記。Nuxt の auto-import 経由で全画面から利用。
- `app/composables/useMember.ts` - 会員セッションのコンポーザブル(`/api/member/me` の SWR ラッパー)。
- `app/composables/useLiff.ts` - LIFF SDK のラッパー(動的 import で SSR 回避、init/login/getIdToken/isInClient)。
- `shared/membership.ts` - 顧客の会員区分判定 + バッジ表示クラス。
- `shared/reservationStatus.ts` - DB ステータス → 表示ステータスの変換(`displayStatus`)。
- `shared/reservationPolicy.ts` - 予約運用ポリシー定数(`MAX_ADVANCE_DAYS=180` / `SLOT_STEP_MINUTES=15`)。
- `shared/permissions.ts` - 権限名定義 + 役職別デフォルト。
- `shared/storeAccess.ts` - 店舗アクセス境界の判定(`canAccessAllStores(role)`: OWNER のみ全店)。
- `server/utils/storeScope.ts` - 操作系 API の店舗スコープ解決 + 越権 403(`resolveStoreScope`)。
- `app/composables/useStoreContext.ts` - 管理画面ヘッダーの店舗スイッチャー文脈(選択中店舗を cookie 保持)。
- `shared/memberTerms.ts` - 会員規約・プライバシーポリシーのバージョン定数(`MEMBER_TERMS_VERSION`)。規約改定時はここを更新。
- `server/utils/lineLogin.ts` - LINE Login OAuth(state 署名・id_token verify)。
- `server/utils/crypto.ts` - AES-256-GCM 暗号化/復号(個人情報用)。
- `server/utils/hash.ts` - SHA-256 ハッシュ(検索・重複防止用)。
- `app/components/Auth/AuthModal.vue` - 予約フロー中の in-page ログイン/新規登録モーダル(LINE ボタン + sessionStorage 復帰)。
- `app/components/Base/PillTabs.vue` - ピル形タブボタン(顧客タブ・予約ステータスタブで利用)。
- `app/components/Base/Pagination.vue` - 一覧画面の共通ページネーション。
- `app/components/Calendar/TimeColumnCalendar.vue` - 縦軸=時刻のカレンダー(スケジュールビューで流用)。シフト管理は廃止済み(出勤予定は `Staff.baseShiftDays` を見る)。
- `app/components/Admin/DetailHeader.vue` - 管理画面の共通ページ見出し(`<AdminDetailHeader>`)。左オレンジアクセントバー + 太字タイトル + バッジ(default slot)+ 右寄せ `#actions` + 下段(詳細ページ=戻るリンク `back-to`/`back-label` / 一覧ページ=説明文 `description` か `#description`)。詳細・一覧どちらのページでも使う。
- `app/components/Admin/BackLink.vue` - 一覧へ戻るリンク(`<AdminBackLink>`)。矢印を丸背景に入れ hover でアクセント色、`accent` で orange/muted 切替。DetailHeader が内部利用。
- `app/components/Admin/DetailActions.vue` - 詳細ページ下部の共通アクションバー(`<AdminDetailActions>`)。区切り線 + エラー表示 + 左=主操作(default slot)/ `#danger`=破壊的操作。`bordered` で上罫線の有無を切替(フォーム内に置くときは false)。
- `app/components/Admin/Menu/Manager.vue` - 共通メニュー / 店舗特別メニュー管理を 1 コンポーネントに集約(`<AdminMenuManager>`)。`storeId` 無=共通(`/api/admin/menus`)/有=その店舗(`/api/admin/stores/{id}/menus`)。一覧・あいまい検索・ステータスタブ・編集モーダル・CRUD・完全削除モーダル・共通メニュー差し替えドロップダウン全部入り。文言は storeId から自動で出し分け。
- `app/components/Admin/Staff/Manager.vue` - 店舗モードのスタッフ管理を 1 コンポーネントに集約(`<AdminStaffManager :store-id>`)。一覧・検索・ステータスタブ・編集モーダル(名前・性別・役職・表示順・振り分け順・基本シフト)・有効/無効・完全削除モーダル全部入り。Login(ログインアカウント)とは無関係。
- `server/utils/staffPurge.ts` - スタッフの完全削除前提情報(`Reservation.staffId` 参照 0 件 + `isActive=false` のときのみ削除可)を共有。
- `server/utils/menuPurge.ts` - 共通/店舗特別メニューの完全削除前提情報(`Reservation.menuId` 参照 0 件 + `isActive=false` のときのみ削除可)を共有。
- `MenuStoreExclusion` テーブル - 共通メニューを「この店舗では非表示」とオプトアウトする関連。`Menu.excludedStores`(共通側)と `Store.menuExclusions`(店舗側)で参照。
- `Menu.replacesMenuId` - 店舗特別メニュー専用の自己参照。アクティブな期間中(`isActive` かつ対象日が `availableFrom..availableUntil` 範囲内)はその共通メニューを当店で自動非表示、期間終了で自動復帰。お客様 API・availability で per-day 判定される。
- `app/components/Admin/Store/BedsTab.vue` / `app/components/Admin/Schedule/BusinessHoursPanel.vue` - `storeId` 省略で「下書きモード」(API を叩かずローカル編集 → 親が `getBedNames()` / `getRanges()` で取り出す)。新規店舗作成ページ(`stores/new.vue`)が利用し、作成 API のトランザクションで Store + アカウント + ベッド + 営業時間を一括作成する。
- `shared/businessHours.ts` - 全店共通の標準営業時間 `DEFAULT_BUSINESS_HOUR_RANGES`(新規店舗作成時の初期値)。
- 管理画面テーブルの共通クラス: `admin-table` / `admin-table-wrap` / `admin-table-head` / `admin-table-body` / `admin-table-row`(縦罫線は点線)。一覧の絞り込みは「ステータスタブ + あいまい検索(名前等の部分一致・スペース区切りで AND)」、件数が多い列は見出しクリックでソート(店舗一覧の都道府県 / 市区町村 / 表示順)。
- 一覧の再活性ボタンの文言は「有効化」(無効化と対)に統一。「復活」は使わない。

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
- **`restart` と `up -d` の使い分け**(超重要):
  - `Caddyfile` の中身だけ編集 → `docker compose restart caddy`(設定再読み込みで OK)
  - `.env` を編集 → `docker compose up -d --force-recreate`(restart では env_file が再ロードされない)
  - `docker-compose.yml` を編集(ports / volumes / depends_on 追加など) → `docker compose up -d --force-recreate`(restart は既存設定で再起動するだけ、新しい mount や port は反映されない)
  - 覚え方: **restart = 同じ設定で再起動 / up = 設定を読み直してコンテナ作り直し**

## ローカルのリバースプロキシ構成(本番想定の再現)

ローカルでも本番に近い「ホスト分離 + HTTPS + セキュリティヘッダ + edge-served 404」を再現するため、`Caddyfile` + `docker-compose.yml` の caddy サービスを導入済み。

```text
ブラウザ
  ↓ https://reserve.honeking.localhost / https://admin.honeking.localhost
Caddy(リバプロ、80/443)
  ↓ Host ヘッダで振り分け + 越境パスは静的 404 を返す
Nuxt(コンテナ内、3000)
```

- **`reserve.honeking.localhost`** : お客様向け予約サイト。`/dashboard*` と `/api/admin*` は edge で 404
- **`admin.honeking.localhost`** : 管理画面。allow-list 方式で `/login` `/dashboard*` `/api/admin*` `/api/_*` `/_nuxt*` `/__nuxt*` `/__vite*` 等のみ通す、それ以外は edge で 404。`/` は `/dashboard` へ 302 リダイレクト
- **`localhost:3000`** : Nuxt 直アクセス(HMR フォールバック用に残置)
- **Basic 認証**: admin ホストに `basicauth` ディレクティブで多層防御。ユーザー名/パスワードは `.env` の `ADMIN_USER` / `ADMIN_PASSWORD_HASH`(bcrypt)を Caddy に環境変数として渡す。ハッシュ生成は `docker compose exec caddy caddy hash-password`。`.env` 内の `$` は `$$` にエスケープ
- 静的 404 ページは `caddy/error-pages/404.html`(JS でホスト名を見てテーマ切替)。`error` ディレクティブ + `handle_errors` で 404 ステータス + HTML 本文両立
- Caddy の内部 CA は macOS Keychain に信頼登録済み(`docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt` → `security add-trusted-cert`)

`/etc/hosts` に以下が必要:

```text
127.0.0.1 reserve.honeking.localhost
127.0.0.1 admin.honeking.localhost
```

本番 Caddyfile は Phase 6 でこれをコピー + 数行差し替えて作成する(詳細は `prod_deploy_checklist` メモリ参照)。

## 残作業(未着手のもの)

実装済みの機能の詳細は本ファイル上部の「確定済みの仕様」「データモデル方針」「URL 設計」を参照。以下はこれからやる作業のみ。

### 1. 店舗スコープ(アクセス境界)を全ページへ展開 (Phase 2/3)

店舗スコープの土台は Phase 1 で実装済(OWNER=全店/他=自店、ヘッダーの店舗スイッチャー、ダッシュボード + 予約一覧 API のスコープ)。残りを横展開する。詳細は「## 権限」の店舗スコープ節。

- Phase 2: 予約・販売ページUI / シフト / スケジュール / 売上 / 店舗設定 を選択店舗で絞る + 各 API に `resolveStoreScope` を入れる
- Phase 3: スタッフ / 商品の見える範囲の整理 + 仕上げ(顧客は全店共通のまま)

※ 管理画面 UI の salonboard 風刷新は **実装完了**: 白地ヘッダー + 横タブ + 店舗スイッチャー + 右端アカウント▼。旧 WordPress 風サイドバーは廃止

### 2. メール → 予約自動取り込み機能

ホットペッパービューティー等の外部経路で来る予約通知メールを受信して、自動で当システムに登録する。

- 送信元・フォーマット・頻度は要ヒアリング
- 受信は SendGrid Inbound Parse / Postmark Inbound 等の Webhook 方式を推奨
- 失敗時は管理画面の「要確認」キューに退避
- 関連: [[email_to_reservation_ingest]] memory

### 3. LINE Messaging API 統合(LINE Login + LIFF の続き)

LINE Login + LIFF は実装済み。次は通知系:

- LINE Messaging API で予約完了通知・前日リマインダーを push
- LINE 公式アカウントを開設し、リッチメニューに LIFF URL を仕込む
- ユーザーへの追加同意取得(プライバシーポリシーには将来形で記載済み)

### 4. Phase 6: 本番デプロイ

VPS + Supabase Pro 昇格 + Cloudflare R2 バックアップ + HTTPS。本番 Caddyfile は dev の `Caddyfile` を雛形に Let's Encrypt 有効化 + HSTS/CSP 追加 + IP allowlist + ホスト名差し替え。

⚠️ デプロイ時の env 設定は以下を必ず確認:

- **`NUXT_SESSION_COOKIE_SECURE=true`** を `.env` に必ず設定(dev では LAN IP HTTP 共有のため `nuxt.config.ts` で `false` に上書き中)
- **`RESERVATION_ENCRYPTION_KEY`** はバックアップ必須(消失で過去顧客情報が永久に復号不能)
- **`ADMIN_USER`** / **`ADMIN_PASSWORD_HASH`** を本番用の強い値に変更
- **`APP_BASE_URL`** を本番ドメインに変更
- **`RESEND_FROM_EMAIL`** を独自ドメイン認証済アドレスに変更
- **`LINE_LOGIN_CALLBACK_URL`** を本番ドメインに変更し、LINE Developers Console の Callback URL にも追加
- LIFF Endpoint URL を本番ドメインに変更
- LINE Login Channel を **公開済み(Published)** に切り替え

詳細: [[prod_deploy_checklist]] memory

### 5. 管理画面 2FA(TOTP)実装

管理画面ログインに TOTP ベースの 2 要素認証を導入。`Login.totpSecret` カラムは既に用意済み。Phase 6 と同タイミングで導入予定。

### 6. 本番公開前: 法務チェック

雛形ベースのプライバシーポリシー(v2.1)・会員規約(v1.1)を **行政書士または弁護士にレビュー依頼**。LINE 連携・暗号化・委託先記載などすでに整備済み。

## 参考資料

- [Nuxt docs](https://nuxt.com/)(Nuxt 4 系)
- [Nuxt UI docs](https://ui.nuxt.com/)(v4 系)
- [Prisma docs](https://www.prisma.io/docs)(v6 系を参照)
- [Supabase docs](https://supabase.com/docs)
- [FullCalendar Resource Timeline](https://fullcalendar.io/docs/resource-timeline-view)
- [個人情報保護委員会](https://www.ppc.go.jp/)
