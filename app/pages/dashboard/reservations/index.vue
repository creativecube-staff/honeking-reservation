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
  staff: { id: number, name: string }
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

// pad / todayYmd / fmtJstDateTime / fmtJstTime / yen は app/utils/format.ts の auto-import 経由で利用。

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
const statusTabs: { value: string, label: string, icon: string }[] = [
  { value: 'UPCOMING', label: '予約済', icon: 'i-lucide-calendar-clock' },
  { value: 'COMPLETED', label: '完了', icon: 'i-lucide-circle-check' },
  { value: 'NO_SHOW', label: '無断キャンセル', icon: 'i-lucide-user-x' },
  { value: 'CANCELLED', label: 'キャンセル', icon: 'i-lucide-ban' },
  { value: 'all', label: 'すべて', icon: 'i-lucide-list' },
]

// 検索入力（即時反映ではなくボタン押下で反映）
const qInput = ref(qFilter.value)
watch(qFilter, v => { qInput.value = v })

function applySearch() {
  qFilter.value = qInput.value.trim()
}

// ヘッダーの店舗スイッチャーの選択中店舗（スケジュールビューで使う）
const { selectedStoreId } = useStoreContext()

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

// ── ビュー切替（一覧 / スケジュール） ─────────────────
// 初期表示は「スケジュール」。一覧に切り替えるときだけ ?view=list を URL に載せる
type ViewMode = 'list' | 'schedule'
const viewMode = computed<ViewMode>({
  get() {
    return route.query.view === 'list' ? 'list' : 'schedule'
  },
  set(v) {
    router.replace({ query: { ...route.query, view: v === 'schedule' ? undefined : v, page: undefined } })
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
    <div class="flex items-center justify-between mb-4 gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <!-- ビュー切替（タブ風・スライドする下線インジケータ） -->
        <div class="relative inline-grid grid-cols-2 border-b border-slate-200 text-base">
          <button
            type="button"
            class="relative px-6 py-3 inline-flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer select-none group tracking-tight"
            :class="viewMode === 'schedule' ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-800 font-semibold'"
            @click="viewMode = 'schedule'"
          >
            <UIcon
              name="i-lucide-calendar-days"
              class="size-5 transition-transform duration-300 ease-out group-hover:scale-110"
              :class="viewMode === 'schedule' ? 'scale-110' : ''"
            />
            スケジュール
          </button>
          <button
            type="button"
            class="relative px-6 py-3 inline-flex items-center justify-center gap-2 transition-colors duration-200 cursor-pointer select-none group tracking-tight"
            :class="viewMode === 'list' ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-800 font-semibold'"
            @click="viewMode = 'list'"
          >
            <UIcon
              name="i-lucide-list"
              class="size-5 transition-transform duration-300 ease-out group-hover:scale-110"
              :class="viewMode === 'list' ? 'scale-110' : ''"
            />
            予約一覧
          </button>
          <!-- スライドする下線インジケータ（オレンジグロー付き） -->
          <span
            class="pointer-events-none absolute -bottom-px left-0 h-0.5 w-1/2 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-transform duration-300 ease-out"
            :style="{ transform: viewMode === 'list' ? 'translateX(100%)' : 'translateX(0)' }"
          />
        </div>
      </div>
      <!-- 登録アクション（遷移先は別途配線予定） -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-sm inline-flex items-center gap-1.5 font-semibold shadow-sm"
        >
          <UIcon name="i-lucide-calendar-plus" class="size-4" />
          予約を登録する
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-sm inline-flex items-center gap-1.5 font-semibold"
        >
          <UIcon name="i-lucide-clock-plus" class="size-4" />
          予定を登録する
        </button>
      </div>
    </div>

    <!-- ========== スケジュールビュー ========== -->
    <template v-if="viewMode === 'schedule'">
      <!-- 店舗未選択時（OWNER で「管理者(全店)」を選んでいるとき）。
           ヘッダーの店舗スイッチャーから 1 店舗を選ぶよう促す。 -->
      <div
        v-if="!selectedStoreId"
        class="bg-white border border-dashed border-[#c3c4c7] rounded-sm p-10 text-center"
      >
        <UIcon name="i-lucide-building-2" class="size-8 text-slate-400 mx-auto mb-2" />
        <p class="text-sm text-slate-600">
          スケジュールを表示するには上部のスイッチャーから店舗を選択してください
        </p>
        <p class="text-xs text-slate-500 mt-1">
          複数店舗のベッドを 1 画面に混ぜると把握しづらいため、1 店舗ずつ表示します。
        </p>
      </div>

      <!-- スケジュール本体（横軸=時刻、スタッフ + ベッドの 2 段構成）
           日付ナビは HorizontalSchedule 内のツールバーが持つので v-model:date で双方向同期 -->
      <AdminReservationsHorizontalSchedule
        v-else
        :store-id="selectedStoreId"
        v-model:date="scheduleDate"
      />
    </template>

    <!-- ========== 一覧ビュー ========== -->
    <template v-else>
    <!-- ステータスフィルタ（ピル形タブ・初期は「予約済」で件数を抑える） -->
    <BasePillTabs v-model="statusFilter" :items="statusTabs" class="mb-3" />

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
            @click="router.push(`/dashboard/reservations/${r.id}`)"
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
                :to="`/dashboard/customers/${r.customer.id}`"
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
              {{ r.staff.name }}<br>
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
    <BasePagination
      v-if="data"
      v-model:page="pageNum"
      :total-pages="data.totalPages"
    />

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
                  :to="`/dashboard/customers/${s.customer.id}`"
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
