<script setup lang="ts">
import type { Practitioner, Shift, Store } from '@prisma/client'
import type { CalendarColumn, CalendarRange } from '../../Calendar/types'

type StaffWithStore = Practitioner & { store: Pick<Store, 'id' | 'name'> }
type ShiftWithJoins = Shift & {
  practitioner: StaffWithStore
  workStore: Pick<Store, 'id' | 'name'> | null
}

const props = defineProps<{
  date: string // YYYY-MM-DD
}>()

// ── データ取得 ─────────────────────────────────────────
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})
const { data: staffList } = await useFetch<StaffWithStore[]>('/api/admin/staff', {
  query: { status: 'active' },
})
const { data: shifts, refresh: refreshShifts } = await useFetch<ShiftWithJoins[]>(
  '/api/admin/shifts',
  {
    query: { date: () => props.date },
    watch: [() => props.date],
  },
)

// ── 表示モード（店舗別 / スタッフ別）切替 ─────────────────
type GroupMode = 'store' | 'staff'
const route = useRoute()
const router = useRouter()
const groupMode = computed<GroupMode>({
  get() {
    return route.query.group === 'staff' ? 'staff' : 'store'
  },
  set(v) {
    router.replace({ query: { ...route.query, group: v } })
  },
})

// ── ranges 構築（バー本体）─────────────────────────────
// columnId は practitionerId（数値）。1 スタッフ = 1 列
const ranges = ref<CalendarRange[]>([])
// shift id → workStoreId を保持（ヘルプ先判定用）
const shiftMeta = reactive<Map<number, { id: number, workStoreId: number | null }>>(new Map())

watchEffect(() => {
  const list = shifts.value ?? []
  ranges.value = list.map(s => ({
    id: `shift-${s.id}`,
    columnId: s.practitionerId,
    startTime: s.startTime,
    endTime: s.endTime,
  }))
  shiftMeta.clear()
  for (const s of list) {
    shiftMeta.set(s.practitionerId, { id: s.id, workStoreId: s.workStoreId })
  }
})

function getShiftMeta(practitionerId: number) {
  return shiftMeta.get(practitionerId)
}

// ── columns 構築（グルーピング）─────────────────────────
// 店舗別: 各店舗ごとにメイン所属スタッフを列として並べる
// スタッフ別: 全スタッフを 1 つのカレンダーに
type Group = { store: { id: number, name: string }, columns: CalendarColumn[] }

const storeBased = computed<Group[]>(() => {
  const list = staffList.value ?? []
  const map = new Map<number, Group>()
  for (const s of list) {
    if (!map.has(s.storeId)) {
      map.set(s.storeId, { store: s.store, columns: [] })
    }
    map.get(s.storeId)!.columns.push({
      id: s.id,
      label: s.name,
    })
  }
  return Array.from(map.values())
})

const allStaffColumns = computed<CalendarColumn[]>(() => {
  const list = staffList.value ?? []
  return list.map(s => ({
    id: s.id,
    label: s.name,
    subLabel: s.store.name,
  }))
})

// ── ranges を column 群でフィルタ ─────────────────────
function rangesFor(columns: CalendarColumn[]): CalendarRange[] {
  const ids = new Set(columns.map(c => c.id))
  return ranges.value.filter(r => ids.has(r.columnId))
}

// ── 保存処理（API POST upsert）──────────────────────────
async function saveShift(practitionerId: number, startTime: string, endTime: string, workStoreId: number | null) {
  await $fetch('/api/admin/shifts', {
    method: 'POST',
    body: {
      practitionerId,
      date: props.date,
      startTime,
      endTime,
      workStoreId,
    },
  })
}

async function deleteShift(shiftId: number) {
  await $fetch(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' })
}

// ── イベントハンドラ ─────────────────────────────────────
const errorMessage = ref<string | null>(null)

async function onRangeCreate(r: CalendarRange) {
  errorMessage.value = null
  try {
    await saveShift(Number(r.columnId), r.startTime, r.endTime, null)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの作成に失敗しました')
    await refreshShifts()
  }
}

async function onRangeUpdate(r: CalendarRange) {
  errorMessage.value = null
  // 既存シフトの workStoreId を保持
  const meta = getShiftMeta(Number(r.columnId))
  try {
    await saveShift(Number(r.columnId), r.startTime, r.endTime, meta?.workStoreId ?? null)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの更新に失敗しました')
    await refreshShifts()
  }
}

async function onRangeDelete(id: string) {
  errorMessage.value = null
  if (!id.startsWith('shift-')) return
  const shiftId = Number(id.slice('shift-'.length))
  if (!Number.isInteger(shiftId)) return
  try {
    await deleteShift(shiftId)
    await refreshShifts()
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'シフトの削除に失敗しました')
    await refreshShifts()
  }
}

function errMsg(e: unknown, fallback: string) {
  const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
  return err.data?.statusMessage || err.statusMessage || fallback
}

// ── ヘルプ先選択ポップオーバー ─────────────────────────
const helpPopover = ref<{
  practitionerId: number
  staffName: string
  mainStoreId: number
  currentWorkStoreId: number | null
} | null>(null)

const helpPopoverOpen = computed({
  get: () => helpPopover.value !== null,
  set: (v: boolean) => { if (!v) helpPopover.value = null },
})

function onRangeClick(r: CalendarRange) {
  const practitionerId = Number(r.columnId)
  const staff = (staffList.value ?? []).find(s => s.id === practitionerId)
  if (!staff) return
  const meta = getShiftMeta(practitionerId)
  helpPopover.value = {
    practitionerId,
    staffName: staff.name,
    mainStoreId: staff.storeId,
    currentWorkStoreId: meta?.workStoreId ?? null,
  }
}

async function applyHelpStore(workStoreId: number | null) {
  const p = helpPopover.value
  if (!p) return
  const r = ranges.value.find(x => x.columnId === p.practitionerId)
  if (!r) return
  errorMessage.value = null
  try {
    await saveShift(p.practitionerId, r.startTime, r.endTime, workStoreId)
    await refreshShifts()
    helpPopover.value = null
  }
  catch (e) {
    errorMessage.value = errMsg(e, 'ヘルプ先の更新に失敗しました')
  }
}

// ── 列ヘッダーにヘルプ表示 ─────────────────────────────
function headerNoteFor(practitionerId: number): string | null {
  const meta = getShiftMeta(practitionerId)
  if (!meta || meta.workStoreId == null) return null
  const store = (stores.value ?? []).find(s => s.id === meta.workStoreId)
  return store ? `→ ${store.name}` : 'ヘルプ'
}
</script>

<template>
  <div class="space-y-4">
    <!-- 表示モード切替 -->
    <div class="flex items-center gap-3">
      <span class="text-xs font-semibold text-slate-700">表示:</span>
      <div class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm">
        <button
          type="button"
          class="px-3 py-1"
          :class="groupMode === 'store' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
          @click="groupMode = 'store'"
        >
          店舗別
        </button>
        <button
          type="button"
          class="px-3 py-1 border-l border-[#8c8f94]"
          :class="groupMode === 'staff' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
          @click="groupMode = 'staff'"
        >
          スタッフ別
        </button>
      </div>
      <p class="text-xs text-slate-500">
        空白部分を縦にドラッグして出勤時間を作成。バーをクリックでヘルプ先を切替。
      </p>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
    />

    <!-- 店舗別 -->
    <template v-if="groupMode === 'store'">
      <div
        v-for="g in storeBased"
        :key="g.store.id"
        class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        <div class="px-4 py-2.5 border-b border-[#dcdcde]">
          <h3 class="text-sm font-semibold text-slate-900">
            {{ g.store.name }}
          </h3>
        </div>
        <CalendarTimeColumnCalendar
          :ranges="rangesFor(g.columns)"
          :columns="g.columns"
          :max-ranges-per-column="1"
          empty-label="未出勤"
          @update:ranges="(v) => { ranges = [...ranges.filter(r => !g.columns.some(c => c.id === r.columnId)), ...v] }"
          @range-create="onRangeCreate"
          @range-update="onRangeUpdate"
          @range-delete="onRangeDelete"
          @range-click="onRangeClick"
        >
          <template #column-header="{ column }">
            <span>{{ column.label }}</span>
            <span
              v-if="headerNoteFor(Number(column.id))"
              class="text-[9px] font-normal text-purple-700"
            >
              {{ headerNoteFor(Number(column.id)) }}
            </span>
          </template>
        </CalendarTimeColumnCalendar>
      </div>
    </template>

    <!-- スタッフ別 -->
    <div
      v-else
      class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
    >
      <div class="px-4 py-2.5 border-b border-[#dcdcde]">
        <h3 class="text-sm font-semibold text-slate-900">
          全スタッフ
        </h3>
      </div>
      <CalendarTimeColumnCalendar
        v-model:ranges="ranges"
        :columns="allStaffColumns"
        :max-ranges-per-column="1"
        empty-label="未出勤"
        @range-create="onRangeCreate"
        @range-update="onRangeUpdate"
        @range-delete="onRangeDelete"
        @range-click="onRangeClick"
      >
        <template #column-header="{ column }">
          <span>{{ column.label }}</span>
          <span class="text-[9px] font-normal text-slate-500">
            {{ column.subLabel }}<template v-if="headerNoteFor(Number(column.id))"> {{ headerNoteFor(Number(column.id)) }}</template>
          </span>
        </template>
      </CalendarTimeColumnCalendar>
    </div>

    <!-- ヘルプ先選択ポップオーバー（モーダル） -->
    <UModal v-model:open="helpPopoverOpen">
      <template #content>
        <div v-if="helpPopover" class="bg-white p-5">
          <h2 class="text-base font-semibold text-slate-900 mb-3">
            {{ helpPopover.staffName }} の勤務先
          </h2>
          <p class="text-xs text-slate-600 mb-3">
            メイン所属店舗で勤務するか、別店舗にヘルプに行くかを選択します。
          </p>
          <div class="space-y-2">
            <button
              type="button"
              class="w-full text-left px-3 py-2 border rounded-sm hover:bg-[#f6f7f7]"
              :class="helpPopover.currentWorkStoreId === null ? 'border-orange-500 bg-orange-50' : 'border-[#c3c4c7]'"
              @click="applyHelpStore(null)"
            >
              <span class="text-sm font-semibold text-slate-900">
                メイン店舗で勤務
              </span>
              <span class="block text-xs text-slate-600 mt-0.5">
                ({{ (stores ?? []).find(s => s.id === helpPopover!.mainStoreId)?.name }})
              </span>
            </button>
            <button
              v-for="store in (stores ?? []).filter(s => s.id !== helpPopover!.mainStoreId)"
              :key="store.id"
              type="button"
              class="w-full text-left px-3 py-2 border rounded-sm hover:bg-[#f6f7f7]"
              :class="helpPopover.currentWorkStoreId === store.id ? 'border-orange-500 bg-orange-50' : 'border-[#c3c4c7]'"
              @click="applyHelpStore(store.id)"
            >
              <span class="text-sm font-semibold text-slate-900">
                ヘルプ: {{ store.name }}
              </span>
              <span class="block text-xs text-slate-600 mt-0.5">
                この日だけ他店舗で勤務
              </span>
            </button>
          </div>
          <div class="flex justify-end mt-4">
            <button
              type="button"
              class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
              @click="helpPopover = null"
            >
              キャンセル
            </button>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

