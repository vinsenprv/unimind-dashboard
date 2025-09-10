import { ref, computed } from 'vue'
import { useRuntimeConfig } from '#app'

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

// --- key matching yang robust ---
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
function pickKey(obj: any, candidates: string[]) {
  const entries = Object.entries(obj || {}).map(([k, v]) => ({ norm: normKey(k), val: v }))

  // exact (normalized)
  for (const name of candidates) {
    const n = normKey(name)
    const hit = entries.find(e => e.norm === n)
    if (!hit) continue
    const v = hit.val
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const s = v.trim()
      if (s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') return s
      continue
    }
    return v
  }
  // loose contains (normalized)
  for (const name of candidates) {
    const n = normKey(name)
    const hit = entries.find(e => e.norm.includes(n))
    if (!hit) continue
    const v = hit.val
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      const s = v.trim()
      if (s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') return s
      continue
    }
    return v
  }
  return undefined
}

function parseDateSmart(s: any): string {
  if (!s) return ''
  const raw = String(s).trim()

  // YYYY-MM-DD / YYYY/MM/DD
  const m1 = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/) as RegExpMatchArray | null
  if (m1) {
    const [, Y, M, D] = m1 as unknown as [string, string, string, string]
    return `${Y}-${M.padStart(2, '0')}-${D.padStart(2, '0')}`
  }

  // DD MM YYYY
  const m2 = raw.match(/^(\d{1,2})\s+([A-Za-z\.]+|\d{1,2})\s+(\d{4})/) as RegExpMatchArray | null
  if (m2) {
    const [, dRaw, mRaw, yRaw] = m2 as unknown as [string, string, string, string]
    const d  = dRaw
    const mm = mRaw.toLowerCase()
    const y  = yRaw
    const month =
      monthMap[mm.replace('.', '')] ||
      (Number(mm) >= 1 && Number(mm) <= 12 ? Number(mm) : NaN)
    if (month) return `${y}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }
  return ''
}

function parseDateTimeSmart(s: any): string {
  if (!s) return ''
  const raw = String(s).trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/) as RegExpMatchArray | null
  if (m) {
    const [, Y, M, D, h, mi, ss] = m as unknown as [string, string, string, string, string, string, string?]
    return `${Y}-${M}-${D} ${h}:${mi}${ss ? `:${ss}` : ''}`
  }
  if (!Number.isNaN(Date.parse(raw))) return raw
  return parseDateSmart(raw)
}

function normalizeStatus(s: string = '') {
  const v = s.toLowerCase()
  if (v.includes('selesai') || v.includes('resolved') || v.includes('done')) return 'SELESAI'
  if (v.includes('rencana') || v.includes('plan')) return 'RENCANA'
  if (v.includes('sedang') || v.includes('berlangsung') || v.includes('ongoing') || v.includes('on going')) return 'SEDANG BERLANGSUNG'
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

  // lokasi
  const provinceAny = pickKey(row, ['provinsi','province','prov'])
  const cityAny     = pickKey(row, ['kabkot','kota','kabupaten','kab/kota','kota/kabupaten','city'])
  const province = (typeof provinceAny === 'string' ? provinceAny : String(provinceAny ?? '')).trim()
  const city     = (typeof cityAny === 'string' ? cityAny : String(cityAny ?? '')).trim()

  // jenis kejadian
  const kindAny = pickKey(row, [
    'event_last','event_continue','event',
    'jenis kejadian','jenis','type','kejadian','insiden','peristiwa','aksi'
  ])
  const kind = (typeof kindAny === 'string' ? kindAny : String(kindAny ?? '')).trim()

  // status
  const statusRawAny = pickKey(row, ['status_last','status_continue','status','keterangan_status','state'])
  const status = normalizeStatus(typeof statusRawAny === 'string' ? statusRawAny : String(statusRawAny ?? ''))

  // tanggal + update
  const date       = parseDateSmart(pickKey(row, ['tanggal','date','waktu','created_at']))
  const updated_at = parseDateTimeSmart(pickKey(row, ['last_updated','update terakhir','updated_at','update']))

  // fasilitas terdampak (jenis + detail)
  const fasJenisAny  = pickKey(row, ['fasum_terdampak_last','fasum_terdampak_continue','fasilitas terdampak','fasum_terdampak'])
  const fasDetailAny = pickKey(row, ['fasum_detail_last','fasum_detail_continue','fasum_detail'])
  const fasJenis  = (typeof fasJenisAny  === 'string' ? fasJenisAny  : String(fasJenisAny  ?? '')).trim()
  const fasDetail = (typeof fasDetailAny === 'string' ? fasDetailAny : String(fasDetailAny ?? '')).trim()

  let descriptionAny = pickKey(row, ['keterangan','deskripsi'])
  let description = (typeof descriptionAny === 'string' ? descriptionAny : String(descriptionAny ?? '')).trim()
  if (!description) description = fasJenis && fasDetail ? `${fasJenis}: ${fasDetail}` : (fasJenis || fasDetail)

  // link artikel
  const urlAny = pickKey(row, ['link_article_last','link_article_continue','article_url','url','link'])
  const url = (typeof urlAny === 'string' && urlAny.trim()) ? urlAny : undefined

  // title & id
  const title = `${province || 'Lokasi tidak diketahui'}${city ? ', ' + city : ''}`

  const rawIdAny = pickKey(row, ['id','kode','articleId_last','articleId_continue'])
  const rawIdStr = typeof rawIdAny === 'string' ? rawIdAny : String(rawIdAny ?? '')
  const id = rawIdStr !== '' ? rawIdStr : `${province}-${city}-${kind}-${date}-${lat}-${lng}`

  return { id, title, province, city, type: kind, status, date, updated_at, lat, lng, url, description }
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
      const rows: any[] =
        Array.isArray(data)      ? data :
        Array.isArray(data?.data)? data.data :
        Object.values(data || {}).flatMap((v: any) => Array.isArray(v) ? v : [])
      raw.value = rows.map(transform).filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng))
      console.log('[unimind] rows:', raw.value.length, raw.value.slice(0,3))
    } catch (e: any) {
      console.error('[unimind] fetch error:', e)
      error.value = e?.message || 'Gagal mengambil data.'
    } finally {
      loading.value = false
    }
  }

  const uniqueTypes = computed(() =>
    Array.from(new Set(raw.value.map(d => (d.type || '').trim()))).filter(Boolean).sort()
  )
  const uniqueStatuses = computed(() =>
    Array.from(new Set(raw.value.map(d => (d.status || '').trim()))).filter(Boolean).sort()
  )

  const countByStatus = computed(() => {
    const total       = raw.value.length
    const berlangsung = raw.value.filter(d => normalizeStatus(d.status) === 'SEDANG BERLANGSUNG').length
    const selesai     = raw.value.filter(d => normalizeStatus(d.status) === 'SELESAI').length
    const rencana     = raw.value.filter(d => normalizeStatus(d.status) === 'RENCANA').length
    return { total, berlangsung, selesai, rencana }
  })

  return { raw, fetchRaw, loading, error, uniqueTypes, uniqueStatuses, countByStatus }
}