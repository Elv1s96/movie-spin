<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue'
import { http, apiError } from '../api/http'
import AppHeader from '../components/AppHeader.vue'
import type { Movie, Genre, WheelSummary, ShareInfo } from '../types'

const movies = ref<Movie[]>([])
const genres = ref<Genre[]>([])
const wheels = ref<WheelSummary[]>([])
const loading = ref(true)
const error = ref('')

// Модалка «додати фільм у колесо».
const wheelTarget = ref<Movie | null>(null)
// Колеса, куди фільм додали щойно, і колеса, де він уже був до відкриття модалки.
const addedWheelIds = ref<string[]>([])
const onWheelIds = ref<string[]>([])
const addingWheelId = ref<string | null>(null)

// Ввід нового жанру прямо у формі фільму (додає в каталог і одразу обирає).
// Перейменування/видалення жанрів живе на окремій сторінці «Жанри».
const newGenre = ref('')

// Форма фільму живе в модалці — і для створення, і для редагування.
const editorOpen = ref(false)
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

// Неоновий колір картки — стабільний за id, щоб не стрибав між рендерами.
function neonClass(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return `n${h % 6}`
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

// movieId — щоб бекенд позначив колеса, де цей фільм уже є (hasMovie).
async function loadWheels(movieId?: string) {
  try {
    const { data } = await http.get<WheelSummary[]>('/wheels', {
      params: movieId ? { movieId } : undefined,
    })
    wheels.value = data
    if (movieId) onWheelIds.value = data.filter((w) => w.hasMovie).map((w) => w.id)
  } catch (e) {
    error.value = apiError(e)
  }
}

function openAddToWheel(m: Movie) {
  wheelTarget.value = m
  addedWheelIds.value = []
  onWheelIds.value = []
  loadWheels(m.id)
}

// Фільм уже на колесі: або був там раніше, або його щойно додали.
function isOnWheel(w: WheelSummary) {
  return onWheelIds.value.includes(w.id) || addedWheelIds.value.includes(w.id)
}

function closeAddToWheel() {
  wheelTarget.value = null
}

// Додати обраний фільм у колесо. Бекенд робить upsert, тож повтор безпечний;
// після додавання перечитуємо колеса, щоб лічильник фільмів був точним.
async function addToWheel(w: WheelSummary) {
  if (!wheelTarget.value || isOnWheel(w)) return
  addingWheelId.value = w.id
  error.value = ''
  try {
    await http.post(`/wheels/${w.id}/items`, { movieId: wheelTarget.value.id })
    addedWheelIds.value.push(w.id)
    await loadWheels(wheelTarget.value.id)
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
    closeEditor()
  } catch (e) {
    error.value = apiError(e)
  } finally {
    saving.value = false
  }
}

function openCreate() {
  resetForm()
  error.value = ''
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  error.value = ''
  resetForm()
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
  error.value = ''
  editorOpen.value = true
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
    if (editingId.value === id) closeEditor()
  } catch (e) {
    error.value = apiError(e)
  }
}

// Esc закриває модалку редагування; поки вона відкрита — сторінка під нею не скролиться.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (editorOpen.value) closeEditor()
  else if (detail.value) closeDetail()
  else if (shareOpen.value) closeShare()
}

// Повний опис фільму в модалці — лише читання. У сітці опис обрізаний трьома
// рядками, а лізти заради нього в редагування незручно.
const detail = ref<Movie | null>(null)

function openDetail(m: Movie) {
  detail.value = m
}
function closeDetail() {
  detail.value = null
}

// ── Публічне посилання на бібліотеку ────────────────────────────────────────
// Один токен на акаунт. Токен тримаємо окремо від URL, бо посилання будуємо
// з поточного origin — щоб воно працювало і локально, і на проді.
const shareOpen = ref(false)
const shareToken = ref<string | null>(null)
const shareBusy = ref(false)
const shareCopied = ref(false)
const shareError = ref('')

const shareUrl = computed(() =>
  shareToken.value ? `${window.location.origin}/shared/${shareToken.value}` : '',
)

async function loadShare() {
  try {
    const { data } = await http.get<ShareInfo>('/movies/share')
    shareToken.value = data.token
  } catch (e) {
    shareError.value = apiError(e)
  }
}

function openShare() {
  shareError.value = ''
  shareCopied.value = false
  shareOpen.value = true
}
function closeShare() {
  shareOpen.value = false
}

// Створення при вже наявному токені — це перевипуск: старе посилання вмирає.
async function createShare() {
  shareBusy.value = true
  shareError.value = ''
  shareCopied.value = false
  try {
    const { data } = await http.post<ShareInfo>('/movies/share')
    shareToken.value = data.token
  } catch (e) {
    shareError.value = apiError(e)
  } finally {
    shareBusy.value = false
  }
}

async function revokeShare() {
  shareBusy.value = true
  shareError.value = ''
  shareCopied.value = false
  try {
    await http.delete('/movies/share')
    shareToken.value = null
  } catch (e) {
    shareError.value = apiError(e)
  } finally {
    shareBusy.value = false
  }
}

// clipboard недоступний на http (крім localhost) — тоді просто підсвічуємо
// поле, щоб посилання можна було скопіювати руками.
async function copyShare() {
  if (!shareUrl.value) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    shareCopied.value = true
  } catch {
    shareError.value = 'Не вдалося скопіювати — виділи посилання вручну.'
  }
}

watch([editorOpen, detail], ([open, m]) => {
  document.body.style.overflow = open || m ? 'hidden' : ''
})

onMounted(() => {
  load()
  loadGenres()
  loadWheels()
  loadShare()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="page">
    <AppHeader />

    <main class="wrap">
      <!-- Бібліотека -->
      <div class="lib-head">
        <div class="eyebrow">Бібліотека</div>
        <div class="lib-tools">
          <button class="btn btn-ghost btn-sm" @click="openCreate">+ Додати фільм</button>
          <a class="link-btn" href="/movies.example.json" download>Приклад JSON</a>
          <button class="btn btn-ghost btn-sm" :disabled="!movies.length" @click="exportJson">
            ↧ Експорт
          </button>
          <label class="btn btn-ghost btn-sm import">
            {{ importing ? 'Імпорт…' : '↥ Імпорт з JSON' }}
            <input type="file" accept="application/json,.json" @change="onImport" :disabled="importing" hidden />
          </label>
          <button class="btn btn-ghost btn-sm" :class="{ shared: shareToken }" @click="openShare">
            ↗ Поділитися{{ shareToken ? ' ✓' : '' }}
          </button>
          <span class="count">
            {{ filtersActive ? `${filteredMovies.length} / ${movies.length}` : movies.length }} фільм(ів)
          </span>
        </div>
      </div>
      <p v-if="importMsg" class="import-msg">{{ importMsg }}</p>
      <p v-if="error && !editorOpen" class="err">{{ error }}</p>

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
        <article
          v-for="m in filteredMovies"
          :key="m.id"
          class="card"
          :class="[neonClass(m.id), { seen: m.watched }]"
        >
          <div
            class="card-poster"
            role="button"
            tabindex="0"
            title="Показати повний опис"
            :aria-label="`Показати опис: ${m.title}`"
            @click="openDetail(m)"
            @keydown.enter.prevent="openDetail(m)"
            @keydown.space.prevent="openDetail(m)"
          >
            <img v-if="m.posterUrl" :src="m.posterUrl" alt="" />
            <span v-else class="poster-ph">постер</span>
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

    <!-- Модальне вікно додавання / редагування фільму -->
    <Teleport to="body">
      <div v-if="editorOpen" class="overlay" @click.self="closeEditor">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="eyebrow">{{ isEditing ? 'Редагування фільму' : 'Новий фільм' }}</div>
            <button class="close" title="Закрити" @click="closeEditor">✕</button>
          </div>

          <div class="modal-body">
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
                    <router-link :to="{ name: 'genres' }" class="btn btn-ghost btn-sm manage">
                      Керувати каталогом
                    </router-link>
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
              </div>
            </div>
            <p v-if="error" class="err">{{ error }}</p>
          </div>

          <div class="modal-foot">
            <button class="btn btn-primary" :disabled="saving || !form.title.trim()" @click="submit">
              {{ saving ? '…' : isEditing ? 'Зберегти' : 'Додати в бібліотеку' }}
            </button>
            <button class="btn btn-ghost" @click="closeEditor">Скасувати</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Модальне вікно позначки перегляду -->
    <Teleport to="body">
      <div v-if="watchTarget" class="overlay" @click.self="closeWatch">
        <div class="modal modal-sm">
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
      <div v-if="wheelTarget" class="overlay" @click.self="closeAddToWheel">
        <div class="modal modal-sm">
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
              :class="{ added: isOnWheel(w) }"
              :disabled="addingWheelId === w.id || isOnWheel(w)"
              @click="addToWheel(w)"
            >
              <span class="wheel-opt-name">{{ w.name }}</span>
              <span class="wheel-opt-meta">
                <span v-if="isOnWheel(w)" class="wheel-opt-mark">
                  {{ addedWheelIds.includes(w.id) ? 'Додано ✓' : 'Уже в колесі ✓' }}
                </span>
                <span v-else>{{ w._count.items }} фільм.</span>
              </span>
            </button>
          </div>

          <div class="wm-actions">
            <button class="btn btn-ghost" @click="closeAddToWheel">Готово</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Модальне вікно публічного посилання на бібліотеку -->
    <Teleport to="body">
      <div v-if="shareOpen" class="overlay" @click.self="closeShare">
        <div class="modal modal-sm">
          <div class="wm-eyebrow">Публічне посилання</div>
          <p class="share-hint">
            Будь-хто з цим посиланням побачить твій список фільмів і зможе користуватися
            фільтрами. Змінювати щось не зможе — тільки дивитися.
          </p>

          <template v-if="shareToken">
            <input class="field share-url" :value="shareUrl" readonly @focus="($event.target as HTMLInputElement).select()" />
            <p v-if="shareCopied" class="share-ok">Скопійовано ✓</p>
          </template>
          <p v-else class="muted">Посилання ще не створене.</p>

          <p v-if="shareError" class="err">{{ shareError }}</p>

          <div class="wm-actions">
            <button v-if="shareToken" class="btn btn-primary" :disabled="shareBusy" @click="copyShare">
              Копіювати
            </button>
            <button class="btn" :class="shareToken ? 'btn-ghost' : 'btn-primary'" :disabled="shareBusy" @click="createShare">
              {{ shareBusy ? '…' : shareToken ? 'Створити нове' : 'Створити посилання' }}
            </button>
            <button v-if="shareToken" class="btn btn-ghost" :disabled="shareBusy" @click="revokeShare">
              Відкликати
            </button>
            <button class="btn btn-ghost" @click="closeShare">Закрити</button>
          </div>
          <p v-if="shareToken" class="share-warn">
            «Створити нове» і «Відкликати» одразу ламають старе посилання.
          </p>
        </div>
      </div>
    </Teleport>

    <!-- Повний опис фільму. Тільки читання — редагування живе в окремій модалці. -->
    <Teleport to="body">
      <div v-if="detail" class="overlay" @click.self="closeDetail">
        <div class="modal modal-lg">
          <div class="modal-head">
            <div class="eyebrow">Про фільм</div>
            <button class="close" title="Закрити" @click="closeDetail">✕</button>
          </div>

          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-poster">
                <img v-if="detail.posterUrl" :src="detail.posterUrl" alt="" />
                <span v-else class="poster-ph">постер</span>
              </div>

              <div class="detail-info">
                <h2 class="detail-title">{{ detail.title }}</h2>
                <div class="detail-meta">
                  <span v-if="detail.year">{{ detail.year }}</span>
                  <span v-if="detail.imdbRating != null" class="detail-imdb">
                    ★ {{ detail.imdbRating.toFixed(1) }} IMDb
                  </span>
                  <span class="detail-seen" :class="{ on: detail.watched }">
                    <template v-if="detail.watched">
                      Переглянуто{{ detail.watchedAt ? ` · ${fmtDate(detail.watchedAt)}` : '' }}
                    </template>
                    <template v-else>Не переглянуто</template>
                  </span>
                </div>

                <div v-if="detail.genres.length" class="genres">
                  <span v-for="g in detail.genres" :key="g" class="chip-sm">{{ g }}</span>
                </div>

                <p v-if="detail.description" class="detail-desc">{{ detail.description }}</p>
                <p v-else class="muted">Опису немає.</p>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <button class="btn btn-ghost" @click="closeDetail">Закрити</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; }
.wrap { max-width: 1500px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 24px; }

/* Редактор фільму (всередині модалки) */
.editor-grid { display: grid; grid-template-columns: 200px 1fr; gap: 24px; }
.poster-col { display: flex; flex-direction: column; gap: 10px; }
.poster-preview {
  width: 100%; aspect-ratio: 2/3; border-radius: 10px;
  background: rgba(8, 4, 20, 0.7); border: 1.5px solid var(--line-soft);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.poster-preview img { width: 100%; height: 100%; object-fit: cover; }
.poster-ph {
  color: var(--ink-faint); font-size: 12px; letter-spacing: 0.18em; text-transform: lowercase;
}
.upload { text-align: center; cursor: pointer; }
.fields-col { display: flex; flex-direction: column; gap: 12px; }
.field.area { resize: vertical; line-height: 1.5; }
.row { display: flex; gap: 12px; }
.mini { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.mini > span { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-faint); }
.watch-row { display: flex; gap: 16px; align-items: flex-end; }
.check { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; font-weight: 600; padding-bottom: 9px; }
.check input { width: 18px; height: 18px; accent-color: var(--accent); cursor: pointer; }
.mini.date { flex: 0 0 auto; }

.lib-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lib-head .eyebrow { font-size: 14px; letter-spacing: 0.26em; color: var(--ink); }
.lib-tools { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.import { cursor: pointer; }
.import-msg {
  font-size: 13px; font-weight: 600; color: var(--accent-4); margin-top: -8px;
  text-shadow: 0 0 12px rgba(57, 255, 168, 0.45);
}

/* Панель фільтрів бібліотеки */
.filter-bar { display: flex; flex-direction: column; gap: 14px; }
.filter-bar .search { max-width: 520px; }
.filter-genres { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filter-genres .clear { margin-left: 4px; }
.filter-watched {
  display: inline-flex; width: fit-content;
  border: 1.5px solid var(--line-soft); border-radius: 999px; overflow: hidden;
  background: rgba(10, 5, 24, 0.5);
}
.seg {
  padding: 8px 16px; background: transparent; border: none;
  color: var(--ink-muted); font-size: 12px; font-weight: 700; letter-spacing: 0.06em;
  cursor: pointer; transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}
.seg:hover:not(.on) { color: var(--accent-2); }
.seg.on {
  background: linear-gradient(100deg, var(--accent) 0%, #c026d3 100%);
  color: #fff; box-shadow: 0 0 18px rgba(255, 45, 149, 0.45);
}
.count { font-size: 12px; letter-spacing: 0.12em; color: var(--ink-faint); }
.muted { color: var(--ink-faint); font-size: 15px; }

/* Сітка карток */
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(215px, 1fr)); gap: 22px; }
.card {
  --neon: var(--accent-3);
  position: relative;
  border: 1.5px solid var(--neon);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(24, 17, 48, 0.9) 0%, rgba(13, 8, 28, 0.94) 100%);
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 0 14px -2px var(--neon), 0 0 34px -12px var(--neon), 0 10px 30px rgba(0, 0, 0, 0.5);
  transition: transform 0.18s, box-shadow 0.18s;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0 20px -1px var(--neon), 0 0 52px -8px var(--neon), 0 16px 40px rgba(0, 0, 0, 0.55);
}
.card.seen { opacity: 0.92; }

/* Колір неону картки — задається класом n0…n5 зі скрипта */
.card.n0 { --neon: var(--neon-0); }
.card.n1 { --neon: var(--neon-1); }
.card.n2 { --neon: var(--neon-2); }
.card.n3 { --neon: var(--neon-3); }
.card.n4 { --neon: var(--neon-4); }
.card.n5 { --neon: var(--neon-5); }

.card-poster {
  position: relative; aspect-ratio: 2/3;
  display: flex; align-items: center; justify-content: center;
  margin: 8px 8px 0; border-radius: 10px; overflow: hidden;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 10px, transparent 10px 20px),
    #171130;
}
.card-poster { cursor: pointer; transition: box-shadow 0.18s; }
.card-poster:hover { box-shadow: inset 0 0 0 1.5px var(--neon); }
.card-poster:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--accent-2); }
.card-poster img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.25s; }
.card-poster:hover img { transform: scale(1.04); }
.card.seen .card-poster img { filter: grayscale(0.4) brightness(0.85); }

.imdb {
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(10, 5, 24, 0.82); border: 1px solid var(--neon); color: var(--neon);
  font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 999px;
  backdrop-filter: blur(4px);
}
.seen-badge {
  position: absolute; top: 8px; left: 8px; width: 24px; height: 24px; border-radius: 50%;
  background: var(--accent-4); color: #04180e;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 14px rgba(57, 255, 168, 0.6);
}

.card-body { padding: 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.card-body h3 {
  font-size: 16px; line-height: 1.25; font-weight: 600;
  color: var(--neon); text-shadow: 0 0 14px color-mix(in srgb, var(--neon) 45%, transparent);
}
.year { display: block; margin-top: 3px; color: var(--ink-faint); font-weight: 500; font-size: 13px; }
.desc {
  font-size: 13px; color: var(--ink-dim); line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.genres { display: flex; flex-wrap: wrap; gap: 5px; }
.chip-sm {
  font-size: 11px; font-weight: 600; color: var(--ink-muted);
  background: rgba(255, 255, 255, 0.03); border: 1px solid var(--line-soft);
  padding: 2px 9px; border-radius: 999px; white-space: nowrap;
}

/* Вибір жанрів чипсами */
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  font-size: 13px; font-weight: 500; color: var(--ink-dim);
  background: rgba(10, 5, 24, 0.5); border: 1.5px solid var(--line-soft);
  padding: 7px 16px; border-radius: 999px; cursor: pointer;
  transition: border-color 0.18s, color 0.18s, background 0.18s, box-shadow 0.18s;
}
.chip:hover {
  border-color: var(--accent-2); color: var(--accent-2);
  box-shadow: 0 0 14px rgba(34, 224, 255, 0.3);
}
.chip.on {
  background: linear-gradient(100deg, var(--accent) 0%, #c026d3 100%);
  border-color: var(--accent); color: #fff; font-weight: 700;
  box-shadow: 0 0 18px rgba(255, 45, 149, 0.5);
}
.chips-empty { font-size: 12px; color: var(--ink-faint); }
.chip-add { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.chip-add .field { flex: 1; min-width: 140px; }

/* Модалка з повним описом */
.detail-grid { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: start; }
.detail-poster {
  width: 100%; aspect-ratio: 2/3; border-radius: 10px; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid var(--line-soft);
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 10px, transparent 10px 20px),
    #171130;
}
.detail-poster img { width: 100%; height: 100%; object-fit: cover; }
.detail-info { display: flex; flex-direction: column; gap: 14px; }
.detail-title {
  font-size: 26px; font-weight: 700; line-height: 1.2; color: var(--accent-2);
  text-shadow: 0 0 16px rgba(34, 224, 255, 0.4);
}
.detail-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 14px;
  font-size: 13px; color: var(--ink-faint);
}
.detail-imdb { color: var(--accent-3); font-weight: 700; }
.detail-seen { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.detail-seen.on { color: var(--accent-4); text-shadow: 0 0 12px rgba(57, 255, 168, 0.4); }
/* Головне тут — опис БЕЗ обрізання, на відміну від картки в сітці. */
.detail-desc {
  font-size: 15px; line-height: 1.65; color: var(--ink-dim); white-space: pre-line;
}

/* Публічне посилання */
.btn.shared { border-color: var(--accent-4); color: var(--accent-4); }
.share-hint { font-size: 13px; color: var(--ink-dim); line-height: 1.5; }
.share-url { font-size: 13px; width: 100%; }
.share-ok {
  font-size: 12px; font-weight: 700; color: var(--accent-4);
  text-shadow: 0 0 12px rgba(57, 255, 168, 0.45);
}
.share-warn { font-size: 11px; color: var(--ink-faint); line-height: 1.45; }

.manage { text-decoration: none; display: inline-flex; align-items: center; white-space: nowrap; }
.link-btn {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12px; color: var(--ink-muted); text-decoration: underline;
}
.link-btn:hover { color: var(--accent-2); }
.seen-line { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); }
.seen-line.on { color: var(--accent-4); text-shadow: 0 0 12px rgba(57, 255, 168, 0.4); }

.card-actions { display: flex; gap: 6px; margin-top: auto; padding-top: 4px; }
.icon-btn {
  width: 34px; height: 30px; flex: 1;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--line-soft); border-radius: 7px;
  background: rgba(255, 255, 255, 0.02); color: var(--ink-muted);
  cursor: pointer; transition: border-color 0.18s, color 0.18s, box-shadow 0.18s;
}
.icon-btn:hover {
  border-color: var(--neon, var(--accent-2)); color: var(--neon, var(--accent-2));
  box-shadow: 0 0 12px -2px var(--neon, var(--accent-2));
}
.icon-btn.watch.on { border-color: var(--accent-4); color: var(--accent-4); box-shadow: 0 0 12px -2px var(--accent-4); }
.icon-btn.del:hover { border-color: var(--danger); color: var(--danger); box-shadow: 0 0 12px -2px var(--danger); }

/* Спільна основа для всіх модалок сторінки */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(4, 2, 12, 0.75);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal {
  background: linear-gradient(180deg, #1a1338 0%, #100a26 100%);
  border: 1.5px solid var(--line); border-radius: 16px;
  box-shadow: 0 0 40px -10px var(--accent-3), 0 30px 70px rgba(0, 0, 0, 0.7);
  display: flex; flex-direction: column; max-height: 90vh;
}
.modal-sm { width: min(380px, 92vw); padding: 26px; gap: 14px; }
.modal-lg { width: min(760px, 94vw); }

.modal-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 18px 24px; border-bottom: 1px solid var(--line-soft);
}
.modal-body { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.modal-foot {
  display: flex; gap: 12px; padding: 16px 24px;
  border-top: 1px solid var(--line-soft);
}
.close {
  width: 32px; height: 32px; flex: 0 0 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--ink-muted);
  font-size: 16px; cursor: pointer; transition: color 0.18s, background 0.18s;
}
.close:hover { color: var(--accent); background: rgba(255, 45, 149, 0.1); }
.wm-eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent-2); }
.wm-movie { font-size: 19px; font-weight: 700; line-height: 1.25; }
.wm-date { font-size: 17px; padding: 12px 15px; width: 100%; }
.wm-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
.wm-actions .btn { width: 100%; justify-content: center; text-align: center; white-space: normal; }

/* Список коліс у модалці «додати в колесо» */
.wheel-list { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; }
.wheel-opt {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 15px; text-align: left; cursor: pointer; border-radius: 10px;
  background: rgba(10, 5, 24, 0.6); border: 1.5px solid var(--line-soft); color: var(--ink);
  transition: border-color 0.18s, box-shadow 0.18s;
}
.wheel-opt:hover:not(:disabled) { border-color: var(--accent-2); box-shadow: 0 0 16px -4px var(--accent-2); }
.wheel-opt.added { border-color: var(--accent-4); color: var(--accent-4); cursor: default; }
.wheel-opt-name { font-size: 15px; font-weight: 600; }
.wheel-opt-meta { font-size: 12px; color: var(--ink-faint); white-space: nowrap; }
.wheel-opt.added .wheel-opt-meta { color: var(--accent-4); }
.wheel-opt-mark { font-weight: 700; letter-spacing: 0.04em; }
.err { color: var(--danger); font-size: 14px; }

@media (max-width: 640px) {
  .wrap { padding: 20px 16px; }
  .editor-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .detail-poster { max-width: 200px; }
  .poster-col { max-width: 200px; }
}
</style>
