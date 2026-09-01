<script setup lang="ts">
// Публічна сторінка чужої бібліотеки: відкривається по посиланню /shared/:token
// без логіну. Свідомо лише читання — список і фільтри. Ніяких дій над фільмами
// тут немає, а бекенд по цьому маршруту нічого й не дозволить.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { http, apiError } from '../api/http'
import type { PublicMovie } from '../types'

const route = useRoute()

const movies = ref<PublicMovie[]>([])
const loading = ref(true)
const error = ref('')

// Фільтри — ті самі, що й у власній бібліотеці: пошук за назвою, жанри
// (усі обрані мають бути у фільмі), статус перегляду.
const searchQuery = ref('')
const filterGenres = ref<string[]>([])
const watchedFilter = ref<'all' | 'watched' | 'unwatched'>('all')

// Каталогу жанрів у гостя немає, тож збираємо їх із самих фільмів.
const allGenres = computed(() => {
  const names = new Set<string>()
  movies.value.forEach((m) => m.genres.forEach((g) => names.add(g)))
  return [...names].sort((a, b) => a.localeCompare(b, 'uk'))
})

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

// Неоновий колір картки — стабільний за id, як і в «Моїх фільмах».
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

// Картка відкриває модалку з повним описом — у сітці опис обрізаний трьома
// рядками, і це єдиний спосіб прочитати його цілком у режимі перегляду.
const detail = ref<PublicMovie | null>(null)

function openDetail(m: PublicMovie) {
  detail.value = m
}
function closeDetail() {
  detail.value = null
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && detail.value) closeDetail()
}

watch(detail, (m) => {
  document.body.style.overflow = m ? 'hidden' : ''
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    const { data } = await http.get<{ movies: PublicMovie[] }>(
      `/public/movies/${encodeURIComponent(String(route.params.token))}`,
    )
    movies.value = data.movies
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <!-- Власний мінімальний хедер: гість не залогінений, тож AppHeader з
         навігацією та «Вийти» тут недоречний. -->
    <header class="topbar">
      <div class="brand">Кінолесо<span>.</span></div>
      <div class="right">
        <span class="who">Спільна бібліотека</span>
        <router-link class="btn btn-ghost btn-sm" :to="{ name: 'login' }">Увійти</router-link>
      </div>
    </header>

    <main class="wrap">
      <div class="lib-head">
        <div class="eyebrow">Бібліотека</div>
        <span v-if="movies.length" class="count">
          {{ filtersActive ? `${filteredMovies.length} / ${movies.length}` : movies.length }} фільм(ів)
        </span>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

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
      <div v-else-if="error" class="muted">Спробуй попросити нове посилання у власника списку.</div>
      <div v-else-if="!movies.length" class="muted">Ця бібліотека порожня.</div>
      <div v-else-if="!filteredMovies.length" class="muted">Нічого не знайдено за фільтром.</div>

      <div v-else class="grid">
        <article
          v-for="m in filteredMovies"
          :key="m.id"
          class="card"
          :class="[neonClass(m.id), { seen: m.watched }]"
          role="button"
          tabindex="0"
          :aria-label="`Показати опис: ${m.title}`"
          @click="openDetail(m)"
          @keydown.enter.prevent="openDetail(m)"
          @keydown.space.prevent="openDetail(m)"
        >
          <div class="card-poster">
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
          </div>
        </article>
      </div>
    </main>

    <!-- Повний опис фільму. Тільки читання: жодних дій, лише «Закрити». -->
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

.topbar {
  display: flex; align-items: center; gap: 34px;
  padding: 18px 32px;
  position: sticky; top: 0; z-index: 20;
  background: linear-gradient(180deg, rgba(10, 5, 26, 0.92) 0%, rgba(10, 5, 26, 0.62) 100%);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--line-soft);
  box-shadow: 0 1px 0 rgba(34, 224, 255, 0.14), 0 10px 30px rgba(0, 0, 0, 0.45);
}
.brand {
  font-size: 19px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.24em;
  color: var(--accent-2);
  text-shadow: 0 0 10px rgba(34, 224, 255, 0.6), 0 0 26px rgba(34, 224, 255, 0.3);
}
.brand span { color: var(--accent); text-shadow: 0 0 10px rgba(255, 45, 149, 0.7); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.who { font-size: 12px; color: var(--ink-faint); letter-spacing: 0.04em; }
.right .btn { text-decoration: none; display: inline-flex; align-items: center; }

.lib-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.lib-head .eyebrow { font-size: 14px; letter-spacing: 0.26em; color: var(--ink); }
.count { font-size: 12px; letter-spacing: 0.12em; color: var(--ink-faint); }
.muted { color: var(--ink-faint); font-size: 15px; }

/* Панель фільтрів */
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
.link-btn {
  background: none; border: none; padding: 0; cursor: pointer;
  font-size: 12px; color: var(--ink-muted); text-decoration: underline;
}
.link-btn:hover { color: var(--accent-2); }

/* Сітка карток — та сама, що в «Моїх фільмах», але без ряду дій */
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
.card { cursor: pointer; }
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 0 20px -1px var(--neon), 0 0 52px -8px var(--neon), 0 16px 40px rgba(0, 0, 0, 0.55);
}
.card:focus-visible {
  outline: none;
  transform: translateY(-4px);
  box-shadow: 0 0 0 2px var(--accent-2), 0 0 24px -2px var(--neon), 0 16px 40px rgba(0, 0, 0, 0.55);
}
.card.seen { opacity: 0.92; }

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
.card-poster img { width: 100%; height: 100%; object-fit: cover; }
.card.seen .card-poster img { filter: grayscale(0.4) brightness(0.85); }
.poster-ph {
  color: var(--ink-faint); font-size: 12px; letter-spacing: 0.18em; text-transform: lowercase;
}

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
.seen-line { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); margin-top: auto; }
.seen-line.on { color: var(--accent-4); text-shadow: 0 0 12px rgba(57, 255, 168, 0.4); }

.err { color: var(--danger); font-size: 14px; }

/* Модалка з повним описом */
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
.modal-lg { width: min(760px, 94vw); }
.modal-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 18px 24px; border-bottom: 1px solid var(--line-soft);
}
.modal-head .eyebrow {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.18em; color: var(--accent-2);
}
.modal-body { padding: 24px; overflow-y: auto; }
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

@media (max-width: 640px) {
  .detail-grid { grid-template-columns: 1fr; }
  .detail-poster { max-width: 200px; }
}

@media (max-width: 720px) {
  .topbar { gap: 18px; padding: 14px 18px; flex-wrap: wrap; }
  .wrap { padding: 20px 16px; }
  .who { display: none; }
}
</style>
