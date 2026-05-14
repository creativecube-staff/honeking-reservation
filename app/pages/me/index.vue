<script setup lang="ts">
// マイページ ダッシュボード
// - 今後の予約 を全て表示（店舗地図つき）
// - 過去の予約 も全て表示（コンパクトに）
// - 設定カード 3 つ
//
// 表示ポリシー: 会員視点では NO_SHOW を「キャンセル」と統一表示する。
// DB の status 値は維持し、管理画面側では引き続き区別する。

definePageMeta({ middleware: 'member-auth' })
useHead({ title: 'マイページ | ほねキング整骨院 予約' })

const { member } = useMember()

type DisplayStatus = 'UPCOMING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
type Reservation = {
  id: number
  startAt: string
  endAt: string
  status: string
  displayStatus: DisplayStatus
  confirmationCode: string
  note: string | null
  store: { id: number, name: string, slug: string, phone: string | null, address: string, isActive: boolean }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number, isActive: boolean }
  practitionerName: string
}

const { data: reservations, pending } = await useFetch<Reservation[]>('/api/member/reservations', {
  key: 'me-reservations',
})

// 今後の予約 / 過去の予約
const upcoming = computed(() => {
  const list = (reservations.value ?? []).filter(r => r.displayStatus === 'UPCOMING')
  list.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
  return list
})
const past = computed(() => {
  return (reservations.value ?? []).filter(r => r.displayStatus !== 'UPCOMING')
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日(${dow}) ${hh}:${mm}`
}

function endTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 会員ページ用のステータス表示（NO_SHOW は「キャンセル」扱い）
const MEMBER_STATUS_LABEL: Record<DisplayStatus, string> = {
  UPCOMING: '予約済',
  COMPLETED: '完了',
  NO_SHOW: 'キャンセル',
  CANCELLED: 'キャンセル',
}
const MEMBER_STATUS_BADGE: Record<DisplayStatus, string> = {
  UPCOMING: 'bg-green-100 text-green-800 border-green-300',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
  NO_SHOW: 'bg-slate-100 text-slate-500 border-slate-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-300',
}

// Google Maps 埋め込み URL（API キー不要の legacy 形式）
function mapEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`
}
function mapOpenUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

// honeking.jp の店舗外観画像 URL（slug ベースで一意に決まる、トップページと同じ規約）
function storeImageUrl(slug: string): string {
  return `https://honeking.jp/wp/wp-content/themes/honeking/assets/img/shops/${slug}/${slug}-img@2x.jpg`
}

// 画像読み込み失敗時は親要素ごと非表示にする
function hideOnError(event: Event) {
  const img = event.target as HTMLImageElement
  const wrap = img.closest('[data-store-image]') as HTMLElement | null
  if (wrap) wrap.style.display = 'none'
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 sm:px-6 py-8">
    <!-- ウェルカム -->
    <div class="flex items-center gap-3 mb-6">
      <div class="size-12 shrink-0 rounded-full bg-orange-500 flex items-center justify-center">
        <UIcon name="i-lucide-circle-user-round" class="size-7 text-white" />
      </div>
      <div>
        <p class="text-xs text-slate-500">ようこそ</p>
        <p class="text-lg font-bold text-slate-900">
          {{ member?.name }} 様
        </p>
      </div>
    </div>

    <!-- 今後の予約 -->
    <section class="mb-8">
      <h2 class="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-calendar-check" class="size-5 text-orange-500" />
        今後のご予約
        <span v-if="upcoming.length > 0" class="text-sm font-normal text-slate-500">（{{ upcoming.length }} 件）</span>
      </h2>

      <div v-if="pending" class="text-center py-6 text-slate-400 text-sm">
        <UIcon name="i-lucide-loader-circle" class="size-5 mx-auto animate-spin mb-1" />
        読み込み中...
      </div>

      <div
        v-else-if="upcoming.length === 0"
        class="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500"
      >
        <UIcon name="i-lucide-calendar-off" class="size-7 mx-auto mb-2 text-slate-400" />
        現在ご予約はありません
        <div class="mt-3">
          <NuxtLink
            to="/"
            class="inline-block px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition"
          >
            ご予約はこちら
          </NuxtLink>
        </div>
      </div>

      <div v-else class="space-y-4">
        <article
          v-for="r in upcoming"
          :key="r.id"
          class="rounded-xl border-2 border-amber-300 bg-[#fff3db] overflow-hidden"
        >
          <!-- SP のみ: 日付を独立行で上に表示（date date 行） -->
          <p class="sm:hidden px-3 pt-3 text-base font-bold text-orange-800 tabular-nums text-center">
            {{ formatDateTime(r.startAt) }} – {{ endTime(r.endAt) }}
          </p>

          <!-- 上段: img | info の 2 カラム（SP では日付なし、PC では日付込み） -->
          <div class="flex gap-3 p-3">
            <!-- 店舗外観画像（読み込み失敗時はサムネごと非表示） -->
            <div
              data-store-image
              class="size-24 sm:size-28 shrink-0 overflow-hidden rounded-lg bg-amber-100"
            >
              <img
                :src="storeImageUrl(r.store.slug)"
                :alt="`${r.store.name} の外観`"
                class="w-full h-full object-cover"
                loading="lazy"
                @error="hideOnError"
              >
            </div>

            <div class="flex-1 min-w-0 space-y-1">
              <!-- PC のみ: 日付を情報カラム内に表示 -->
              <p class="hidden sm:block text-lg font-bold text-orange-800 tabular-nums leading-tight">
                {{ formatDateTime(r.startAt) }} – {{ endTime(r.endAt) }}
              </p>
              <p class="text-sm font-semibold text-slate-900 truncate">
                {{ r.store.name }}
              </p>
              <p class="text-xs text-slate-600 truncate">
                {{ r.menu.name }}（{{ r.menu.durationMinutes }} 分）
              </p>
              <p v-if="r.note" class="text-xs text-slate-500 truncate">
                <span class="text-slate-400">ご要望:</span> {{ r.note }}
              </p>

              <!-- 電話案内: SP は縦積み button、PC は横並び枠なしテキスト -->
              <template v-if="r.store.phone">
                <!-- SP のみ -->
                <div class="sm:hidden pt-1">
                  <p class="text-[10px] text-slate-500 leading-none mb-1">
                    変更・キャンセルはお電話で
                  </p>
                  <a
                    :href="`tel:${r.store.phone.replace(/[^\d+]/g, '')}`"
                    class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm tabular-nums transition"
                  >
                    <UIcon name="i-lucide-phone" class="size-3.5" />
                    {{ r.store.phone }}
                  </a>
                </div>
                <!-- PC のみ: 電話番号 → 注釈 の順、番号は少し大きく -->
                <p class="hidden sm:flex sm:items-baseline sm:gap-2 pt-0.5">
                  <span class="inline-flex items-center gap-1 text-base font-bold text-orange-800 tabular-nums">
                    <UIcon name="i-lucide-phone" class="size-4" />
                    {{ r.store.phone }}
                  </span>
                  <span class="text-xs text-slate-600">変更・キャンセルはお電話で</span>
                </p>
              </template>
            </div>
          </div>

          <!-- 地図（アコーディオン）-->
          <details class="group border-t border-amber-300 bg-white">
            <summary
              class="list-none [&::-webkit-details-marker]:hidden cursor-pointer px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-amber-50 transition"
            >
              <span class="inline-flex items-center gap-1.5">
                <UIcon name="i-lucide-map-pin" class="size-4 text-orange-600" />
                <span class="group-open:hidden">地図を見る</span>
                <span class="hidden group-open:inline">地図を閉じる</span>
              </span>
              <UIcon name="i-lucide-chevron-down" class="size-4 transition group-open:rotate-180" />
            </summary>
            <div>
              <iframe
                :src="mapEmbedUrl(r.store.address)"
                class="w-full h-48 sm:h-56 block"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                :title="`${r.store.name} の地図`"
              />
              <a
                :href="mapOpenUrl(r.store.address)"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-center gap-1 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 border-t border-slate-200 transition"
              >
                <UIcon name="i-lucide-map" class="size-3.5" />
                Google マップで開く
                <UIcon name="i-lucide-external-link" class="size-3" />
              </a>
            </div>
          </details>
        </article>
      </div>
    </section>

    <!-- 過去の予約 -->
    <section v-if="!pending && past.length > 0" class="mb-8">
      <h2 class="text-base font-bold text-slate-700 flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-history" class="size-5 text-slate-500" />
        過去のご予約
        <span class="text-sm font-normal text-slate-500">（{{ past.length }} 件）</span>
      </h2>

      <div class="space-y-2">
        <article
          v-for="r in past"
          :key="r.id"
          class="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div class="flex items-start justify-between gap-2 mb-1">
            <span
              class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border"
              :class="MEMBER_STATUS_BADGE[r.displayStatus]"
            >
              {{ MEMBER_STATUS_LABEL[r.displayStatus] }}
            </span>
            <span class="text-xs text-slate-400 tabular-nums">
              {{ r.confirmationCode }}
            </span>
          </div>
          <p class="text-sm font-semibold text-slate-800 tabular-nums">
            {{ formatDateTime(r.startAt) }}
          </p>
          <p class="text-xs text-slate-600 mt-0.5">
            {{ r.store.name }} / {{ r.menu.name }}
          </p>
          <!-- 同じ施術で再予約: 店舗もメニューも現役の場合のみ -->
          <div v-if="r.store.isActive && r.menu.isActive" class="mt-2 flex justify-end">
            <NuxtLink
              :to="`/${r.store.slug}/${r.menu.id}`"
              class="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition"
            >
              <UIcon name="i-lucide-rotate-cw" class="size-3.5" />
              同じ施術で予約
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <!-- 各種設定（3 つ） -->
    <section class="mb-8">
      <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
        各種設定
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NuxtLink
          to="/me/profile"
          class="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 transition text-center"
        >
          <UIcon name="i-lucide-user-pen" class="size-7 text-orange-500" />
          <div>
            <p class="font-semibold text-slate-900 text-sm">プロフィール</p>
            <p class="text-xs text-slate-500">お名前・電話番号</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/me/email-change"
          class="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 transition text-center"
        >
          <UIcon name="i-lucide-mail" class="size-7 text-orange-500" />
          <div>
            <p class="font-semibold text-slate-900 text-sm">メールアドレス</p>
            <p class="text-xs text-slate-500">確認メール経由で変更</p>
          </div>
        </NuxtLink>

        <NuxtLink
          to="/me/password"
          class="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50 transition text-center"
        >
          <UIcon name="i-lucide-key-round" class="size-7 text-orange-500" />
          <div>
            <p class="font-semibold text-slate-900 text-sm">パスワード</p>
            <p class="text-xs text-slate-500">セキュリティ管理</p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- 退会（控えめ） -->
    <div class="border-t border-slate-200 pt-6">
      <NuxtLink
        to="/me/withdraw"
        class="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-red-700 underline underline-offset-2"
      >
        <UIcon name="i-lucide-user-x" class="size-3.5" />
        退会のお手続き
      </NuxtLink>
    </div>
  </div>
</template>
