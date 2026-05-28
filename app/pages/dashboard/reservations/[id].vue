<script setup lang="ts">
import { ROLE_LABEL } from '~~/shared/permissions'
import { displayStatus, DISPLAY_STATUS_LABEL, DISPLAY_STATUS_BADGE_CLASS, type DbStatus } from '~~/shared/reservationStatus'

definePageMeta({ layout: 'admin', requirePermission: 'reservation:view' })

const route = useRoute()
const id = computed(() => Number(route.params.id ?? 0))

// DB に残るステータスは CONFIRMED / CANCELLED / NO_SHOW のみ。
// 「完了」は表示時に CONFIRMED + endAt 過去で自動判定する。
type ReservationStatus = DbStatus

type ReservationHistoryRow = {
  id: number
  changedAt: string
  changedByLoginId: number | null
  changedByName: string
  prevStartAt: string
  prevEndAt: string
  prevStatus: ReservationStatus
  prevMenuId: number
  prevStaffId: number
  prevBedId: number
  newStartAt: string
  newEndAt: string
  newStatus: ReservationStatus
  newMenuId: number
  newStaffId: number
  newBedId: number
  note: string | null
}

type ProductSaleRow = {
  id: number
  productId: number
  quantity: number
  unitPriceJpyAtSale: number
  soldAt: string
  note: string | null
  product: { id: number, name: string, kind: 'PRODUCT' | 'VOUCHER', voucherTotalUses: number | null }
  voucher: { id: number, totalUses: number, remainingUses: number } | null
}

type VoucherUsageRow = {
  id: number
  customerVoucherId: number
  usedAt: string
  customerVoucher: {
    id: number
    totalUses: number
    remainingUses: number
    product: { id: number, name: string }
  }
}

type ReservationDetail = {
  id: number
  storeId: number
  status: ReservationStatus
  confirmationCode: string
  startAt: string
  endAt: string
  note: string | null
  cancelledAt: string | null
  createdAt: string
  store: { id: number, name: string, address: string, phone: string | null }
  bed: { id: number, name: string }
  staff: { id: number, name: string, storeId: number }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
  histories: ReservationHistoryRow[]
  productSales: ProductSaleRow[]
  voucherUsage: VoucherUsageRow | null
}

const { data: reservation, error, refresh } = await useFetch<ReservationDetail>(() => `/api/admin/reservations/${id.value}`)

function pad(n: number): string { return String(n).padStart(2, '0') }
function fmtJstDateTime(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()]
  return `${jst.getUTCFullYear()}年${jst.getUTCMonth() + 1}月${jst.getUTCDate()}日 (${dow}) ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}
function fmtJstTime(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}
function jstYmd(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`
}
function jstHm(iso: string): string {
  const d = new Date(iso)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
}
function yen(n: number): string { return n.toLocaleString('ja-JP') }
function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

const submitting = ref(false)
const errorMessage = ref<string | null>(null)

// 詳細上部のバッジ: DB の status と endAt から表示用ステータスを判定
function displayBadge(status: ReservationStatus, endAt: string): { label: string, class: string } {
  const s = displayStatus(status, endAt)
  return { label: DISPLAY_STATUS_LABEL[s], class: DISPLAY_STATUS_BADGE_CLASS[s] }
}
// 履歴の prev/new 表示用: DB の生値だけを使うシンプルなラベル化（過去 COMPLETED もあり得るので displayStatus に通す）
function rawStatusLabel(status: ReservationStatus): string {
  // 履歴では endAt は変更前後の値を使うべきだが、簡易表示として「現在の判定基準で」ラベル化
  // CONFIRMED は「予約済」と表示する（過去判定はトップのバッジで行う）
  if (status === 'CANCELLED') return DISPLAY_STATUS_LABEL.CANCELLED
  if (status === 'NO_SHOW') return DISPLAY_STATUS_LABEL.NO_SHOW
  if (status === 'COMPLETED') return DISPLAY_STATUS_LABEL.COMPLETED
  return DISPLAY_STATUS_LABEL.UPCOMING
}

async function changeStatus(newStatus: ReservationStatus) {
  if (!reservation.value) return
  if (submitting.value) return
  const msg = {
    CANCELLED: '本当にこの予約をキャンセルしますか?（同じ枠は再予約可能になります）',
    NO_SHOW: 'この予約を「無断キャンセル」として記録しますか?',
    CONFIRMED: 'この予約を「予約済」に戻しますか?',
  }[newStatus]
  if (!window.confirm(msg)) return
  submitting.value = true
  errorMessage.value = null
  try {
    await $fetch(`/api/admin/reservations/${id.value}`, {
      method: 'PATCH',
      body: { status: newStatus },
    })
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || 'ステータス変更に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// ─── リスケジュール（日時 / メニュー / スタッフ / ベッド 変更） ─────────────────
type MenuMaster = { id: number, storeId: number | null, name: string, durationMinutes: number, priceJpy: number, isActive: boolean }
type StaffMaster = { id: number, storeId: number, name: string, isActive: boolean }
type BedMaster = { id: number, storeId: number, name: string, displayOrder: number, isActive: boolean }

const editMode = ref(false)
const editError = ref<string | null>(null)
const editSubmitting = ref(false)

const editForm = reactive({
  date: '',
  time: '',
  menuId: null as number | null,
  autoAssign: true,
  staffId: null as number | null,
  bedId: null as number | null,
  historyNote: '',
  forceOverride: false,
})

// 既存予約の値で初期化
function resetEditForm() {
  if (!reservation.value) return
  editForm.date = jstYmd(reservation.value.startAt)
  editForm.time = jstHm(reservation.value.startAt)
  editForm.menuId = reservation.value.menu.id
  editForm.autoAssign = true
  editForm.staffId = reservation.value.staff.id
  editForm.bedId = reservation.value.bed.id
  editForm.historyNote = ''
  editForm.forceOverride = false
  editError.value = null
}

function openEdit() {
  resetEditForm()
  editMode.value = true
}
function cancelEdit() {
  editMode.value = false
  editError.value = null
}

// マスタ（メニュー・スタッフ・ベッド）。ベッドは店舗単位 API なので予約の店舗 ID から URL を組む。
const reservationStoreId = computed(() => reservation.value?.storeId ?? 0)
const reservationCustomerId = computed(() => reservation.value?.customer.id ?? 0)
const { data: allMenus } = await useFetch<MenuMaster[]>('/api/admin/menus', { query: { status: 'active' } })
const { data: allStaff } = await useFetch<StaffMaster[]>('/api/admin/staff', { query: { status: 'active', assignable: 'true' } })
const { data: allBeds } = await useFetch<BedMaster[]>(() => `/api/admin/stores/${reservationStoreId.value}/beds`)

// 物販・回数券マスタ
type ProductMaster = {
  id: number
  storeId: number | null
  kind: 'PRODUCT' | 'VOUCHER'
  name: string
  priceJpy: number
  stock: number
  voucherTotalUses: number | null
  isActive: boolean
}
const { data: allProducts } = await useFetch<ProductMaster[]>('/api/admin/products', { query: { status: 'active' } })

const saleableProducts = computed(() => {
  if (!reservation.value) return []
  const storeId = reservation.value.storeId
  return (allProducts.value ?? [])
    .filter(p => p.isActive && (p.storeId === null || p.storeId === storeId))
    .filter(p => p.kind === 'VOUCHER' || p.stock > 0)
})

// 顧客の保有回数券（残あり）
type CustomerVoucherRow = {
  id: number
  totalUses: number
  remainingUses: number
  product: { id: number, name: string, priceJpy: number }
}
const { data: customerVouchers, refresh: refreshVouchers } = await useFetch<CustomerVoucherRow[]>(
  () => reservationCustomerId.value > 0 ? `/api/admin/customers/${reservationCustomerId.value}/vouchers` : null,
  { query: { activeOnly: 'true' } },
)

const availableMenus = computed(() => {
  if (!reservation.value) return []
  const storeId = reservation.value.storeId
  return (allMenus.value ?? []).filter(m => m.isActive && (m.storeId === null || m.storeId === storeId))
})
const availableStaff = computed(() => {
  if (!reservation.value) return []
  const storeId = reservation.value.storeId
  return (allStaff.value ?? []).filter(p => p.isActive && p.storeId === storeId)
})
const availableBeds = computed(() => {
  if (!reservation.value) return []
  const storeId = reservation.value.storeId
  return (allBeds.value ?? []).filter(b => b.isActive && b.storeId === storeId)
})

async function saveReschedule() {
  if (!reservation.value) return
  if (editSubmitting.value) return
  editError.value = null

  const { date, time, menuId, autoAssign, staffId, bedId, historyNote, forceOverride } = editForm
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    editError.value = '日時が不正です'
    return
  }
  if (!menuId) {
    editError.value = 'メニューを選んでください'
    return
  }

  const startAt = `${date}T${time.replace(':', '')}`

  const body: Record<string, unknown> = { startAt, menuId, historyNote: historyNote.trim() || undefined, forceOverride: forceOverride || undefined }
  if (autoAssign) {
    body.autoAssign = true
  }
  else {
    if (staffId) body.staffId = staffId
    if (bedId) body.bedId = bedId
  }

  editSubmitting.value = true
  try {
    await $fetch(`/api/admin/reservations/${id.value}`, { method: 'PATCH', body })
    editMode.value = false
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    editError.value = err.data?.statusMessage || err.statusMessage || '変更に失敗しました'
  }
  finally {
    editSubmitting.value = false
  }
}

// ─── 履歴表示用ヘルパー（メニュー名・スタッフ名・ベッド名を引く） ─────────────────
function menuName(menuId: number): string {
  return (allMenus.value ?? []).find(m => m.id === menuId)?.name ?? `#${menuId}`
}
function staffName(staffId: number): string {
  return (allStaff.value ?? []).find(p => p.id === staffId)?.name ?? `#${staffId}`
}
function bedName(bedId: number): string {
  return (allBeds.value ?? []).find(b => b.id === bedId)?.name ?? `#${bedId}`
}

// ─── 物販・回数券セクション ────────────────────────────────
const saleForm = reactive({
  productId: null as number | null,
  quantity: 1,
  note: '',
})
const saleError = ref<string | null>(null)
const saleSubmitting = ref(false)

async function addSale() {
  if (!reservation.value || !saleForm.productId) {
    saleError.value = '商品を選んでください'
    return
  }
  saleError.value = null
  saleSubmitting.value = true
  try {
    await $fetch('/api/admin/sales', {
      method: 'POST',
      body: {
        productId: saleForm.productId,
        storeId: reservation.value.storeId,
        customerId: reservation.value.customer.id,
        reservationId: reservation.value.id,
        quantity: saleForm.quantity,
        note: saleForm.note.trim() || undefined,
      },
    })
    saleForm.productId = null
    saleForm.quantity = 1
    saleForm.note = ''
    await Promise.all([refresh(), refreshVouchers()])
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    saleError.value = err.data?.statusMessage || err.statusMessage || '販売登録に失敗しました'
  }
  finally {
    saleSubmitting.value = false
  }
}

const saleBusy = ref<number | null>(null)
async function cancelSale(sale: ProductSaleRow) {
  const msg = sale.product.kind === 'VOUCHER'
    ? `回数券「${sale.product.name}」の販売を取り消しますか？\n（既に消費されている場合は取り消しできません）`
    : `「${sale.product.name}」× ${sale.quantity} の販売を取り消し、在庫を戻しますか？`
  if (!confirm(msg)) return
  saleBusy.value = sale.id
  try {
    await $fetch(`/api/admin/sales/${sale.id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshVouchers()])
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    alert(err.data?.statusMessage || err.statusMessage || '取り消しに失敗しました')
  }
  finally {
    saleBusy.value = null
  }
}

// 回数券消費
const voucherSelectId = ref<number | null>(null)
const voucherError = ref<string | null>(null)
const voucherSubmitting = ref(false)

async function useVoucher() {
  if (!voucherSelectId.value) {
    voucherError.value = '消費する回数券を選んでください'
    return
  }
  voucherError.value = null
  voucherSubmitting.value = true
  try {
    await $fetch(`/api/admin/reservations/${id.value}/voucher`, {
      method: 'POST',
      body: { customerVoucherId: voucherSelectId.value },
    })
    voucherSelectId.value = null
    await Promise.all([refresh(), refreshVouchers()])
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    voucherError.value = err.data?.statusMessage || err.statusMessage || '回数券の消費に失敗しました'
  }
  finally {
    voucherSubmitting.value = false
  }
}

async function cancelVoucherUsage() {
  if (!confirm('回数券の消費を取り消し、残回数を戻しますか？')) return
  voucherSubmitting.value = true
  try {
    await $fetch(`/api/admin/reservations/${id.value}/voucher`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshVouchers()])
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    voucherError.value = err.data?.statusMessage || err.statusMessage || '取り消しに失敗しました'
  }
  finally {
    voucherSubmitting.value = false
  }
}

// 売上合計（施術 + 物販 - 回数券消費分）
const totalRevenue = computed(() => {
  if (!reservation.value) return { menu: 0, sales: 0, total: 0, voucherUsed: false }
  const voucherUsed = reservation.value.voucherUsage !== null
  const menuJpy = voucherUsed ? 0 : reservation.value.menu.priceJpy
  const salesJpy = (reservation.value.productSales ?? []).reduce((sum, s) => sum + s.unitPriceJpyAtSale * s.quantity, 0)
  return { menu: menuJpy, sales: salesJpy, total: menuJpy + salesJpy, voucherUsed }
})

// 履歴 1 行をテキスト化
function summarizeHistory(h: ReservationHistoryRow): { items: { label: string, before: string, after: string }[], status: { changed: boolean, before: string, after: string } } {
  const items: { label: string, before: string, after: string }[] = []
  if (h.prevStartAt !== h.newStartAt || h.prevEndAt !== h.newEndAt) {
    items.push({
      label: '日時',
      before: `${fmtJstDateTime(h.prevStartAt)}–${fmtJstTime(h.prevEndAt)}`,
      after: `${fmtJstDateTime(h.newStartAt)}–${fmtJstTime(h.newEndAt)}`,
    })
  }
  if (h.prevMenuId !== h.newMenuId) {
    items.push({ label: 'メニュー', before: menuName(h.prevMenuId), after: menuName(h.newMenuId) })
  }
  if (h.prevStaffId !== h.newStaffId) {
    items.push({ label: '担当', before: staffName(h.prevStaffId), after: staffName(h.newStaffId) })
  }
  if (h.prevBedId !== h.newBedId) {
    items.push({ label: 'ベッド', before: bedName(h.prevBedId), after: bedName(h.newBedId) })
  }
  return {
    items,
    status: { changed: h.prevStatus !== h.newStatus, before: rawStatusLabel(h.prevStatus), after: rawStatusLabel(h.newStatus) },
  }
}
// ROLE_LABEL は将来履歴に役職を出すときのために import 済み
void ROLE_LABEL
</script>

<template>
  <div>
    <div class="mb-4">
      <NuxtLink to="/dashboard/reservations" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        予約一覧へ戻る
      </NuxtLink>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`予約の取得に失敗しました: ${error.message}`"
    />

    <div v-else-if="reservation" class="space-y-4">
      <div class="flex items-baseline gap-3 flex-wrap">
        <h1 class="text-2xl font-semibold text-slate-900">
          予約 #{{ reservation.id }}
        </h1>
        <span class="inline-block px-3 py-1 text-sm font-semibold rounded border" :class="displayBadge(reservation.status, reservation.endAt).class">
          {{ displayBadge(reservation.status, reservation.endAt).label }}
        </span>
      </div>
      <p class="text-sm text-slate-600 font-mono">
        予約番号: <strong class="text-orange-700">{{ reservation.confirmationCode }}</strong>
      </p>

      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
      />

      <!-- 詳細グリッド -->
      <div class="grid gap-4 md:grid-cols-2">
        <div class="bg-white border border-[#c3c4c7] rounded-sm">
          <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7] flex items-center justify-between">
            <h2 class="text-sm font-semibold text-slate-900">
              予約情報
            </h2>
            <button
              v-if="!editMode && hasPermission('reservation:edit') && reservation.status === 'CONFIRMED'"
              type="button"
              class="text-xs text-blue-700 hover:text-blue-900 hover:underline"
              @click="openEdit"
            >
              変更する
            </button>
          </div>
          <dl class="p-4 space-y-3 text-sm">
            <div>
              <dt class="text-xs text-slate-500">日時</dt>
              <dd class="text-base font-semibold text-slate-900 tabular-nums">
                {{ fmtJstDateTime(reservation.startAt) }}–{{ fmtJstTime(reservation.endAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">店舗</dt>
              <dd class="text-slate-900 font-medium">
                {{ reservation.store.name }}
              </dd>
              <dd class="text-xs text-slate-600">{{ reservation.store.address }}</dd>
            </div>
            <div>
              <dt class="text-xs text-slate-500">メニュー</dt>
              <dd class="text-slate-900 font-medium">
                {{ reservation.menu.name }}
              </dd>
              <dd class="text-xs text-slate-600">
                {{ duration(reservation.menu.durationMinutes) }} / ¥{{ yen(reservation.menu.priceJpy) }}
              </dd>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <dt class="text-xs text-slate-500">担当</dt>
                <dd class="text-slate-900">
                  {{ reservation.staff.name }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-slate-500">ベッド</dt>
                <dd class="text-slate-900">
                  {{ reservation.bed.name }}
                </dd>
              </div>
            </div>
            <div v-if="reservation.note">
              <dt class="text-xs text-slate-500">ご要望・備考</dt>
              <dd class="text-sm text-slate-800 whitespace-pre-line">
                {{ reservation.note }}
              </dd>
            </div>
            <div class="text-xs text-slate-500 pt-2 border-t border-[#dcdcde]">
              登録: {{ fmtJstDateTime(reservation.createdAt) }}
              <template v-if="reservation.cancelledAt">
                <br>キャンセル: {{ fmtJstDateTime(reservation.cancelledAt) }}
              </template>
            </div>
          </dl>
        </div>

        <!-- お客様情報 -->
        <div class="bg-white border border-[#c3c4c7] rounded-sm">
          <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
            <h2 class="text-sm font-semibold text-slate-900 inline-flex items-center gap-1">
              <UIcon name="i-lucide-lock" class="size-3.5 text-slate-500" />
              お客様情報
            </h2>
          </div>
          <dl class="p-4 space-y-3 text-sm">
            <div>
              <dt class="text-xs text-slate-500">お名前</dt>
              <dd class="text-base font-semibold text-slate-900">
                <NuxtLink
                  :to="`/dashboard/customers/${reservation.customer.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline inline-flex items-center gap-1.5"
                >
                  {{ reservation.customer.name ?? '(復号できませんでした)' }}
                  <UIcon name="i-lucide-external-link" class="size-3.5 opacity-60" />
                </NuxtLink>
              </dd>
            </div>
            <div v-if="reservation.customer.phone">
              <dt class="text-xs text-slate-500">電話</dt>
              <dd>
                <a :href="`tel:${reservation.customer.phone}`" class="text-orange-700 hover:underline">
                  {{ reservation.customer.phone }}
                </a>
              </dd>
            </div>
            <div v-if="reservation.customer.email">
              <dt class="text-xs text-slate-500">メール</dt>
              <dd>
                <a :href="`mailto:${reservation.customer.email}`" class="text-orange-700 hover:underline break-all">
                  {{ reservation.customer.email }}
                </a>
              </dd>
            </div>
            <p class="text-[10px] text-slate-400 pt-2 border-t border-[#dcdcde]">
              個人情報は DB に AES-256-GCM で暗号化して保存されており、この画面でのみ復号されます。
            </p>
          </dl>
        </div>
      </div>

      <!-- リスケジュールフォーム -->
      <div v-if="editMode" class="bg-white border border-orange-300 rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-orange-50">
          <h2 class="text-sm font-semibold text-slate-900">
            予約内容の変更
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <UAlert
            v-if="editError"
            color="error"
            icon="i-lucide-triangle-alert"
            :title="editError"
          />

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">日付</label>
              <input
                v-model="editForm.date"
                type="date"
                class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">開始時刻</label>
              <input
                v-model="editForm.time"
                type="time"
                step="600"
                class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">メニュー</label>
            <select
              v-model.number="editForm.menuId"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
              <option :value="null" disabled>
                -- 選択 --
              </option>
              <option v-for="m in availableMenus" :key="m.id" :value="m.id">
                {{ m.name }}（{{ duration(m.durationMinutes) }} / ¥{{ yen(m.priceJpy) }}）
              </option>
            </select>
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm text-slate-900">
              <input
                v-model="editForm.autoAssign"
                type="checkbox"
                class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
              >
              スタッフ・ベッドを自動で再割当する
            </label>
            <p class="text-xs text-slate-500 mt-1 ml-6">
              チェックを外すと、下で手動指定できます。
            </p>
          </div>

          <div v-if="!editForm.autoAssign" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">担当スタッフ</label>
              <select
                v-model.number="editForm.staffId"
                class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
                <option :value="null">
                  -- 自動 --
                </option>
                <option v-for="p in availableStaff" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">ベッド</label>
              <select
                v-model.number="editForm.bedId"
                class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
                <option :value="null">
                  -- 自動 --
                </option>
                <option v-for="b in availableBeds" :key="b.id" :value="b.id">
                  {{ b.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">変更メモ（履歴に残ります）</label>
            <input
              v-model="editForm.historyNote"
              type="text"
              placeholder="例: お客様から電話で変更依頼"
              maxlength="1000"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm text-slate-700">
              <input
                v-model="editForm.forceOverride"
                type="checkbox"
                class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
              >
              営業時間外・休業日でも強制的に変更する
            </label>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              :disabled="editSubmitting"
              class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm"
              @click="saveReschedule"
            >
              {{ editSubmitting ? '保存中...' : '変更を保存' }}
            </button>
            <button
              type="button"
              :disabled="editSubmitting"
              class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
              @click="cancelEdit"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>

      <!-- ステータス変更 -->
      <div v-if="hasPermission('reservation:edit') || hasPermission('reservation:cancel')" class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="text-sm font-semibold text-slate-900">
            ステータス変更
          </h2>
        </div>
        <div class="p-4 flex flex-wrap gap-2">
          <button
            v-if="reservation.status !== 'CONFIRMED' && hasPermission('reservation:edit')"
            type="button"
            class="px-3 py-1.5 text-sm rounded-sm border border-green-300 bg-green-50 hover:bg-green-100 text-green-800 disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('CONFIRMED')"
          >
            予約済に戻す
          </button>
          <button
            v-if="reservation.status === 'CONFIRMED' && hasPermission('reservation:edit')"
            type="button"
            class="px-3 py-1.5 text-sm rounded-sm border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('NO_SHOW')"
          >
            無断キャンセル
          </button>
          <button
            v-if="reservation.status !== 'CANCELLED' && hasPermission('reservation:cancel')"
            type="button"
            class="ml-auto px-3 py-1.5 text-sm rounded-sm border border-red-400 bg-red-100 hover:bg-red-200 text-red-900 font-semibold disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('CANCELLED')"
          >
            この予約をキャンセル
          </button>
        </div>
      </div>

      <!-- 物販・回数券 -->
      <div v-if="hasPermission('sale:view')" class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7] flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-900">
            物販・回数券
          </h2>
          <div class="text-xs text-slate-700">
            <template v-if="totalRevenue.voucherUsed">
              <span class="text-purple-700 font-semibold">回数券で来店</span>
              <span class="text-slate-400 mx-1">|</span>
            </template>
            <span>施術 ¥{{ yen(totalRevenue.menu) }}</span>
            <span class="text-slate-400 mx-1">+</span>
            <span>物販 ¥{{ yen(totalRevenue.sales) }}</span>
            <span class="text-slate-400 mx-1">=</span>
            <strong class="text-slate-900">合計 ¥{{ yen(totalRevenue.total) }}</strong>
          </div>
        </div>
        <div class="p-4 space-y-4">
          <!-- 回数券消費 -->
          <div v-if="reservation.voucherUsage" class="border border-purple-200 bg-purple-50 rounded-sm p-3 flex items-center justify-between">
            <div class="text-sm">
              <div class="font-semibold text-purple-900">
                回数券を消費しました: {{ reservation.voucherUsage.customerVoucher.product.name }}
              </div>
              <div class="text-xs text-purple-700 mt-0.5">
                残 {{ reservation.voucherUsage.customerVoucher.remainingUses }} / {{ reservation.voucherUsage.customerVoucher.totalUses }} 回（この予約の施術料金は ¥0）
              </div>
            </div>
            <button
              v-if="hasPermission('sale:edit')"
              type="button"
              :disabled="voucherSubmitting"
              class="text-xs text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
              @click="cancelVoucherUsage"
            >
              消費を取り消す
            </button>
          </div>

          <div v-else-if="hasPermission('sale:edit') && (customerVouchers?.length ?? 0) > 0" class="border border-slate-200 rounded-sm p-3">
            <UAlert
              v-if="voucherError"
              color="error"
              icon="i-lucide-triangle-alert"
              :title="voucherError"
              class="mb-2"
            />
            <p class="text-xs text-slate-600 mb-2">
              このお客様の保有回数券を消費する場合は選択してください（施術料金が ¥0 になります）
            </p>
            <div class="flex items-end gap-2 flex-wrap">
              <select
                v-model.number="voucherSelectId"
                class="flex-1 min-w-[200px] px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
                <option :value="null">
                  -- 回数券を選択 --
                </option>
                <option v-for="v in customerVouchers ?? []" :key="v.id" :value="v.id">
                  {{ v.product.name }}（残 {{ v.remainingUses }} / {{ v.totalUses }} 回）
                </option>
              </select>
              <button
                type="button"
                :disabled="voucherSubmitting || !voucherSelectId"
                class="px-3 py-1.5 text-sm rounded-sm border border-purple-400 bg-purple-100 hover:bg-purple-200 text-purple-900 disabled:opacity-50"
                @click="useVoucher"
              >
                {{ voucherSubmitting ? '消費中...' : '回数券を消費する' }}
              </button>
            </div>
          </div>

          <!-- 紐付いた販売一覧 -->
          <div v-if="reservation.productSales.length > 0">
            <p class="text-xs font-semibold text-slate-700 mb-1.5">
              この予約で販売したもの
            </p>
            <ul class="divide-y divide-[#f0f0f1] border border-[#dcdcde] rounded-sm">
              <li v-for="s in reservation.productSales" :key="s.id" class="px-3 py-2 flex items-center gap-2 text-sm">
                <span class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-sm border" :class="s.product.kind === 'VOUCHER' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'">
                  {{ s.product.kind === 'VOUCHER' ? '回数券' : '物販' }}
                </span>
                <span class="flex-1">
                  {{ s.product.name }} × {{ s.quantity }}
                </span>
                <span class="tabular-nums text-slate-900 font-semibold">
                  ¥{{ yen(s.unitPriceJpyAtSale * s.quantity) }}
                </span>
                <button
                  v-if="hasPermission('sale:edit')"
                  type="button"
                  :disabled="saleBusy === s.id"
                  class="text-xs text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="cancelSale(s)"
                >
                  取消
                </button>
              </li>
            </ul>
          </div>

          <!-- 物販追加フォーム -->
          <div v-if="hasPermission('sale:edit')" class="border-t border-[#dcdcde] pt-3">
            <p class="text-xs font-semibold text-slate-700 mb-2">
              商品を追加する
            </p>
            <UAlert
              v-if="saleError"
              color="error"
              icon="i-lucide-triangle-alert"
              :title="saleError"
              class="mb-2"
            />
            <div class="flex items-end gap-2 flex-wrap">
              <div class="flex-1 min-w-[200px]">
                <label class="block text-xs text-slate-700 mb-1">商品</label>
                <select
                  v-model.number="saleForm.productId"
                  class="w-full px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
                >
                  <option :value="null">
                    -- 選択 --
                  </option>
                  <option v-for="p in saleableProducts" :key="p.id" :value="p.id">
                    {{ p.kind === 'VOUCHER' ? '【回数券】' : '' }}{{ p.name }}（¥{{ yen(p.priceJpy) }}{{ p.kind === 'PRODUCT' ? ` / 在庫 ${p.stock}` : '' }}）
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-700 mb-1">数量</label>
                <input
                  v-model.number="saleForm.quantity"
                  type="number"
                  min="1"
                  class="w-20 px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
                >
              </div>
              <button
                type="button"
                :disabled="saleSubmitting || !saleForm.productId"
                class="px-3 py-1.5 text-sm rounded-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold"
                @click="addSale"
              >
                {{ saleSubmitting ? '追加中...' : '追加' }}
              </button>
            </div>
            <p class="text-xs text-slate-500 mt-2">
              ※ 回数券は購入即時で売上計上、後で同じ予約や別予約で「回数券を消費する」を選んで使えます。
            </p>
          </div>
        </div>
      </div>

      <!-- 変更履歴 -->
      <div v-if="reservation.histories.length > 0" class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="text-sm font-semibold text-slate-900">
            変更履歴
          </h2>
        </div>
        <ul class="divide-y divide-[#dcdcde]">
          <li
            v-for="h in reservation.histories"
            :key="h.id"
            class="px-4 py-3 text-sm"
          >
            <div class="flex items-baseline justify-between gap-3 mb-2">
              <span class="text-slate-500 text-xs tabular-nums">
                {{ fmtJstDateTime(h.changedAt) }}
              </span>
              <span class="text-xs text-slate-600">
                操作: <span class="text-slate-900 font-medium">{{ h.changedByName }}</span>
              </span>
            </div>

            <template v-for="(item, i) in summarizeHistory(h).items" :key="i">
              <div class="grid grid-cols-[64px_1fr] gap-2 text-xs mb-1">
                <span class="text-slate-500">{{ item.label }}</span>
                <span class="text-slate-800">
                  <s class="text-slate-400">{{ item.before }}</s>
                  →
                  <strong>{{ item.after }}</strong>
                </span>
              </div>
            </template>

            <div v-if="summarizeHistory(h).status.changed" class="grid grid-cols-[64px_1fr] gap-2 text-xs mb-1">
              <span class="text-slate-500">状態</span>
              <span class="text-slate-800">
                <s class="text-slate-400">{{ summarizeHistory(h).status.before }}</s>
                →
                <strong>{{ summarizeHistory(h).status.after }}</strong>
              </span>
            </div>

            <p v-if="h.note" class="text-xs text-slate-600 mt-2 bg-slate-50 border-l-2 border-slate-300 px-2 py-1">
              {{ h.note }}
            </p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
