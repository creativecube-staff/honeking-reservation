<script setup lang="ts">
import type { PublicHoliday } from '@prisma/client'
import { createPublicHolidaySchema, updatePublicHolidaySchema } from '~~/shared/schemas/publicHoliday'

// 国民の祝日（全店共通）の管理パネル。
// 管理者(全店)モード専用ページ /dashboard/holidays から呼ばれる。
// 年フィルタ + 一覧 + 追加/編集モーダル + 削除確認。
// 影響: BusinessHour で dayOfWeek=-1 のレンジがあればそれを引き、無ければ日曜(0)にフォールバック。

// 全データを一度取得して、年プルダウンの選択肢はそこから実データの年だけを抽出する。
// （未登録の年を見せても意味がないので「2026 / 2027」のように登録済みの年のみ並べる）
const { data: allHolidays, refresh, error } = await useFetch<PublicHoliday[]>(
  '/api/admin/public-holidays',
  { default: () => [] as PublicHoliday[] },
)

// 登録済みの年（昇順）
const yearOptions = computed<number[]>(() => {
  const set = new Set<number>()
  for (const h of allHolidays.value ?? []) {
    set.add(new Date(h.date).getUTCFullYear())
  }
  return Array.from(set).sort((a, b) => a - b)
})

// 選択中の年。初期は現在年が登録済みならそれ、なければ最新の登録年。
const currentYear = new Date().getFullYear()
const year = ref<number | null>(null)
watchEffect(() => {
  if (year.value !== null && yearOptions.value.includes(year.value)) return
  if (yearOptions.value.length === 0) {
    year.value = null
    return
  }
  year.value = yearOptions.value.includes(currentYear)
    ? currentYear
    : yearOptions.value[yearOptions.value.length - 1]!
})

// 選択中の年で絞った一覧
const holidays = computed<PublicHoliday[]>(() => {
  if (year.value === null) return []
  return (allHolidays.value ?? []).filter(
    h => new Date(h.date).getUTCFullYear() === year.value,
  )
})

// ── 表示ヘルパ ──────────────────────────────────────
const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

function dayClass(d: Date): string {
  const dow = d.getUTCDay()
  if (dow === 0) return 'text-red-600'
  if (dow === 6) return 'text-blue-600'
  return ''
}

// ── 編集モーダル ────────────────────────────────────
type EditorMode = 'create' | 'edit'
const editorOpen = ref(false)
const editorMode = ref<EditorMode>('create')
const editingId = ref<number | null>(null)

const state = reactive<{ date: string, name: string, note: string }>({ date: '', name: '', note: '' })
const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

function resetForm() {
  state.date = ''
  state.name = ''
  state.note = ''
  fieldErrors.value = {}
  formError.value = null
}

function openCreate() {
  editorMode.value = 'create'
  editingId.value = null
  resetForm()
  editorOpen.value = true
}

function openEdit(h: PublicHoliday) {
  editorMode.value = 'edit'
  editingId.value = h.id
  // サーバ側は @db.Date で UTC 0 時として保存。ISO の先頭 10 文字でそのまま YYYY-MM-DD に。
  state.date = new Date(h.date).toISOString().slice(0, 10)
  state.name = h.name
  state.note = h.note ?? ''
  fieldErrors.value = {}
  formError.value = null
  editorOpen.value = true
}

async function onSave() {
  fieldErrors.value = {}
  formError.value = null

  const schema = editorMode.value === 'create' ? createPublicHolidaySchema : updatePublicHolidaySchema
  const payload = {
    date: state.date,
    name: state.name,
    note: state.note.trim() === '' ? null : state.note,
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!errors[key]) errors[key] = issue.message
    }
    fieldErrors.value = errors
    formError.value = '入力内容を確認してください'
    return
  }

  submitting.value = true
  try {
    if (editorMode.value === 'create') {
      await $fetch('/api/admin/public-holidays', { method: 'POST', body: parsed.data })
    }
    else if (editingId.value) {
      await $fetch(`/api/admin/public-holidays/${editingId.value}`, { method: 'PATCH', body: parsed.data })
    }
    editorOpen.value = false
    await refresh()
    // 追加/編集した日付の年に切り替えて、保存直後にその行が見えるようにする
    if (/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
      year.value = Number(state.date.slice(0, 4))
    }
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// ── 削除 ──────────────────────────────────────────
const busy = ref<number | null>(null)
async function onDelete(h: PublicHoliday) {
  if (!confirm(`${dateFmt.format(new Date(h.date))} の「${h.name}」を削除しますか？`)) return
  busy.value = h.id
  try {
    await $fetch(`/api/admin/public-holidays/${h.id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <div class="admin-public-holidays-panel">
    <!-- ツールバー: 年フィルタ(左) + 追加(右) -->
    <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="text-sm font-semibold text-slate-900">対象年</label>
        <select
          v-model.number="year"
          :disabled="yearOptions.length === 0"
          class="px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option v-if="yearOptions.length === 0" :value="null">
            —
          </option>
          <option v-for="y in yearOptions" :key="y" :value="y">
            {{ y }}年
          </option>
        </select>
        <span class="text-xs text-slate-500">
          ({{ holidays.length }} 件)
        </span>
      </div>

      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-sm shadow-sm whitespace-nowrap"
        @click="openCreate"
      >
        ＋ 祝日を追加
      </button>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`一覧の取得に失敗しました: ${error.message}`"
      class="mb-3"
    />

    <!-- 一覧テーブル（コンパクト・行アクションは別列でホバー時のみ表示） -->
    <div class="admin-table-wrap bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table
        class="admin-table w-full text-sm
          [&_th]:[border-right:1px_dotted_#c3c4c7] [&_td]:[border-right:1px_dotted_#c3c4c7]
          [&_th:last-child]:[border-right:none] [&_td:last-child]:[border-right:none]"
      >
        <thead class="admin-table-head bg-[#f6f7f7] text-slate-900">
          <tr class="admin-table-head-row">
            <th class="px-3 py-1.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap w-48">
              日付
            </th>
            <th class="px-3 py-1.5 text-left font-semibold border-b border-[#c3c4c7] w-48">
              名称
            </th>
            <th class="px-3 py-1.5 text-left font-semibold border-b border-[#c3c4c7]">
              メモ
            </th>
            <th class="px-3 py-1.5 text-right font-semibold border-b border-[#c3c4c7] w-28 whitespace-nowrap">
              アクション
            </th>
          </tr>
        </thead>
        <tbody class="admin-table-body">
          <tr v-if="holidays.length === 0" class="admin-table-empty">
            <td colspan="4" class="px-3 py-6 text-center text-slate-500">
              <template v-if="year !== null">
                {{ year }}年の祝日はまだ登録されていません。「＋ 祝日を追加」から登録してください。
              </template>
              <template v-else>
                祝日はまだ登録されていません。「＋ 祝日を追加」から登録してください。
              </template>
            </td>
          </tr>
          <tr
            v-for="h in holidays"
            :key="h.id"
            class="admin-table-row group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-1.5 align-middle">
              <span class="font-semibold tabular-nums" :class="dayClass(new Date(h.date))">
                {{ dateFmt.format(new Date(h.date)) }}
              </span>
            </td>
            <td class="px-3 py-1.5 align-middle text-slate-700">
              {{ h.name }}
            </td>
            <td class="px-3 py-1.5 align-middle text-slate-700">
              <span v-if="h.note">{{ h.note }}</span>
              <span v-else class="text-slate-300">—</span>
            </td>
            <td class="px-3 py-1.5 align-middle text-right text-xs whitespace-nowrap">
              <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  :disabled="busy === h.id"
                  class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
                  @click="openEdit(h)"
                >
                  編集
                </button>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  type="button"
                  :disabled="busy === h.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="onDelete(h)"
                >
                  削除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 追加/編集モーダル -->
    <UModal v-model:open="editorOpen">
      <template #content>
        <div class="bg-white p-5">
          <h2 class="text-lg font-semibold text-slate-900 mb-4">
            祝日を{{ editorMode === 'create' ? '追加' : '編集' }}
          </h2>

          <UAlert
            v-if="formError"
            color="error"
            icon="i-lucide-triangle-alert"
            :title="formError"
            class="mb-3"
          />

          <form class="space-y-4" @submit.prevent="onSave">
            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                日付 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="state.date"
                type="date"
                :class="[baseInput, fieldErrors.date && errInput]"
              >
              <p v-if="fieldErrors.date" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.date }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                名称 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="state.name"
                type="text"
                placeholder="例: 元日、成人の日、海の日 など"
                :class="[baseInput, fieldErrors.name && errInput]"
              >
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.name }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                メモ（任意）
              </label>
              <input
                v-model="state.note"
                type="text"
                placeholder="例: 振替休日、特別営業など"
                :class="[baseInput, fieldErrors.note && errInput]"
              >
              <p v-if="fieldErrors.note" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.note }}
              </p>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-[#dcdcde]">
              <button
                type="submit"
                :disabled="submitting"
                class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
              >
                {{ submitting ? '保存中...' : (editorMode === 'create' ? '追加' : '更新') }}
              </button>
              <button
                type="button"
                :disabled="submitting"
                class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
                @click="editorOpen = false"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
