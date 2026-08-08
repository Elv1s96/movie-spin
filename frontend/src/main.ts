import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './styles.css'

const app = createApp(App)
app.use(createPinia())

// Підтягуємо профіль з наявного токена перед стартом роутера.
const auth = useAuthStore()
auth.fetchMe().finally(() => {
  app.use(router)
  app.mount('#app')
})
