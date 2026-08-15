<script setup lang="ts">
// Окрема сторінка керування каталогом жанрів: таблиця зі списком, кількістю
// фільмів на кожному жанрі, перейменуванням та видаленням.
import { ref, computed, onMounted, nextTick } from 'vue'
import { http, apiError } from '../api/http'
import AppHeader from '../components/AppHeader.vue'
import type { Genre, Movie } from '../types'

const genres = ref<Genre[]>([])
const movies = ref<Movie[]>([])
const loading = ref(true)
const error = ref('')

const draft = ref('')
const adding = ref(false)
const search = ref('')

const renamingId = ref<string | null>(null)
const renameDraft = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

type SortKey = 'name' | 'count' | 'createdAt'
const sortKey = ref<SortKey>('name')
const sortDir = ref<'asc' | 'desc'>('asc')

// Скільки фільмів у бібліотеці має кожен жанр (жанри на фільмах — рядки).
const counts = computed(() => {
  const map = new Map<string, number>()
  movies.value.forEach((m) => m.genres.forEach((g) => map.set(g, (map.get(g) ?? 0) + 1)))
  return map
})

const rows = computed(() =>
  genres.value.map((g) => ({ ...g, count: counts.value.get(g.name) ?? 0 })),
)

const visibleRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = q ? rows.value.filter((r) => r.name.toLowerCase().includes(q)) : [...rows.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    if (sortKey.value === 'name') return a.name.localeCompare(b.name, 'uk') * dir
    if (sortKey.value === 'count') {
      return (a.count - b.count || a.name.localeCompare(b.name, 'uk')) * dir
    }
    return (a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, 'uk')) * dir
  })
})

const usedCount = computed(() => rows.value.filter((r) => r.count > 0).length)

function setSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    // Для кількості логічніше починати з найбільшої, для решти — за зростанням.
    sortDir.value = key === 'count' ? 'desc' : 'asc'
  }
}

function sortMark(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '↑' : '↓'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [g, m] = await Promise.all([
      http.get<Genre[]>('/genres'),
      http.get<Movie[]>('/movies'),
    ])
    genres.value = g.data
    movies.value = m.data
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

// Бекенд зводить назву до нижнього регістру й повертає наявний запис,
// якщо такий жанр уже є, — тож дубль просто не створиться.
async function create() {
  const name = draft.value.trim()
  if (!name || adding.value) return
  adding.value = true
  error.value = ''
  try {
    const { data } = await http.post<Genre>('/genres', { name })
    if (!genres.value.some((x) => x.id === data.id)) genres.value.push(data)
    draft.value = ''
  } catch (e) {
    error.value = apiError(e)
  } finally {
    adding.value = false
  }
}

async function startRename(g: Genre) {
  renamingId.value = g.id
  renameDraft.value = g.name
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

async function saveRename(g: Genre) {
  const name = renameDraft.value.trim()
  renamingId.value = null
  if (!name || name === g.name) return
  error.value = ''
  try {
    await http.patch<Genre>(`/genres/${g.id}`, { name })
    // Перейменування каскадить у фільми — перечитуємо і каталог, і бібліотеку.
    await load()
  } catch (e) {
    error.value = apiError(e)
  }
}

async function remove(g: Genre & { count: number }) {
  const tail = g.count ? ` Він зникне з ${g.count} фільм(ів).` : ''
  if (!confirm(`Видалити жанр «${g.name}» з каталогу?${tail}`)) return
  error.value = ''
  try {
    await http.delete(`/genres/${g.id}`)
    await load()
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
        <div class="eyebrow">Каталог жанрів</div>
        <h1>Керування жанрами</h1>
        <p class="sub">
          Жанри з каталогу пропонуються чипсами у формі фільму. Назви зберігаються
          в нижньому регістрі, повтори не додаються.
        </p>
      </div>

      <form class="creator" @submit.prevent="create">
        <input v-model="draft" class="field" placeholder="Новий жанр, напр. «трилер»" />
        <button class="btn btn-primary" type="submit" :disabled="adding || !draft.trim()">
          {{ adding ? '…' : 'Додати' }}
        </button>
      </form>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="tbl-head">
        <input v-model="search" class="field search" type="search" placeholder="Пошук жанру…" />
        <span class="count">
          {{ rows.length }} жанр(ів) · {{ usedCount }} у вжитку
        </span>
      </div>

      <div v-if="loading" class="muted">Завантаження…</div>
      <div v-else-if="!rows.length" class="muted">
        Каталог порожній — додай перший жанр вище.
      </div>
      <div v-else-if="!visibleRows.length" class="muted">Нічого не знайдено.</div>

      <div v-else class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th class="c-name" @click="setSort('name')">
                <span class="th-in">Жанр <i class="mark">{{ sortMark('name') }}</i></span>
              </th>
              <th class="c-num" @click="setSort('count')">
                <span class="th-in">Фільмів <i class="mark">{{ sortMark('count') }}</i></span>
              </th>
              <th class="c-date" @click="setSort('createdAt')">
                <span class="th-in">Додано <i class="mark">{{ sortMark('createdAt') }}</i></span>
              </th>
              <th class="c-act"><span class="sr">Дії</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in visibleRows" :key="g.id" :class="{ editing: renamingId === g.id }">
              <td class="c-name">
                <input
                  v-if="renamingId === g.id"
                  :ref="(el) => (renameInput = el as HTMLInputElement | null)"
                  class="field rename"
                  v-model="renameDraft"
                  @keydown.enter.prevent="saveRename(g)"
                  @keydown.esc="renamingId = null"
                />
                <span v-else class="name">{{ g.name }}</span>
              </td>
              <td class="c-num">
                <span class="pill" :class="{ zero: !g.count }">{{ g.count || '—' }}</span>
              </td>
              <td class="c-date">{{ fmtDate(g.createdAt) }}</td>
              <td class="c-act">
                <div class="acts">
                  <template v-if="renamingId === g.id">
                    <button class="btn btn-primary btn-sm" @click="saveRename(g)">Зберегти</button>
                    <button class="btn btn-ghost btn-sm" @click="renamingId = null">Скасувати</button>
                  </template>
                  <template v-else>
                    <button class="icon-btn" title="Перейменувати" @click="startRename(g)">
                      <svg viewBox="0 0 24 24" width="16" height="16"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></g></svg>
                    </button>
                    <button class="icon-btn del" title="Видалити" @click="remove(g)">
                      <svg viewBox="0 0 24 24" width="16" height="16"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></g></svg>
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; }
.wrap { max-width: 900px; margin: 0 auto; padding: 40px 32px; display: flex; flex-direction: column; gap: 22px; }
.head h1 { font-size: 28px; margin-top: 6px; }
.sub { margin-top: 8px; font-size: 14px; color: var(--ink-muted); line-height: 1.5; max-width: 620px; }

.creator { display: flex; gap: 12px; }
.creator .field { flex: 1; }

.tbl-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.tbl-head .search { max-width: 320px; }
.count { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); white-space: nowrap; }

.tbl-wrap { border: 2px solid var(--line-soft); background: var(--surface); overflow-x: auto; }
.tbl { width: 100%; border-collapse: collapse; }

.tbl thead th {
  background: var(--surface-2);
  text-align: left; padding: 0;
  font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--ink-faint);
  border-bottom: 2px solid var(--line-soft);
  cursor: pointer; user-select: none;
}
.tbl thead th:hover { color: var(--ink); }
.tbl thead th.c-act { cursor: default; }
.tbl thead th.c-act:hover { color: var(--ink-faint); }
.th-in { display: block; padding: 12px 16px; }
.mark { font-style: normal; color: var(--accent); margin-left: 4px; }
.sr { display: block; padding: 12px 16px; }

.tbl tbody td { padding: 11px 16px; border-bottom: 1px solid var(--line-soft); vertical-align: middle; }
.tbl tbody tr:last-child td { border-bottom: none; }
.tbl tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.014); }
.tbl tbody tr:hover { background: rgba(255, 212, 0, 0.05); }
.tbl tbody tr.editing { background: rgba(255, 212, 0, 0.08); }

.c-name { width: 100%; }
.c-num { width: 110px; text-align: center; }
.c-date { width: 150px; white-space: nowrap; font-size: 13px; color: var(--ink-faint); }
.c-act { width: 210px; }
.tbl thead .c-num .th-in, .tbl tbody .c-num { text-align: center; }

.name { font-size: 15px; font-weight: 700; }
.rename { padding: 8px 10px; font-size: 15px; max-width: 320px; }

.pill {
  display: inline-block; min-width: 30px; padding: 3px 9px;
  font-size: 12px; font-weight: 800;
  background: var(--bg); border: 1px solid var(--line-soft); border-radius: 999px;
  color: var(--ink-dim);
}
.pill.zero { color: var(--ink-faint); font-weight: 600; }

.acts { display: flex; gap: 8px; justify-content: flex-end; }
.icon-btn {
  width: 34px; height: 34px; flex: 0 0 34px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--line-soft); background: transparent; color: var(--ink-muted);
  cursor: pointer; transition: border-color 0.12s, color 0.12s;
}
.icon-btn:hover { border-color: var(--ink); color: var(--ink); }
.icon-btn.del:hover { border-color: var(--danger); color: var(--danger); }

.muted { color: var(--ink-faint); font-size: 15px; }
.err { color: #ff8a80; font-size: 14px; }

@media (max-width: 640px) {
  .c-date { display: none; }
  .tbl-head { flex-direction: column; align-items: stretch; }
  .tbl-head .search { max-width: none; }
}
</style>
