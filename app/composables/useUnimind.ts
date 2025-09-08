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

function firstKey(obj: any, candidates: string[]) {
  const lower: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj || {})) lower[k.toLowerCase()] = v
  for (const c of candidates) {
    const hit = lower[c.toLowerCase()]
    if (hit !== undefined) return hit
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

function normalizeStatus(s: string = '') {
  const v = s.toLowerCase()
  if (v.includes('selesai') || v.includes('resolved') || v.includes('done')) return 'SELESAI'
  if (v.includes('rencana') || v.includes('plan')) return 'RENCANA'
  if (v.includes('sedang') || v.includes('berlangsung') || v.includes('ongoing')) return 'SEDANG BERLANGSUNG'
  return s.toUpperCase()
}

function transform(row: any): Incident {
  const lat =
    toNum(firstKey(row, ['lat', 'latitude', 'lintang'])) ??
    (Array.isArray(row.latlng) ? toNum(row.latlng[0]) : NaN)
  const lng =
    toNum(firstKey(row, ['lng', 'lon', 'long', 'longitude', 'bujur'])) ??
    (Array.isArray(row.latlng) ? toNum(row.latlng[1]) : NaN)

  const province = firstKey(row, ['provinsi', 'province', 'prov']) || ''
  const city = firstKey(row, ['kota', 'kabupaten', 'kab/kota', 'city']) || ''
  const type = firstKey(row, ['jenis kejadian', 'jenis', 'type']) || ''
  const statusRaw = firstKey(row, ['status', 'keterangan_status', 'state']) || ''
  const status = normalizeStatus(String(statusRaw))
  const date = parseDateSmart(firstKey(row, ['tanggal', 'date', 'waktu', 'created_at']))
  const updated_at = parseDateSmart(firstKey(row, ['update terakhir', 'updated_at', 'update']))
  const url = firstKey(row, ['url', 'link', 'article_url'])
  const description = firstKey(row, ['fasilitas terdampak', 'keterangan', 'deskripsi'])
  const title = `${province || 'Lokasi tidak diketahui'}${city ? ', ' + city : ''}`
  const id = String(firstKey(row, ['id', 'kode'])) ||
    `${province}-${city}-${type}-${date}-${lat}-${lng}`

  return { id, title, province, city, type, status, date, updated_at, lat, lng, url, description }
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

  return { raw, fetchRaw, loading, error, uniqueTypes, uniqueStatuses, countByStatus }
}
