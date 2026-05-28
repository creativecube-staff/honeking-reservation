<script setup lang="ts">
// メール管理ページ（準備中）。
// 将来的にホットペッパービューティー等の外部経由で届く予約通知メールを受信・整理する場所。
definePageMeta({ layout: 'admin' })
useHead({ title: 'メール管理' })
</script>

<template>
  <AdminComingSoon
    title="メール管理"
    description="店舗宛に届くメール（ホットペッパービューティー経由の予約通知など）をここで受信・確認できるようにする予定です。"
  >
    <template #features>
      <li>外部サービスからの予約通知メールの受信</li>
      <li>予約管理への自動取り込み</li>
      <li>取り込みに失敗したメールの「要確認」キュー</li>
      <li>店舗別のメール受信状況の確認</li>
    </template>
  </AdminComingSoon>
</template>
