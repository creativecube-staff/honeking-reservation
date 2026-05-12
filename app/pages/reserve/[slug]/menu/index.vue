<script setup lang="ts">
// 予約フロー 1/4: メニュー選択
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

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

const { data: store, error: storeError } = await useFetch<Store>(() => `/api/stores/${slug.value}`)
const { data: menus, status, error: menusError } = await useFetch<Menu[]>(() => `/api/stores/${slug.value}/menus`)

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

// 共通メニューと特別メニューに分けて表示
const commonMenus = computed(() => (menus.value ?? []).filter(m => m.storeId === null))
const specialMenus = computed(() => (menus.value ?? []).filter(m => m.storeId !== null))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 sm:px-6 py-8">
    <!-- ステップインジケーター -->
    <ol class="flex items-center text-xs sm:text-sm text-slate-500 mb-6 gap-2">
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">1</span>
        <span>店舗</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1 font-semibold text-orange-700">
        <span class="size-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">2</span>
        <span>メニュー</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">3</span>
        <span>日時</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">4</span>
        <span>確認</span>
      </li>
    </ol>

    <UAlert
      v-if="storeError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店舗の取得に失敗しました: ${storeError.message}`"
    />

    <div v-else-if="store">
      <p class="text-sm text-slate-600">
        {{ store.prefecture }} / {{ store.city }}
      </p>
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 mb-2">
        {{ store.name }}
      </h1>
      <p class="text-sm text-slate-700 mb-6">
        ご希望の施術メニューをお選びください。
      </p>

      <div v-if="status === 'pending'" class="text-slate-600 py-10 text-center">
        読み込み中...
      </div>

      <UAlert
        v-else-if="menusError"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="`メニューの取得に失敗しました: ${menusError.message}`"
      />

      <UAlert
        v-else-if="(menus ?? []).length === 0"
        color="warning"
        icon="i-lucide-info"
        title="ご予約いただけるメニューがありません。"
      />

      <div v-else class="space-y-8">
        <!-- 共通メニュー -->
        <section v-if="commonMenus.length > 0">
          <h2 class="text-lg font-bold text-slate-900 border-b-2 border-amber-300 pb-2 mb-4">
            施術メニュー
          </h2>
          <ul class="space-y-3">
            <li v-for="m in commonMenus" :key="m.id">
              <NuxtLink
                :to="`/reserve/${slug}/menu/${m.id}/datetime`"
                class="block rounded-xl border-2 border-amber-300 bg-[#fff3db] p-4 sm:p-5 transition hover:bg-white hover:border-orange-500 hover:shadow-md"
              >
                <div class="flex items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-base sm:text-lg font-bold text-slate-900">
                      {{ m.name }}
                    </h3>
                    <p v-if="m.description" class="mt-1 text-sm text-slate-700 whitespace-pre-line">
                      {{ m.description }}
                    </p>
                    <div class="mt-2 flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                      <span class="inline-flex items-center gap-1">
                        <UIcon name="i-lucide-clock" class="size-4" />
                        {{ duration(m.durationMinutes) }}
                      </span>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-xl sm:text-2xl font-bold text-orange-700 tabular-nums">
                      ¥{{ yen(m.priceJpy) }}
                    </p>
                    <p class="text-xs text-slate-500 mt-0.5">
                      税込
                    </p>
                  </div>
                </div>
                <div class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                  このメニューで進む
                  <UIcon name="i-lucide-chevron-right" class="size-4" />
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <!-- 特別メニュー -->
        <section v-if="specialMenus.length > 0">
          <h2 class="text-lg font-bold text-slate-900 border-b-2 border-orange-400 pb-2 mb-4">
            この店舗の特別メニュー
          </h2>
          <ul class="space-y-3">
            <li v-for="m in specialMenus" :key="m.id">
              <NuxtLink
                :to="`/reserve/${slug}/menu/${m.id}/datetime`"
                class="block rounded-xl border-2 border-orange-400 bg-orange-50 p-4 sm:p-5 transition hover:bg-white hover:border-orange-600 hover:shadow-md"
              >
                <div class="flex items-start gap-4">
                  <div class="flex-1 min-w-0">
                    <h3 class="text-base sm:text-lg font-bold text-slate-900">
                      {{ m.name }}
                    </h3>
                    <p v-if="m.description" class="mt-1 text-sm text-slate-700 whitespace-pre-line">
                      {{ m.description }}
                    </p>
                    <div class="mt-2 flex items-center gap-3 text-xs sm:text-sm text-slate-600">
                      <span class="inline-flex items-center gap-1">
                        <UIcon name="i-lucide-clock" class="size-4" />
                        {{ duration(m.durationMinutes) }}
                      </span>
                      <span v-if="m.availableUntil" class="inline-flex items-center gap-1 text-orange-700">
                        <UIcon name="i-lucide-calendar" class="size-4" />
                        {{ m.availableUntil.slice(0, 10) }} まで
                      </span>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-xl sm:text-2xl font-bold text-orange-700 tabular-nums">
                      ¥{{ yen(m.priceJpy) }}
                    </p>
                    <p class="text-xs text-slate-500 mt-0.5">
                      税込
                    </p>
                  </div>
                </div>
                <div class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
                  このメニューで進む
                  <UIcon name="i-lucide-chevron-right" class="size-4" />
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>

      <div class="mt-8">
        <NuxtLink to="/" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
          <UIcon name="i-lucide-chevron-left" class="size-4" />
          店舗選択に戻る
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
