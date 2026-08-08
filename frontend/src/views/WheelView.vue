<script setup lang="ts">
import { ref, computed, onMounted, watch, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { http, apiError } from '../api/http'
import type { Wheel, WheelItem, Movie, SpinResult, SpinHistoryEntry } from '../types'
import SpinWheel, { type Segment } from '../components/SpinWheel.vue'

const route = useRoute()
const router = useRouter()
const wheelId = route.params.id as string

const wheelRef = useTemplateRef<InstanceType<typeof SpinWheel>>('wheelRef')

const wheel = ref<Wheel | null>(null)
const items = ref<WheelItem[]>([])
const library = ref<Movie[]>([])
const history = ref<SpinHistoryEntry[]>([])
const winner = ref<Movie | null>(null)
const spinning = ref(false)
const error = ref('')

const pickerOpen = ref(false)
const pickerQuery = ref('')

// Налаштування колеса (зберігаються локально).
const spinDuration = ref(7) // секунди
const mode = ref<'winner' | 'elimination'>('winner')
const eliminated = ref<string[]>([]) // id позицій, що вибули цього раунду (режим «на вибування»)
const champion = ref<Movie | null>(null) // фінальний переможець (останній, хто лишився)

try {
  const raw = localStorage.getItem('spin_settings')
  if (raw) {
    const s = JSON.parse(raw)
    if (typeof s.duration === 'number') spinDuration.value = s.duration
    if (s.mode === 'winner' || s.mode === 'elimination') mode.value = s.mode
  }
} catch {
  /* ignore */
}

watch([spinDuration, mode], () => {
  localStorage.setItem(
    'spin_settings',
    JSON.stringify({ duration: spinDuration.value, mode: mode.value }),
  )
})
// Зміна режиму скидає вибулих (щоб не лишалось прихованих позицій).
watch(mode, () => {
  eliminated.value = []
  champion.value = null
})

// Активні позиції: у режимі «на вибування» — без тих, що вже випали.
const activeItems = computed(() =>
  mode.value === 'elimination'
    ? items.value.filter((it) => !eliminated.value.includes(it.id))
    : items.value,
)

function restoreAll() {
  eliminated.value = []
  champion.value = null
}

function closeChampion() {
  champion.value = null
}

// Синхронізовано з палітрою секторів у SpinWheel.vue (смужки/свотчі — легенда колеса).
const FILLS = ['#ffd400', '#3ea0ff', '#ff7a2f', '#a877ff', '#43c66b', '#ff5fa2', '#22c7c7', '#ff5147']

// Сегменти для колеса: назва + вага з активної позиції.
const segments = computed<Segment[]>(() =>
  activeItems.value.map((it) => ({
    id: it.id,
    label: it.movie.title,
    weight: it.weight,
    posterUrl: it.movie.posterUrl,
  })),
)

const totalWeight = computed(() => {
  const w = activeItems.value.map((it) => (it.weight > 0 ? it.weight : 0))
  const t = w.reduce((s, x) => s + x, 0)
  return t > 0 ? t : activeItems.value.length || 1
})

function pct(it: WheelItem): string {
  const anyPos = activeItems.value.some((x) => x.weight > 0)
  const eff = anyPos ? (it.weight > 0 ? it.weight : 0) : 1
  const p = (eff / totalWeight.value) * 100
  return p.toFixed(p < 10 ? 1 : 0)
}

// Фільми з бібліотеки, яких ще немає в колесі.
const available = computed(() => {
  const inWheel = new Set(items.value.map((it) => it.movieId))
  const q = pickerQuery.value.trim().toLowerCase()
  return library.value
    .filter((m) => !inWheel.has(m.id))
    .filter((m) => !q || m.title.toLowerCase().includes(q))
})

async function load() {
  try {
    const [{ data: w }, { data: lib }] = await Promise.all([
      http.get<Wheel>(`/wheels/${wheelId}`),
      http.get<Movie[]>('/movies'),
    ])
    wheel.value = w
    items.value = w.items
    library.value = lib
    await loadHistory()
  } catch (e) {
    error.value = apiError(e)
  }
}

async function loadHistory() {
  const { data } = await http.get<SpinHistoryEntry[]>(`/wheels/${wheelId}/history?limit=8`)
  history.value = data
}

async function clearHistory() {
  if (!confirm('Очистити історію спінів цього колеса?')) return
  try {
    await http.delete(`/wheels/${wheelId}/history`)
    history.value = []
  } catch (e) {
    error.value = apiError(e)
  }
}

async function addFromLibrary(movie: Movie) {
  try {
    const { data } = await http.post<WheelItem>(`/wheels/${wheelId}/items`, { movieId: movie.id })
    items.value.push(data)
  } catch (e) {
    error.value = apiError(e)
  }
}

let patchTimer: number | undefined
function onWeight(it: WheelItem, value: string) {
  it.weight = Math.max(0, Number(value) || 0)
  window.clearTimeout(patchTimer)
  patchTimer = window.setTimeout(async () => {
    try {
      await http.patch(`/wheels/${wheelId}/items/${it.id}`, { weight: it.weight })
    } catch (e) {
      error.value = apiError(e)
    }
  }, 400)
}

async function removeItem(it: WheelItem) {
  try {
    await http.delete(`/wheels/${wheelId}/items/${it.id}`)
    items.value = items.value.filter((x) => x.id !== it.id)
  } catch (e) {
    error.value = apiError(e)
  }
}

async function weightsFromImdb() {
  try {
    const { data } = await http.post<WheelItem[]>(`/wheels/${wheelId}/items/weights-from-imdb`)
    items.value = data
  } catch (e) {
    error.value = apiError(e)
  }
}

async function doSpin() {
  if (spinning.value || activeItems.value.length < 2) return
  spinning.value = true
  winner.value = null
  error.value = ''
  try {
    const ids = activeItems.value.map((it) => it.id)
    const { data } = await http.post<SpinResult>(`/wheels/${wheelId}/spin`, { itemIds: ids })
    await wheelRef.value?.spinTo(data.index, spinDuration.value * 1000)
    winner.value = data.winner
    // Режим «на вибування»: прибираємо того, хто випав. Коли лишається один —
    // він фінальний переможець, показуємо модалку.
    if (mode.value === 'elimination') {
      const wonItem = activeItems.value[data.index]
      if (wonItem) eliminated.value.push(wonItem.id)
      const remaining = items.value.filter((it) => !eliminated.value.includes(it.id))
      if (remaining.length === 1) champion.value = remaining[0].movie
    }
    await loadHistory()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    spinning.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="layout">
    <!-- ЛІВА ПАНЕЛЬ -->
    <aside class="panel">
      <div class="panel-head">
        <button class="back" @click="router.push({ name: 'wheels' })">← Колеса</button>
        <h2>{{ wheel?.name }}</h2>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <!-- Налаштування -->
      <section class="block settings">
        <div class="eyebrow">Налаштування</div>
        <label class="set-row">
          <span class="set-label">Час прокручування</span>
          <input type="range" min="2" max="60" step="1" v-model.number="spinDuration" />
          <span class="set-val">{{ spinDuration }} с</span>
        </label>
        <div class="set-row">
          <span class="set-label">Режим</span>
          <div class="mode-seg">
            <button class="seg" :class="{ on: mode === 'winner' }" @click="mode = 'winner'">Переможець</button>
            <button class="seg" :class="{ on: mode === 'elimination' }" @click="mode = 'elimination'">На вибування</button>
          </div>
        </div>
        <p v-if="mode === 'elimination'" class="set-hint">
          Кожен прокрут прибирає переможця з колеса. Кнопка «Відновити список» повертає всіх.
        </p>
      </section>

      <hr class="divider" />

      <!-- 01 Фільми в колесі -->
      <section class="block">
        <div class="chances-head">
          <div class="eyebrow">01 — Фільми в колесі</div>
          <button class="add-btn" @click="pickerOpen = !pickerOpen">
            {{ pickerOpen ? '✕ Закрити' : '+ Додати' }}
          </button>
        </div>

        <!-- Пікер бібліотеки -->
        <div v-if="pickerOpen" class="picker">
          <input v-model="pickerQuery" class="field" placeholder="Пошук у бібліотеці" />
          <div v-if="!available.length" class="muted small">
            {{ library.length ? 'Усі фільми вже додані' : 'Бібліотека порожня.' }}
            <router-link :to="{ name: 'movies' }" class="link">Перейти до «Мої фільми»</router-link>
          </div>
          <div v-else class="picker-list">
            <button v-for="m in available" :key="m.id" class="picker-row" @click="addFromLibrary(m)">
              <img v-if="m.posterUrl" :src="m.posterUrl" class="pick-poster" alt="" />
              <span v-else class="pick-poster empty"></span>
              <span class="pick-title">{{ m.title }}</span>
              <span v-if="m.imdbRating != null" class="pick-imdb">★ {{ m.imdbRating.toFixed(1) }}</span>
            </button>
          </div>
        </div>

        <div v-if="!items.length" class="muted">Ще порожньо. Натисни «+ Додати» й обери фільми з бібліотеки.</div>
        <div v-else class="movie-list">
          <div
            v-for="(it, i) in items"
            :key="it.id"
            class="movie-row"
            :class="{ gone: mode === 'elimination' && eliminated.includes(it.id) }"
          >
            <span class="bar" :style="{ background: FILLS[i % FILLS.length] }"></span>
            <img v-if="it.movie.posterUrl" :src="it.movie.posterUrl" class="m-poster" alt="" />
            <span class="m-title" :title="it.movie.title">{{ it.movie.title }}</span>
            <input
              class="field w"
              type="number"
              min="0"
              step="0.5"
              :value="it.weight"
              @change="onWeight(it, ($event.target as HTMLInputElement).value)"
            />
            <button class="del" title="Прибрати з колеса" @click="removeItem(it)">×</button>
          </div>
        </div>

        <button v-if="items.length" class="btn btn-ghost btn-sm imdb-fill" @click="weightsFromImdb">
          ★ Заповнити ваги балами IMDb
        </button>
      </section>

      <hr class="divider" />

      <!-- 02 Шанси -->
      <section class="block">
        <div class="chances-head">
          <div class="eyebrow">02 — Шанси</div>
          <div class="count">{{ activeItems.length }} фільм(ів)</div>
        </div>
        <div v-for="(it, i) in activeItems" :key="it.id" class="chance-row">
          <span class="swatch" :style="{ background: FILLS[i % FILLS.length] }"></span>
          <span class="c-name">{{ it.movie.title }}</span>
          <span class="c-weight">×{{ it.weight }}</span>
          <span class="c-pct">{{ pct(it) }}%</span>
        </div>
      </section>
    </aside>

    <!-- ПРАВА ЗОНА -->
    <main class="stage-area">
      <div class="stage-top">
        <span>Обертання</span>
        <span>{{ spinning ? 'крутиться…' : activeItems.length > 1 ? 'готово' : eliminated.length ? 'список вичерпано' : 'додайте 2+ фільми' }}</span>
      </div>

      <SpinWheel ref="wheelRef" :segments="segments" :spinning="spinning" @spin="doSpin" />

      <div class="controls">
        <div v-if="mode === 'elimination'" class="elim-bar">
          <span class="elim-count">Залишилось: {{ activeItems.length }} з {{ items.length }}</span>
          <button v-if="eliminated.length" class="btn btn-ghost btn-sm" @click="restoreAll">
            ↺ Відновити список
          </button>
        </div>
        <div class="winner-line">
          <img v-if="winner?.posterUrl" :src="winner.posterUrl" class="winner-poster" alt="" />
          <div class="winner-text">
            <span class="winner-label">Випало</span>
            <span class="winner" :class="{ empty: !winner }">{{ winner?.title ?? '—' }}</span>
          </div>
        </div>
      </div>

      <div class="history">
        <span class="history-label">Історія</span>
        <span v-for="h in history" :key="h.id" class="chip">{{ h.movie.title }}</span>
        <button v-if="history.length" class="history-clear" @click="clearHistory">Очистити</button>
      </div>
    </main>

    <!-- Модалка фінального переможця (режим «на вибування») -->
    <Teleport to="body">
      <div v-if="champion" class="champ-overlay" @click.self="closeChampion">
        <div class="champ-modal">
          <div class="champ-eyebrow">🏆 Переможець</div>
          <img v-if="champion.posterUrl" :src="champion.posterUrl" class="champ-poster" alt="" />
          <div class="champ-title">{{ champion.title }}</div>
          <div class="champ-actions">
            <button class="btn btn-primary" @click="restoreAll">↺ Відновити список</button>
            <button class="btn btn-ghost" @click="closeChampion">Закрити</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.layout { display: grid; grid-template-columns: 420px 1fr; min-height: 100vh; }

.panel {
  border-right: 2px solid var(--line); padding: 28px; display: flex; flex-direction: column;
  gap: 22px; background: var(--surface); overflow-y: auto; max-height: 100vh;
}
.panel-head { display: flex; flex-direction: column; gap: 8px; }
.back { align-self: flex-start; border: none; background: transparent; color: var(--ink-muted); font-size: 13px; font-weight: 700; cursor: pointer; padding: 0; }
.back:hover { color: var(--accent); }
.panel-head h2 { font-size: 24px; word-break: break-word; }
.block { display: flex; flex-direction: column; gap: 12px; }

.chances-head { display: flex; justify-content: space-between; align-items: center; }
.add-btn { border: 2px solid var(--line-soft); background: transparent; color: var(--ink); font-size: 12px; font-weight: 800; padding: 6px 10px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em; }
.add-btn:hover { border-color: var(--accent); color: var(--accent); }

.picker { border: 2px solid var(--line-soft); padding: 12px; display: flex; flex-direction: column; gap: 10px; background: var(--bg); }
.picker-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.picker-row { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line-soft); background: var(--surface); padding: 6px 8px; cursor: pointer; text-align: left; }
.picker-row:hover { border-color: var(--accent); }
.pick-poster { width: 28px; height: 42px; object-fit: cover; flex: 0 0 28px; background: #3a3634; }
.pick-poster.empty { background: #3a3634; }
.pick-title { flex: 1; min-width: 0; font-size: 14px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pick-imdb { font-size: 12px; color: var(--accent); font-weight: 700; }
.muted { color: var(--ink-faint); font-size: 13px; }
.muted.small { font-size: 12.5px; }
.link { color: var(--accent); }

.movie-list { display: flex; flex-direction: column; gap: 8px; }
.movie-row { display: flex; gap: 8px; align-items: center; }
.movie-row.gone { opacity: 0.38; }
.movie-row.gone .m-title { text-decoration: line-through; }
.bar { width: 8px; align-self: stretch; flex: 0 0 8px; }
.m-poster { width: 30px; height: 44px; flex: 0 0 30px; object-fit: cover; background: #3a3634; }
.m-title { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.field.w { width: 66px; flex: 0 0 66px; padding: 9px 8px; font-size: 14px; }
.del { width: 34px; flex: 0 0 34px; border: 2px solid var(--line-soft); background: transparent; color: var(--ink-muted); font-size: 16px; cursor: pointer; }
.del:hover { border-color: var(--danger); color: var(--danger); }
.imdb-fill { align-self: flex-start; }

.count { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }
.chance-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line-soft); }
.swatch { width: 10px; height: 10px; flex: 0 0 10px; }
.c-name { flex: 1; min-width: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.c-weight { font-size: 12px; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
.c-pct { width: 54px; text-align: right; font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }

.stage-area {
  position: relative; min-width: 0; padding: 32px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 28px; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 42%, #35312f 0%, #201e1d 62%, #171514 100%);
}
.stage-top { position: absolute; top: 28px; left: 32px; right: 32px; display: flex; justify-content: space-between; align-items: baseline; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
/* Налаштування */
.settings { display: flex; flex-direction: column; gap: 12px; }
.set-row { display: flex; align-items: center; gap: 12px; }
.set-label { font-size: 13px; font-weight: 600; color: var(--ink-muted); flex: 0 0 auto; }
.set-row input[type='range'] { flex: 1; accent-color: var(--accent); cursor: pointer; }
.set-val { font-size: 13px; font-weight: 800; min-width: 40px; text-align: right; }
.mode-seg { display: inline-flex; border: 2px solid var(--line-soft); margin-left: auto; }
.seg {
  padding: 7px 12px; background: transparent; border: none;
  border-right: 2px solid var(--line-soft); color: var(--ink-muted);
  font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.12s, color 0.12s;
}
.seg:last-child { border-right: none; }
.seg:hover:not(.on) { color: var(--ink); }
.seg.on { background: var(--accent); color: #1a1600; }
.set-hint { font-size: 12px; color: var(--ink-faint); line-height: 1.4; }

.elim-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.elim-count { font-size: 13px; font-weight: 700; color: var(--ink-muted); }

.controls { width: min(760px, 100%); display: flex; flex-direction: column; gap: 16px; z-index: 6; }
.winner-line { border-top: 2px solid var(--line); padding-top: 16px; display: flex; align-items: center; gap: 16px; min-height: 74px; }
.winner-poster { width: 44px; height: 66px; object-fit: cover; flex: 0 0 44px; }
.winner-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.winner-label { font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.winner { font-size: 30px; font-weight: 900; letter-spacing: -0.02em; line-height: 1.1; color: var(--accent); overflow: hidden; text-overflow: ellipsis; }
.winner.empty { color: #605d5d; }
.history { position: absolute; bottom: 24px; left: 32px; right: 32px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12px; color: var(--ink-faint); }
.history-label { font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
.history-clear {
  margin-left: auto; background: none; border: none; cursor: pointer;
  font-size: 12px; color: var(--ink-muted); text-decoration: underline;
}
.history-clear:hover { color: var(--danger); }
.chip { padding: 4px 9px; border: 1px solid var(--line-soft); font-size: 12.5px; color: var(--ink-dim); background: rgba(243,242,242,.04); }
.err { color: #ff8a80; font-size: 14px; }

/* Модалка фінального переможця */
.champ-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.72);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.champ-modal {
  width: min(360px, 92vw); text-align: center;
  background: var(--surface); border: 2px solid var(--accent);
  padding: 28px; display: flex; flex-direction: column; align-items: center; gap: 16px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.7);
}
.champ-eyebrow { font-size: 13px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
.champ-poster { width: 180px; max-width: 60%; aspect-ratio: 2/3; object-fit: cover; border: 2px solid var(--line-soft); }
.champ-title { font-size: 24px; font-weight: 900; line-height: 1.15; }
.champ-actions { display: flex; flex-direction: column; gap: 10px; width: 100%; margin-top: 4px; }
.champ-actions .btn { width: 100%; justify-content: center; text-align: center; white-space: normal; }

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .panel { max-height: none; border-right: none; border-bottom: 2px solid var(--line); }
}
</style>
