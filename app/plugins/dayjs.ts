// plugins/dayjs.ts
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import 'dayjs/locale/id'

dayjs.extend(customParseFormat)
dayjs.locale('id')

export default defineNuxtPlugin(() => {
  return { provide: { dayjs } }
})
