import bcrypt from 'bcryptjs'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { generatePassword } from '~~/server/utils/generatePassword'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 対象アカウントのパスワードを再発行する（サーバで自動生成・手入力なし）。OWNER のみ。
// 新しい平文パスワードはこのレスポンスでだけ返す（DB にはハッシュのみ）。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const target = await prisma.practitioner.findUnique({
    where: { id },
    select: { id: true, canLogin: true, username: true },
  })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'アカウントが見つかりません' })
  }
  if (!target.canLogin) {
    throw createError({ statusCode: 400, statusMessage: 'このアカウントはログイン許可されていません' })
  }

  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.practitioner.update({
    where: { id },
    data: { passwordHash, passwordEnc: encryptUtf8(password) },
    select: { id: true },
  })

  return { ok: true, username: target.username, password }
})
