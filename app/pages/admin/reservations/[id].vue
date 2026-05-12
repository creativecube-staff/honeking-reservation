<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id ?? 0))

type ReservationDetail = {
  id: number
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW'
  confirmationCode: string
  startAt: string
  endAt: string
  note: string | null
  cancelledAt: string | null
  createdAt: string
  store: { id: number, name: string, address: string, phone: string | null }
  bed: { id: number, name: string }
  practitioner: { id: number, name: string, storeId: number }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number }
  customer: { id: number, name: string | null, phone: string | null, email: string | null }
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
function yen(n: number): string { return n.toLocaleString('ja-JP') }
function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

const submitting = ref(false)
const errorMessage = ref<string | null>(null)

async function changeStatus(newStatus: 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'CONFIRMED') {
  if (!reservation.value) return
  if (submitting.value) return
  const msg = {
    CANCELLED: '本当にこの予約をキャンセルしますか?（同じ枠は再予約可能になります）',
    COMPLETED: 'この予約を「完了」にしますか?',
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

function statusBadge(status: string): { label: string, class: string } {
  switch (status) {
    case 'CONFIRMED':
      return { label: '予約済', class: 'bg-green-100 text-green-800 border-green-300' }
    case 'CANCELLED':
      return { label: 'キャンセル', class: 'bg-slate-100 text-slate-500 border-slate-300' }
    case 'COMPLETED':
      return { label: '完了', class: 'bg-blue-100 text-blue-800 border-blue-300' }
    case 'NO_SHOW':
      return { label: '無断キャンセル', class: 'bg-red-100 text-red-800 border-red-300' }
    default:
      return { label: status, class: 'bg-slate-100 text-slate-700 border-slate-300' }
  }
}
</script>

<template>
  <div>
    <div class="mb-4">
      <NuxtLink to="/admin/reservations" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
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
        <span class="inline-block px-3 py-1 text-sm font-semibold rounded border" :class="statusBadge(reservation.status).class">
          {{ statusBadge(reservation.status).label }}
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
        <!-- 予約情報 -->
        <div class="bg-white border border-[#c3c4c7] rounded-sm">
          <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
            <h2 class="text-sm font-semibold text-slate-900">
              予約情報
            </h2>
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
                  {{ reservation.practitioner.name }}
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
                {{ reservation.customer.name ?? '(復号できませんでした)' }}
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

      <!-- ステータス変更 -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="text-sm font-semibold text-slate-900">
            ステータス変更
          </h2>
        </div>
        <div class="p-4 flex flex-wrap gap-2">
          <button
            v-if="reservation.status !== 'CONFIRMED'"
            type="button"
            class="px-3 py-1.5 text-sm rounded-sm border border-green-300 bg-green-50 hover:bg-green-100 text-green-800 disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('CONFIRMED')"
          >
            予約済に戻す
          </button>
          <button
            v-if="reservation.status === 'CONFIRMED'"
            type="button"
            class="px-3 py-1.5 text-sm rounded-sm border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('COMPLETED')"
          >
            完了にする
          </button>
          <button
            v-if="reservation.status === 'CONFIRMED'"
            type="button"
            class="px-3 py-1.5 text-sm rounded-sm border border-red-300 bg-red-50 hover:bg-red-100 text-red-800 disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('NO_SHOW')"
          >
            無断キャンセル
          </button>
          <button
            v-if="reservation.status !== 'CANCELLED'"
            type="button"
            class="ml-auto px-3 py-1.5 text-sm rounded-sm border border-red-400 bg-red-100 hover:bg-red-200 text-red-900 font-semibold disabled:opacity-50"
            :disabled="submitting"
            @click="changeStatus('CANCELLED')"
          >
            この予約をキャンセル
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
