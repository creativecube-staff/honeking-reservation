<script setup lang="ts">
// 管理画面の共通ページ見出し。タイトル(h1) + バッジ類(default slot) + 右寄せアクション(#actions)
// + 下段（詳細ページ=戻るリンク / 一覧ページ=説明文）。詳細・一覧どちらのページでも使い回す。
//
// 詳細ページ:
//   <AdminDetailHeader :title="store?.name" back-to="/dashboard/stores" back-label="店舗一覧に戻る">
//     <span v-if="!store.isActive" class="...">無効</span>  <!-- タイトル右のバッジ -->
//   </AdminDetailHeader>
//
// 一覧ページ:
//   <AdminDetailHeader title="店舗管理" description="店舗の追加・編集・無効化を行います。">
//     <template #actions><NuxtLink to="/dashboard/stores/new">新規追加</NuxtLink></template>
//   </AdminDetailHeader>
defineProps<{
  /** 見出しタイトル。markup が要る場合は #title スロットで上書き可 */
  title?: string
  /** 戻り先パス。指定時のみ「← 戻る」リンクを表示（詳細ページ用） */
  backTo?: string
  /** 戻るリンクの文言（例: 「店舗一覧に戻る」） */
  backLabel?: string
  /** タイトル下の説明文（一覧ページ用。markup が要る場合は #description スロットでも可） */
  description?: string
}>()
</script>

<template>
  <div class="admin-detail-header flex gap-3 mb-6">
    <!-- 左の縦アクセントバー（orange はアクセントのみ運用）。タイトル＋戻るの高さいっぱいに伸びる -->
    <div class="admin-detail-accent w-1 shrink-0 self-stretch rounded-full bg-orange-500" />
    <div class="admin-detail-header-body flex-1 min-w-0">
      <div class="admin-detail-header-row flex items-center gap-3 mb-1 flex-wrap">
        <h1 class="admin-detail-title text-2xl font-bold text-slate-900">
          <slot name="title">{{ title }}</slot>
        </h1>
        <!-- タイトル右に並べるバッジ類（無効 / 会員区分 / 種別 など、ページ固有） -->
        <slot />
        <!-- 右寄せアクション（新規追加ボタンなど。一覧ページ用） -->
        <div v-if="$slots.actions" class="admin-detail-header-actions ml-auto flex items-center gap-2">
          <slot name="actions" />
        </div>
      </div>
      <!-- 下段: 戻るリンク（詳細）または説明文（一覧） -->
      <p v-if="backTo" class="admin-detail-header-back">
        <AdminBackLink :to="backTo">{{ backLabel }}</AdminBackLink>
      </p>
      <p v-if="description || $slots.description" class="admin-detail-header-desc text-sm text-slate-600">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
  </div>
</template>
