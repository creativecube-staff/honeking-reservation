import { z } from 'zod'

// 単発作成・編集の共通フィールド（編集時に未送信フィールドは partial で許容）
export const menuBaseSchema = z.object({
  name: z.string().min(1, 'メニュー名は必須です').max(100, '100 文字以内で入力してください'),
  durationMinutes: z.number().int().min(5, '5 分以上で入力してください').max(600, '600 分以下で入力してください'),
  priceJpy: z.number().int().min(0, '0 円以上で入力してください').max(1000000, '上限を超えています'),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
})

export const createMenuSchema = menuBaseSchema.extend({
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
})

export const updateMenuSchema = menuBaseSchema.partial()

export type MenuFormState = z.input<typeof menuBaseSchema>
export type CreateMenuInput = z.input<typeof createMenuSchema>
export type UpdateMenuInput = z.input<typeof updateMenuSchema>
