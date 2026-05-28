<script setup lang="ts">
// 口コミ管理ページ（準備中）。
// 将来的に Google マイビジネスの口コミ一覧を取り込み、返信などの管理が行える予定。
definePageMeta({ layout: 'admin' })
useHead({ title: '口コミ管理' })
</script>

<template>
  <AdminComingSoon
    title="口コミ管理"
    description="Google マイビジネスに投稿された口コミをここに一覧表示し、返信や管理ができるようにする予定です。"
  >
    <template #features>
      <li>Google マイビジネスからの口コミ自動取り込み</li>
      <li>店舗別の口コミ一覧表示</li>
      <li>未返信の口コミの絞り込み</li>
      <li>管理画面から直接返信文を投稿</li>
    </template>
  </AdminComingSoon>
</template>
