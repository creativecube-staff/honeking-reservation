<script setup lang="ts">
// 店舗モード専用のスタッフ管理画面。
// 全店モード（OWNER が「管理者」を選択中）では「店舗を選んでください」を表示する。
// 一覧・編集・追加・完全削除はすべて AdminStaffManager に集約。
definePageMeta({ layout: 'admin', requirePermission: 'staff:view' })

const { selectedStoreId, canAccessAll } = useStoreContext()
const isAdminContext = computed(() => canAccessAll.value && selectedStoreId.value === null)
</script>

<template>
  <div>
    <AdminDetailHeader
      title="スタッフ管理"
      description="店舗のスタッフを管理します。"
    />

    <!-- 全店モードのときはガイドのみ表示 -->
    <div v-if="isAdminContext" class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 text-center">
      <p class="text-base text-slate-700">
        スタッフ管理は店舗ごとに行います。
      </p>
      <p class="mt-2 text-sm text-slate-600">
        ヘッダーの店舗スイッチャーから対象の店舗を選んでください。
      </p>
      <p class="mt-4 text-xs text-slate-500">
        ログイン情報・パスワードの管理は <NuxtLink to="/dashboard/accounts" class="text-blue-700 hover:text-blue-900 hover:underline">「ログイン管理」</NuxtLink> で行えます。
      </p>
    </div>

    <AdminStaffManager v-else-if="selectedStoreId !== null" :store-id="selectedStoreId" />
  </div>
</template>
