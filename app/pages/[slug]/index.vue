<script setup lang="ts">
// 予約フロー SPA コンテナ
// LIFF 組み込み想定で URL は /[slug] 固定。内部ステートで メニュー→日時→確認 を切替。
// 完了時のみ /complete/[code] へ通常遷移。
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
const { data: menus, status: menusStatus, error: menusError } = await useFetch<Menu[]>(() => `/api/stores/${slug.value}/menus`)

// 店舗名込みの動的タイトル + description(SSR 時に店舗データが取れていればそれを使う)。
useHead(() => {
  const s = store.value
  const title = s
    ? `${s.name} のご予約 | ほねキング整骨院グループ`
    : 'ご予約 | ほねキング整骨院グループ'
  const description = s
    ? `${s.prefecture}${s.city}「${s.name}」の Web 予約ページ。メニュー・日時を選んで 24 時間ご予約いただけます。`
    : '整骨院の Web 予約ページ。メニュー・日時を選んで 24 時間ご予約いただけます。'
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
    ],
  }
})

type StepName = 'menu' | 'datetime' | 'confirm'
const STEP_ORDER: StepName[] = ['menu', 'datetime', 'confirm']

const step = ref<StepName>('menu')
const selectedMenu = ref<Menu | null>(null)
const selectedStartAt = ref<string | null>(null)
const direction = ref<'forward' | 'back'>('forward')

const currentStepNumber = computed<2 | 3 | 4>(() => {
  if (step.value === 'menu') return 2
  if (step.value === 'datetime') return 3
  return 4
})

const transitionName = computed(() => direction.value === 'forward' ? 'slide-fwd' : 'slide-back')

function goTo(next: StepName) {
  const cur = STEP_ORDER.indexOf(step.value)
  const nxt = STEP_ORDER.indexOf(next)
  direction.value = nxt > cur ? 'forward' : 'back'
  step.value = next
  // 上部までスクロール(ステップ切替時に見出しが画面外にあると分かりにくいため)
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function onMenuSelect(menu: Menu) {
  selectedMenu.value = menu
  goTo('datetime')
}

function onDateTimeSelect(startAt: string) {
  selectedStartAt.value = startAt
  goTo('confirm')
}

function onBackToMenu() {
  goTo('menu')
}

function onBackToDateTime() {
  goTo('datetime')
}

async function onSubmitted(code: string) {
  await navigateTo(`/complete/${code}`)
}

// ステップインジケータの完了済みステップをクリックされたとき
async function onIndicatorNavigate(stepId: 1 | 2 | 3 | 4) {
  if (stepId === 1) {
    await navigateTo('/')
    return
  }
  if (stepId === 2) goTo('menu')
  else if (stepId === 3) goTo('datetime')
}

// LINE Login など外部リダイレクト経由で戻ってきた場合の予約フロー復元。
// AuthModal が sessionStorage に保存した state を読み、メニューと開始時刻を復元してステップ3にジャンプする。
// セッションキーは AuthModal と一致させること。
const RESUME_KEY = 'honeking_pending_reservation'
// 30 分以上経過した state は破棄(古い予約意図を勝手に復元しないため)
const RESUME_TTL_MS = 30 * 60 * 1000

onMounted(() => {
  if (!import.meta.client) return
  const raw = sessionStorage.getItem(RESUME_KEY)
  if (!raw) return
  sessionStorage.removeItem(RESUME_KEY)
  try {
    const saved = JSON.parse(raw) as { slug: string, menuId: number, startAt: string, savedAt?: number }
    if (saved.slug !== slug.value) return
    if (saved.savedAt && Date.now() - saved.savedAt > RESUME_TTL_MS) return
    const m = (menus.value ?? []).find(x => x.id === saved.menuId)
    if (!m) return
    selectedMenu.value = m
    selectedStartAt.value = saved.startAt
    step.value = 'confirm'
  }
  catch {
    // 壊れた JSON は無視
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8 overflow-x-hidden">
    <ReservationStepIndicator
      :current="currentStepNumber"
      class="mb-6"
      @navigate="onIndicatorNavigate"
    />

    <UAlert
      v-if="storeError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店舗の取得に失敗しました: ${storeError.message}`"
    />

    <div v-else-if="store" class="step-container">


      <Transition :name="transitionName" mode="out-in">
        <KeepAlive>
          <ReservationMenuStep
            v-if="step === 'menu'"
            key="menu"
            :store="store"
            :menus="menus ?? []"
            :status="menusStatus"
            :error="menusError"
            @select="onMenuSelect"
          />
          <ReservationDateTimeStep
            v-else-if="step === 'datetime' && selectedMenu"
            key="datetime"
            :store="store"
            :menu="selectedMenu"
            @select="onDateTimeSelect"
            @back="onBackToMenu"
          />
          <ReservationConfirmStep
            v-else-if="step === 'confirm' && selectedMenu && selectedStartAt"
            key="confirm"
            :store="store"
            :menu="selectedMenu"
            :start-at="selectedStartAt"
            @submitted="onSubmitted"
            @back="onBackToDateTime"
          />
        </KeepAlive>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* スライド中のクリップは親ラッパー(.overflow-x-hidden)側で行う。
   ここで overflow-x:hidden すると、日時カレンダーの SP フルブリード(-mx-4)が切れてしまうため設定しない。 */

/* 進む(右から入る・左へ出る) */
.slide-fwd-enter-active,
.slide-fwd-leave-active,
.slide-back-enter-active,
.slide-back-leave-active {
  transition: transform 0.32s ease-out, opacity 0.32s ease-out;
}
.slide-fwd-enter-from {
  transform: translateX(40px);
  opacity: 0;
}
.slide-fwd-leave-to {
  transform: translateX(-40px);
  opacity: 0;
}
/* 戻る(左から入る・右へ出る) */
.slide-back-enter-from {
  transform: translateX(-40px);
  opacity: 0;
}
.slide-back-leave-to {
  transform: translateX(40px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .slide-fwd-enter-active,
  .slide-fwd-leave-active,
  .slide-back-enter-active,
  .slide-back-leave-active {
    transition: opacity 0.15s linear;
  }
  .slide-fwd-enter-from,
  .slide-fwd-leave-to,
  .slide-back-enter-from,
  .slide-back-leave-to {
    transform: none;
  }
}
</style>
