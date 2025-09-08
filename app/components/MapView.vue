<!-- components/MapView.vue -->
<script setup lang="ts">
import { LMap, LTileLayer, LMarker, LPopup } from '@vue-leaflet/vue-leaflet'
import * as L from 'leaflet'

type Incident = {
  id: string
  title: string
  province: string
  city: string
  type: string
  status: string
  date: string
  updated_at?: string
  lat: number
  lng: number
  url?: string
  description?: string
}

const props = defineProps<{
  items: Incident[]
}>()

// Perbaikan path icon leaflet di Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const center: [number, number] = [-2.5, 117] // tengah Indonesia
const zoom = 5

function badgeClass(status: string) {
  if (status === 'SELESAI') return 'badge success'
  if (status === 'SEDANG BERLANGSUNG') return 'badge warn'
  if (status === 'RENCANA') return 'badge info'
  return 'badge'
}
</script>

<template>
  <LMap :zoom="zoom" :center="center" style="height:520px; border-radius:12px; overflow:hidden;">
    <LTileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />
    <LMarker v-for="it in items" :key="it.id" :lat-lng="[it.lat, it.lng]">
      <LPopup>
        <div class="popup">
          <h4>{{ it.province || '-' }}, {{ it.city || '-' }}</h4>
          <div class="row"><span>Jenis Kejadian:</span> <b>{{ it.type || '-' }}</b></div>
          <div class="row"><span>Status:</span> <span :class="badgeClass(it.status)">{{ it.status }}</span></div>
          <div class="row"><span>Tanggal:</span> <b>{{ it.date || '-' }}</b></div>
          <div class="row" v-if="it.updated_at"><span>Update Terakhir:</span> <b>{{ it.updated_at }}</b></div>
          <div class="row" v-if="it.description"><span>Fasilitas Terdampak:</span> <b>{{ it.description }}</b></div>
          <div class="actions" v-if="it.url">
            <a class="btn" :href="it.url" target="_blank" rel="noopener">Baca Artikel</a>
          </div>
        </div>
      </LPopup>
    </LMarker>
  </LMap>
</template>

<style scoped>
.popup { width: 320px; }
.popup h4 { margin: 0 0 .5rem 0; font-weight: 700; }
.popup .row { display:flex; gap:.5rem; margin:.25rem 0; }
.popup .row span:first-child { color:#555; min-width: 130px; }
.badge { display:inline-block; padding:.15rem .5rem; border-radius:.5rem; font-size:.8rem; background:#e5e7eb; color:#111; }
.badge.success{ background:#d1fae5; color:#065f46; }
.badge.warn{ background:#fef3c7; color:#92400e; }
.badge.info{ background:#dbeafe; color:#1e3a8a; }
.btn { display:inline-block; background:#2e7d32; color:white; padding:.35rem .6rem; border-radius:.4rem; text-decoration:none; }
.btn:hover{ opacity:.9; }
</style>
