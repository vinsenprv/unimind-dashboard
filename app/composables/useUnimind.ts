// composables/useUnimind.ts
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

const monthMap: Record<string, number> = {
  januari: 1, febuari: 2, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7,
  agustus: 8, september: 9, oktober: 10, november: 11, desember: 12
}

function toNum(v: any): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

// Normalisasi nama kunci: lowercase + hapus selain huruf/angka
function normKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Ambil NILAI PERTAMA yang tidak kosong, cocokkan dengan normalisasi kunci.
// Contoh: "event_last", "Event Last", "eventLast" -> sama-sama "eventlast"
function pickKey(obj: any, candidates: string[]) {
  const entries = Object.entries(obj || {}).map(([k, v]) => ({
    rawKey: k,
    norm: normKey(k),
    val: v
  }))

  // exact match (normalized)
  for (const name of candidates) {
    const n = normKey(name)
    const hit = entries.find(e => e.norm === n)
    if (!hit) continue
    const v = hit.val
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const s = v.trim()
      if (s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') return s
      continue
    }
    return v
  }

  // loose: "mengandung" (normalized)
  for (const name of candidates) {
    const n = normKey(name)
    const hit = entries.find(e => e.norm.includes(n))
    if (!hit) continue
    const v = hit.val
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const s = v.trim()
      if (s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') return s
      continue
    }
    return v
  }
  return undefined
}

function parseDateSmart(s: any): string {
  if (!s) return ''
  const raw = String(s).trim()

  // 1) jika sudah YYYY-MM-DD or YYYY/MM/DD
  const m1 = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`

  // 2) "DD MM YYYY" (MM bisa angka atau nama bulan Indonesia)
  const m2 = raw.match(/^(\d{1,2})\s+([A-Za-z\.]+|\d{1,2})\s+(\d{4})/)
  if (m2) {
    const d = m2[1]
    const mm = m2[2].toLowerCase()
    const y = m2[3]
    const month =
      monthMap[mm.replace('.', '')] || (Number(mm) >= 1 && Number(mm) <= 12 ? Number(mm) : NaN)
    if (month) return `${y}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  // fallback: kosongkan (biar tidak bikin error filter)
  return ''
}

// (opsional) parser datetime "YYYY-MM-DD HH:mm:ss" atau ISO
function parseDateTimeSmart(s: any): string {
  if (!s) return ''
  const raw = String(s).trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const [_, Y, M, D, h, mi, ss] = m
    return `${Y}-${M}-${D} ${h}:${mi}${ss ? `:${ss}` : ''}`
  }
  if (!Number.isNaN(Date.parse(raw))) return raw
  return parseDateSmart(raw)
}

function normalizeStatus(s: string = '') {
  const v = s.toLowerCase()
  if (v.includes('selesai') || v.includes('resolved') || v.includes('done')) return 'SELESAI'
  if (v.includes('rencana') || v.includes('plan')) return 'RENCANA'
  if (v.includes('sedang') || v.includes('berlangsung') || v.includes('ongoing')) return 'SEDANG BERLANGSUNG'
  return s.toUpperCase()
}

function parseLatLng(row: any) {
  const lat = toNum(pickKey(row, ['lat','latitude','lintang']))
  const lng = toNum(pickKey(row, ['lng','lon','long','longitude','bujur']))
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }

  const latlon = pickKey(row, ['latlon','lat_long','latlng'])
  if (typeof latlon === 'string') {
    const [a,b] = latlon.split(',')
    return { lat: toNum(a), lng: toNum(b) }
  }
  if (Array.isArray(latlon)) return { lat: toNum(latlon[0]), lng: toNum(latlon[1]) }
  return { lat: NaN, lng: NaN }
}

function transform(row: any): Incident {
  const { lat, lng } = parseLatLng(row)

  const province = (pickKey(row, ['provinsi','province','prov']) || '') as string
  const city = (pickKey(row, ['kabkot','kota','kabupaten','kab/kota','kota/kabupaten','city']) || '') as string

  // 🔹 Jenis kejadian (tangkap variasi: event_last/eventLast/dll + sinonim)
  const kindRaw = pickKey(row, [
    'event_last','event_continue','event',
    'jenis kejadian','jenis','type','kejadian','insiden','peristiwa','aksi'
  ])
  const kind = kindRaw ? String(kindRaw).trim() : ''

  // 🔹 Status
  const statusRaw = pickKey(row, ['status_last','status_continue','status','keterangan_status','state']) || ''
  const status = normalizeStatus(String(statusRaw))

  // 🔹 Tanggal & update
  const date = parseDateSmart(pickKey(row, ['tanggal','date','waktu','created_at']))
  const updated_at = parseDateTimeSmart(pickKey(row, ['last_updated','update terakhir','updated_at','update']))

  // 🔹 Fasilitas terdampak (gabung jenis + detail)
  const fasJenis  = pickKey(row, ['fasum_terdampak_last','fasum_terdampak_continue','fasilitas terdampak','fasum_terdampak'])
  const fasDetail = pickKey(row, ['fasum_detail_last','fasum_detail_continue','fasum_detail'])
  let description = pickKey(row, ['keterangan','deskripsi']) as string | undefined
  if (!description) {
    if (fasJenis && fasDetail) description = `${fasJenis}: ${fasDetail}`
    else description = (fasJenis as string) || (fasDetail as string) || ''
  }

  // 🔹 Link
  const url = pickKey(row, ['link_article_last','link_article_continue','article_url','url','link'])

  const safeProvince = province.trim()
  const safeCity = city.trim()
  const title = `${safeProvince || 'Lokasi tidak diketahui'}${safeCity ? ', ' + safeCity : ''}`

  const rawId = pickKey(row, ['id','kode','articleId_last','articleId_continue'])
  const id = rawId != null && rawId !== '' ? String(rawId) : `${safeProvince}-${safeCity}-${kind}-${date}-${lat}-${lng}`

  return { id, title, province: safeProvince, city: safeCity, type: kind, status, date, updated_at, lat, lng, url, description }
}

export const useUnimind = () => {
  const config = useRuntimeConfig()
  const raw = ref<Incident[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchRaw = async () => {
    loading.value = true
    error.value = null
    try {
      const data: any = await $fetch(config.public.UNIMIND_RAW_URL)
      let rows: any[] = []
      if (Array.isArray(data)) rows = data
      else if (Array.isArray(data?.data)) rows = data.data
      else rows = Object.values(data || {}).flatMap((v: any) => (Array.isArray(v) ? v : []))
      raw.value = rows.map(transform).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng))
    } catch (e: any) {
      error.value = e?.message || 'Gagal mengambil data.'
    } finally {
      loading.value = false
    }
  }

  const uniqueTypes = computed(() => {
    return Array.from(new Set(raw.value.map(d => (d.type || '').trim()))).filter(Boolean).sort()
  })
  const uniqueStatuses = computed(() => {
    return Array.from(new Set(raw.value.map(d => (d.status || '').trim()))).filter(Boolean).sort()
  })

  const countByStatus = computed(() => {
    const total = raw.value.length
    const selesai = raw.value.filter(d => d.status === 'SELESAI').length
    const berlangsung = raw.value.filter(d => d.status === 'SEDANG BERLANGSUNG').length
    const rencana = raw.value.filter(d => d.status === 'RENCANA').length
    return { total, berlangsung, selesai, rencana }
  })
  console.log('contoh:', raw.value.slice(0,3))

  return { raw, fetchRaw, loading, error, uniqueTypes, uniqueStatuses, countByStatus }
}
