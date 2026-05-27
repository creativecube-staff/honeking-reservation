import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { encryptUtf8 } from '~~/server/utils/crypto'
import { generatePassword } from '~~/server/utils/generatePassword'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// オーナー（全店アクセス）アカウントを追加発行する。OWNER のみ。パスワードは自動生成。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const body = await readBody(event).catch(() => null) as Record<string, unknown> | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  if (!name || !username) {
    throw createError({ statusCode: 400, statusMessage: '名前とログイン ID は必須です' })
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    throw createError({ statusCode: 400, statusMessage: 'ログイン ID は半角英数字と _.- の 3〜32 文字にしてください' })
  }

  // OWNER も Practitioner なので storeId(FK) が必要。役職 OWNER は全店アクセスなので所属は便宜上の先頭店舗にする。
  const anyStore = await prisma.store.findFirst({ orderBy: { id: 'asc' }, select: { id: true } })
  if (!anyStore) {
    throw createError({ statusCode: 400, statusMessage: '先に店舗を作成してください' })
  }

  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const created = await prisma.practitioner.create({
      data: {
        storeId: anyStore.id,
        name,
        displayOrder: 9999,
        isActive: true,
        isAssignable: false,
        canLogin: true,
        username,
        passwordHash,
        passwordEnc: encryptUtf8(password),
        role: 'OWNER',
        permissions: [],
      },
      select: { id: true, username: true },
    })
    return { ok: true, id: created.id, username: created.username, password }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'そのログイン ID はすでに使われています' })
    }
    throw e
  }
})
