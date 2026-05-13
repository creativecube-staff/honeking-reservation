# お客様会員制（リピーター対応） — 未実装の計画メモ

リピーターが毎回名前・連絡先を入力する手間を減らすため、お客様側に会員制を導入する計画。
今日は着手せず、後日着手する。

## 採用方針

**完全自前で会員制 + メール送信は Resend**

理由：
- セキュリティを妥協しない（メアドもアプリ層で暗号化する既存方針を維持）
- Supabase Auth に乗せると `auth.users.email` が平文保存されるため不採用
- Resend は月 3,000 通 / 日 100 通まで無料 → 整骨院規模なら 10 倍以上の余裕

## 仕様（決定済み）

### 大方針
- **ゲスト予約も残す**（会員登録は任意）
- ログイン ID は **メールアドレス**（電話番号ログインは将来検討）
- パスワード忘れ時は **メールでリセットリンク送信**

### 会員登録時の入力項目
1. メールアドレス
2. パスワード
3. 氏名
4. 電話番号

メール認証あり：仮登録 → 確認メール → リンククリックで本登録（他人のメアドで勝手に登録されるのを防ぐ）。

### UI 配置
- **トップページ右上**に「会員ログイン」ボタン
- **予約フローの《お客様情報》ステップ**にも「会員の方はログイン」リンク

## データモデル（未適用）

```prisma
model Customer {
  // 既存フィールド + 以下を追加
  passwordHash    String?
  emailVerifiedAt DateTime?
  lastLoginAt     DateTime?

  // back relation
  passwordResetTokens     PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]
}

// 仮登録 → 本登録の中継トークン
model EmailVerificationToken {
  id         Int      @id @default(autoincrement())
  customerId Int
  token      String   @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime @default(now())
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  @@index([customerId])
}

model PasswordResetToken {
  id         Int      @id @default(autoincrement())
  customerId Int
  token      String   @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime @default(now())
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Restrict)
  @@index([customerId])
}
```

## 実装ステップ（着手時の段取り）

### Phase 1: 基盤
- `Customer` 拡張 + 2 トークンテーブル追加 + migration
- Resend SDK 導入（`npm i resend`）
- `.env` に `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `APP_BASE_URL` を追加
- `server/utils/mail.ts` メール送信ヘルパー
- メールテンプレ: 会員登録確認 / パスワードリセット

### Phase 2: 会員登録・ログイン
- API: `POST /api/member/signup` / `login` / `logout` / `GET /api/member/me`
- ページ: `/signup` `/login`
- お客様側セッション（管理画面と別の cookie キー）
- 仮登録 → メール送信 → `/verify-email/[token]` で本登録完了

### Phase 3: パスワードリセット
- API: `POST /api/member/password-reset/request` `/confirm`
- ページ: `/password-reset` `/password-reset/[token]`

### Phase 4: 予約フローを会員対応
- ログイン状態なら《お客様情報》ステップで氏名・電話・メアドを自動入力
- 未ログインなら既存ゲストフロー + 「会員になるとラク」誘導

### Phase 5: 会員マイページ `/me`
- 予約履歴
- 回数券残数
- 個人情報変更（氏名・電話・メアド）
- パスワード変更

### Phase 6: トップページ・ヘッダ・管理画面
- トップ右上に「会員ログイン」「マイページ」ボタン
- 予約フローの《お客様情報》に「会員の方はログイン」リンク
- 管理画面の顧客一覧に「会員」フラグ・最終ログイン日表示

## コスト試算

| サービス | 無料枠 | 試算 |
|---|---|---|
| Resend | 月 3,000 通 / 日 100 通 | 整骨院規模なら月数百通 → **完全無料** |
| Supabase | （既存 Pro $25/月）| 追加コストなし |

## セキュリティ方針

- メアド・氏名・電話は **AES-256-GCM で暗号化**（既存方針を維持）
- パスワードは bcrypt（管理画面と同じ）
- トークンは `crypto.randomBytes(32).toString('base64url')` 程度のランダム値
- トークン有効期限：メール認証 24h / パスワードリセット 1h
- リセット要求は **存在しないメアドでも 200 を返す**（メアド存在の漏洩防止）

---

最終更新: 2026-05-12
