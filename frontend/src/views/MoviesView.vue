<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { http, apiError } from '../api/http'
import { useAuthStore } from '../stores/auth'
import type { Movie, Genre, WheelSummary } from '../types'

const auth = useAuthStore()
const router = useRouter()

const movies = ref<Movie[]>([])
const genres = ref<Genre[]>([])
const wheels = ref<WheelSummary[]>([])
const loading = ref(true)
const error = ref('')

// Модалка «додати фільм у колесо».
const wheelTarget = ref<Movie | null>(null)
const addedWheelIds = ref<string[]>([])
const addingWheelId = ref<string | null>(null)

// Ввід нового жанру прямо у формі фільму (додає в каталог і одразу обирає).
const newGenre = ref('')
// Панель керування каталогом жанрів.
const managerOpen = ref(false)
const genreDraft = ref('') // ввід у панелі керування
const renamingId = ref<string | null>(null)
const renameDraft = ref('')

const editingId = ref<string | null>(null)
const uploading = ref(false)
const saving = ref(false)
const importing = ref(false)
const importMsg = ref('')

// Фільтри бібліотеки: пошук за назвою + вибір жанрів (усі обрані мають бути у фільмі)
// + статус перегляду.
const searchQuery = ref('')
const filterGenres = ref<string[]>([])
const watchedFilter = ref<'all' | 'watched' | 'unwatched'>('all')

const form = reactive({
  title: '',
  description: '',
  imdbRating: null as number | null,
  posterUrl: '',
  year: null as number | null,
  genres: [] as string[],
  watched: false,
  watchedAt: '',
})

const isEditing = computed(() => editingId.value !== null)

// Чипси у формі = каталог + жанри самого фільму (раптом якийсь ще не в каталозі).
const pickerGenres = computed(() => {
  const names = new Set(genres.value.map((g) => g.name))
  form.genres.forEach((g) => names.add(g))
  return [...names].sort((a, b) => a.localeCompare(b, 'uk'))
})

// Жанри для фільтра — каталог + усі, що трапляються на фільмах.
const allGenres = computed(() => {
  const names = new Set(genres.value.map((g) => g.name))
  movies.value.forEach((m) => m.genres.forEach((g) => names.add(g)))
  return [...names].sort((a, b) => a.localeCompare(b, 'uk'))
})

// Бібліотека після застосування пошуку й фільтра жанрів.
const filteredMovies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const gs = filterGenres.value
  const wf = watchedFilter.value
  return movies.value.filter((m) => {
    if (q && !m.title.toLowerCase().includes(q)) return false
    if (gs.length && !gs.every((g) => m.genres.includes(g))) return false
    if (wf === 'watched' && !m.watched) return false
    if (wf === 'unwatched' && m.watched) return false
    return true
  })
})

const filtersActive = computed(
  () => !!searchQuery.value.trim() || filterGenres.value.length > 0 || watchedFilter.value !== 'all',
)

function toggleFilterGenre(name: string) {
  const i = filterGenres.value.indexOf(name)
  if (i >= 0) filterGenres.value.splice(i, 1)
  else filterGenres.value.push(name)
}
function clearFilters() {
  searchQuery.value = ''
  filterGenres.value = []
  watchedFilter.value = 'all'
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function resetForm() {
  editingId.value = null
  form.title = ''
  form.description = ''
  form.imdbRating = null
  form.posterUrl = ''
  form.year = null
  form.genres = []
  form.watched = false
  form.watchedAt = ''
  newGenre.value = ''
}

async function load() {
  loading.value = true
  try {
    const { data } = await http.get<Movie[]>('/movies')
    movies.value = data
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}

// Приводимо запис із JSON до форми, яку очікує бекенд. Робимо м'яко:
// числа коерсимо, жанри приймаємо і масивом, і рядком через кому.
function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : undefined
}
function int(v: unknown): number | undefined {
  const n = num(v)
  return n === undefined ? undefined : Math.trunc(n)
}
function normalizeImport(m: any) {
  const rawGenres = m?.genres
  const genres = Array.isArray(rawGenres)
    ? rawGenres.map((g: unknown) => String(g).trim()).filter(Boolean)
    : typeof rawGenres === 'string'
      ? rawGenres.split(',').map((g) => g.trim()).filter(Boolean)
      : []
  return {
    title: String(m?.title ?? '').trim(),
    description: m?.description ? String(m.description) : undefined,
    imdbRating: num(m?.imdbRating ?? m?.rating),
    posterUrl: m?.posterUrl ? String(m.posterUrl) : undefined,
    year: int(m?.year),
    genres,
    watched: typeof m?.watched === 'boolean' ? m.watched : undefined,
    watchedAt: m?.watchedAt ? String(m.watchedAt) : undefined,
  }
}

// Експорт усіх фільмів у той самий формат, що приймає імпорт (round-trip).
// Порожні/null поля пропускаємо, щоб файл був чистим.
function exportJson() {
  if (!movies.value.length) return
  const list = movies.value.map((m) => {
    const o: Record<string, unknown> = { title: m.title }
    if (m.year != null) o.year = m.year
    if (m.imdbRating != null) o.imdbRating = m.imdbRating
    if (m.genres.length) o.genres = m.genres
    if (m.posterUrl) o.posterUrl = m.posterUrl
    if (m.description) o.description = m.description
    if (m.watched) o.watched = true
    if (m.watchedAt) o.watchedAt = m.watchedAt.slice(0, 10)
    return o
  })
  const blob = new Blob([JSON.stringify({ movies: list }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `movies-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importing.value = true
  importMsg.value = ''
  error.value = ''
  try {
    const text = await file.text()
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Файл не є коректним JSON')
    }
    const list = Array.isArray(parsed) ? parsed : parsed?.movies
    if (!Array.isArray(list)) {
      throw new Error('Очікується масив фільмів або обʼєкт { "movies": [ … ] }')
    }
    const movies = list.map(normalizeImport).filter((m) => m.title)
    const skipped = list.length - movies.length
    if (!movies.length) throw new Error('У файлі немає жодного фільму з назвою')
    const { data } = await http.post<{ created: number; genresAdded: number }>(
      '/movies/import',
      { movies },
    )
    importMsg.value =
      `Додано фільмів: ${data.created}` +
      (skipped ? `, пропущено (без назви): ${skipped}` : '') +
      (data.genresAdded ? `. Нових жанрів у каталог: ${data.genresAdded}` : '') +
      '.'
    await Promise.all([load(), loadGenres()])
  } catch (e) {
    error.value = e instanceof Error ? e.message : apiError(e)
  } finally {
    importing.value = false
  }
}

async function loadGenres() {
  try {
    const { data } = await http.get<Genre[]>('/genres')
    genres.value = data
  } catch (e) {
    error.value = apiError(e)
  }
}

async function loadWheels() {
  try {
    const { data } = await http.get<WheelSummary[]>('/wheels')
    wheels.value = data
  } catch (e) {
    error.value = apiError(e)
  }
}

function openAddToWheel(m: Movie) {
  wheelTarget.value = m
  addedWheelIds.value = []
  loadWheels()
}

function closeAddToWheel() {
  wheelTarget.value = null
}

// Додати обраний фільм у колесо. Бекенд робить upsert, тож повтор безпечний;
// після додавання перечитуємо колеса, щоб лічильник фільмів був точним.
async function addToWheel(w: WheelSummary) {
  if (!wheelTarget.value || addedWheelIds.value.includes(w.id)) return
  addingWheelId.value = w.id
  error.value = ''
  try {
    await http.post(`/wheels/${w.id}/items`, { movieId: wheelTarget.value.id })
    addedWheelIds.value.push(w.id)
    await loadWheels()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    addingWheelId.value = null
  }
}

// Обрати/зняти жанр для поточного фільму у формі.
function toggleGenre(name: string) {
  const i = form.genres.indexOf(name)
  if (i >= 0) form.genres.splice(i, 1)
  else form.genres.push(name)
}

// Додати новий жанр із поля вводу: створюємо в каталозі й одразу обираємо.
async function addNewGenre() {
  const name = newGenre.value.trim()
  if (!name) return
  try {
    const { data } = await http.post<Genre>('/genres', { name })
    if (!genres.value.some((g) => g.id === data.id)) genres.value.push(data)
    if (!form.genres.includes(data.name)) form.genres.push(data.name)
    newGenre.value = ''
  } catch (e) {
    error.value = apiError(e)
  }
}

// --- Панель керування каталогом ---
async function createGenre() {
  const name = genreDraft.value.trim()
  if (!name) return
  try {
    const { data } = await http.post<Genre>('/genres', { name })
    if (!genres.value.some((g) => g.id === data.id)) genres.value.push(data)
    genreDraft.value = ''
  } catch (e) {
    error.value = apiError(e)
  }
}

function startRename(g: Genre) {
  renamingId.value = g.id
  renameDraft.value = g.name
}

async function saveRename(g: Genre) {
  const name = renameDraft.value.trim()
  renamingId.value = null
  if (!name || name === g.name) return
  try {
    await http.patch<Genre>(`/genres/${g.id}`, { name })
    // Перейменування каскадить у фільми — перечитуємо каталог і бібліотеку.
    await Promise.all([loadGenres(), load()])
  } catch (e) {
    error.value = apiError(e)
  }
}

async function deleteGenre(g: Genre) {
  if (!confirm(`Видалити жанр «${g.name}» з каталогу? Він зникне і з усіх фільмів.`)) return
  try {
    await http.delete(`/genres/${g.id}`)
    genres.value = genres.value.filter((x) => x.id !== g.id)
    form.genres = form.genres.filter((n) => n !== g.name)
    await load()
  } catch (e) {
    error.value = apiError(e)
  }
}

async function onUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  error.value = ''
  try {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await http.post<{ url: string }>('/movies/upload', fd)
    form.posterUrl = data.url
  } catch (e) {
    error.value = apiError(e)
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function payload() {
  return {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    imdbRating: form.imdbRating ?? undefined,
    posterUrl: form.posterUrl.trim() || undefined,
    year: form.year ?? undefined,
    genres: [...new Set(form.genres.map((g) => g.trim()).filter(Boolean))],
    watched: form.watched,
    watchedAt: form.watched ? form.watchedAt || today() : null,
  }
}

async function submit() {
  if (!form.title.trim()) return
  saving.value = true
  error.value = ''
  try {
    if (isEditing.value) {
      const { data } = await http.patch<Movie>(`/movies/${editingId.value}`, payload())
      const idx = movies.value.findIndex((m) => m.id === data.id)
      if (idx >= 0) movies.value[idx] = data
    } else {
      const { data } = await http.post<Movie>('/movies', payload())
      movies.value.unshift(data)
    }
    resetForm()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function startEdit(m: Movie) {
  editingId.value = m.id
  form.title = m.title
  form.description = m.description ?? ''
  form.imdbRating = m.imdbRating
  form.posterUrl = m.posterUrl ?? ''
  form.year = m.year
  form.genres = [...m.genres]
  form.watched = m.watched
  form.watchedAt = m.watchedAt ? m.watchedAt.slice(0, 10) : ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Позначка «переглянуто» з картки. Око завжди відкриває модальне вікно з
// вибором дати; для вже переглянутого фільму там є ще й «Прибрати позначку».
const watchTarget = ref<Movie | null>(null)
const watchDate = ref('')

function onEye(m: Movie) {
  watchDate.value = m.watchedAt ? m.watchedAt.slice(0, 10) : today()
  watchTarget.value = m
}

function closeWatch() {
  watchTarget.value = null
}

async function confirmWatched() {
  const m = watchTarget.value
  if (!m) return
  await patchWatched(m, true, watchDate.value || today())
  closeWatch()
}

async function clearWatched() {
  const m = watchTarget.value
  if (!m) return
  await patchWatched(m, false, null)
  closeWatch()
}

async function patchWatched(m: Movie, watched: boolean, watchedAt: string | null) {
  try {
    const { data } = await http.patch<Movie>(`/movies/${m.id}`, { watched, watchedAt })
    const idx = movies.value.findIndex((x) => x.id === data.id)
    if (idx >= 0) movies.value[idx] = data
  } catch (e) {
    error.value = apiError(e)
  }
}

async function remove(id: string) {
  if (!confirm('Видалити фільм з бібліотеки? Він зникне з усіх коліс.')) return
  try {
    await http.delete(`/movies/${id}`)
    movies.value = movies.value.filter((m) => m.id !== id)
    if (editingId.value === id) resetForm()
  } catch (e) {
    error.value = apiError(e)
  }
}

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

onMounted(() => {
  load()
  loadGenres()
  loadWheels()
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">Колесо<span>.</span></div>
      <nav class="nav">
        <router-link :to="{ name: 'wheels' }">Колеса</router-link>
        <router-link :to="{ name: 'movies' }" class="active">Мої фільми</router-link>
      </nav>
      <div class="right">
        <span class="who">{{ auth.user?.email }}</span>
        <button class="btn btn-ghost btn-sm" @click="logout">Вийти</button>
      </div>
    </header>

    <main class="wrap">
      <!-- Форма додавання / редагування -->
      <section class="editor">
        <div class="eyebrow">{{ isEditing ? 'Редагування фільму' : 'Новий фільм' }}</div>
        <div class="editor-grid">
          <!-- Постер -->
          <div class="poster-col">
            <div class="poster-preview">
              <img v-if="form.posterUrl" :src="form.posterUrl" alt="" />
              <span v-else class="poster-ph">Постер</span>
            </div>
            <input class="field" v-model="form.posterUrl" placeholder="Лінк на картинку" />
            <label class="btn btn-ghost btn-sm upload">
              {{ uploading ? 'Завантаження…' : 'Завантажити файл' }}
              <input type="file" accept="image/*" @change="onUpload" hidden />
            </label>
          </div>

          <!-- Поля -->
          <div class="fields-col">
            <input class="field" v-model="form.title" placeholder="Назва фільму *" />
            <textarea
              class="field area"
              v-model="form.description"
              placeholder="Короткий опис"
              rows="3"
            ></textarea>
            <div class="row">
              <label class="mini">
                <span>Бали IMDb</span>
                <input class="field" v-model.number="form.imdbRating" type="number" min="0" max="10" step="0.1" placeholder="0–10" />
              </label>
              <label class="mini">
                <span>Рік</span>
                <input class="field" v-model.number="form.year" type="number" min="1900" max="2100" placeholder="напр. 1999" />
              </label>
            </div>
            <div class="mini">
              <span>Жанри</span>
              <div class="chips">
                <button
                  v-for="g in pickerGenres"
                  :key="g"
                  type="button"
                  class="chip"
                  :class="{ on: form.genres.includes(g) }"
                  @click="toggleGenre(g)"
                >{{ g }}</button>
                <span v-if="!pickerGenres.length" class="chips-empty">Каталог порожній — додай перший жанр нижче.</span>
              </div>
              <div class="chip-add">
                <input
                  class="field"
                  v-model="newGenre"
                  placeholder="Новий жанр + Enter"
                  @keydown.enter.prevent="addNewGenre"
                />
                <button type="button" class="btn btn-ghost btn-sm" @click="addNewGenre">Додати</button>
                <button type="button" class="btn btn-ghost btn-sm" @click="managerOpen = !managerOpen">
                  {{ managerOpen ? 'Сховати каталог' : 'Керувати каталогом' }}
                </button>
              </div>

              <div v-if="managerOpen" class="genre-manager">
                <div class="gm-head">Каталог жанрів</div>
                <div v-if="!genres.length" class="chips-empty">Ще немає жанрів у каталозі.</div>
                <div v-for="g in genres" :key="g.id" class="gm-row">
                  <template v-if="renamingId === g.id">
                    <input
                      class="field"
                      v-model="renameDraft"
                      @keydown.enter.prevent="saveRename(g)"
                      @keydown.esc="renamingId = null"
                    />
                    <button type="button" class="btn btn-ghost btn-sm" @click="saveRename(g)">Ок</button>
                    <button type="button" class="btn btn-ghost btn-sm" @click="renamingId = null">×</button>
                  </template>
                  <template v-else>
                    <span class="gm-name">{{ g.name }}</span>
                    <button type="button" class="link-btn" @click="startRename(g)">перейменувати</button>
                    <button type="button" class="link-btn del" @click="deleteGenre(g)">видалити</button>
                  </template>
                </div>
                <div class="gm-row">
                  <input
                    class="field"
                    v-model="genreDraft"
                    placeholder="Додати жанр у каталог"
                    @keydown.enter.prevent="createGenre"
                  />
                  <button type="button" class="btn btn-ghost btn-sm" @click="createGenre">Додати</button>
                </div>
              </div>
            </div>

            <!-- Перегляд -->
            <div class="watch-row">
              <label class="check">
                <input type="checkbox" v-model="form.watched" />
                <span>Переглянуто</span>
              </label>
              <label v-if="form.watched" class="mini date">
                <span>Дата перегляду</span>
                <input class="field" type="date" v-model="form.watchedAt" />
              </label>
            </div>

            <div class="actions">
              <button class="btn btn-primary" :disabled="saving || !form.title.trim()" @click="submit">
                {{ saving ? '…' : isEditing ? 'Зберегти' : 'Додати в бібліотеку' }}
              </button>
              <button v-if="isEditing" class="btn btn-ghost" @click="resetForm">Скасувати</button>
            </div>
          </div>
        </div>
        <p v-if="error" class="err">{{ error }}</p>
      </section>

      <hr class="divider" />

      <!-- Бібліотека -->
      <div class="lib-head">
        <div class="eyebrow">Бібліотека</div>
        <div class="lib-tools">
          <a class="link-btn" href="/movies.example.json" download>Приклад JSON</a>
          <button class="btn btn-ghost btn-sm" :disabled="!movies.length" @click="exportJson">
            ↧ Експорт
          </button>
          <label class="btn btn-ghost btn-sm import">
            {{ importing ? 'Імпорт…' : '↥ Імпорт з JSON' }}
            <input type="file" accept="application/json,.json" @change="onImport" :disabled="importing" hidden />
          </label>
          <span class="count">
            {{ filtersActive ? `${filteredMovies.length} / ${movies.length}` : movies.length }} фільм(ів)
          </span>
        </div>
      </div>
      <p v-if="importMsg" class="import-msg">{{ importMsg }}</p>

      <div v-if="movies.length" class="filter-bar">
        <input
          class="field search"
          v-model="searchQuery"
          type="search"
          placeholder="Пошук за назвою…"
        />
        <div class="filter-watched">
          <button type="button" class="seg" :class="{ on: watchedFilter === 'all' }" @click="watchedFilter = 'all'">Всі</button>
          <button type="button" class="seg" :class="{ on: watchedFilter === 'watched' }" @click="watchedFilter = 'watched'">Переглянуто</button>
          <button type="button" class="seg" :class="{ on: watchedFilter === 'unwatched' }" @click="watchedFilter = 'unwatched'">Не переглянуто</button>
        </div>
        <div v-if="allGenres.length" class="filter-genres">
          <button
            v-for="g in allGenres"
            :key="g"
            type="button"
            class="chip"
            :class="{ on: filterGenres.includes(g) }"
            @click="toggleFilterGenre(g)"
          >{{ g }}</button>
          <button v-if="filtersActive" type="button" class="link-btn clear" @click="clearFilters">
            Скинути
          </button>
        </div>
      </div>

      <div v-if="loading" class="muted">Завантаження…</div>
      <div v-else-if="!movies.length" class="muted">Бібліотека порожня — додай перший фільм вгорі.</div>
      <div v-else-if="!filteredMovies.length" class="muted">Нічого не знайдено за фільтром.</div>

      <div v-else class="grid">
        <article v-for="m in filteredMovies" :key="m.id" class="card" :class="{ seen: m.watched }">
          <div class="card-poster">
            <img v-if="m.posterUrl" :src="m.posterUrl" alt="" />
            <span v-else class="poster-ph">Без постера</span>
            <span v-if="m.imdbRating != null" class="imdb">★ {{ m.imdbRating.toFixed(1) }}</span>
            <span v-if="m.watched" class="seen-badge" title="Переглянуто">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5"/></svg>
            </span>
          </div>
          <div class="card-body">
            <h3>{{ m.title }} <span v-if="m.year" class="year">{{ m.year }}</span></h3>
            <p v-if="m.description" class="desc">{{ m.description }}</p>
            <div v-if="m.genres.length" class="genres">
              <span v-for="g in m.genres" :key="g" class="chip-sm">{{ g }}</span>
            </div>

            <div class="seen-line" :class="{ on: m.watched }">
              <template v-if="m.watched">Переглянуто{{ m.watchedAt ? ` · ${fmtDate(m.watchedAt)}` : '' }}</template>
              <template v-else>Не переглянуто</template>
            </div>

            <div class="card-actions">
              <button class="icon-btn" title="Редагувати" @click="startEdit(m)">
                <svg viewBox="0 0 24 24" width="17" height="17"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></g></svg>
              </button>
              <button class="icon-btn" title="Додати в колесо" @click="openAddToWheel(m)">
                <svg viewBox="0 0 24 24" width="17" height="17"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></g></svg>
              </button>
              <button class="icon-btn watch" :class="{ on: m.watched }" :title="m.watched ? 'Зняти позначку' : 'Позначити переглянутим'" @click="onEye(m)">
                <svg viewBox="0 0 24 24" width="17" height="17"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></g></svg>
              </button>
              <button class="icon-btn del" title="Видалити" @click="remove(m.id)">
                <svg viewBox="0 0 24 24" width="17" height="17"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></g></svg>
              </button>
            </div>
          </div>
        </article>
      </div>

    </main>

    <!-- Модальне вікно позначки перегляду -->
    <Teleport to="body">
      <div v-if="watchTarget" class="watch-overlay" @click.self="closeWatch">
        <div class="watch-modal">
          <div class="wm-eyebrow">Дата перегляду</div>
          <div class="wm-movie">{{ watchTarget.title }}</div>
          <input
            class="field wm-date"
            type="date"
            v-model="watchDate"
            @keydown.enter.prevent="confirmWatched"
            @keydown.esc="closeWatch"
          />
          <div class="wm-actions">
            <button class="btn btn-primary" @click="confirmWatched">
              {{ watchTarget.watched ? 'Зберегти дату' : 'Позначити переглянутим' }}
            </button>
            <button v-if="watchTarget.watched" class="btn btn-ghost" @click="clearWatched">
              Прибрати позначку
            </button>
            <button class="btn btn-ghost" @click="closeWatch">Скасувати</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Модальне вікно «додати в колесо» -->
    <Teleport to="body">
      <div v-if="wheelTarget" class="watch-overlay" @click.self="closeAddToWheel">
        <div class="watch-modal">
          <div class="wm-eyebrow">Додати в колесо</div>
          <div class="wm-movie">{{ wheelTarget.title }}</div>

          <div v-if="!wheels.length" class="muted">
            Ще немає коліс. Створи колесо на сторінці «Колеса».
          </div>
          <div v-else class="wheel-list">
            <button
              v-for="w in wheels"
              :key="w.id"
              type="button"
              class="wheel-opt"
              :class="{ added: addedWheelIds.includes(w.id) }"
              :disabled="addingWheelId === w.id || addedWheelIds.includes(w.id)"
              @click="addToWheel(w)"
            >
              <span class="wheel-opt-name">{{ w.name }}</span>
              <span class="wheel-opt-meta">
                {{ addedWheelIds.includes(w.id) ? 'Додано ✓' : `${w._count.items} фільм.` }}
              </span>
            </button>
          </div>

          <div class="wm-actions">
            <button class="btn btn-ghost" @click="closeAddToWheel">Готово</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; }
.topbar {
  display: flex; align-items: center; gap: 28px;
  padding: 16px 32px; border-bottom: 2px solid var(--line); background: var(--surface);
  position: sticky; top: 0; z-index: 10;
}
.brand { font-size: 18px; font-weight: 900; text-transform: uppercase; }
.brand span { color: var(--accent); }
.nav { display: flex; gap: 18px; }
.nav a {
  text-decoration: none; color: var(--ink-muted); font-size: 14px; font-weight: 700;
  padding-bottom: 2px; border-bottom: 2px solid transparent;
}
.nav a.active, .nav a.router-link-active { color: var(--ink); border-color: var(--accent); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.who { font-size: 13px; color: var(--ink-muted); }

.wrap { max-width: 1500px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 24px; }

/* Редактор */
.editor { background: var(--surface); border: 2px solid var(--line-soft); padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.editor-grid { display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
.poster-col { display: flex; flex-direction: column; gap: 10px; }
.poster-preview {
  width: 100%; aspect-ratio: 2/3; background: var(--bg); border: 2px solid var(--line-soft);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.poster-preview img { width: 100%; height: 100%; object-fit: cover; }
.poster-ph { color: var(--ink-faint); font-size: 13px; }
.upload { text-align: center; cursor: pointer; }
.fields-col { display: flex; flex-direction: column; gap: 12px; }
.field.area { resize: vertical; line-height: 1.5; }
.row { display: flex; gap: 12px; }
.mini { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.mini > span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); }
.watch-row { display: flex; gap: 16px; align-items: flex-end; }
.check { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 600; padding-bottom: 9px; }
.check input { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; }
.mini.date { flex: 0 0 auto; }
.actions { display: flex; gap: 12px; margin-top: 4px; }

.lib-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.lib-tools { display: flex; align-items: center; gap: 14px; }
.import { cursor: pointer; }
.import-msg { font-size: 13px; font-weight: 600; color: var(--accent); margin-top: -8px; }

/* Панель фільтрів бібліотеки */
.filter-bar { display: flex; flex-direction: column; gap: 12px; }
.filter-bar .search { max-width: 420px; }
.filter-genres { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.filter-genres .clear { margin-left: 4px; }
.filter-watched { display: inline-flex; width: fit-content; border: 2px solid var(--line-soft); }
.seg {
  padding: 7px 14px; background: transparent; border: none;
  border-right: 2px solid var(--line-soft); color: var(--ink-muted);
  font-size: 13px; font-weight: 700; cursor: pointer; transition: background 0.12s, color 0.12s;
}
.seg:last-child { border-right: none; }
.seg:hover:not(.on) { color: var(--ink); }
.seg.on { background: var(--accent); color: #1a1600; }
.count { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); }
.muted { color: var(--ink-faint); font-size: 15px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
.card { border: 2px solid var(--line-soft); background: var(--surface); display: flex; flex-direction: column; overflow: hidden; transition: border-color 0.12s; }
.card.seen { border-color: color-mix(in srgb, var(--accent) 45%, var(--line-soft)); }
.card-poster { position: relative; aspect-ratio: 2/3; background: var(--bg); display: flex; align-items: center; justify-content: center; }
.card-poster img { width: 100%; height: 100%; object-fit: cover; }
.card.seen .card-poster img { filter: grayscale(0.35) brightness(0.92); }
.imdb {
  position: absolute; top: 8px; right: 8px; background: var(--accent); color: #1a1600;
  font-size: 12px; font-weight: 800; padding: 3px 7px;
}
.seen-badge {
  position: absolute; top: 8px; left: 8px; width: 24px; height: 24px;
  background: var(--accent); color: #1a1600; display: flex; align-items: center; justify-content: center;
}
.card-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.card-body h3 { font-size: 17px; line-height: 1.2; }
.year { color: var(--ink-faint); font-weight: 600; font-size: 14px; }
.desc {
  font-size: 13px; color: var(--ink-dim); line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.genres { display: flex; flex-wrap: wrap; gap: 5px; }
.chip-sm {
  font-size: 11px; font-weight: 600; color: var(--ink-dim);
  background: var(--bg); border: 1px solid var(--line-soft);
  padding: 2px 8px; border-radius: 999px; white-space: nowrap;
}

/* Вибір жанрів чипсами у формі */
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip {
  font-size: 12px; font-weight: 600; color: var(--ink-muted);
  background: var(--bg); border: 1.5px solid var(--line-soft);
  padding: 4px 11px; border-radius: 999px; cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.chip:hover { border-color: var(--ink-muted); color: var(--ink); }
.chip.on {
  background: var(--accent); border-color: var(--accent);
  color: #1a1600; font-weight: 800;
}
.chips-empty { font-size: 12px; color: var(--ink-faint); }
.chip-add { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.chip-add .field { flex: 1; min-width: 140px; }

.genre-manager {
  border: 1.5px solid var(--line-soft); background: var(--bg);
  padding: 12px; display: flex; flex-direction: column; gap: 8px;
}
.gm-head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--ink-faint); }
.gm-row { display: flex; gap: 8px; align-items: center; }
.gm-row .field { flex: 1; }
.gm-name { flex: 1; font-size: 14px; font-weight: 600; }
.link-btn {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12px; color: var(--ink-muted); text-decoration: underline;
}
.link-btn:hover { color: var(--ink); }
.link-btn.del:hover { color: var(--danger); }
.seen-line { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: var(--ink-faint); }
.seen-line.on { color: var(--accent); }

.card-actions { display: flex; gap: 8px; margin-top: auto; padding-top: 4px; }
.icon-btn {
  width: 36px; height: 36px; flex: 0 0 36px;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid var(--line-soft); background: transparent; color: var(--ink-muted);
  cursor: pointer; transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.icon-btn:hover { border-color: var(--ink); color: var(--ink); }
.icon-btn.watch.on { border-color: var(--accent); color: var(--accent); }
.icon-btn.del:hover { border-color: var(--danger); color: var(--danger); }

/* Модальне вікно позначки перегляду (клік по оку) */
.watch-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.watch-modal {
  width: min(380px, 92vw);
  background: var(--surface); border: 2px solid var(--line-soft);
  padding: 24px; display: flex; flex-direction: column; gap: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}
.wm-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: var(--ink-faint); }
.wm-movie { font-size: 18px; font-weight: 800; line-height: 1.25; }
.wm-date { font-size: 18px; padding: 12px 14px; width: 100%; }
.wm-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.wm-actions .btn { width: 100%; justify-content: center; text-align: center; white-space: normal; }

/* Список коліс у модалці «додати в колесо» */
.wheel-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.wheel-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; text-align: left; cursor: pointer;
  background: var(--bg); border: 2px solid var(--line-soft); color: var(--ink);
  transition: border-color 0.12s, background 0.12s;
}
.wheel-opt:hover:not(:disabled) { border-color: var(--accent); }
.wheel-opt.added { border-color: var(--accent); color: var(--accent); cursor: default; }
.wheel-opt-name { font-size: 15px; font-weight: 700; }
.wheel-opt-meta { font-size: 12px; color: var(--ink-faint); white-space: nowrap; }
.wheel-opt.added .wheel-opt-meta { color: var(--accent); }
.err { color: #ff8a80; font-size: 14px; }

@media (max-width: 640px) {
  .editor-grid { grid-template-columns: 1fr; }
  .poster-col { max-width: 200px; }
}
</style>
