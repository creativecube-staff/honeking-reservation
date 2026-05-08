import { Prisma } from '@prisma/client'
import { createBedBulkSchema, createBedSchema } from '../../../../../../shared/schemas/bed'
import { prisma } from '../../../../../utils/prisma'

// body が { count } なら N 個一括追加（連番）、{ name } なら単発追加。
export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(storeId) || storeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な店舗 ID です' })
  }

  // 店舗が存在することを確認（FK 違反より前に分かりやすいエラーで返す）
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true } })
  if (!store) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  const body = await readBody(event)

  if (body && typeof body === 'object' && 'count' in body) {
    const parsed = createBedBulkSchema.safeParse(body)
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: '入力内容に誤りがあります',
        data: { issues: parsed.error.issues },
      })
    }

    // 既存の「ベッド N」名から最大番号を抽出して、その続きから命名
    const existing = await prisma.bed.findMany({
      where: { storeId },
      select: { name: true, displayOrder: true },
    })
    let maxN = 0
    for (const b of existing) {
      const m = b.name.match(/^ベッド(\d+)$/)
      if (m) maxN = Math.max(maxN, Number(m[1]))
    }
    const baseDisplayOrder = existing.reduce((acc, b) => Math.max(acc, b.displayOrder), -1) + 1

    const data = Array.from({ length: parsed.data.count }, (_, i) => ({
      storeId,
      name: `ベッド${maxN + 1 + i}`,
      displayOrder: baseDisplayOrder + i,
    }))

    try {
      const result = await prisma.bed.createMany({ data, skipDuplicates: false })
      return { created: result.count }
    }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: '同名のベッドが既に存在します。個別に名前を指定して追加してください。' })
      }
      throw e
    }
  }

  // 単発追加
  const parsed = createBedSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const baseDisplayOrder
    = (await prisma.bed.findFirst({
      where: { storeId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    }))?.displayOrder ?? -1

  try {
    return await prisma.bed.create({
      data: {
        storeId,
        name: parsed.data.name,
        displayOrder: baseDisplayOrder + 1,
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のベッドがすでに存在します' })
    }
    throw e
  }
})
