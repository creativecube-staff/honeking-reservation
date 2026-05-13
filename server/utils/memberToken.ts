import { randomBytes } from 'node:crypto'

// 会員制（メール認証・パスワードリセット）で使うトークン生成ユーティリティ。
// crypto.randomBytes(32) を base64url 変換 → 約 43 文字の URL セーフ文字列。
// 2^256 通りなので衝突無視できる強度。

/** 32 バイトのランダム値を base64url 文字列で返す（43 文字、URL に安全）。 */
export function generateMemberToken(): string {
  return randomBytes(32).toString('base64url')
}

/** メール認証トークンの有効期限（24 時間）を今から計算して Date で返す。 */
export function emailVerificationExpiresAt(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

/** パスワードリセットトークンの有効期限（1 時間）を今から計算して Date で返す。 */
export function passwordResetExpiresAt(): Date {
  return new Date(Date.now() + 60 * 60 * 1000)
}
