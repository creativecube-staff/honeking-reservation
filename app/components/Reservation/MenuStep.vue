<script setup lang="ts">
// 予約フロー(SPA) ステップ 1/3: メニュー選択
type Store = {
  id: number
  slug: string
  prefecture: string
  city: string
  name: string
  address: string
  phone: string | null
}

type Menu = {
  id: number
  storeId: number | null
  name: string
  description: string | null
  durationMinutes: number
  priceJpy: number
  availableFrom: string | null
  availableUntil: string | null
}

interface Props {
  store: Store
  menus: Menu[]
  status: 'idle' | 'pending' | 'success' | 'error'
  error: { message: string } | null | undefined
}
const props = defineProps<Props>()

const emit = defineEmits<{
  select: [menu: Menu]
}>()

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

// 期間限定バッジ用: ISO 日付 (YYYY-MM-DDT...) を "M/D" 形式に
function formatBadgeDate(iso: string): string {
  const ymd = iso.slice(0, 10)
  const [, m, d] = ymd.split('-')
  return `${Number(m)}/${Number(d)}`
}

const commonMenus = computed(() => (props.menus ?? []).filter(m => m.storeId === null))
const specialMenus = computed(() => (props.menus ?? []).filter(m => m.storeId !== null))
</script>

<template>
  <div>
    <!-- 中央寄せ見出し(店舗選択ページと同パターン) -->
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
        ご希望の<span class="text-orange-600">施術メニュー</span>を<br class="sm:hidden">選んでください
      </h1>
      <p class="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-full px-3.5 py-1.5">
        <UIcon name="i-lucide-mouse-pointer-click" class="shrink-0 w-3.5 h-3.5 text-orange-600" />
        タップして「日時選択」へ進みます
      </p>
      <div class="mt-4 flex justify-center">
        <UIcon name="i-lucide-chevron-down" class="w-6 h-6 text-orange-500 animate-bounce" />
      </div>
    </div>

    <!-- 予約中の店舗ストリップ(見出しの下) -->
    <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-6">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-store" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご予約中の店舗</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ store.name }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-xs sm:text-sm text-slate-700 leading-tight">{{ store.prefecture }}{{ store.city }}</p>
      </div>
    </div>

    <div v-if="status === 'pending'" class="text-slate-600 py-10 text-center">
      読み込み中...
    </div>

    <UAlert
      v-else-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`メニューの取得に失敗しました: ${error.message}`"
    />

    <UAlert
      v-else-if="(menus ?? []).length === 0"
      color="warning"
      icon="i-lucide-info"
      title="ご予約いただけるメニューがありません。"
    />

    <div v-else class="space-y-10">
      <!-- 特別メニュー(店舗オリジナル)を上に -->
      <section v-if="specialMenus.length > 0">
        <h2 class="text-lg font-bold text-slate-900 border-b-2 border-orange-400 pb-2 mb-4 flex items-center gap-2">
          <UIcon name="i-lucide-sparkles" class="size-5 text-orange-500" />
          特別メニュー
        </h2>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="m in specialMenus" :key="m.id" class="h-full">
            <button
              type="button"
              class="menu-card w-full h-full text-left flex flex-col rounded-xl border-2 border-orange-400 bg-orange-50 p-4 transition hover:bg-white hover:border-orange-600 hover:shadow-md cursor-pointer relative"
              @click="emit('select', m)"
            >
              <!-- 期間限定バッジ(コーナーステッカー風、傾きあり) -->
              <span
                v-if="m.availableUntil"
                class="absolute -top-2 -left-2 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500 text-white text-[10px] sm:text-xs font-extrabold shadow-md ring-2 ring-white rotate-[-4deg]"
              >
                <UIcon name="i-lucide-sparkles" class="size-3" />
                期間限定 〜{{ formatBadgeDate(m.availableUntil) }}
              </span>

              <!-- 名前(大きく強調) -->
              <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {{ m.name }}
              </h3>

              <!-- 金額ブロック(目立たせ) -->
              <div class="mt-2 mb-3 flex items-baseline justify-center gap-1.5 py-2 rounded-lg bg-white/60">
                <p class="text-3xl sm:text-4xl font-extrabold text-orange-600 tabular-nums leading-none">
                  ¥{{ yen(m.priceJpy) }}
                </p>
                <span class="text-[10px] sm:text-xs text-slate-500 font-medium">税込</span>
              </div>

              <!-- 説明文(3行までで揃える) -->
              <p
                v-if="m.description"
                class="text-xs sm:text-sm text-slate-700 leading-snug line-clamp-3 mb-3"
              >
                {{ m.description }}
              </p>

              <!-- 施術時間(目立つピル) + CTA -->
              <div class="mt-auto pt-2 border-t border-orange-200 flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-100 text-orange-800 text-sm font-bold">
                  <UIcon name="i-lucide-clock" class="size-4" />
                  {{ duration(m.durationMinutes) }}
                </span>
                <span class="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                  予約する
                  <UIcon name="i-lucide-chevron-right" class="size-4" />
                </span>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <!-- 共通メニュー -->
      <section v-if="commonMenus.length > 0">
        <h2 class="text-lg font-bold text-slate-900 border-b-2 border-amber-300 pb-2 mb-4">
          施術メニュー
        </h2>
        <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="m in commonMenus" :key="m.id" class="h-full">
            <button
              type="button"
              class="menu-card w-full h-full text-left flex flex-col rounded-xl border-2 border-amber-300 bg-[#fff3db] p-4 transition hover:bg-white hover:border-orange-500 hover:shadow-md cursor-pointer"
              @click="emit('select', m)"
            >
              <!-- 名前(大きく強調) -->
              <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight tracking-tight">
                {{ m.name }}
              </h3>

              <!-- 金額ブロック -->
              <div class="mt-2 mb-3 flex items-baseline justify-center gap-1.5 py-2 rounded-lg bg-white/70">
                <p class="text-3xl sm:text-4xl font-extrabold text-orange-600 tabular-nums leading-none">
                  ¥{{ yen(m.priceJpy) }}
                </p>
                <span class="text-[10px] sm:text-xs text-slate-500 font-medium">税込</span>
              </div>

              <p
                v-if="m.description"
                class="text-xs sm:text-sm text-slate-700 leading-snug line-clamp-3 mb-3"
              >
                {{ m.description }}
              </p>

              <!-- 施術時間(目立つピル) + CTA -->
              <div class="mt-auto pt-2 border-t border-amber-200 flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-200 text-amber-900 text-sm font-bold">
                  <UIcon name="i-lucide-clock" class="size-4" />
                  {{ duration(m.durationMinutes) }}
                </span>
                <span class="inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                  予約する
                  <UIcon name="i-lucide-chevron-right" class="size-4" />
                </span>
              </div>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
