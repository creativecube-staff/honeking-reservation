import { z } from 'zod'
import { ROLES } from '../permissions'

// Staff（店舗で働く人）の共通バリデーション。
// Login（管理画面ログインアカウント）とは完全に別物。
// 項目: name / gender / role / displayOrder / assignOrder / baseShiftDays / isActive / isAssignable
//
//   - role        : 役職の表示用ラベル（Login.role と異なり認証・権限とは無関係）
//   - displayOrder: 一覧表示の並び順
//   - assignOrder : 予約自動割当の優先順位

// 性別。null も許容（未設定）。
const genderEnum = z.enum(['MALE', 'FEMALE'])

// 役職。表示用なので OWNER も型上は許容するが、UI 側でフィルタする想定。
const roleEnum = z.enum(ROLES)

// 基本シフト（出勤曜日のセット）。-1=祝日, 0=日, ... 6=土。重複や範囲外を排除して昇順に正規化。
// 祝日(-1) を含まないスタッフは、祝日に対しては日曜(0)の出勤可否にフォールバックする。
const baseShiftDaysSchema = z.array(z.number().int().min(-1).max(6)).transform((arr) => {
  const set = new Set(arr)
  return Array.from(set).sort((a, b) => a - b)
})

// 新規作成スキーマ。storeId 必須、isActive / isAssignable はデフォルト true。
export const createStaffSchema = z.object({
  storeId: z.number().int().min(1, '所属店舗を選んでください'),
  name: z.string().min(1, 'スタッフ名は必須です').max(100, '100 文字以内で入力してください'),
  gender: genderEnum.nullable().optional(),
  role: roleEnum.nullable().optional(),
  baseShiftDays: baseShiftDaysSchema.default([]),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  assignOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  isAssignable: z.boolean().default(true),
})

// 編集スキーマ。全フィールド任意（部分更新）。
export const updateStaffSchema = z.object({
  storeId: z.number().int().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  gender: genderEnum.nullable().optional(),
  role: roleEnum.nullable().optional(),
  baseShiftDays: baseShiftDaysSchema.optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  assignOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
  isAssignable: z.boolean().optional(),
})

export type CreateStaffInput = z.input<typeof createStaffSchema>
export type UpdateStaffInput = z.input<typeof updateStaffSchema>
