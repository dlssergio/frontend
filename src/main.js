// frontend/src/main.js
import { createApp }  from 'vue'
import { createPinia } from 'pinia'
import App    from './App.vue'
import router from './router'

import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import './assets/main.css'

const app   = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(Antd)

// ✅ Restaurar sesión ANTES de montar la app.
//
// Motivo: si el usuario tiene un token guardado en localStorage y refresca
// la página, el router guard se ejecuta antes de que fetchUser() termine,
// y ve user=null aunque el token sea válido. Esto causaba redirecciones
// incorrectas al login o falta de permisos en el primer ciclo de navegación.
//
// Con .finally() garantizamos que la app se monta siempre,
// aunque restoreSession falle (token expirado, red caída, etc.)
import { useAuthStore } from '@/stores/auth'
const authStore = useAuthStore()
authStore.restoreSession().finally(() => {
  app.mount('#app')
})
