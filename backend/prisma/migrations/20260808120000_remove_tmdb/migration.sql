-- Прибрано інтеграцію TMDB: колонка більше не потрібна.
ALTER TABLE "Movie" DROP COLUMN IF EXISTS "tmdbId";
