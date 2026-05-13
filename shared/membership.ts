// 顧客の会員区分（membership）に関する共通定義。
// API 側 (server/api/admin/customers/*) で算出した文字列値と、
// UI 側 (app/pages/admin/customers/*) のバッジ表示を一致させる。

export type Membership = 'member' | 'pending' | 'guest' | 'withdrawn'

/** 顧客レコードから会員区分を算出。
 * - withdrawn: withdrawnAt が設定済み（退会済）
 * - member:    パスワード + メール認証済み = 本会員
 * - pending:   パスワードあり + メール未認証 = 仮登録
 * - guest:     パスワードなし = ゲスト予約のみ */
export function resolveMembership(c: {
  withdrawnAt: Date | string | null
  passwordHash: string | null
  emailVerifiedAt: Date | string | null
}): Membership {
  if (c.withdrawnAt) return 'withdrawn'
  if (c.passwordHash && c.emailVerifiedAt) return 'member'
  if (c.passwordHash) return 'pending'
  return 'guest'
}

/** バッジ表示用のラベル + Tailwind クラス。
 * 「仮登録」は一覧と詳細で文言を変えていた箇所があるが、ここで統一する。 */
export const MEMBERSHIP_BADGE: Record<Membership, { label: string, class: string }> = {
  member: { label: '本会員', class: 'bg-green-100 text-green-800 border-green-300' },
  pending: { label: '仮登録', class: 'bg-amber-100 text-amber-800 border-amber-300' },
  guest: { label: 'ゲスト', class: 'bg-slate-100 text-slate-700 border-slate-300' },
  withdrawn: { label: '退会済', class: 'bg-slate-200 text-slate-600 border-slate-400' },
}
