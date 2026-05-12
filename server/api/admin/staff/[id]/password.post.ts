import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { resetPasswordSchema } from '../../../../../shared/schemas/staff'
import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// パスワード再設定。staff:edit を持つユーザーが任意のスタッフのパスワードを再設定できる。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 対象スタッフが canLogin=true である必要がある
  const target = await prisma.practitioner.findUnique({ where: { id }, select: { canLogin: true } })
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
  }
  if (!target.canLogin) {
    throw createError({ statusCode: 400, statusMessage: 'このスタッフはログイン許可されていません' })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  try {
    await prisma.practitioner.update({
      where: { id },
      data: { passwordHash },
      select: { id: true },
    })
    return { ok: true }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
    }
    throw e
  }
})
