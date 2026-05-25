import { decryptUtf8 } from '~~/server/utils/crypto'
import { isPendingLineLinkFresh } from '~~/server/utils/lineLogin'
import { prisma } from '~~/server/utils/prisma'

// pendingLineLink セッションの中身をクライアント（/auth/line/link, /auth/line/signup）に返す。
// PII の最小化のため、サーバ側でしか見えない lineUserId 等はそのまま返さず、
// 「LINE 連携待ち」の表示用情報だけを返す。

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const pending = session.pendingLineLink

  if (!pending || !isPendingLineLinkFresh(pending.issuedAt)) {
    return { pending: null }
  }

  // 既存 Customer マッチがあれば、その顧客の email（マスク表示用）と name を返す。
  let matched: { maskedEmail: string | null, name: string } | null = null
  if (pending.matchedCustomerId) {
    const c = await prisma.customer.findUnique({
      where: { id: pending.matchedCustomerId },
      select: { name: true, email: true },
    })
    if (c?.email) {
      const plain = decryptUtf8(c.email)
      matched = {
        maskedEmail: maskEmail(plain),
        name: decryptUtf8(c.name),
      }
    }
  }

  return {
    pending: {
      // LINE プロフィール表示名（PII としては弱め、UI で「○○ さん、LINE で続行します」表示用）
      lineDisplayName: pending.lineDisplayName ?? null,
      // LINE が email scope で取得できたか
      hasEmail: !!pending.email,
      // ヒットした既存会員の表示情報（紐付けフロー専用）
      matched,
      // 完了後のリダイレクト先（予約フローへの復帰用、同一オリジン絶対パスのみ）
      redirectAfter: pending.redirectAfter && pending.redirectAfter.startsWith('/') ? pending.redirectAfter : null,
    },
  }
})

/** メールアドレスを「abc***@example.com」形式にマスク。 */
function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at)
  if (local.length <= 2) return `${local[0] ?? '*'}***${domain}`
  return `${local.slice(0, 2)}***${domain}`
}
