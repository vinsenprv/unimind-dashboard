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
  padding: clamp(14px, 2.2vw, 18px);
  text-align: center;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
  min-width: 0; /* hindari overflow teks di grid ketat */
}
.num { 
  font-size: clamp(22px, 3.2vw, 32px); 
  font-weight: 800; color:#111827; line-height:1.05; 
}
.label { margin-top: 6px; color:#6b7280; font-weight:600; font-size: clamp(12px, 1.6vw, 14px); }
</style>