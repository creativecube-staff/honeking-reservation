<script setup lang="ts">
// 「準備中」プレースホルダー。改修中のページで共通利用する。
// 使い方:
//   <AdminComingSoon
//     title="口コミ管理"
//     description="Google マイビジネスの口コミ一覧を表示・管理する機能を準備中です。"
//   >
//     <template #features>
//       <li>口コミ一覧の閲覧</li>
//       <li>返信文の作成・送信</li>
//     </template>
//   </AdminComingSoon>
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div>
    <AdminDetailHeader :title="title" :description="description" />

    <div class="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-md p-8 text-center">
      <div class="inline-flex items-center justify-center size-16 rounded-full bg-amber-100 border border-amber-300 mb-4">
        <UIcon name="i-lucide-hammer" class="size-8 text-amber-600" />
      </div>
      <h2 class="text-xl font-bold text-amber-900 mb-1">
        準備中
      </h2>
      <p class="text-sm text-amber-800 mb-4">
        この機能は現在開発中です。近日中にご利用いただけるようになります。
      </p>

      <!-- 予定機能リスト（任意） -->
      <div v-if="$slots.features" class="mt-4 inline-block text-left">
        <p class="text-xs font-semibold text-amber-900 mb-2">
          予定している機能:
        </p>
        <ul class="text-sm text-amber-800 list-disc list-inside space-y-1">
          <slot name="features" />
        </ul>
      </div>
    </div>
  </div>
</template>
