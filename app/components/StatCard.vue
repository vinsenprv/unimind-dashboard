<!-- components/StatCard.vue -->
<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <div class="stat">
    <div class="num">{{ value }}</div>
    <div class="label">{{ label }}</div>
  </div>
</template>

<style scoped>
.stat {
  background: white;
  border: 1px solid #eee;
  border-radius: 14px;
  padding: 18px;
  text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
}
.num { font-size: 32px; font-weight: 800; color:#111827; line-height:1; }
.label { margin-top: 6px; color:#6b7280; font-weight:600; }
</style>
