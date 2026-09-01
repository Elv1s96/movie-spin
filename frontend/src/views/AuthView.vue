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
      <div class="brand">Кінолесо<span>.</span></div>
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
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.card {
  width: 100%; max-width: 400px;
  background: linear-gradient(180deg, rgba(26, 19, 56, 0.92) 0%, rgba(13, 8, 28, 0.95) 100%);
  border: 1.5px solid var(--line); border-radius: 18px;
  box-shadow: 0 0 44px -12px var(--accent-3), 0 0 90px -40px var(--accent-2), 0 30px 70px rgba(0, 0, 0, 0.6);
  padding: 38px 32px;
  display: flex; flex-direction: column; gap: 18px;
}
.brand {
  font-size: 30px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em;
  color: var(--accent-2);
  text-shadow: 0 0 14px rgba(34, 224, 255, 0.6), 0 0 34px rgba(34, 224, 255, 0.3);
}
.brand span { color: var(--accent); text-shadow: 0 0 14px rgba(255, 45, 149, 0.7); }
.sub { font-size: 13px; color: var(--ink-muted); margin-top: -10px; letter-spacing: 0.02em; }
.tabs {
  display: flex; border: 1.5px solid var(--line-soft); border-radius: 999px;
  overflow: hidden; background: rgba(10, 5, 24, 0.5);
}
.tabs button {
  flex: 1; padding: 11px; border: none; background: transparent;
  color: var(--ink-muted); font-weight: 700; text-transform: uppercase;
  font-size: 12px; letter-spacing: 0.12em; cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}
.tabs button:hover:not(.on) { color: var(--accent-2); }
.tabs button.on {
  background: linear-gradient(100deg, var(--accent) 0%, #c026d3 100%);
  color: #fff; box-shadow: 0 0 20px rgba(255, 45, 149, 0.45);
}
form { display: flex; flex-direction: column; gap: 12px; }
.submit { margin-top: 4px; }
.err { color: var(--danger); font-size: 13px; }
</style>
