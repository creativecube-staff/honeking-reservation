<script setup lang="ts">
// メニュー管理ページ。一覧・検索・編集 UI は AdminMenuManager に集約済み。
// 管理者(全店)モード = 共通メニュー / 店舗モード = 自店の店舗特別メニュー、を店舗スイッチャーの文脈で切り替える。
definePageMeta({ layout: 'admin' })

const { selectedStoreId, canAccessAll, selectedStoreName } = useStoreContext()
const isAdminView = computed(() => canAccessAll.value && selectedStoreId.value === null)
</script>

<template>
  <div>
    <!-- 店舗モード: 自店の店舗特別メニュー -->
    <div v-if="!isAdminView">
      <AdminDetailHeader title="店舗特別メニュー">
        <template #description>
          {{ selectedStoreName }} だけのメニューを管理します。全店共通のメニューは管理者モードの「メニュー管理」で扱います。
        </template>
      </AdminDetailHeader>
      <AdminMenuManager v-if="selectedStoreId" :store-id="selectedStoreId" />
    </div>

    <!-- 管理者(全店)モード: 共通メニュー管理 -->
    <template v-else>
      <AdminDetailHeader title="メニュー管理">
        <template #description>
          共通メニュー（全店舗で自動的に利用可能）を管理します。<br>
          店舗ごとの特別メニューは、ヘッダーの店舗スイッチャーで対象店舗に切り替えると管理できます。
        </template>
      </AdminDetailHeader>
      <AdminMenuManager />
    </template>
  </div>
</template>
