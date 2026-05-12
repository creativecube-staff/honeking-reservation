import { Prisma } from '@prisma/client'
import { updateStaffSchema } from '../../../../shared/schemas/staff'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  const currentUser = await requirePermission(event, 'staff:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateStaffSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  // 自分自身の無効化・ログイン停止を禁止（ロックアウト防止）
  if (id === currentUser.id) {
    if (parsed.data.isActive === false) {
      throw createError({ statusCode: 400, statusMessage: '自分自身を無効化することはできません' })
    }
    if (parsed.data.canLogin === false) {
      throw createError({ statusCode: 400, statusMessage: '自分自身のログインを無効化することはできません' })
    }
  }

  // canLogin = false に切り替えるときは、ログイン関連情報をクリアする
  const data: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.canLogin === false) {
    data.username = null
    data.passwordHash = null
    data.role = null
    data.permissions = []
  }
  // canLogin = true に切り替える/維持する場合、空文字 username は null に正規化
  if (data.username === '') data.username = null

  try {
    return await prisma.practitioner.update({
      where: { id },
      data,
      select: {
        id: true, storeId: true, name: true, displayOrder: true, isActive: true,
        isAssignable: true, canLogin: true, username: true, role: true, permissions: true,
        createdAt: true, updatedAt: true,
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        throw createError({ statusCode: 404, statusMessage: 'スタッフが見つかりません' })
      }
      if (e.code === 'P2003') {
        throw createError({ statusCode: 400, statusMessage: '指定された店舗が見つかりません' })
      }
      if (e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: 'そのユーザー名は既に使われています' })
      }
    }
    throw e
  }
})
