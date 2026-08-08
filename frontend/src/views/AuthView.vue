<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { apiError } from '../api/http'

const auth = useAuthStore()
const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'login') {
      await auth.login(email.value, password.value)
    } else {
      await auth.register(email.value, password.value)
    }
    router.push({ name: 'wheels' })
  } catch (e) {
    error.value = apiError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth">
    <div class="card">
      <div class="brand">Колесо<span>.</span></div>
      <p class="sub">Зважений випадковий вибір фільмів</p>

      <div class="tabs">
        <button :class="{ on: mode === 'login' }" @click="mode = 'login'">Вхід</button>
        <button :class="{ on: mode === 'register' }" @click="mode = 'register'">Реєстрація</button>
      </div>

      <form @submit.prevent="submit">
        <input v-model="email" class="field" type="email" placeholder="email" required />
        <input v-model="password" class="field" type="password" placeholder="пароль (мін. 6)" required />
        <p v-if="error" class="err">{{ error }}</p>
        <button class="btn btn-primary submit" type="submit" :disabled="loading">
          {{ loading ? '...' : mode === 'login' ? 'Увійти' : 'Створити акаунт' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(120% 90% at 50% 30%, #35312f 0%, #201e1d 62%, #171514 100%);
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 2px solid var(--line);
  padding: 36px 32px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.brand { font-size: 30px; font-weight: 900; text-transform: uppercase; }
.brand span { color: var(--accent); }
.sub { font-size: 14px; color: var(--ink-dim); margin-top: -10px; }
.tabs { display: flex; border: 2px solid var(--line-soft); }
.tabs button {
  flex: 1; padding: 11px; border: none; background: transparent;
  color: var(--ink-muted); font-weight: 800; text-transform: uppercase;
  font-size: 13px; letter-spacing: 0.06em; cursor: pointer;
}
.tabs button.on { background: var(--ink); color: var(--bg); }
form { display: flex; flex-direction: column; gap: 12px; }
.submit { margin-top: 4px; }
.err { color: #ff8a80; font-size: 13px; }
</style>
