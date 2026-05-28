<script setup lang="ts">
// LINE 管理ページ（準備中）。
// 将来的にスケジュールを元に LINE 配信文を自動生成したり、配信履歴を管理できるようにする予定。
definePageMeta({ layout: 'admin' })
useHead({ title: 'LINE 管理' })
</script>

<template>
  <AdminComingSoon
    title="LINE 管理"
    description="LINE 公式アカウントからのお知らせ配信や、お客様への自動メッセージ送信をここで管理できるようにする予定です。"
  >
    <template #features>
      <li>予約のスケジュールを元にした配信文の自動生成</li>
      <li>予約完了通知・前日リマインダーの自動送信</li>
      <li>キャンペーン情報の一斉配信</li>
      <li>配信履歴の確認</li>
    </template>
  </AdminComingSoon>
</template>
