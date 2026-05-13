<script setup lang="ts">
import { displayStatus, DISPLAY_STATUS_LABEL, type DbStatus } from '~~/shared/reservationStatus'

definePageMeta({ layout: 'admin', requirePermission: 'reservation:view' })

const route = useRoute()
const router = useRouter()

type Store = { id: number, name: string }
type Reservation = {
  id: number
  status: DbStatus
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

// ステータスフィルタは表示ステータス（UPCOMING / COMPLETED / NO_SHOW / CANCELLED / '' = すべて）
// 初期値は「UPCOMING（予約済）」: 未来の予約だけ表示することで、件数が増えても普段使いがコンパクトに保てる
const statusFilter = computed<string>({
  get() {
    const q = String(route.query.status ?? 'UPCOMING')
    return ['UPCOMING', 'COMPLETED', 'NO_SHOW', 'CANCELLED', 'all'].includes(q) ? q : 'UPCOMING'
  },
  set(v) {
    // 'all' は URL に載せず、デフォルト UPCOMING との区別のために 'all' を残す
    router.replace({ query: { ...route.query, status: v === 'UPCOMING' ? undefined : v, page: undefined } })
  },
})

// ベッド絞り込み（店舗選択時のみ意味あり）
const bedIdFilter = computed<number | null>({
  get() {
    const q = Number(route.query.bedId)
    return Number.isInteger(q) && q > 0 ? q : null
  },
  set(v) {
    router.replace({ query: { ...route.query, bedId: v == null ? undefined : String(v), page: undefined } })
  },
})

function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const fromFilter = computed<string>({
  get() {
    // URL に from パラメータが「無い」ときは今日をデフォルトとして使う。
    // 入力欄を手動で空にすると ?from= が URL に載り、クリアされたとみなして空欄になる。
    // 「条件クリア」ボタンは全クエリを消すので、結果としてデフォルト（今日）に戻る。
    if (!('from' in route.query)) return todayYmd()
    const q = String(route.query.from ?? '')
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ''
  },
  set(v) {
    router.replace({ query: { ...route.query, from: v ?? '', page: undefined } })
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

// ステータスタブ定義（ピル形）
// 初期は「予約済（UPCOMING）」。完了/キャンセル/無断キャンセルは別タブで切り替える運用。
const statusTabs: { v: string, label: string, icon: string }[] = [
  { v: 'UPCOMING', label: '予約済', icon: 'i-lucide-calendar-clock' },
  { v: 'COMPLETED', label: '完了', icon: 'i-lucide-circle-check' },
  { v: 'NO_SHOW', label: '無断キャンセル', icon: 'i-lucide-user-x' },
  { v: 'CANCELLED', label: 'キャンセル', icon: 'i-lucide-ban' },
  { v: 'all', label: 'すべて', icon: 'i-lucide-list' },
]

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

// 店舗選択時のみ、その店舗のベッド一覧を取得（ベッド絞り込みプルダウン用）
type Bed = { id: number, name: string, displayOrder: number, isActive: boolean }
const { data: beds } = await useFetch<Bed[]>(() =>
  storeIdFilter.value ? `/api/admin/stores/${storeIdFilter.value}/beds` : '',
{
  default: () => [] as Bed[],
  watch: [storeIdFilter],
})

// 店舗を変更したらベッド絞り込みをリセット
watch(storeIdFilter, () => {
  if (bedIdFilter.value != null) bedIdFilter.value = null
})

const { data, status, refresh } = await useFetch<ListResponse>('/api/admin/reservations', {
  query: computed(() => ({
    storeId: storeIdFilter.value ?? undefined,
    bedId: bedIdFilter.value ?? undefined,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    from: fromFilter.value || undefined,
    to: toFilter.value || undefined,
    q: qFilter.value || undefined,
    page: pageNum.value,
    pageSize: 50,
  })),
  watch: [storeIdFilter, bedIdFilter, statusFilter, fromFilter, toFilter, qFilter, pageNum],
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

// 表示用ステータス: DB の status と endAt から自動判定（CONFIRMED + 終了済 = 完了）
function statusBadge(r: Reservation): { label: string, class: string } {
  const s = displayStatus(r.status, r.endAt)
  const cls
    = s === 'UPCOMING' ? 'bg-green-100 text-green-800 border-green-300'
      : s === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border-blue-300'
        : s === 'NO_SHOW' ? 'bg-red-100 text-red-800 border-red-300'
          : 'bg-slate-100 text-slate-500 border-slate-300 line-through'
  return { label: DISPLAY_STATUS_LABEL[s], class: cls }
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

// 物販販売フォーム
const saleMode = ref(false)

// 予約に紐付かない独立販売（同期間）を時系列で混在表示
type StandaloneSale = {
  id: number
  storeId: number
  store: { id: number, name: string }
  product: { id: number, name: string, kind: 'PRODUCT' | 'VOUCHER' }
  customer: { id: number, name: string | null }
  quantity: number
  unitPriceJpyAtSale: number
  soldAt: string
  soldByPractitioner: { id: number, name: string } | null
}

const standaloneSalesQuery = computed(() => {
  const q: Record<string, string> = { noReservation: 'true' }
  if (storeIdFilter.value) q.storeId = String(storeIdFilter.value)
  if (fromFilter.value) q.from = fromFilter.value
  if (toFilter.value) q.to = toFilter.value
  return q
})

const { data: standaloneSales, refresh: refreshStandaloneSales } = await useFetch<StandaloneSale[]>('/api/admin/sales', {
  query: standaloneSalesQuery,
  watch: [standaloneSalesQuery],
})

async function onSaleAdded() {
  saleMode.value = false
  await Promise.all([refresh(), refreshStandaloneSales()])
}

function yen(n: number): string { return n.toLocaleString('ja-JP') }

// ── ビュー切替（一覧 / スケジュール） ─────────────────
type ViewMode = 'list' | 'schedule'
const viewMode = computed<ViewMode>({
  get() {
    return route.query.view === 'schedule' ? 'schedule' : 'list'
  },
  set(v) {
    router.replace({ query: { ...route.query, view: v === 'list' ? undefined : v, page: undefined } })
  },
})

// スケジュールビューの「対象日」: fromFilter を流用（既存の開始日入力）
const scheduleDate = computed<string>({
  get() {
    return fromFilter.value || todayYmd()
  },
  set(v) {
    fromFilter.value = v
  },
})

// 日付の前後送り（スケジュールビュー用）
function shiftDate(days: number) {
  const m = scheduleDate.value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return
  const d = new Date(`${scheduleDate.value}T00:00:00+09:00`)
  d.setUTCDate(d.getUTCDate() + days)
  scheduleDate.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
function goToday() { scheduleDate.value = todayYmd() }
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-2xl font-semibold text-slate-900">
        予約・販売管理
      </h1>
      <div class="ml-auto flex items-center gap-2 flex-wrap">
        <!-- ビュー切替トグル -->
        <div class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm">
          <button
            type="button"
            class="px-3 py-1.5 inline-flex items-center gap-1"
            :class="viewMode === 'list' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
            @click="viewMode = 'list'"
          >
            <UIcon name="i-lucide-list" class="size-3.5" />
            一覧
          </button>
          <button
            type="button"
            class="px-3 py-1.5 border-l border-[#8c8f94] inline-flex items-center gap-1"
            :class="viewMode === 'schedule' ? 'bg-orange-500 text-white' : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'"
            @click="viewMode = 'schedule'"
          >
            <UIcon name="i-lucide-calendar-days" class="size-3.5" />
            スケジュール
          </button>
        </div>
        <button
          v-if="viewMode === 'list' && hasPermission('sale:edit')"
          type="button"
          class="px-3 py-1.5 text-sm border border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-sm inline-flex items-center gap-1"
          @click="saleMode = !saleMode"
        >
          <UIcon name="i-lucide-shopping-cart" class="size-4" />
          {{ saleMode ? '物販販売フォームを閉じる' : '物販販売を追加' }}
        </button>
        <NuxtLink
          to="/admin/reservations/new"
          class="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-sm inline-flex items-center gap-1"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
          手動で予約を追加
        </NuxtLink>
      </div>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      予約と物販販売を一括管理。物販だけ買いに来たお客様もここから登録できます。
    </p>

    <!-- ========== スケジュールビュー ========== -->
    <template v-if="viewMode === 'schedule'">
      <!-- 店舗選択 + 日付ナビ -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex flex-wrap items-center gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">店舗</label>
          <select
            :value="storeIdFilter ?? ''"
            class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            @change="storeIdFilter = Number(($event.target as HTMLSelectElement).value) || null"
          >
            <option value="">
              店舗を選んでください
            </option>
            <option v-for="s in (stores ?? [])" :key="s.id" :value="s.id">
              {{ s.name }}
            </option>
          </select>
        </div>
        <div v-if="storeIdFilter" class="flex items-end gap-2">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">対象日</label>
            <input
              v-model="scheduleDate"
              type="date"
              class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
            >
          </div>
          <div class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm">
            <button
              type="button"
              class="px-2.5 py-1.5 bg-white text-slate-700 hover:bg-[#f6f7f7]"
              title="前日"
              @click="shiftDate(-1)"
            >
              <UIcon name="i-lucide-chevron-left" class="size-4" />
            </button>
            <button
              type="button"
              class="px-3 py-1.5 border-l border-[#8c8f94] bg-white text-slate-700 hover:bg-[#f6f7f7]"
              @click="goToday"
            >
              今日
            </button>
            <button
              type="button"
              class="px-2.5 py-1.5 border-l border-[#8c8f94] bg-white text-slate-700 hover:bg-[#f6f7f7]"
              title="翌日"
              @click="shiftDate(1)"
            >
              <UIcon name="i-lucide-chevron-right" class="size-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- 店舗未選択時 -->
      <div
        v-if="!storeIdFilter"
        class="bg-white border border-dashed border-[#c3c4c7] rounded-sm p-10 text-center"
      >
        <UIcon name="i-lucide-building-2" class="size-8 text-slate-400 mx-auto mb-2" />
        <p class="text-sm text-slate-600">
          スケジュールを表示するには店舗を選択してください
        </p>
        <p class="text-xs text-slate-500 mt-1">
          複数店舗のベッドを 1 画面に混ぜると把握しづらいため、1 店舗ずつ表示します。
        </p>
      </div>

      <!-- スケジュール本体 -->
      <!-- Nuxt の自動コンポーネント名: Admin/Reservations/ReservationsTimeline.vue は
           ファイル名がディレクトリ名で始まるため AdminReservationsTimeline に短縮される -->
      <AdminReservationsTimeline
        v-else
        :store-id="storeIdFilter"
        :date="scheduleDate"
      />
    </template>

    <!-- ========== 一覧ビュー ========== -->
    <template v-else>
    <!-- ステータスフィルタ（ピル形タブ・初期は「予約済」で件数を抑える） -->
    <div class="mb-3 flex flex-wrap items-center gap-1.5">
      <button
        v-for="tab in statusTabs"
        :key="tab.v"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors"
        :class="statusFilter === tab.v
          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
          : 'bg-white text-slate-700 border-slate-300 hover:border-orange-500 hover:bg-orange-50 hover:text-orange-700'"
        @click="statusFilter = tab.v"
      >
        <UIcon :name="tab.icon" class="size-3.5" />
        {{ tab.label }}
      </button>
    </div>

    <!-- 物販販売フォーム（インライン展開） -->
    <AdminReservationsQuickSale
      v-if="saleMode"
      :stores="stores ?? []"
      @added="onSaleAdded"
      @close="saleMode = false"
    />

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
      <!-- ベッド絞り込み（店舗選択時のみ表示） -->
      <div v-if="storeIdFilter">
        <label class="block text-xs font-semibold text-slate-700 mb-1">ベッド</label>
        <select
          :value="bedIdFilter ?? ''"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
          @change="bedIdFilter = Number(($event.target as HTMLSelectElement).value) || null"
        >
          <option value="">
            すべて
          </option>
          <option v-for="b in (beds ?? [])" :key="b.id" :value="b.id">
            {{ b.name }}{{ b.isActive ? '' : '（無効）' }}
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

    <!-- 予約一覧テーブル -->
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
              <NuxtLink
                :to="`/admin/customers/${r.customer.id}`"
                class="font-medium text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                @click.stop
              >
                {{ r.customer.name ?? '(復号失敗)' }}
                <UIcon name="i-lucide-external-link" class="size-3 opacity-60" />
              </NuxtLink>
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
              <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded border" :class="statusBadge(r).class">
                {{ statusBadge(r).label }}
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

    <!-- 予約に紐付かない物販販売 -->
    <div v-if="hasPermission('sale:view') && (standaloneSales?.length ?? 0) > 0" class="mt-8">
      <div class="flex items-baseline gap-2 mb-2">
        <h2 class="text-base font-semibold text-slate-900">
          物販販売（予約なし）
        </h2>
        <span class="text-xs text-slate-500">
          {{ standaloneSales?.length ?? 0 }} 件
        </span>
      </div>
      <p class="text-xs text-slate-600 mb-2">
        予約に紐付かず、店頭で物販・回数券だけ販売した記録です。
      </p>
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead class="bg-[#f6f7f7]">
            <tr>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                販売日時
              </th>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                店舗
              </th>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                商品
              </th>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                お客様
              </th>
              <th class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                金額
              </th>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                担当
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in standaloneSales ?? []" :key="s.id" class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]">
              <td class="px-3 py-2 tabular-nums">
                {{ fmtJstDateTime(s.soldAt) }}
              </td>
              <td class="px-3 py-2">
                {{ s.store.name }}
              </td>
              <td class="px-3 py-2">
                <span class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-sm border mr-1" :class="s.product.kind === 'VOUCHER' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'">
                  {{ s.product.kind === 'VOUCHER' ? '回数券' : '物販' }}
                </span>
                {{ s.product.name }} × {{ s.quantity }}
              </td>
              <td class="px-3 py-2">
                <NuxtLink
                  :to="`/admin/customers/${s.customer.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1"
                >
                  {{ s.customer.name ?? '(復号失敗)' }}
                  <UIcon name="i-lucide-external-link" class="size-3 opacity-60" />
                </NuxtLink>
              </td>
              <td class="px-3 py-2 text-right tabular-nums font-semibold">
                ¥{{ yen(s.unitPriceJpyAtSale * s.quantity) }}
              </td>
              <td class="px-3 py-2 text-xs text-slate-600">
                {{ s.soldByPractitioner?.name ?? '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
  </div>
</template>
