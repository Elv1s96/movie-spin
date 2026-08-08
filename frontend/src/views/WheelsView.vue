<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { http, apiError } from '../api/http'
import { useAuthStore } from '../stores/auth'
import type { WheelSummary } from '../types'

const auth = useAuthStore()
const router = useRouter()

const wheels = ref<WheelSummary[]>([])
const newName = ref('')
const error = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const { data } = await http.get<WheelSummary[]>('/wheels')
    wheels.value = data
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

async function create() {
  const name = newName.value.trim()
  if (!name) return
  try {
    const { data } = await http.post('/wheels', { name })
    newName.value = ''
    router.push({ name: 'wheel', params: { id: data.id } })
  } catch (e) {
    error.value = apiError(e)
  }
}

async function remove(id: string) {
  if (!confirm('Видалити це колесо разом з фільмами?')) return
  try {
    await http.delete(`/wheels/${id}`)
    wheels.value = wheels.value.filter((w) => w.id !== id)
  } catch (e) {
    error.value = apiError(e)
  }
}

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">Колесо<span>.</span></div>
      <nav class="nav">
        <router-link :to="{ name: 'wheels' }" class="active">Колеса</router-link>
        <router-link :to="{ name: 'movies' }">Мої фільми</router-link>
      </nav>
      <div class="right">
        <span class="who">{{ auth.user?.email }}</span>
        <button class="btn btn-ghost btn-sm" @click="logout">Вийти</button>
      </div>
    </header>

    <main class="wrap">
      <div class="head">
        <div class="eyebrow">Мої колеса</div>
        <h1>Обери колесо або створи нове</h1>
      </div>

      <form class="creator" @submit.prevent="create">
        <input v-model="newName" class="field" placeholder="Назва колеса, напр. «Вечір п'ятниці»" />
        <button class="btn btn-primary" type="submit">Створити</button>
      </form>

      <p v-if="error" class="err">{{ error }}</p>

      <div v-if="loading" class="muted">Завантаження…</div>
      <div v-else-if="!wheels.length" class="muted">Ще немає жодного колеса. Створи перше вгорі.</div>

      <div v-else class="grid">
        <div v-for="w in wheels" :key="w.id" class="tile" @click="router.push({ name: 'wheel', params: { id: w.id } })">
          <div class="tile-top">
            <h3>{{ w.name }}</h3>
            <button class="del" title="Видалити" @click.stop="remove(w.id)">×</button>
          </div>
          <div class="count">{{ w._count.items }} фільм(ів)</div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; }
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 32px; border-bottom: 2px solid var(--line); background: var(--surface);
}
.brand { font-size: 18px; font-weight: 900; text-transform: uppercase; }
.brand span { color: var(--accent); }
.nav { display: flex; gap: 18px; margin-left: 28px; }
.nav a { text-decoration: none; color: var(--ink-muted); font-size: 14px; font-weight: 700; padding-bottom: 2px; border-bottom: 2px solid transparent; }
.nav a.active, .nav a.router-link-exact-active { color: var(--ink); border-color: var(--accent); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.who { font-size: 13px; color: var(--ink-muted); }
.wrap { max-width: 900px; margin: 0 auto; padding: 40px 32px; display: flex; flex-direction: column; gap: 24px; }
.head h1 { font-size: 28px; margin-top: 6px; }
.creator { display: flex; gap: 12px; }
.creator .field { flex: 1; }
.err { color: #ff8a80; font-size: 14px; }
.muted { color: var(--ink-faint); font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.tile {
  border: 2px solid var(--line-soft); background: var(--surface); padding: 20px;
  cursor: pointer; transition: border-color 0.12s, transform 0.12s;
  display: flex; flex-direction: column; gap: 12px; min-height: 120px;
}
.tile:hover { border-color: var(--accent); transform: translateY(-2px); }
.tile-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.tile h3 { font-size: 19px; word-break: break-word; }
.del {
  border: none; background: transparent; color: var(--ink-faint);
  font-size: 22px; line-height: 1; cursor: pointer; flex: 0 0 auto;
}
.del:hover { color: var(--danger); }
.count { font-size: 12px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: auto; }
</style>
