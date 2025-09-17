<script setup lang="ts">
import { LMap, LTileLayer, LControl } from '@vue-leaflet/vue-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { ref, shallowRef, reactive, watch, nextTick } from 'vue'

type Incident = {
  id: string
  title: string
  province: string
  city: string
  type: string
  status: string
  date: string
  updated_at?: string
  lat: number | string
  lng: number | string
  url?: string
  description?: string
}

const props = defineProps<{ items: Incident[] }>()
const mapRef = ref<any>(null)
const mapReady = ref(false)

type SKey = 'ON GOING'|'SELESAI'|'RENCANA'|'LAINNYA'
const enabled = reactive<Record<SKey, boolean>>({
  'ON GOING': true, 'SELESAI': true, 'RENCANA': true, 'LAINNYA': true
})
const groups = shallowRef<Record<SKey, any>>({
  'ON GOING': null, 'SELESAI': null, 'RENCANA': null, 'LAINNYA': null
})

const center: [number, number] = [-2.5, 117]
const zoom = 5

// Perbaiki icon default agar tidak 404
delete (L.Icon.Default as any).prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ---- helpers ----
function canonStatus(s: any = ''): SKey | 'LAINNYA' {
  const v = String(s || '').toLowerCase().trim()
  if (/(selesai|resolved|done)/.test(v)) return 'SELESAI'
  if (/(rencana|plan|planned)/.test(v)) return 'RENCANA'
  if (/(sedang|berlangsung|ongoing|on ?going|proses|aktif)/.test(v)) return 'ON GOING'
  return 'LAINNYA'
}
function statusColor(status?: string) {
  switch (canonStatus(status)) {
    case 'ON GOING': return '#f59e0b'
    case 'SELESAI':  return '#22c55e'
    case 'RENCANA':  return '#3b82f6'
    default:         return '#6b7280'
  }
}
function parseCoord(v: unknown, digits = 6): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim().replace(',', '.')) : NaN
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : NaN
}

// ====== Normalisasi & dedupe ======
type Norm = { k: SKey, lat: number, lng: number, it: Incident, key: string }
function normalize(list: Incident[]): Norm[] {
  const seen = new Set<string>()
  const out: Norm[] = []
  for (const it of list) {
    const lat = parseCoord(it.lat)
    const lng = parseCoord(it.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const key = (it.id && String(it.id).trim())
      ? `id:${it.id}`
      : `pos:${lat}|${lng}|${(it.title||'').trim()}|${(it.date||'').trim()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ k: canonStatus(it.status) as SKey, lat, lng, it, key })
  }
  return out
}

// ====== Icons ======
function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="
      display:inline-block;width:14px;height:14px;border-radius:999px;
      background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25);
    "></span>`,
    iconSize: [18,18],
    iconAnchor: [9,9]
  })
}
function clusterIcon(count: number, color: string) {
  const size = count > 100 ? 44 : count > 25 ? 38 : 32
  return L.divIcon({
    className: '',
    html: `<div class="cl-wrap" style="--c:${color}; --s:${size}px;"><span>${count}</span></div>`,
    iconSize: [size, size]
  })
}
function popupHtml(it: Incident) {
  const esc = (v?: string) => (v ? String(v).replace(/</g,'&lt;').replace(/>/g,'&gt;') : '-')
  const url = it.url && /^https?:\/\//i.test(it.url)
    ? `<a class="btn" href="${it.url}" target="_blank" rel="noopener">Baca Artikel</a>` : ''
  const badge = canonStatus(it.status).toLowerCase().replace(' ','-')
  return `
    <div class="popup">
      <h4>${esc(it.province)}${it.city ? ', '+esc(it.city) : ''}</h4>
      <div class="row"><span>Jenis Kejadian:</span> <b class="caps">${esc((it.type || '').trim())}</b></div>
      <div class="row"><span>Status:</span> <span class="badge ${badge}">${esc(it.status)}</span></div>
      <div class="row"><span>Tanggal:</span> <b>${esc(it.date)}</b></div>
      ${it.updated_at ? `<div class="row"><span>Update Terakhir:</span> <b>${esc(it.updated_at)}</b></div>` : ''}
      ${it.description ? `<div class="row"><span>Fasilitas Terdampak:</span> <b>${esc(it.description)}</b></div>` : ''}
      ${url ? `<div class="actions">${url}</div>` : ''}
    </div>`
}

// ====== Cluster group ======
function makeGroup(color: string) {
  const g: any = (L as any).markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    disableClusteringAtZoom: 12,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (cluster: any) => clusterIcon(cluster.getChildCount(), color)
  })

  g.on('clusterclick', (evt: any) => {
    const cluster = evt?.layer
    if (!cluster) return

    const children: L.Marker[] =
      typeof cluster.getAllChildMarkers === 'function'
        ? cluster.getAllChildMarkers()
        : []

    if (children.length > 1) {
      const first = children[0]?.getLatLng?.()
      const sameSpot =
        !!first &&
        children.every((m) => {
          const ll = m?.getLatLng?.()
          return !!ll && ll.lat === first.lat && ll.lng === first.lng
        })

      if (sameSpot && typeof cluster.spiderfy === 'function') {
        cluster.spiderfy()
        evt?.originalEvent?.preventDefault?.()
        return
      }
    }

    const bounds =
      typeof cluster.getBounds === 'function' ? cluster.getBounds() : null

    const map: L.Map | undefined =
      (evt?.sourceTarget as any)?._map ||
      (evt?.target as any)?._map ||
      (mapRef.value?.leafletObject as L.Map | undefined)

    if (bounds && map) map.fitBounds(bounds, { padding: [20, 20] })
  })

  return g
}

// ====== Rebuild map ======
async function rebuild() {
  if (!mapReady.value) return
  await nextTick()

  const map: L.Map | undefined = mapRef.value?.leafletObject
  if (!map) return

  // hapus group lama
  ;(Object.keys(groups.value) as SKey[]).forEach(k => {
    const g = groups.value[k]
    if (g) { g.clearLayers(); map.removeLayer(g) }
  })

  // buat groups baru
  groups.value = {
    'ON GOING': makeGroup(statusColor('ON GOING')),
    'SELESAI':  makeGroup(statusColor('SELESAI')),
    'RENCANA':  makeGroup(statusColor('RENCANA')),
    'LAINNYA':  makeGroup(statusColor('LAINNYA')),
  }

  // normalisasi + dedupe
  const norm = normalize(props.items)

  // isi markers
  for (const n of norm) {
    const m = L.marker([n.lat, n.lng], { icon: dotIcon(statusColor(n.k)) })
      .bindPopup(popupHtml(n.it), { maxWidth: 320 })
    groups.value[n.k].addLayer(m)
  }

  // pasang ke map sesuai toggle
  ;(Object.keys(groups.value) as SKey[]).forEach(k => {
    if (enabled[k]) map.addLayer(groups.value[k])
  })

  // fit ke data
  if (norm.length) {
    map.fitBounds(L.latLngBounds(norm.map(n => L.latLng(n.lat, n.lng))), { padding: [20,20] })
  } else {
    map.setView(center, zoom)
  }

  map.invalidateSize()
}

// dipanggil saat <LMap> siap
function onMapReady() {
  mapReady.value = true
  rebuild()
}

// rebuild ketika data berubah (perubahan referensi & panjang)
watch(() => props.items, rebuild, { deep: false })
watch(() => props.items.length, rebuild)
</script>

<template>
  <LMap
    ref="mapRef"
    :zoom="zoom"
    :center="center"
    style="height:520px; border-radius:12px; overflow:hidden;"
    @ready="onMapReady"
  >
    <LTileLayer
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      attribution="&copy; OpenStreetMap contributors"
    />
    <LControl position="bottomleft">
      <div class="legend">
        <button class="item" :class="{off: !enabled['ON GOING']}" @click="enabled['ON GOING']=!enabled['ON GOING']; rebuild()">
          <span class="dot" style="background:#f59e0b"></span> On Going
        </button>
        <button class="item" :class="{off: !enabled['SELESAI']}"  @click="enabled['SELESAI']=!enabled['SELESAI']; rebuild()">
          <span class="dot" style="background:#22c55e"></span> Selesai
        </button>
        <button class="item" :class="{off: !enabled['RENCANA']}"  @click="enabled['RENCANA']=!enabled['RENCANA']; rebuild()">
          <span class="dot" style="background:#3b82f6"></span> Rencana
        </button>
        <button class="item" :class="{off: !enabled['LAINNYA']}"  @click="enabled['LAINNYA']=!enabled['LAINNYA']; rebuild()">
          <span class="dot" style="background:#6b7280"></span> Lainnya
        </button>
      </div>
    </LControl>
  </LMap>
</template>

<style scoped>
.legend{
  background:#fff; border-radius:8px; padding:8px 10px;
  box-shadow:0 4px 16px rgba(0,0,0,.15); font-size:12px; color:#111827;
}
.legend .item{
  display:flex; align-items:center; gap:8px; margin:4px 0; padding:4px 6px;
  border-radius:6px; border:1px solid transparent; cursor:pointer; background:transparent;
}
.legend .item:hover{ background:#f3f4f6; }
.legend .item.off{ opacity:.45; border-color:#e5e7eb; }
.legend .dot{ width:12px; height:12px; border-radius:999px; border:2px solid #fff; box-shadow:0 0 0 1px rgba(0,0,0,.15); }

:global(.cl-wrap){
  width:var(--s); height:var(--s);
  display:grid; place-items:center;
  border-radius:999px; background:var(--c); color:#fff; font-weight:800;
  box-shadow:0 4px 14px rgba(0,0,0,.25), inset 0 0 0 3px #fff;
}

:global(.popup){ width: min(86vw, 320px); }
:global(.popup h4){
  margin: 0 0 .5rem 0; font-weight: 800; font-size: 18px; color:#1e3a8a; position:relative; padding-right:18px;
}
:global(.popup h4::after){
  content:""; display:block; height:3px; margin-top:8px;
  background: linear-gradient(90deg,#1e3a8a,#2f7cc3,#3ea0e8); border-radius:2px;
}
:global(.popup .row){ display:flex; gap:.5rem; margin:.35rem 0; line-height:1.35; }
:global(.popup .row span:first-child){ color:#6b7280; min-width: 140px; font-weight:600; }
:global(.popup .row b){ color:#374151; font-weight:600; }

:global(.badge){ display:inline-block; padding:.18rem .6rem; border-radius:999px; font-size:.82rem; background:#e5e7eb; color:#111827; line-height:1.2; }
:global(.badge.selesai){ background:#22c55e; color:#fff; }
:global(.badge.on-going){ background:#f59e0b; color:#fff; }
:global(.badge.rencana){ background:#3b82f6; color:#fff; }
:global(.badge.lainnya){ background:#6b7280; color:#fff; }

:global(.btn){
  display:inline-block; background:#3b82f6; color:#fff; padding:.45rem .8rem; border-radius:.5rem;
  text-decoration:none; font-weight:600; box-shadow:0 2px 6px rgba(59,130,246,.35);
}
:global(.btn:hover){ filter: brightness(.95); }
:global(.btn:active){ transform: translateY(1px); }

:global(.leaflet-popup-content-wrapper){
  border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); border:1px solid #e5e7eb;
}
:global(.leaflet-popup-content){ margin:10px 12px; }
:global(.leaflet-popup-close-button){ color:#6b7280; font-weight:700; }

/* pastikan teks tombol putih di semua state link */
:global(.popup .btn),
:global(.popup .btn:visited) {
  color: #fff !important;
}
:global(.popup .btn:hover),
:global(.popup .btn:focus) {
  color: #fff !important;
}
:global(.popup .caps){
  text-transform: uppercase;
}
</style>
