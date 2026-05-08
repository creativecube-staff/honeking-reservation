import { z } from 'zod'

// Practitioner（管理画面では「スタッフ」と呼ぶ）の共通バリデーション。
// メイン所属店舗 storeId は必須。シフトで日単位の他店舗ヘルプは Shift.workStoreId で許容。
export const staffBaseSchema = z.object({
  storeId: z.number().int().min(1, 'メイン所属店舗を選んでください'),
  name: z.string().min(1, 'スタッフ名は必須です').max(100, '100 文字以内で入力してください'),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
})

export const createStaffSchema = staffBaseSchema.extend({
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
})

export const updateStaffSchema = staffBaseSchema.partial()

export type StaffFormState = z.input<typeof staffBaseSchema>
export type CreateStaffInput = z.input<typeof createStaffSchema>
export type UpdateStaffInput = z.input<typeof updateStaffSchema>
