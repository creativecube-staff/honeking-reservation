<script setup lang="ts">
import { MEMBERSHIP_BADGE, type Membership } from '~~/shared/membership'
import { displayStatus, DISPLAY_STATUS_LABEL, type DbStatus } from '~~/shared/reservationStatus'

definePageMeta({ layout: 'admin', requirePermission: 'customer:view' })

type CustomerDetail = {
  id: number
  name: string | null
  phone: string | null
  email: string | null
  membership: Membership
  emailVerifiedAt: string | null
  withdrawnAt: string | null
  lastLoginAt: string | null
  termsAgreedAt: string | null
  termsVersionAgreedAt: string | null
  note: string | null
  createdAt: string
  updatedAt: string
  counts: { reservations: number, sales: number, vouchers: number, upcoming: number }
}

type Reservation = {
  id: number
  status: DbStatus
  confirmationCode: string
  startAt: string
  endAt: string
  store: { id: number, name: string }
  bed: { id: number, name: string }
  practitioner: { id: number, name: string }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
}
type ReservationListResponse = {
  items: Reservation[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

type Sale = {
  id: number
  storeId: number
  store: { id: number, name: string }
  product: { id: number, name: string, kind: 'PRODUCT' | 'VOUCHER' }
  quantity: number
  unitPriceJpyAtSale: number
  soldAt: string
  soldByPractitioner: { id: number, name: string } | null
  reservation: { id: number, confirmationCode: string } | null
}

type Voucher = {
  id: number
  totalUses: number
  remainingUses: number
  createdAt: string
  product: { id: number, name: string, priceJpy: number }
}

const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)
if (!Number.isInteger(id) || id <= 0) {
  throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
}

// ── タブ管理 ────────────────────────────────────────────
type TabId = 'basic' | 'reservations' | 'sales' | 'vouchers'
const tabs: { id: TabId, label: string }[] = [
  { id: 'basic', label: '基本情報' },
  { id: 'reservations', label: '来店履歴' },
  { id: 'sales', label: '物販・回数券' },
  { id: 'vouchers', label: '保有回数券' },
]
const activeTab = computed<TabId>(() => {
  const t = String(route.query.tab ?? 'basic')
  return tabs.find(x => x.id === t)?.id ?? 'basic'
})
function setTab(id: TabId) {
  router.replace({ query: { ...route.query, tab: id } })
}

// ── 基本情報 ─────────────────────────────────────────
const { data: customer, error: loadError, refresh: refreshCustomer } = await useFetch<CustomerDetail>(`/api/admin/customers/${id}`)
if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: '顧客が見つかりません' })
}

// ── 来店履歴 ────────────────────────────────────────
const { data: reservations, status: resStatus } = await useFetch<ReservationListResponse>('/api/admin/reservations', {
  query: { customerId: id, pageSize: 200 },
  lazy: true,
})

// ── 物販・回数券販売履歴 ──────────────────────────────
const { data: sales, status: salesStatus } = await useFetch<Sale[]>('/api/admin/sales', {
  query: { customerId: id },
  lazy: true,
})

// ── 保有回数券 ────────────────────────────────────────
const { data: vouchers, status: voucherStatus } = await useFetch<Voucher[]>(`/api/admin/customers/${id}/vouchers`, {
  lazy: true,
})

// ── 表示ヘルパ ───────────────────────────────────────
// fmtJstDate / fmtJstDateTime / fmtJstTime / yen は app/utils/format.ts の auto-import 経由。
// 会員区分バッジは shared/membership.ts の MEMBERSHIP_BADGE を流用。

function statusBadge(r: Reservation): { label: string, class: string } {
  const s = displayStatus(r.status, r.endAt)
  const cls
    = s === 'UPCOMING' ? 'bg-green-100 text-green-800 border-green-300'
      : s === 'COMPLETED' ? 'bg-blue-100 text-blue-800 border-blue-300'
        : s === 'NO_SHOW' ? 'bg-red-100 text-red-800 border-red-300'
          : 'bg-slate-100 text-slate-500 border-slate-300 line-through'
  return { label: DISPLAY_STATUS_LABEL[s], class: cls }
}

// 主要メトリクス
const visitCount = computed(() => {
  const list = reservations.value?.items ?? []
  return list.filter(r => displayStatus(r.status, r.endAt) === 'COMPLETED').length
})
const lastVisitAt = computed<string | null>(() => {
  const list = reservations.value?.items ?? []
  const completed = list.filter(r => displayStatus(r.status, r.endAt) === 'COMPLETED')
  if (completed.length === 0) return null
  return completed[0]!.startAt
})
const totalPaidJpy = computed(() => {
  const reservationTotal = (reservations.value?.items ?? [])
    .filter(r => displayStatus(r.status, r.endAt) === 'COMPLETED')
    .reduce((sum, r) => sum + r.menu.priceJpy, 0)
  const saleTotal = (sales.value ?? [])
    .reduce((sum, s) => sum + s.unitPriceJpyAtSale * s.quantity, 0)
  return reservationTotal + saleTotal
})

// ── サブテーブルのソート（クライアントサイド） ────────────
type SortDir = 'asc' | 'desc'

// 来店履歴: 日時 / 店舗 / メニュー / 担当 / 状態
type ReservationSortKey = 'startAt' | 'store' | 'menu' | 'practitioner' | 'status'
const resSortKey = ref<ReservationSortKey>('startAt')
const resSortDir = ref<SortDir>('desc')
function toggleResSort(key: ReservationSortKey) {
  if (resSortKey.value === key) resSortDir.value = resSortDir.value === 'asc' ? 'desc' : 'asc'
  else { resSortKey.value = key; resSortDir.value = key === 'startAt' ? 'desc' : 'asc' }
}
const sortedReservations = computed(() => {
  const list = [...(reservations.value?.items ?? [])]
  const dir = resSortDir.value === 'asc' ? 1 : -1
  const key = resSortKey.value
  list.sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (key === 'startAt') { av = a.startAt; bv = b.startAt }
    else if (key === 'store') { av = a.store.name; bv = b.store.name }
    else if (key === 'menu') { av = a.menu.name; bv = b.menu.name }
    else if (key === 'practitioner') { av = a.practitioner.name; bv = b.practitioner.name }
    else if (key === 'status') {
      av = displayStatus(a.status, a.endAt)
      bv = displayStatus(b.status, b.endAt)
    }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
  })
  return list
})

// 物販販売: 販売日時 / 店舗 / 商品 / 金額 / 担当 / 紐付け予約
type SaleSortKey = 'soldAt' | 'store' | 'product' | 'amount' | 'practitioner' | 'reservation'
const saleSortKey = ref<SaleSortKey>('soldAt')
const saleSortDir = ref<SortDir>('desc')
function toggleSaleSort(key: SaleSortKey) {
  if (saleSortKey.value === key) saleSortDir.value = saleSortDir.value === 'asc' ? 'desc' : 'asc'
  else { saleSortKey.value = key; saleSortDir.value = key === 'soldAt' ? 'desc' : 'asc' }
}
const sortedSales = computed(() => {
  const list = [...(sales.value ?? [])]
  const dir = saleSortDir.value === 'asc' ? 1 : -1
  const key = saleSortKey.value
  list.sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (key === 'soldAt') { av = a.soldAt; bv = b.soldAt }
    else if (key === 'store') { av = a.store.name; bv = b.store.name }
    else if (key === 'product') { av = a.product.name; bv = b.product.name }
    else if (key === 'amount') { av = a.unitPriceJpyAtSale * a.quantity; bv = b.unitPriceJpyAtSale * b.quantity }
    else if (key === 'practitioner') { av = a.soldByPractitioner?.name ?? ''; bv = b.soldByPractitioner?.name ?? '' }
    else if (key === 'reservation') { av = a.reservation?.confirmationCode ?? ''; bv = b.reservation?.confirmationCode ?? '' }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
  })
  return list
})

// 回数券: 回数券名 / 残回数 / 総回数 / 購入日 / 状態
type VoucherSortKey = 'product' | 'remaining' | 'total' | 'createdAt' | 'state'
const voucherSortKey = ref<VoucherSortKey>('createdAt')
const voucherSortDir = ref<SortDir>('desc')
function toggleVoucherSort(key: VoucherSortKey) {
  if (voucherSortKey.value === key) voucherSortDir.value = voucherSortDir.value === 'asc' ? 'desc' : 'asc'
  else { voucherSortKey.value = key; voucherSortDir.value = key === 'createdAt' ? 'desc' : 'asc' }
}
const sortedVouchers = computed(() => {
  const list = [...(vouchers.value ?? [])]
  const dir = voucherSortDir.value === 'asc' ? 1 : -1
  const key = voucherSortKey.value
  list.sort((a, b) => {
    let av: string | number = ''
    let bv: string | number = ''
    if (key === 'product') { av = a.product.name; bv = b.product.name }
    else if (key === 'remaining') { av = a.remainingUses; bv = b.remainingUses }
    else if (key === 'total') { av = a.totalUses; bv = b.totalUses }
    else if (key === 'createdAt') { av = a.createdAt; bv = b.createdAt }
    else if (key === 'state') {
      av = a.remainingUses > 0 ? 0 : 1
      bv = b.remainingUses > 0 ? 0 : 1
    }
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
  })
  return list
})

// ── 接客メモ編集 ─────────────────────────────────────
const canEdit = computed(() => hasPermission('customer:edit'))
const noteEdit = ref(customer.value?.note ?? '')
watch(() => customer.value?.note, v => { noteEdit.value = v ?? '' })
const noteSaving = ref(false)
const noteError = ref<string | null>(null)
const noteSaved = ref(false)
const noteDirty = computed(() => (customer.value?.note ?? '') !== noteEdit.value)

async function saveNote() {
  noteError.value = null
  noteSaved.value = false
  noteSaving.value = true
  try {
    await $fetch(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      body: { note: noteEdit.value },
    })
    await refreshCustomer()
    noteSaved.value = true
    setTimeout(() => { noteSaved.value = false }, 3000)
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    noteError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    noteSaving.value = false
  }
}
</script>

<template>
  <div>
    <AdminDetailHeader :title="customer?.name ?? '(復号失敗)'" back-to="/dashboard/customers" back-label="顧客一覧に戻る">
      <span
        v-if="customer"
        class="inline-block px-2 py-0.5 text-xs font-semibold rounded border"
        :class="MEMBERSHIP_BADGE[customer.membership].class"
      >
        {{ MEMBERSHIP_BADGE[customer.membership].label }}
      </span>
      <span
        v-if="customer?.withdrawnAt"
        class="text-xs text-slate-500"
      >
        {{ fmtJstDate(customer.withdrawnAt) }} に退会
      </span>
    </AdminDetailHeader>

    <!-- 主要メトリクス（5カラム・PC で常に 1 行） -->
    <div v-if="customer" class="flex flex-nowrap gap-3 mb-5">
      <div class="flex-1 min-w-0 bg-white border border-[#c3c4c7] rounded-sm p-3">
        <div class="text-xs text-slate-500 mb-1">
          来店回数（完了）
        </div>
        <div class="text-xl font-semibold tabular-nums">
          {{ visitCount }}<span class="text-sm text-slate-500 ml-1">回</span>
        </div>
      </div>
      <div class="flex-1 min-w-0 bg-white border border-[#c3c4c7] rounded-sm p-3">
        <div class="text-xs text-slate-500 mb-1">
          最終来店日
        </div>
        <div class="text-base font-semibold tabular-nums">
          {{ fmtJstDate(lastVisitAt) }}
        </div>
      </div>
      <div class="flex-1 min-w-0 bg-white border border-[#c3c4c7] rounded-sm p-3">
        <div class="text-xs text-slate-500 mb-1">
          予約中（来店予定）
        </div>
        <div class="text-xl font-semibold tabular-nums" :class="customer.counts.upcoming > 0 ? 'text-green-700' : 'text-slate-400'">
          {{ customer.counts.upcoming }}<span class="text-sm text-slate-500 ml-1">件</span>
        </div>
      </div>
      <div class="flex-1 min-w-0 bg-white border border-[#c3c4c7] rounded-sm p-3">
        <div class="text-xs text-slate-500 mb-1">
          累計支払額（概算）
        </div>
        <div class="text-xl font-semibold tabular-nums">
          ¥{{ yen(totalPaidJpy) }}
        </div>
      </div>
      <div class="flex-1 min-w-0 bg-white border border-[#c3c4c7] rounded-sm p-3">
        <div class="text-xs text-slate-500 mb-1">
          保有回数券
        </div>
        <div class="text-xl font-semibold tabular-nums">
          {{ (vouchers ?? []).filter(v => v.remainingUses > 0).length }}<span class="text-sm text-slate-500 ml-1">枚</span>
        </div>
      </div>
    </div>

    <!-- WP 風水平タブ（stores/[id].vue と同じスタイル） -->
    <div class="border-b border-[#c3c4c7] mb-5 flex">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        class="px-4 py-2 text-sm -mb-px border border-transparent transition-colors"
        :class="activeTab === t.id
          ? 'border-[#c3c4c7] border-b-white bg-white text-slate-900 font-semibold rounded-t-sm'
          : 'text-blue-700 hover:text-blue-900 hover:bg-[#f6f7f7]'"
        @click="setTab(t.id)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- 基本情報タブ -->
    <div v-if="activeTab === 'basic' && customer" class="space-y-4">
      <!-- PC: 2 列、SP: 1 列でセクションカードを並べる -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 連絡先・基本情報 -->
        <section class="bg-white border border-[#c3c4c7] rounded-sm p-5">
          <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 mb-3 border-b border-[#e8e9eb]">
            <UIcon name="i-lucide-id-card" class="size-4 text-slate-500" />
            連絡先・基本情報
          </h2>
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-start gap-3">
              <dt class="w-24 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                顧客ID
              </dt>
              <dd class="tabular-nums font-mono text-slate-700">
                #{{ customer.id }}
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-24 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                氏名
              </dt>
              <dd class="font-semibold">
                {{ customer.name ?? '(復号失敗)' }}
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-24 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                電話番号
              </dt>
              <dd class="flex items-center gap-1.5">
                <UIcon v-if="customer.phone" name="i-lucide-phone" class="size-3.5 text-slate-400" />
                <span :class="customer.phone ? 'tabular-nums' : 'text-slate-400'">{{ customer.phone ?? '—' }}</span>
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-24 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                メール
              </dt>
              <dd class="flex items-center gap-1.5 min-w-0">
                <UIcon v-if="customer.email" name="i-lucide-mail" class="size-3.5 text-slate-400 flex-shrink-0" />
                <span class="break-all" :class="customer.email ? '' : 'text-slate-400'">{{ customer.email ?? '—' }}</span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- 会員ステータス -->
        <section class="bg-white border border-[#c3c4c7] rounded-sm p-5">
          <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 mb-3 border-b border-[#e8e9eb]">
            <UIcon name="i-lucide-shield-check" class="size-4 text-slate-500" />
            会員ステータス
          </h2>
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-start gap-3">
              <dt class="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                会員区分
              </dt>
              <dd>
                <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded border" :class="MEMBERSHIP_BADGE[customer.membership].class">
                  {{ MEMBERSHIP_BADGE[customer.membership].label }}
                </span>
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                メール認証
              </dt>
              <dd class="flex items-center gap-1.5">
                <UIcon
                  :name="customer.emailVerifiedAt ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
                  class="size-3.5"
                  :class="customer.emailVerifiedAt ? 'text-green-600' : 'text-slate-400'"
                />
                <span class="tabular-nums" :class="customer.emailVerifiedAt ? '' : 'text-slate-400'">
                  {{ fmtJstDateTime(customer.emailVerifiedAt) }}
                </span>
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                最終ログイン
              </dt>
              <dd class="tabular-nums" :class="customer.lastLoginAt ? 'text-slate-700' : 'text-slate-400'">
                {{ fmtJstDateTime(customer.lastLoginAt) }}
              </dd>
            </div>
            <div class="flex items-start gap-3">
              <dt class="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                規約同意
              </dt>
              <dd class="tabular-nums" :class="customer.termsAgreedAt ? 'text-slate-700' : 'text-slate-400'">
                {{ fmtJstDateTime(customer.termsAgreedAt) }}
                <span v-if="customer.termsVersionAgreedAt" class="ml-1 text-xs text-slate-500">
                  ({{ customer.termsVersionAgreedAt }})
                </span>
              </dd>
            </div>
            <div v-if="customer.withdrawnAt" class="flex items-start gap-3 pt-2 mt-2 border-t border-[#e8e9eb]">
              <dt class="w-28 flex-shrink-0 text-xs text-slate-500 pt-0.5">
                退会日
              </dt>
              <dd class="flex items-center gap-1.5">
                <UIcon name="i-lucide-user-x" class="size-3.5 text-slate-500" />
                <span class="tabular-nums text-slate-700">{{ fmtJstDateTime(customer.withdrawnAt) }}</span>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <!-- 登録履歴（フル幅） -->
      <section class="bg-white border border-[#c3c4c7] rounded-sm p-5">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900 pb-2 mb-3 border-b border-[#e8e9eb]">
          <UIcon name="i-lucide-history" class="size-4 text-slate-500" />
          登録履歴
        </h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="flex items-center gap-3 bg-[#f6f7f7] border border-[#e8e9eb] rounded-sm px-3 py-2">
            <UIcon name="i-lucide-calendar-plus" class="size-4 text-slate-500 flex-shrink-0" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">
                登録日
              </dt>
              <dd class="tabular-nums font-semibold text-slate-800">
                {{ fmtJstDateTime(customer.createdAt) }}
              </dd>
            </div>
          </div>
          <div class="flex items-center gap-3 bg-[#f6f7f7] border border-[#e8e9eb] rounded-sm px-3 py-2">
            <UIcon name="i-lucide-pencil-line" class="size-4 text-slate-500 flex-shrink-0" />
            <div class="min-w-0">
              <dt class="text-xs text-slate-500">
                最終更新
              </dt>
              <dd class="tabular-nums font-semibold text-slate-800">
                {{ fmtJstDateTime(customer.updatedAt) }}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <p class="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <UIcon name="i-lucide-info" class="size-3.5 mt-0.5 flex-shrink-0" />
        個人情報の編集は会員本人がマイページから行います。誤登録やトラブル対応で管理者修正が必要な場合は開発者まで連絡してください。
      </p>

      <!-- 接客メモ -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-5">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold text-slate-900 inline-flex items-center gap-2">
            <UIcon name="i-lucide-sticky-note" class="size-4 text-amber-600" />
            接客メモ
          </h2>
          <span class="text-xs text-slate-500">管理者のみ閲覧可</span>
        </div>
        <p class="text-xs text-slate-600 mb-2 leading-relaxed">
          施術時の留意点・好み・体調傾向など。<span class="text-red-700">個人情報（電話・住所・既往症の詳細など）はここに書かないこと。</span>
        </p>
        <textarea
          v-model="noteEdit"
          rows="5"
          maxlength="2000"
          :disabled="!canEdit || noteSaving"
          class="w-full px-3 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-[#f6f7f7] disabled:text-slate-500 resize-y"
          placeholder="例: 左肩のみ施術可。腰痛持ち。お子様の話で盛り上がる。"
        />
        <div class="mt-2 flex items-center justify-between text-xs">
          <div class="text-slate-500 tabular-nums">
            {{ noteEdit.length }} / 2000
          </div>
          <div class="flex items-center gap-2">
            <span v-if="noteError" class="text-red-700">{{ noteError }}</span>
            <span v-else-if="noteSaved" class="text-green-700">保存しました</span>
            <button
              v-if="canEdit"
              type="button"
              class="px-3 py-1.5 text-sm rounded-sm disabled:opacity-40"
              :class="noteDirty
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'"
              :disabled="!noteDirty || noteSaving"
              @click="saveNote"
            >
              {{ noteSaving ? '保存中...' : 'メモを保存' }}
            </button>
            <span v-else class="text-slate-500">
              編集権限がありません
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 来店履歴タブ -->
    <div v-else-if="activeTab === 'reservations'">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead class="bg-[#f6f7f7]">
            <tr>
              <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">
                予約番号
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleResSort('startAt')"
              >
                日時
                <span class="text-slate-400 text-[10px] ml-1">{{ resSortKey === 'startAt' ? (resSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleResSort('store')"
              >
                店舗
                <span class="text-slate-400 text-[10px] ml-1">{{ resSortKey === 'store' ? (resSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleResSort('menu')"
              >
                メニュー
                <span class="text-slate-400 text-[10px] ml-1">{{ resSortKey === 'menu' ? (resSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleResSort('practitioner')"
              >
                担当
                <span class="text-slate-400 text-[10px] ml-1">{{ resSortKey === 'practitioner' ? (resSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleResSort('status')"
              >
                状態
                <span class="text-slate-400 text-[10px] ml-1">{{ resSortKey === 'status' ? (resSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="resStatus === 'pending'">
              <td colspan="6" class="px-3 py-10 text-center text-slate-500">
                読み込み中...
              </td>
            </tr>
            <tr v-else-if="sortedReservations.length === 0">
              <td colspan="6" class="px-3 py-10 text-center text-slate-500">
                来店履歴はありません
              </td>
            </tr>
            <tr
              v-for="r in sortedReservations"
              v-else
              :key="r.id"
              class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-orange-50/40 cursor-pointer"
              @click="router.push(`/dashboard/reservations/${r.id}`)"
            >
              <td class="px-3 py-2 tabular-nums font-mono text-xs">
                {{ r.confirmationCode }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                <span class="font-semibold">{{ fmtJstDateTime(r.startAt) }}</span>
                <span class="text-slate-500 text-xs">–{{ fmtJstTime(r.endAt) }}</span>
              </td>
              <td class="px-3 py-2">
                {{ r.store.name }}
              </td>
              <td class="px-3 py-2">
                {{ r.menu.name }}
                <span class="text-xs text-slate-500">({{ r.menu.durationMinutes }}分 / ¥{{ yen(r.menu.priceJpy) }})</span>
              </td>
              <td class="px-3 py-2 text-xs">
                {{ r.practitioner.name }}<br>
                <span class="text-slate-500">{{ r.bed.name }}</span>
              </td>
              <td class="px-3 py-2">
                <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded border" :class="statusBadge(r).class">
                  {{ statusBadge(r).label }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="reservations && reservations.total > reservations.items.length" class="mt-2 text-xs text-slate-500">
        最新 {{ reservations.items.length }} 件を表示中（全 {{ reservations.total }} 件）
      </p>
    </div>

    <!-- 物販・回数券販売タブ -->
    <div v-else-if="activeTab === 'sales'">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[760px]">
          <thead class="bg-[#f6f7f7]">
            <tr>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('soldAt')"
              >
                販売日時
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'soldAt' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('store')"
              >
                店舗
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'store' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('product')"
              >
                商品
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'product' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('amount')"
              >
                金額
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'amount' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('practitioner')"
              >
                担当
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'practitioner' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleSaleSort('reservation')"
              >
                紐付け予約
                <span class="text-slate-400 text-[10px] ml-1">{{ saleSortKey === 'reservation' ? (saleSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="salesStatus === 'pending'">
              <td colspan="6" class="px-3 py-10 text-center text-slate-500">
                読み込み中...
              </td>
            </tr>
            <tr v-else-if="sortedSales.length === 0">
              <td colspan="6" class="px-3 py-10 text-center text-slate-500">
                販売履歴はありません
              </td>
            </tr>
            <tr
              v-for="s in sortedSales"
              v-else
              :key="s.id"
              class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
            >
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
              <td class="px-3 py-2 text-right tabular-nums font-semibold">
                ¥{{ yen(s.unitPriceJpyAtSale * s.quantity) }}
              </td>
              <td class="px-3 py-2 text-xs text-slate-600">
                {{ s.soldByPractitioner?.name ?? '—' }}
              </td>
              <td class="px-3 py-2 font-mono text-xs">
                <NuxtLink
                  v-if="s.reservation"
                  :to="`/dashboard/reservations/${s.reservation.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline"
                >
                  {{ s.reservation.confirmationCode }}
                </NuxtLink>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 保有回数券タブ -->
    <div v-else-if="activeTab === 'vouchers'">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[560px]">
          <thead class="bg-[#f6f7f7]">
            <tr>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleVoucherSort('product')"
              >
                回数券
                <span class="text-slate-400 text-[10px] ml-1">{{ voucherSortKey === 'product' ? (voucherSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleVoucherSort('remaining')"
              >
                残回数
                <span class="text-slate-400 text-[10px] ml-1">{{ voucherSortKey === 'remaining' ? (voucherSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleVoucherSort('total')"
              >
                総回数
                <span class="text-slate-400 text-[10px] ml-1">{{ voucherSortKey === 'total' ? (voucherSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleVoucherSort('createdAt')"
              >
                購入日
                <span class="text-slate-400 text-[10px] ml-1">{{ voucherSortKey === 'createdAt' ? (voucherSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
              <th
                class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde] cursor-pointer select-none hover:bg-[#eef0f1]"
                @click="toggleVoucherSort('state')"
              >
                状態
                <span class="text-slate-400 text-[10px] ml-1">{{ voucherSortKey === 'state' ? (voucherSortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="voucherStatus === 'pending'">
              <td colspan="5" class="px-3 py-10 text-center text-slate-500">
                読み込み中...
              </td>
            </tr>
            <tr v-else-if="sortedVouchers.length === 0">
              <td colspan="5" class="px-3 py-10 text-center text-slate-500">
                保有している回数券はありません
              </td>
            </tr>
            <tr
              v-for="v in sortedVouchers"
              v-else
              :key="v.id"
              class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
              :class="v.remainingUses <= 0 ? 'opacity-60' : ''"
            >
              <td class="px-3 py-2 font-semibold">
                {{ v.product.name }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums" :class="v.remainingUses > 0 ? 'font-semibold text-green-700' : 'text-slate-400'">
                {{ v.remainingUses }}
              </td>
              <td class="px-3 py-2 text-right tabular-nums text-slate-600">
                {{ v.totalUses }}
              </td>
              <td class="px-3 py-2 tabular-nums">
                {{ fmtJstDate(v.createdAt) }}
              </td>
              <td class="px-3 py-2">
                <span
                  v-if="v.remainingUses > 0"
                  class="inline-block px-2 py-0.5 text-xs font-semibold rounded border bg-green-100 text-green-800 border-green-300"
                >
                  残あり
                </span>
                <span
                  v-else
                  class="inline-block px-2 py-0.5 text-xs font-semibold rounded border bg-slate-100 text-slate-500 border-slate-300"
                >
                  使い切り
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
