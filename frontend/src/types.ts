export interface AuthUser {
  id: string
  email: string
}

/** Жанр із каталогу користувача (джерело для вибору чипсами). */
export interface Genre {
  id: string
  name: string
  createdAt: string
}

/** Фільм у бібліотеці користувача. */
export interface Movie {
  id: string
  userId: string
  title: string
  description: string | null
  imdbRating: number | null
  posterUrl: string | null
  year: number | null
  genres: string[]
  /** Своє слово, додане на сторінці колеса (у бібліотеці не показується). */
  isCustom: boolean
  watched: boolean
  watchedAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Фільм, відданий по публічному посиланню: без userId/isCustom — гостю вони
 * не потрібні, тож бекенд їх не віддає.
 */
export type PublicMovie = Omit<Movie, 'userId' | 'isCustom' | 'updatedAt'>

/** Стан публічного посилання на бібліотеку: token === null — посилання немає. */
export interface ShareInfo {
  token: string | null
}

/** Фільм у колесі + його вага. */
export interface WheelItem {
  id: string
  wheelId: string
  movieId: string
  weight: number
  createdAt: string
  movie: Movie
}

export interface WheelSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count: { items: number }
  /** Чи вже є на цьому колесі фільм, переданий у GET /wheels?movieId=… */
  hasMovie?: boolean
}

export interface Wheel {
  id: string
  name: string
  userId: string
  createdAt: string
  updatedAt: string
  items: WheelItem[]
}

export interface SpinResult {
  spinId: string
  index: number
  winner: Movie
  order: string[]
  createdAt: string
}

export interface SpinHistoryEntry {
  id: string
  createdAt: string
  movie: { id: string; title: string; posterUrl: string | null }
}

/**
 * Налаштування сесії пропонування. Дзеркало SessionOptions з бекенду —
 * зберігається одним Json-полем, тож нова опція додається сюди й у форму
 * запуску, без міграції БД.
 */
export interface SuggestOptions {
  /** Питати ім'я гостя перед пропозицією. */
  askName: boolean
  /** Ім'я обов'язкове — без нього пропозицію не приймуть. */
  requireName: boolean
}

/** Активна сесія пропонування — те, що бачить власник списку. */
export interface SuggestSession {
  id: string
  wheelId: string
  wheelName: string
  options: SuggestOptions
  /** Скільки фільмів уже запропонували гості. */
  count: number
  createdAt: string
}

/** Один запропонований фільм у відповіді публічного посилання. */
export interface SuggestedEntry {
  movieId: string
  guestName: string | null
}

/**
 * Блок пропонування у відповіді публічного посилання.
 * null → сесії немає, сторінка гостя працює лише на перегляд.
 */
export interface PublicSuggest {
  wheelName: string
  options: SuggestOptions
  suggested: SuggestedEntry[]
}
