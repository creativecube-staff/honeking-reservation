import { z } from 'zod'

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// 1 曜日分のスキーマ
export const businessHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    isClosed: z.boolean(),
    openTime: z.string().regex(timeRegex, 'HH:MM 形式').nullable(),
    closeTime: z.string().regex(timeRegex, 'HH:MM 形式').nullable(),
    breakStartTime: z.string().regex(timeRegex, 'HH:MM 形式').nullable(),
    breakEndTime: z.string().regex(timeRegex, 'HH:MM 形式').nullable(),
  })
  .refine(d => d.isClosed || (d.openTime && d.closeTime), {
    message: '営業日は開店・閉店時刻が必須です',
    path: ['openTime'],
  })
  .refine(d => d.isClosed || !d.openTime || !d.closeTime || d.openTime < d.closeTime, {
    message: '閉店時刻は開店時刻より後にしてください',
    path: ['closeTime'],
  })
  .refine(
    d => !d.breakStartTime === !d.breakEndTime,
    { message: '休憩開始・終了は両方指定してください', path: ['breakEndTime'] },
  )
  .refine(
    d => !d.breakStartTime || !d.breakEndTime || d.breakStartTime < d.breakEndTime,
    { message: '休憩終了は休憩開始より後にしてください', path: ['breakEndTime'] },
  )

// 7 曜日まとめての upsert
export const businessHoursBulkSchema = z.object({
  hours: z.array(businessHourSchema).length(7, '7 曜日分すべて指定してください'),
})

export type BusinessHourInput = z.input<typeof businessHourSchema>
export type BusinessHoursBulkInput = z.input<typeof businessHoursBulkSchema>
