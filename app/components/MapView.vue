<script setup lang="ts">
import { LMap, LTileLayer, LCircleMarker, LPopup, LControl } from '@vue-leaflet/vue-leaflet'
import * as L from 'leaflet'
import { watch, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import 'leaflet/dist/leaflet.css'

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

const props = defineProps<{ items: Incident[] }>()
const mapRef = ref<any>(null)

const center: [number, number] = [-2.5, 117] // tengah Indonesia
const zoom = 5

delete (L.Icon.Default as any).prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function canonStatus(s: any = ''): 'SELESAI'|'RENCANA'|'ON GOING'|'LAINNYA' {
  const v = String(s || '').toLowerCase().trim()
  if (/(selesai|resolved|done)/.test(v)) return 'SELESAI'
  if (/(rencana|plan|planned)/.test(v)) return 'RENCANA'
  if (/(sedang|berlangsung|ongoing|on ?going|proses|aktif)/.test(v)) return 'ON GOING'
  return 'LAINNYA'
}
function badgeClass(status: string) {
  switch (canonStatus(status)) {
    case 'SELESAI':            return 'badge success'
    case 'RENCANA':            return 'badge info'
    case 'ON GOING': return 'badge warn'
    default:                   return 'badge'
  }
}
function statusColor(status?: string) {
  switch (canonStatus(status)) {
    case 'ON GOING': return '#f59e0b' // oranye
    case 'SELESAI':            return '#22c55e' // hijau
    case 'RENCANA':            return '#3b82f6' // biru
    default:                   return '#6b7280' // abu-abu
  }
}

// Auto fit ke hasil filter
function fitToItems(list: Incident[]) {
  const map: L.Map | undefined = mapRef.value?.leafletObject
  if (!map) return
  if (list && list.length) {
    const bounds = L.latLngBounds(list.map(d => [d.lat, d.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [20, 20] })
  } else {
    map.setView(center, zoom)
  }
}

let resizeTimer: number | undefined
function onResize() {
  const map: L.Map | undefined = mapRef.value?.leafletObject
  if (!map) return
  // debounce ringan
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    map.invalidateSize()
    // re-fit sedikit setelah invalidate supaya nyaman
    fitToItems(props.items)
  }, 150)
}
onMounted(async () => {
  await nextTick()
  fitToItems(props.items)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

watch(() => props.items, (list) => fitToItems(list), { deep: false })
</script>

<template>
  <LMap
    ref="mapRef"
    :zoom="zoom"
    :center="center"
    style="height: clamp(320px, 56vh, 560px); border-radius:12px; overflow:hidden;"
  >
    <LTileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />

    <!-- Titik bulat berwarna -->
    <LCircleMarker
      v-for="it in items"
      :key="it.id"
      :lat-lng="[it.lat, it.lng]"
      :radius="8"
      :stroke="true"
      color="#ffffff"
      :weight="2"
      :fill="true"
      :fillColor="statusColor(it.status)"
      :fillOpacity="0.9"
    >
      <LPopup>
        <div class="popup">
          <h4>{{ it.province || '-' }}, {{ it.city || '-' }}</h4>
          <div class="row"><span>Jenis Kejadian:</span> <b>{{ it.type || '-' }}</b></div>
          <div class="row">
            <span>Status:</span>
            <span :class="badgeClass(it.status)">{{ it.status || '-' }}</span>
          </div>
          <div class="row"><span>Tanggal:</span> <b>{{ it.date || '-' }}</b></div>
          <div class="row" v-if="it.updated_at"><span>Update Terakhir:</span> <b>{{ it.updated_at }}</b></div>
          <div class="row" v-if="it.description"><span>Fasilitas Terdampak:</span> <b>{{ it.description }}</b></div>
          <div class="actions" v-if="it.url">
            <a class="btn" :href="it.url" target="_blank" rel="noopener">Baca Artikel</a>
          </div>
        </div>
      </LPopup>
    </LCircleMarker>

    <!-- Legend warna -->
    <LControl position="bottomleft">
      <div class="legend">
        <div class="item"><span class="dot" style="background:#f59e0b"></span> On Going</div>
        <div class="item"><span class="dot" style="background:#22c55e"></span> Selesai</div>
        <div class="item"><span class="dot" style="background:#3b82f6"></span> Rencana</div>
        <div class="item"><span class="dot" style="background:#6b7280"></span> Lainnya</div>
      </div>
    </LControl>
  </LMap>
</template>

<style scoped>


/* Popup & legend styles (tetap) */
.popup { width: min(86vw, 320px); } /* aman di HP kecil */
.popup h4 { margin: 0 0 .5rem 0; font-weight: 800; font-size: 18px; color:#1e3a8a; position:relative; padding-right:18px; }
.popup h4::after{
  content:""; display:block; height:3px; margin-top:8px;
  background: linear-gradient(90deg,#1e3a8a,#2f7cc3,#3ea0e8); border-radius:2px;
}
.popup .row { display:flex; gap:.5rem; margin:.35rem 0; line-height:1.35; }
.popup .row span:first-child { color:#6b7280; min-width: 120px; font-weight:600; }
.popup .row b { color:#374151; font-weight:600; }

.badge { display:inline-block; padding:.18rem .6rem; border-radius:999px; font-size:.82rem; background:#e5e7eb; color:#111827; line-height:1.2; }
.badge.success{ background:#22c55e; color:#fff; }
.badge.warn{    background:#f59e0b; color:#fff; }
.badge.info{    background:#3b82f6; color:#fff; }

.btn { display:inline-block; background:#3b82f6; color:#fff; padding:.45rem .8rem; border-radius:.5rem; text-decoration:none; font-weight:600; box-shadow:0 2px 6px rgba(59,130,246,.35); }
.btn:hover{ filter: brightness(.95); }
.btn:active{ transform: translateY(1px); }

/* Legend */
.legend{
  background:#fff; border-radius:8px; padding:8px 10px;
  box-shadow:0 4px 16px rgba(0,0,0,.15); font-size:12px; color:#111827;
  max-width: 60vw; /* biar gak melebar di HP */
}
.legend .item{ display:flex; align-items:center; gap:8px; margin:4px 0; }
.legend .dot{ width:12px; height:12px; border-radius:999px; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.15); }

/* Popup wrapper tweaks */
:deep(.leaflet-popup-content-wrapper){
  border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); border:1px solid #e5e7eb;
}
:deep(.leaflet-popup-content){ margin:10px 12px; }
:deep(.leaflet-popup-close-button){ color:#6b7280; font-weight:700; }

/* HP kecil: rapatkan label di popup */
@media (max-width: 420px){
  .popup .row span:first-child { min-width: 96px; }
}
</style>