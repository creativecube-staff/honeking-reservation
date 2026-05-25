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
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
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
.step-container {
  /* スライド中に隣のステップが見えないようにクリップ */
  overflow-x: hidden;
}

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
