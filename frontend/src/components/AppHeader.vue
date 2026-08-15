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
.nav a.router-link-active { color: var(--ink); border-color: var(--accent); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.who { font-size: 13px; color: var(--ink-muted); }
</style>
