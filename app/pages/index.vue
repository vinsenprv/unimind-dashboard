<script setup lang="ts">
import MapView from '~/components/MapView.vue'
import StatCard from '~/components/StatCard.vue'
import dayjs from 'dayjs'
import { useUnimind } from '~/composables/useUnimind'

const { raw, fetchRaw, loading, error, uniqueTypes, uniqueStatuses } = useUnimind()

// State filter
const jenis   = ref<string>('ALL')
const status  = ref<string>('ALL')
const tanggal = ref<string>('') // HTML date => YYYY-MM-DD

// Helper: kanonisasi status
function canonStatus(s = '') {
  const v = s.toLowerCase().trim()
  if (/(selesai|resolved|done)/.test(v)) return 'SELESAI'
  if (/(rencana|plan|planned)/.test(v)) return 'RENCANA'
  if (/(sedang|berlangsung|ongoing|on ?going|proses|aktif)/.test(v)) return 'ON GOING'
  return 'LAINNYA'
}

// Data terfilter
const filtered = computed(() => {
  const j = (jenis.value  || 'ALL').toLowerCase().trim()
  const s = (status.value || 'ALL').toLowerCase().trim()
  const sCanon = s === 'all' ? null : s.toUpperCase()
  const tgl = tanggal.value ? dayjs(tanggal.value).startOf('day') : null

  return raw.value.filter((d) => {
    const dt = d.date && dayjs(d.date).isValid() ? dayjs(d.date).startOf('day') : null
    const okJenis  = j === 'all' || (d.type || '').toLowerCase().trim() === j
    const okStatus = !sCanon || canonStatus(d.status) === sCanon   // hanya SATU definisi
    const okTgl    = !tgl || (dt && dt.isSame(tgl, 'day'))
    return okJenis && okStatus && okTgl
  })
})

// Stats akurat berbasis kanonisasi
const stats = computed(() => {
  const acc = { total: 0, berlangsung: 0, selesai: 0, rencana: 0, lainnya: 0 }
  for (const d of filtered.value) {
    acc.total++
    switch (canonStatus(d.status)) {
      case 'SELESAI': acc.selesai++; break
      case 'RENCANA': acc.rencana++; break
      case 'ON GOING': acc.berlangsung++; break
      default: acc.lainnya++; break
    }
  }
  return acc
})

// Opsi status (kanonis) untuk dropdown (opsional)
const statusOptions = computed(() => {
  const set = new Set<string>()
  raw.value.forEach(d => set.add(canonStatus(d.status))) // ambil yang ada di data
  ;['ON GOING','SELESAI','RENCANA','LAINNYA'].forEach(s => set.add(s)) // pastikan ada
  const order = ['ON GOING','SELESAI','RENCANA','LAINNYA']
  return Array.from(set).sort((a,b) => order.indexOf(a) - order.indexOf(b))
})


// Lifecycle & actions
onMounted(async () => {
  await fetchRaw()
  // debug cepat
  console.log('[index] sample', raw.value.slice(0, 3))
})
function refresh() { fetchRaw() }

const typeOptions = computed(() =>
  uniqueTypes.value.map(t => ({ value: t, label: (t || '').toUpperCase() }))
)
</script>

<template>
  <header class="headerbar">
    <h1>Data Real-time Demonstrasi dan Kerusuhan di Indonesia</h1>
  </header>

  <main class="container">
    <section class="filters card">
      <div class="field">
        <label>Filter Jenis Kejadian:</label>
        <select v-model="jenis">
          <option value="ALL">Semua Kejadian</option>
          <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>

      <div class="field">
        <label>Filter Status:</label>
        <select v-model="status">
          <option value="ALL">Semua Status</option>
          <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
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
      <StatCard label="Total Kejadian" :value="stats.total" />
      <StatCard label="On Going" :value="stats.berlangsung" />
      <StatCard label="Selesai" :value="stats.selesai" />
      <StatCard label="Rencana" :value="stats.rencana" />
    </section>

    <section v-if="loading" class="note">Mengambil data…</section>
    <section v-else-if="error" class="note error">Gagal memuat data: {{ error }}</section>

    
  </main>
</template>

<style scoped>
.container { max-width: 1200px; margin: 0 auto; padding: 18px; }

/* ---- Header bar full width ---- */
.headerbar {
  background: linear-gradient(90deg, #2c4f6b, #338cc8);
  padding: 14px 0;
  text-align: center;
  border-radius: 4px 4px 0 0;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.headerbar h1 { margin: 0; font-size: 16px; font-weight: 600; color: #fff; }

.card {
  background: white; border: 1px solid #eee; border-radius: 14px; padding: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,.04);
}

/* ---- Layout filter: 3 field + 1 tombol ---- */
.filters{
  display: grid;
  grid-template-columns: repeat(3, minmax(240px,1fr)) 180px;
  gap: 16px 20px;
  align-items: end;
}

/* Field & label */
.field{ display:flex; flex-direction:column; gap:6px; }
.field label{ font-size:12px; color:#374151; font-weight:600; }

/* Samakan tinggi semua kontrol */
select, input[type="date"], input[type="text"], input[type="search"]{
  width:100%; height:44px; padding:10px 12px; border-radius:10px;
  border:1px solid #d1d5db; background:#f9fafb; box-sizing:border-box;
}

/* Tombol refresh */
.btn.refresh{
  height:44px; padding:0 20px; display:flex; align-items:center; justify-content:center;
  background:#22c55e; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer; align-self:end;
}
.btn.refresh:hover{ opacity:.9; }

.mapwrap { padding: 8px; }

.stats {
  display:grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 14px;
}

.note { margin-top: 10px; color:#374151; }
.note.error { color:#b91c1c; }

/* Responsif */
@media (max-width: 1100px){ .filters{ grid-template-columns: repeat(2, minmax(240px,1fr)); } }
@media (max-width: 640px){ .filters{ grid-template-columns: 1fr; } }
</style>