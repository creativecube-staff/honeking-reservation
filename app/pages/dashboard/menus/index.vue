<script setup lang="ts">
// メニュー管理ページ。一覧・検索・編集 UI は AdminMenuManager に集約済み。
// 店舗が選択されていれば店舗特別メニュー、全店（管理者）なら共通メニューを出す。
// 分岐は selectedStoreId を主軸にする。store-context（canAccessAll）の解決前は「読み込み中」を出し、
// 「ヘッダーだけ出て中身が空」になる状態を作らない。
definePageMeta({ layout: 'admin' })

const { selectedStoreId, canAccessAll, selectedStoreName } = useStoreContext()
</script>

<template>
  <div>
    <!-- 店舗選択中 = その店舗の特別メニュー -->
    <div v-if="selectedStoreId != null">
      <AdminDetailHeader title="メニュー管理">
        <template #description>
          店舗特別メニュー（その店舗のキャンペーン・独自施術など）を管理します。
        </template>
      </AdminDetailHeader>
      <AdminMenuManager :store-id="selectedStoreId" />
    </div>

    <!-- 全店（管理者）= 共通メニュー -->
    <div v-else-if="canAccessAll">
      <AdminDetailHeader title="共通メニュー管理">
        <template #description>
          共通メニュー（全店舗で自動的に利用可能）を管理します。<br>
          店舗ごとの特別メニューは、対象店舗に切り替えてメニューで登録してください。
        </template>
      </AdminDetailHeader>
      <AdminMenuManager />
    </div>

    <!-- 店舗コンテキスト解決待ち（稀）。ここで空白を出さない -->
    <div v-else class="py-12 text-center text-sm text-slate-500">
      読み込み中…
    </div>
  </div>
</template>
