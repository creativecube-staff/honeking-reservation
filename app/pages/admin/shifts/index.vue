<script setup lang="ts">
import type { Practitioner, Shift, Store } from '@prisma/client'

definePageMeta({ layout: 'admin' })

type StaffWithStore = Practitioner & { store: Pick<Store, 'id' | 'name'> }
type ShiftWithJoins = Shift & {
  practitioner: StaffWithStore
  workStore: Pick<Store, 'id' | 'name'> | null
}

const route = useRoute()
const router = useRouter()

// ── 日付管理 ──────────────────────────────────────────
function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const date = computed<string>({
  get() {
    const q = String(route.query.date ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayYmd()
  },
  set(v) {
    router.replace({ query: { ...route.query, date: v } })
  },
})

function shiftDate(deltaDays: number) {
  const [y, m, d] = date.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  dt.setDate(dt.getDate() + deltaDays)
  const ny = dt.getFullYear()
  const nm = String(dt.getMonth() + 1).padStart(2, '0')
  const nd = String(dt.getDate()).padStart(2, '0')
  date.value = `${ny}-${nm}-${nd}`
}

const dateLabel = computed(() => {
  const [y, m, d] = date.value.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${y}年${m}月${d}日 (${dow})`
})

// ── データ取得 ─────────────────────────────────────────
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})
const { data: staffList } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'active' },
})
const { data: shifts, refresh: refreshShifts } = await useFetch<ShiftWithJoins[]>('/api/admin/shifts', {
  query: { date },
  watch: [date],
})

// 既存シフトを practitionerId をキーに引けるようにする
const shiftByPractitioner = computed(() => {
  const map = new Map<number, ShiftWithJoins>()
  for (const s of shifts.value ?? []) map.set(s.practitionerId, s)
  return map
})

// ── 行の編集ステート ────────────────────────────────────
type RowState = {
  startTime: string
  endTime: string
  workStoreId: number | null
}
const rowStates = reactive<Record<number, RowState>>({})

watchEffect(() => {
  const list = staffList.value ?? []
  for (const s of list) {
    const existing = shiftByPractitioner.value.get(s.id)
    rowStates[s.id] = {
      startTime: existing?.startTime ?? '09:30',
      endTime: existing?.endTime ?? '20:30',
      workStoreId: existing?.workStoreId ?? null,
    }
  }
})

const busy = ref<number | null>(null)
const rowError = ref<{ id: number, message: string } | null>(null)

async function onSave(staff: StaffWithStore) {
  rowError.value = null
  const row = rowStates[staff.id]
  if (!row) return
  busy.value = staff.id
  try {
    await $fetch('/api/admin/shifts', {
      method: 'POST',
      body: {
        practitionerId: staff.id,
        date: date.value,
        startTime: row.startTime,
        endTime: row.endTime,
        workStoreId: row.workStoreId,
      },
    })
    await refreshShifts()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    rowError.value = { id: staff.id, message: err.data?.statusMessage || err.statusMessage || '保存に失敗しました' }
  }
  finally {
    busy.value = null
  }
}

async function onDelete(staff: StaffWithStore) {
  const existing = shiftByPractitioner.value.get(staff.id)
  if (!existing) return
  if (!confirm(`${staff.name} の ${dateLabel.value} のシフトを削除しますか？`)) return
  busy.value = staff.id
  try {
    await $fetch(`/api/admin/shifts/${existing.id}`, { method: 'DELETE' })
    await refreshShifts()
  }
  finally {
    busy.value = null
  }
}

// メイン店舗ごとにグルーピング表示
const grouped = computed(() => {
  const map = new Map<number, { store: { id: number, name: string }, items: StaffWithStore[] }>()
  for (const s of staffList.value ?? []) {
    if (!map.has(s.storeId)) map.set(s.storeId, { store: s.store, items: [] })
    map.get(s.storeId)!.items.push(s)
  }
  return Array.from(map.values())
})

const baseInput = 'w-full px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        シフト管理
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      日付を選んで、各スタッフの出勤時刻・退勤時刻・勤務店舗（ヘルプ先）を設定します。
    </p>

    <!-- 日付ナビゲーション -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap">
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        @click="shiftDate(-1)"
      >
        ← 前日
      </button>
      <input
        v-model="date"
        type="date"
        class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
      >
      <span class="text-sm font-semibold text-slate-900">{{ dateLabel }}</span>
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
        @click="shiftDate(1)"
      >
        翌日 →
      </button>
      <button
        type="button"
        class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
        @click="date = todayYmd()"
      >
        今日
      </button>
    </div>

    <div v-if="(staffList ?? []).length === 0" class="bg-white border border-[#c3c4c7] rounded-sm p-6 text-center text-slate-600">
      まだスタッフが登録されていません。
      <NuxtLink to="/admin/staff/new" class="text-blue-700 hover:text-blue-900 hover:underline">
        スタッフを追加する →
      </NuxtLink>
    </div>

    <!-- メイン店舗ごとにグルーピング -->
    <div v-for="g in grouped" :key="g.store.id" class="mb-6">
      <h2 class="text-base font-semibold text-slate-900 mb-2">
        {{ g.store.name }}
      </h2>
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[#f6f7f7] text-slate-900">
            <tr>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] w-40">
                スタッフ
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] w-28">
                出勤
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] w-28">
                退勤
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                勤務店舗
              </th>
              <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] w-44">
                アクション
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="staff in g.items"
              :key="staff.id"
              class="border-b border-[#f0f0f1] last:border-b-0 align-top"
            >
              <td class="px-3 py-2.5 font-medium text-slate-900">
                {{ staff.name }}
                <span v-if="!shiftByPractitioner.get(staff.id)" class="block text-xs text-slate-500 font-normal mt-0.5">
                  シフト未設定
                </span>
              </td>
              <td class="px-3 py-2.5">
                <input
                  v-if="rowStates[staff.id]"
                  v-model="rowStates[staff.id]!.startTime"
                  type="time"
                  step="900"
                  :class="baseInput"
                >
              </td>
              <td class="px-3 py-2.5">
                <input
                  v-if="rowStates[staff.id]"
                  v-model="rowStates[staff.id]!.endTime"
                  type="time"
                  step="900"
                  :class="baseInput"
                >
              </td>
              <td class="px-3 py-2.5">
                <select
                  v-if="rowStates[staff.id]"
                  v-model.number="rowStates[staff.id]!.workStoreId"
                  :class="baseInput"
                >
                  <option :value="null">
                    メイン店舗（{{ staff.store.name }}）
                  </option>
                  <option
                    v-for="store in (stores ?? []).filter(s => s.id !== staff.storeId)"
                    :key="store.id"
                    :value="store.id"
                  >
                    ヘルプ: {{ store.name }}
                  </option>
                </select>
                <p
                  v-if="rowError && rowError.id === staff.id"
                  class="mt-1 text-xs text-red-700"
                >
                  {{ rowError.message }}
                </p>
              </td>
              <td class="px-3 py-2.5 text-right space-x-2 whitespace-nowrap">
                <button
                  type="button"
                  :disabled="busy === staff.id"
                  class="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-semibold rounded-sm shadow-sm"
                  @click="onSave(staff)"
                >
                  {{ busy === staff.id ? '...' : '保存' }}
                </button>
                <button
                  v-if="shiftByPractitioner.get(staff.id)"
                  type="button"
                  :disabled="busy === staff.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400 text-xs"
                  @click="onDelete(staff)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
