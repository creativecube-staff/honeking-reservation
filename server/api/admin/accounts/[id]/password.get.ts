import { decryptUtf8 } from '~~/server/utils/crypto'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// アカウントのパスワードを復号して返す（ログイン管理画面の「パスワードを確認」ボタン用）。OWNER のみ。
// 一覧には載せず、確認操作のときだけこのエンドポイントで都度取得する（インライン表示で覗き見されるのを防ぐ）。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const target = await prisma.practitioner.findUnique({
    where: { id },
    select: { username: true, passwordEnc: true, canLogin: true },
  })
  if (!target || !target.canLogin) {
    throw createError({ statusCode: 404, statusMessage: 'アカウントが見つかりません' })
  }
  // 旧データや手入力で作られたアカウントは暗号化パスワードを持たない（復元不可）
  if (!target.passwordEnc) {
    throw createError({ statusCode: 409, statusMessage: 'このアカウントはパスワードを保持していません。「パスワード再発行」で作り直してください。' })
  }

  return { username: target.username, password: decryptUtf8(target.passwordEnc) }
})
