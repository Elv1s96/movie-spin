import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/AuthView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'wheels',
      component: () => import('../views/WheelsView.vue'),
    },
    {
      path: '/movies',
      name: 'movies',
      component: () => import('../views/MoviesView.vue'),
    },
    {
      path: '/genres',
      name: 'genres',
      component: () => import('../views/GenresView.vue'),
    },
    {
      path: '/wheels/:id',
      name: 'wheel',
      component: () => import('../views/WheelView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.public && !auth.isAuthed) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.isAuthed) {
    return { name: 'wheels' }
  }
})

export default router
