import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '../api/http'
import type { AuthUser } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('spin_token'))
  const user = ref<AuthUser | null>(null)

  const isAuthed = computed(() => !!token.value)

  function setSession(t: string, u: AuthUser) {
    token.value = t
    user.value = u
    localStorage.setItem('spin_token', t)
  }

  async function register(email: string, password: string) {
    const { data } = await http.post('/auth/register', { email, password })
    setSession(data.token, data.user)
  }

  async function login(email: string, password: string) {
    const { data } = await http.post('/auth/login', { email, password })
    setSession(data.token, data.user)
  }

  async function fetchMe() {
    if (!token.value) return
    try {
      const { data } = await http.get('/auth/me')
      user.value = data
    } catch {
      logout()
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('spin_token')
  }

  return { token, user, isAuthed, register, login, fetchMe, logout }
})
