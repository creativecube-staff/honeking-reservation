import { z } from 'zod'

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// 1 つの営業時間レンジ（1 日に複数持てる）
export const businessHourRangeSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(timeRegex, 'HH:MM 形式'),
    endTime: z.string().regex(timeRegex, 'HH:MM 形式'),
  })
  .refine(d => d.startTime < d.endTime, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['endTime'],
  })

// 1 店舗の 7 曜日分まとめての upsert
// 各レンジは独立した行。店休 = その dayOfWeek にレンジが 0 件
// 同一日内のレンジ重複はサーバー側で検証
export const businessHoursBulkSchema = z.object({
  ranges: z.array(businessHourRangeSchema),
})

export type BusinessHourRangeInput = z.input<typeof businessHourRangeSchema>
export type BusinessHoursBulkInput = z.input<typeof businessHoursBulkSchema>
