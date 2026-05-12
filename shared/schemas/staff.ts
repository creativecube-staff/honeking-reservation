import { z } from 'zod'
import { ALL_PERMISSIONS, ROLES } from '../permissions'

// Practitioner（管理画面では「スタッフ」と呼ぶ）の共通バリデーション。
// メイン所属店舗 storeId は必須。シフトで日単位の他店舗ヘルプは Shift.workStoreId で許容。
//
// 「ログイン可能か」「予約に割り当てるか」を独立して持つことで、施術しない受付や、
// 施術専門でログインしないスタッフをひとつのモデルで扱う。
const usernameRegex = /^[a-zA-Z0-9_-]+$/

export const staffBaseSchema = z.object({
  storeId: z.number().int().min(1, 'メイン所属店舗を選んでください'),
  name: z.string().min(1, 'スタッフ名は必須です').max(100, '100 文字以内で入力してください'),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  isAssignable: z.boolean(),
  canLogin: z.boolean(),
  // canLogin = true の場合のみ実際に使われるフィールド
  username: z.string().min(3, 'ユーザー名は 3 文字以上').max(32, '32 文字以内')
    .regex(usernameRegex, '半角英数と _ - のみ使用できます').optional().or(z.literal('')),
  role: z.enum(ROLES).nullable().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
}).superRefine((data, ctx) => {
  if (data.canLogin) {
    if (!data.username || data.username.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['username'], message: 'ログイン許可時はユーザー名が必須です' })
    }
    if (!data.role) {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'ログイン許可時は役職が必須です' })
    }
  }
})

// 新規作成: canLogin = true なら password 必須
export const createStaffSchema = z.object({
  storeId: z.number().int().min(1, 'メイン所属店舗を選んでください'),
  name: z.string().min(1, 'スタッフ名は必須です').max(100, '100 文字以内で入力してください'),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  isAssignable: z.boolean().default(true),
  canLogin: z.boolean().default(false),
  username: z.string().min(3, 'ユーザー名は 3 文字以上').max(32, '32 文字以内')
    .regex(usernameRegex, '半角英数と _ - のみ使用できます').optional().or(z.literal('')),
  role: z.enum(ROLES).nullable().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).default([]),
  password: z.string().min(8, 'パスワードは 8 文字以上').max(128, '128 文字以内').optional().or(z.literal('')),
}).superRefine((data, ctx) => {
  if (data.canLogin) {
    if (!data.username || data.username.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['username'], message: 'ログイン許可時はユーザー名が必須です' })
    }
    if (!data.role) {
      ctx.addIssue({ code: 'custom', path: ['role'], message: 'ログイン許可時は役職が必須です' })
    }
    if (!data.password || data.password.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['password'], message: 'ログイン許可時は初期パスワードが必須です' })
    }
  }
})

// 更新: 全フィールド任意。canLogin を true に切り替える場合は username/role が必要。
// パスワード変更は別 API（/staff/:id/password）を使う。
export const updateStaffSchema = z.object({
  storeId: z.number().int().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  isAssignable: z.boolean().optional(),
  canLogin: z.boolean().optional(),
  username: z.string().min(3).max(32).regex(usernameRegex).optional().or(z.literal('')),
  role: z.enum(ROLES).nullable().optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'パスワードは 8 文字以上').max(128, '128 文字以内'),
})

export type StaffFormState = z.input<typeof staffBaseSchema>
export type CreateStaffInput = z.input<typeof createStaffSchema>
export type UpdateStaffInput = z.input<typeof updateStaffSchema>
