import { z } from 'zod'

// 会員制 API の入力スキーマ群（shared/ なのでサーバ・クライアント両側で再利用できる）

// パスワード要件: 8 文字以上、英数字記号 OK。複雑要件は最低限に留め、長さで担保する。
// 長文パスフレーズも歓迎できるよう上限は緩めに。
const passwordSchema = z
  .string()
  .min(8, 'パスワードは 8 文字以上で入力してください')
  .max(200, 'パスワードが長すぎます')

// 会員登録（仮登録）
// 必須: email, password, name, phone, 規約同意, プライバシーポリシー同意
// 仮登録時点で Customer 行を作る。メール認証完了で本登録になる。
export const memberSignupSchema = z.object({
  email: z.string().trim().toLowerCase().email('メールアドレスの形式が正しくありません').max(200),
  password: passwordSchema,
  name: z.string().trim().min(1, 'お名前を入力してください').max(100),
  phone: z.string().trim().min(1, '電話番号を入力してください').max(30),
  agreeTerms: z.literal(true, { message: '会員規約とプライバシーポリシーへの同意が必要です' }),
})
export type MemberSignupInput = z.infer<typeof memberSignupSchema>

// ログイン
// メールアドレスのみで識別（パスワードリセットもメールベースのため、整合性を取る）。
export const memberLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('メールアドレスの形式が正しくありません').max(200),
  password: z.string().min(1, 'パスワードを入力してください').max(200),
})
export type MemberLoginInput = z.infer<typeof memberLoginSchema>

// メール認証（トークン経由）
export const verifyEmailSchema = z.object({
  token: z.string().min(10).max(200),
})

// パスワードリセット要求
export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('メールアドレスの形式が正しくありません').max(200),
})

// パスワードリセット実行
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(10).max(200),
  newPassword: passwordSchema,
})

// マイページ: 氏名・電話の変更
export const memberProfileUpdateSchema = z.object({
  name: z.string().trim().min(1, 'お名前を入力してください').max(100),
  phone: z.string().trim().min(1, '電話番号を入力してください').max(30),
})

// マイページ: メアド変更申請
export const memberEmailChangeRequestSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('メールアドレスの形式が正しくありません').max(200),
})

// マイページ: メアド変更確定
export const memberEmailChangeConfirmSchema = z.object({
  token: z.string().min(10).max(200),
})

// マイページ: パスワード変更
export const memberPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, '現在のパスワードを入力してください').max(200),
  newPassword: passwordSchema,
})
