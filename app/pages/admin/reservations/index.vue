<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()

type Store = { id: number, name: string }
type Reservation = {
  id: number
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  confirmationCode: string
  startAt: string
  endAt: string
  note: string | null
  store: { id: number, name: string }
  bed: { id: number, name: string }
  practitioner: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
}
type ListResponse = {
  items: Reservation[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

// ── URL クエリ <-> state ─────────────────────────────
const storeIdFilter = computed<number | null>({
  get() {
    const q = Number(route.query.storeId)
    return Number.isInteger(q) && q > 0 ? q : null
  },
  set(v) {
    router.replace({ query: { ...route.query, storeId: v == null ? undefined : String(v), page: undefined } })
  },
})

const statusFilter = computed<string>({
  get() {
    const q = String(route.query.status ?? '')
    return ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(q) ? q : ''
  },
  set(v) {
    router.replace({ query: { ...route.query, status: v || undefined, page: undefined } })
  },
})

function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const fromFilter = computed<string>({
  get() {
    const q = String(route.query.from ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ''
  },
  set(v) {
    router.replace({ query: { ...route.query, from: v || undefined, page: undefined } })
  },
})

const toFilter = computed<string>({
  get() {
    const q = String(route.query.to ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ''
  },
  set(v) {
    router.replace({ query: { ...route.query, to: v || undefined, page: undefined } })
  },
})

const qFilter = computed<string>({
  get() {
    return String(route.query.q ?? '')
  },
  set(v) {
    router.replace({ query: { ...route.query, q: v || undefined, page: undefined } })
  },
})

const pageNum = computed<number>({
  get() {
    const q = Number(route.query.page)
    return Number.isInteger(q) && q > 0 ? q : 1
  },
  set(v) {
    router.replace({ query: { ...route.query, page: String(v) } })
  },
})

// 検索入力（即時反映ではなくボタン押下で反映）
const qInput = ref(qFilter.value)
watch(qFilter, v => { qInput.value = v })

function applySearch() {
  qFilter.value = qInput.value.trim()
}

// ── データ ──────────────────────────────────────────
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'active' },
})

const { data, status, refresh } = await useFetch<ListResponse>('/api/admin/reservations', {
  query: computed(() => ({
    storeId: storeIdFilter.value ?? undefined,
    status: statusFilter.value || undefined,
    from: fromFilter.value || undefined,
    to: toFilter.value || undefined,
    q: qFilter.value || undefined,
    page: pageNum.value,
    pageSize: 50,
  })),
  watch: [storeIdFilter, statusFilter, fromFilter, toFilter, qFilter, pageNum],
})

// ── 表示ヘルパ ───────────────────────────────────────
function fmtJstDateTime(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth() + 1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}
function fmtJstTime(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}

function statusBadge(status: string): { label: string, class: string } {
  switch (status) {
    case 'CONFIRMED':
      return { label: '予約済', class: 'bg-green-100 text-green-800 border-green-300' }
    case 'CANCELLED':
      return { label: 'キャンセル', class: 'bg-slate-100 text-slate-500 border-slate-300 line-through' }
    case 'COMPLETED':
      return { label: '完了', class: 'bg-blue-100 text-blue-800 border-blue-300' }
    case 'NO_SHOW':
      return { label: '無断キャンセル', class: 'bg-red-100 text-red-800 border-red-300' }
    default:
      return { label: status, class: 'bg-slate-100 text-slate-700 border-slate-300' }
  }
}

function clearFilters() {
  router.replace({ query: {} })
  qInput.value = ''
}

function goPage(p: number) {
  if (p < 1) return
  if (data.value && p > data.value.totalPages) return
  pageNum.value = p
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-2xl font-semibold text-slate-900">
        予約管理
      </h1>
      <NuxtLink
        to="/admin/reservations/new"
        class="ml-auto px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-sm inline-flex items-center gap-1"
      >
        <UIcon name="i-lucide-plus" class="size-4" />
        手動で予約を追加
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      お客様側で取られた予約と、管理画面から手動で入力した予約を一覧で確認・操作します。
    </p>

    <!-- フィルター -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">店舗</label>
        <select
          :value="storeIdFilter ?? ''"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
          @change="storeIdFilter = Number(($event.target as HTMLSelectElement).value) || null"
        >
          <option value="">
            すべて
          </option>
          <option v-for="s in (stores ?? [])" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">ステータス</label>
        <select
          v-model="statusFilter"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
          <option value="">
            すべて
          </option>
          <option value="CONFIRMED">
            予約済
          </option>
          <option value="COMPLETED">
            完了
          </option>
          <option value="NO_SHOW">
            無断キャンセル
          </option>
          <option value="CANCELLED">
            キャンセル
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">開始日</label>
        <input
          v-model="fromFilter"
          type="date"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
        >
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">終了日</label>
        <input
          v-model="toFilter"
          type="date"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
        >
      </div>
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-semibold text-slate-700 mb-1">
          検索（顧客名・電話・メール・予約番号）
        </label>
        <div class="flex gap-2">
          <input
            v-model="qInput"
            type="text"
            class="flex-1 px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
            placeholder="山田太郎 / 090- / @ / K3F8X2A7"
            @keydown.enter="applySearch"
          >
          <button
            type="button"
            class="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-sm"
            @click="applySearch"
          >
            検索
          </button>
        </div>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-sm"
        @click="clearFilters"
      >
        条件クリア
      </button>
    </div>

    <!-- 件数・ページ送り上部 -->
    <div class="flex items-center justify-between mb-2 text-sm">
      <p class="text-slate-600">
        <span v-if="status === 'pending'">読み込み中...</span>
        <span v-else-if="data">
          全 <strong class="tabular-nums">{{ data.total }}</strong> 件 / {{ data.page }} / {{ data.totalPages }} ページ
        </span>
      </p>
      <button
        type="button"
        class="text-xs text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        @click="refresh()"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-3" />
        再読み込み
      </button>
    </div>

    <!-- テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm border-collapse min-w-[920px]">
        <thead class="bg-[#f6f7f7]">
          <tr>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">予約番号</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">日時</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">店舗</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">お客様</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">メニュー</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">担当 / ベッド</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">状態</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending'">
            <td colspan="7" class="px-3 py-10 text-center text-slate-500">
              読み込み中...
            </td>
          </tr>
          <tr v-else-if="!data || data.items.length === 0">
            <td colspan="7" class="px-3 py-10 text-center text-slate-500">
              該当する予約はありません
            </td>
          </tr>
          <tr
            v-for="r in (data?.items ?? [])"
            v-else
            :key="r.id"
            class="hover:bg-orange-50/40 cursor-pointer"
            @click="router.push(`/admin/reservations/${r.id}`)"
          >
            <td class="px-3 py-2 border-b border-[#dcdcde] tabular-nums font-mono text-xs">
              {{ r.confirmationCode }}
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde] tabular-nums">
              <span class="font-semibold">{{ fmtJstDateTime(r.startAt) }}</span>
              <span class="text-slate-500 text-xs">–{{ fmtJstTime(r.endAt) }}</span>
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde]">
              {{ r.store.name }}
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde]">
              <div class="font-medium">{{ r.customer.name ?? '(復号失敗)' }}</div>
              <div v-if="r.customer.phone" class="text-xs text-slate-500">{{ r.customer.phone }}</div>
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde]">
              {{ r.menu.name }}
              <span class="text-xs text-slate-500">({{ r.menu.durationMinutes }}分)</span>
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde] text-xs">
              {{ r.practitioner.name }}<br>
              <span class="text-slate-500">{{ r.bed.name }}</span>
            </td>
            <td class="px-3 py-2 border-b border-[#dcdcde]">
              <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded border" :class="statusBadge(r.status).class">
                {{ statusBadge(r.status).label }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ページ送り下部 -->
    <div v-if="data && data.totalPages > 1" class="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
        :disabled="pageNum <= 1"
        @click="goPage(pageNum - 1)"
      >
        ← 前
      </button>
      <span class="text-sm tabular-nums text-slate-700">
        {{ pageNum }} / {{ data.totalPages }}
      </span>
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-sm border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
        :disabled="pageNum >= data.totalPages"
        @click="goPage(pageNum + 1)"
      >
        次 →
      </button>
    </div>
  </div>
</template>
