import { Prisma } from '@prisma/client'
import { updateMenuSchema } from '../../../../../../shared/schemas/menu'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const storeId = Number(getRouterParam(event, 'id'))
  const menuId = Number(getRouterParam(event, 'menuId'))
  if (!Number.isInteger(storeId) || storeId <= 0 || !Number.isInteger(menuId) || menuId <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateMenuSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const menu = await prisma.menu.findFirst({ where: { id: menuId, storeId }, select: { id: true } })
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'メニューが見つかりません' })
  }

  // excludedStoreIds は共通メニュー専用なので店舗特別メニューでは無視
  const { availableFrom, availableUntil, excludedStoreIds, replacesMenuId, ...rest } = parsed.data
  void excludedStoreIds

  // 差し替え対象が更新で指定されたら有効な共通メニューであることを確認（null へのクリアは許可）
  if (replacesMenuId != null) {
    if (replacesMenuId === menuId) {
      throw createError({ statusCode: 400, statusMessage: '自分自身を差し替え対象にすることはできません' })
    }
    const target = await prisma.menu.findFirst({
      where: { id: replacesMenuId, storeId: null },
      select: { id: true },
    })
    if (!target) {
      throw createError({ statusCode: 400, statusMessage: '差し替え対象には有効な共通メニューを指定してください' })
    }
  }

  const data: Prisma.MenuUpdateInput = { ...rest }
  if (availableFrom !== undefined) {
    data.availableFrom = availableFrom == null ? null : new Date(availableFrom)
  }
  if (availableUntil !== undefined) {
    data.availableUntil = availableUntil == null ? null : new Date(availableUntil)
  }
  // replacesMenuId は更新時に明示的に送られたときだけ反映（null クリアも許可、未送信なら触らない）
  if (replacesMenuId !== undefined) {
    data.replaces = replacesMenuId == null ? { disconnect: true } : { connect: { id: replacesMenuId } }
  }

  try {
    return await prisma.menu.update({ where: { id: menuId }, data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: '同名のメニューがすでに存在します' })
    }
    throw e
  }
})
