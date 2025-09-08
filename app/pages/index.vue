<!-- pages/index.vue -->
<script setup lang="ts">
import MapView from '~/components/MapView.vue'
import StatCard from '~/components/StatCard.vue'
import dayjs from 'dayjs'
import { useUnimind } from '~/composables/useUnimind'

const { raw, fetchRaw, loading, error, uniqueTypes, uniqueStatuses, countByStatus } = useUnimind()

// filter state
const jenis = ref<string>('ALL')
const status = ref<string>('ALL')
const tanggal = ref<string>('') // HTML date => YYYY-MM-DD

onMounted(fetchRaw)

const filtered = computed(() => {
  return raw.value.filter((d) => {
    const okJenis = jenis.value === 'ALL' || (d.type || '') === jenis.value
    const okStatus = status.value === 'ALL' || (d.status || '') === status.value
    const okTanggal =
      !tanggal.value ||
      (!d.date ? false : dayjs(d.date).isValid() && dayjs(d.date).isSame(dayjs(tanggal.value), 'day'))
    return okJenis && okStatus && (tanggal.value ? okTanggal : true)
  })
})

function refresh() {
  fetchRaw()
}
</script>

<template>
  <main class="container">
    <header class="topbar">
      <h1>Data Real-time Demonstrasi dan Kerusuhan di Indonesia</h1>
    </header>

    <section class="filters card">
      <div class="field">
        <label>Filter Jenis Kejadian:</label>
        <select v-model="jenis">
          <option value="ALL">Semua Kejadian</option>
          <option v-for="t in uniqueTypes" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div class="field">
        <label>Filter Status:</label>
        <select v-model="status">
          <option value="ALL">Semua Status</option>
          <option v-for="s in uniqueStatuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div class="field">
        <label>Filter Tanggal:</label>
        <input type="date" v-model="tanggal" placeholder="dd/mm/yyyy" />
      </div>

      <button class="btn refresh" @click="refresh">Refresh Data</button>
    </section>

    <section class="card mapwrap">
      <ClientOnly>
        <MapView :items="filtered" />
        <template #fallback>
          <div style="height:520px;display:grid;place-items:center;">Memuat peta…</div>
        </template>
      </ClientOnly>
    </section>

    <section class="stats">
      <StatCard label="Total Kejadian" :value="filtered.length" />
      <StatCard label="Sedang Berlangsung" :value="filtered.filter(d=>d.status==='SEDANG BERLANGSUNG').length" />
      <StatCard label="Selesai" :value="filtered.filter(d=>d.status==='SELESAI').length" />
      <StatCard label="Rencana" :value="filtered.filter(d=>d.status==='RENCANA').length" />
    </section>

    <section v-if="loading" class="note">Mengambil data…</section>
    <section v-else-if="error" class="note error">Gagal memuat data: {{ error }}</section>
  </main>
</template>

<style scoped>
.container { max-width: 1200px; margin: 0 auto; padding: 18px; }
.topbar { text-align:center; margin-bottom: 14px; }
.topbar h1 { font-weight: 700; font-size: 20px; color: white; background:#1f6feb; padding: 10px 14px; border-radius: 10px; }
.card {
  background: white; border: 1px solid #eee; border-radius: 14px; padding: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
}
.filters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
.field label { display:block; font-size: 12px; color:#374151; margin-bottom: 6px; font-weight:600; }
select, input[type="date"] {
  width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #d1d5db; background:#f9fafb;
}
.btn.refresh { background:#22c55e; color:white; padding: 10px 12px; border-radius: 10px; border: none; cursor: pointer; font-weight:700; }
.btn.refresh:hover{ opacity:.9; }
.mapwrap { padding: 8px; }
.stats { display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 14px; }
.note { margin-top: 10px; color:#374151; }
.note.error { color:#b91c1c; }
@media (max-width: 900px) {
  .filters { grid-template-columns: 1fr 1fr; }
  .stats { grid-template-columns: 1fr 1fr; }
}
</style>
