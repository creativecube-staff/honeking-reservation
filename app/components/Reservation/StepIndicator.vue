<script setup lang="ts">
type StepId = 1 | 2 | 3 | 4
type TagValue = { primary: string, secondary?: string }
interface Props {
  current: StepId
  // ステップ円の下に表示する小さなタグ(完了済みステップで選択値を見せる用)。
  // primary が主な値(例: 店舗名)、secondary は補助情報(例: 都道府県+市)
  tags?: Partial<Record<StepId, TagValue>>
}
const props = defineProps<Props>()

const emit = defineEmits<{
  // done 状態のステップをクリックすると stepId を emit。親が遷移処理を行う。
  navigate: [stepId: StepId]
}>()

type StepDef = { id: StepId, label: string, shortLabel: string }
const steps: ReadonlyArray<StepDef> = [
  { id: 1, label: '予約店舗', shortLabel: '店舗' },
  { id: 2, label: 'メニューを選ぶ', shortLabel: 'メニュー' },
  { id: 3, label: '日時を選ぶ', shortLabel: '日時' },
  { id: 4, label: '予約内容の確認', shortLabel: '確認' },
]

function stepState(id: number): 'done' | 'current' | 'todo' {
  if (id < props.current) return 'done'
  if (id === props.current) return 'current'
  return 'todo'
}

function onStepClick(id: StepId) {
  if (stepState(id) === 'done') {
    emit('navigate', id)
  }
}

// 初回マウント後に 0% → 進捗% へラインを伸ばすアニメーション用フラグ
const mounted = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    mounted.value = true
  })
})
</script>

<template>
  <ol class="flex items-start w-full sm:max-w-2xl sm:mx-auto">
    <template v-for="(step, i) in steps" :key="step.id">
      <li v-if="i > 0" class="flex-1 pt-[34px] sm:pt-[40px]">
        <div class="h-1 bg-slate-200 rounded-full overflow-hidden">
          <div
            class="h-full bg-orange-500 rounded-full transition-[width] duration-700 ease-out"
            :class="(mounted && step.id <= current) ? 'w-full' : 'w-0'"
          />
        </div>
      </li>
      <li
        :class="[
          'relative flex flex-col items-center gap-1 shrink-0 transition-opacity',
          stepState(step.id) === 'done' && 'cursor-pointer hover:opacity-75',
        ]"
        :role="stepState(step.id) === 'done' ? 'button' : undefined"
        :tabindex="stepState(step.id) === 'done' ? 0 : undefined"
        @click="onStepClick(step.id)"
        @keydown.enter="onStepClick(step.id)"
        @keydown.space.prevent="onStepClick(step.id)"
      >
        <!-- ラベル(円の上) -->
        <span
          :class="[
            'text-xs sm:text-sm whitespace-nowrap transition-colors duration-500 text-center leading-tight',
            stepState(step.id) === 'current' && 'text-orange-700 font-bold',
            stepState(step.id) === 'done' && 'text-slate-700 font-medium',
            stepState(step.id) === 'todo' && 'text-slate-400',
          ]"
        >
          <span class="sm:hidden">{{ step.shortLabel }}</span>
          <span class="hidden sm:inline">{{ step.label }}</span>
        </span>
        <!-- 円(中央) -->
        <span
          :class="[
            'flex items-center justify-center rounded-full font-bold transition-all duration-500',
            'size-9 sm:size-11 text-sm sm:text-base',
            stepState(step.id) === 'done' && 'bg-orange-500 text-white shadow-sm',
            stepState(step.id) === 'current' && 'bg-orange-500 text-white scale-110 animate-pulse-ring',
            stepState(step.id) === 'todo' && 'bg-white border-2 border-slate-200 text-slate-400',
          ]"
        >
          <UIcon
            v-if="stepState(step.id) === 'done'"
            name="i-lucide-check"
            class="w-4 h-4 sm:w-5 sm:h-5 animate-pop-in"
          />
          <template v-else>{{ step.id }}</template>
        </span>
        <!-- 選択値タグ(円の下に絶対配置 = カラム幅に影響しない) -->
        <!-- 端のステップは左右ぶつかり回避のため端寄せ、中央のステップは円中央に揃える -->
        <span
          v-if="props.tags?.[step.id]"
          :class="[
            'indicator-tag absolute top-full mt-1 flex flex-col items-center max-w-[130px] sm:max-w-[180px] px-2 py-1 rounded-md bg-orange-500 text-white shadow-sm leading-tight z-10',
            i === 0 && 'left-0',
            i === steps.length - 1 && 'right-0',
            i !== 0 && i !== steps.length - 1 && 'left-1/2 -translate-x-1/2',
          ]"
        >
          <span class="text-[10px] sm:text-xs font-semibold truncate max-w-full">
            {{ props.tags?.[step.id]?.primary }}
          </span>
          <span
            v-if="props.tags?.[step.id]?.secondary"
            class="text-[9px] sm:text-[10px] opacity-90 mt-0.5 truncate max-w-full"
          >
            {{ props.tags?.[step.id]?.secondary }}
          </span>
        </span>
      </li>
    </template>
  </ol>
</template>

<style scoped>
@keyframes pulse-ring {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.55);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(249, 115, 22, 0);
  }
}
.animate-pulse-ring {
  animation: pulse-ring 2s ease-in-out infinite;
}

@keyframes pop-in {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.animate-pop-in {
  animation: pop-in 0.4s ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .animate-pulse-ring,
  .animate-pop-in {
    animation: none;
  }
}
</style>
