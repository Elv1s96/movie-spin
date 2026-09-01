<script setup lang="ts">
// Спільний верхній бар для всіх сторінок із навігацією.
// Активний пункт підсвічує сам vue-router через .router-link-active.
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <div class="brand">Кінолесо<span>.</span></div>
    <nav class="nav">
      <router-link :to="{ name: 'wheels' }">Колеса</router-link>
      <router-link :to="{ name: 'movies' }">Мої фільми</router-link>
      <router-link :to="{ name: 'genres' }">Жанри</router-link>
    </nav>
    <div class="right">
      <span class="who">{{ auth.user?.email }}</span>
      <button class="btn btn-ghost btn-sm" @click="logout">Вийти</button>
    </div>
  </header>
</template>

<style scoped>
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
.nav { display: flex; gap: 26px; }
.nav a {
  text-decoration: none; color: var(--ink-muted);
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.16em;
  padding-bottom: 4px; border-bottom: 2px solid transparent;
  transition: color 0.18s, border-color 0.18s, text-shadow 0.18s;
}
.nav a:hover { color: var(--accent-2); text-shadow: 0 0 10px rgba(34, 224, 255, 0.5); }
.nav a.router-link-active {
  color: var(--accent); border-color: var(--accent);
  text-shadow: 0 0 12px rgba(255, 45, 149, 0.6);
}
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.who { font-size: 12px; color: var(--ink-faint); letter-spacing: 0.04em; }

@media (max-width: 720px) {
  .topbar { gap: 18px; padding: 14px 18px; flex-wrap: wrap; }
  .nav { gap: 16px; order: 3; width: 100%; }
  .who { display: none; }
}
</style>
