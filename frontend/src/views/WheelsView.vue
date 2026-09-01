<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { http, apiError } from '../api/http'
import AppHeader from '../components/AppHeader.vue'
import type { WheelSummary } from '../types'

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

onMounted(load)
</script>

<template>
  <div class="page">
    <AppHeader />

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
.wrap { max-width: 900px; margin: 0 auto; padding: 40px 32px; display: flex; flex-direction: column; gap: 24px; }
.head h1 {
  font-size: 30px; margin-top: 8px; font-weight: 700;
  color: var(--accent-2); text-shadow: 0 0 18px rgba(34, 224, 255, 0.4);
}
.creator { display: flex; gap: 12px; }
.creator .field { flex: 1; }
.err { color: var(--danger); font-size: 14px; }
.muted { color: var(--ink-faint); font-size: 15px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
.tile {
  border: 1.5px solid var(--line); border-radius: 14px;
  background: linear-gradient(180deg, rgba(24, 17, 48, 0.9) 0%, rgba(13, 8, 28, 0.94) 100%);
  padding: 20px; cursor: pointer;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
  display: flex; flex-direction: column; gap: 12px; min-height: 124px;
  box-shadow: 0 0 22px -12px var(--accent-3), 0 10px 30px rgba(0, 0, 0, 0.45);
}
.tile:hover {
  border-color: var(--accent); transform: translateY(-4px);
  box-shadow: 0 0 22px -4px var(--accent), 0 16px 40px rgba(0, 0, 0, 0.5);
}
.tile-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
.tile h3 { font-size: 18px; font-weight: 600; word-break: break-word; transition: color 0.18s; }
.tile:hover h3 { color: var(--accent); text-shadow: 0 0 14px rgba(255, 45, 149, 0.45); }
.del {
  border: none; background: transparent; color: var(--ink-faint);
  font-size: 22px; line-height: 1; cursor: pointer; flex: 0 0 auto; transition: color 0.18s;
}
.del:hover { color: var(--danger); }
.count { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.14em; margin-top: auto; }

@media (max-width: 640px) { .wrap { padding: 24px 16px; } }
</style>
