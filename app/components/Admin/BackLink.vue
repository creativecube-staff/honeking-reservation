<script setup lang="ts">
// 一覧などへ「‹ 戻る」ためのリンク。詳細ページ上部やモーダル内など色々な箇所で使い回す。
// 矢印を丸い背景に入れたチップ風デザイン。hover で丸とテキストがアクセント色に変わる。
const props = withDefaults(defineProps<{
  /** 遷移先パス */
  to: string
  /** 先頭の矢印アイコン（丸背景）を出すか */
  arrow?: boolean
  /** hover 時のアクセント。orange=管理画面標準 / muted=色を変えず控えめに */
  accent?: 'orange' | 'muted'
}>(), {
  arrow: true,
  accent: 'orange',
})

// テキスト色（通常 → hover）
const textClass = computed(() =>
  props.accent === 'muted'
    ? 'text-slate-600 hover:text-slate-900'
    : 'text-slate-600 hover:text-orange-700',
)
// 矢印の丸背景（通常 → group-hover でアクセント色に）
const iconClass = computed(() =>
  props.accent === 'muted'
    ? 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
    : 'bg-slate-100 text-slate-500 group-hover:bg-orange-100 group-hover:text-orange-600',
)
</script>

<template>
  <NuxtLink
    :to="to"
    class="admin-back-link group inline-flex items-center gap-2 text-sm font-medium transition-colors"
    :class="textClass"
  >
    <span
      v-if="arrow"
      class="admin-back-link-icon inline-flex size-6 items-center justify-center rounded-full transition-colors"
      :class="iconClass"
      aria-hidden="true"
    >
      <UIcon name="i-lucide-chevron-left" class="size-4" />
    </span>
    <slot />
  </NuxtLink>
</template>
