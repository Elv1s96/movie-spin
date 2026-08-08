import axios from 'axios'

export const http = axios.create({
  baseURL: '/api',
})

// Додаємо JWT з localStorage до кожного запиту.
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('spin_token')
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Витягуємо зрозуміле повідомлення про помилку з відповіді бекенду.
export function apiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.message
    if (Array.isArray(msg)) return msg.join(', ')
    if (typeof msg === 'string') return msg
    return e.message
  }
  return 'Невідома помилка'
}
