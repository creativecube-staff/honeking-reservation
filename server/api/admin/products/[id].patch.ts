import { Prisma } from '@prisma/client'
import { updateProductSchema } from '../../../../shared/schemas/product'
import { prisma } from '../../../utils/prisma'
import { requirePermission } from '../../../utils/requirePermission'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'product:edit')

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (data.description === '') data.description = null

  try {
    return await prisma.product.update({
      where: { id },
      data,
      include: { store: { select: { id: true, name: true } } },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        throw createError({ statusCode: 404, statusMessage: '商品が見つかりません' })
      }
      if (e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: '同じ店舗内に同じ商品名が既に存在します' })
      }
    }
    throw e
  }
})
