<script setup lang="ts">
// 詳細ページ下部の共通アクションバー。
// 左側=主要操作（更新・キャンセル・保存状態）、右側=破壊的操作（無効化など）を横並びに配置する。
// レイアウト（区切り線・エラー表示・左右の振り分け）だけを担い、ボタン自体は slot で渡す。
// ページごとに type="submit" / @click や無効化条件・保存状態の有無が違うため、中身は固定しない。
//
// 使い方:
//   <AdminDetailActions :error="formError">
//     <button @click="onUpdate">更新</button>
//     <NuxtLink to="/dashboard/stores">キャンセル</NuxtLink>
//     <span v-if="saved">✓ 保存しました</span>
//     <template #danger>
//       <button @click="onDelete">この店舗を無効化</button>
//     </template>
//   </AdminDetailActions>
withDefaults(defineProps<{
  /** バー上部に表示するエラーメッセージ（任意） */
  error?: string
  /** 上部の区切り線（border-t）を出すか。フォーム内に置く等で不要なら false */
  bordered?: boolean
}>(), {
  bordered: true,
})
</script>

<template>
  <div class="admin-detail-actions" :class="bordered ? 'border-t border-[#dcdcde] pt-4 mt-2' : 'pt-2'">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="error"
      class="mb-3"
    />
    <div class="flex items-center justify-between">
      <!-- 左: 主要操作（更新 / キャンセル / 保存状態など） -->
      <div class="admin-detail-actions-main flex items-center gap-3">
        <slot />
      </div>
      <!-- 右: 破壊的操作（無効化など）。無ければ何も描画しない -->
      <div v-if="$slots.danger" class="admin-detail-actions-danger flex items-center gap-3">
        <slot name="danger" />
      </div>
    </div>
  </div>
</template>
