import { prisma } from '../../../../utils/prisma'
import { requirePermission } from '../../../../utils/requirePermission'

// 管理画面: 顧客の編集（現状は接客メモ note のみ）
// 個人情報（氏名・電話・メール）はマイページから本人が変更する建付けのため、ここでは扱わない。
export default defineEventHandler(async (event) => {
  await requirePermission(event, 'customer:edit')

  const customerId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = (await readBody(event)) as Record<string, unknown> | null
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'リクエストボディが不正です' })
  }

  const data: { note?: string | null } = {}

  if ('note' in body) {
    if (body.note === null || body.note === '') {
      data.note = null
    }
    else if (typeof body.note === 'string') {
      const trimmed = body.note.trim()
      if (trimmed.length > 2000) {
        throw createError({ statusCode: 400, statusMessage: 'メモは 2000 文字以内で入力してください' })
      }
      data.note = trimmed === '' ? null : trimmed
    }
    else {
      throw createError({ statusCode: 400, statusMessage: 'note は文字列である必要があります' })
    }
  }

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '更新項目がありません' })
  }

  try {
    const updated = await prisma.customer.update({
      where: { id: customerId },
      data,
      select: { id: true, note: true, updatedAt: true },
    })
    return updated
  }
  catch (e) {
    const err = e as { code?: string }
    if (err.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '顧客が見つかりません' })
    }
    throw e
  }
})
