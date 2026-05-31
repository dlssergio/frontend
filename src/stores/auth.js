// frontend/src/stores/auth.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  // ===== STATE =====
  const accessToken  = ref(localStorage.getItem('accessToken'))
  const refreshToken = ref(localStorage.getItem('refreshToken'))
  const user         = ref(null)
  const loading      = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)

  // ===== LOGIN =====
  async function login(username, password) {
    loading.value = true
    try {
      const { data } = await api.post('/api/token/', { username, password })

      accessToken.value  = data.access
      refreshToken.value = data.refresh

      localStorage.setItem('accessToken', data.access)
      localStorage.setItem('refreshToken', data.refresh)

      await fetchUser()
      return true
    } catch (error) {
      // Loguear el error real en consola para debugging
      const httpStatus = error?.response?.status
      const detail     = error?.response?.data?.detail || error?.message || 'Error desconocido'
      console.error(`[Auth] Login falló — HTTP ${httpStatus}:`, detail)

      // Construir mensaje amigable según el código HTTP
      const msg =
        httpStatus === 401 ? 'Usuario o contraseña incorrectos' :
        httpStatus === 404 ? 'No se pudo conectar con el servidor (tenant no encontrado)' :
        httpStatus === 0 || !httpStatus ? 'Sin conexión con el servidor' :
        `Error del servidor (${httpStatus})`

      logout()

      // Lanzar el error para que LoginView.vue lo muestre en pantalla
      throw new Error(msg)
    } finally {
      loading.value = false
    }
  }

  // ===== CARGAR USUARIO ACTUAL =====
  async function fetchUser() {
    try {
      // /api/auth/me/ retorna { is_logged_in: true, user: { id, username, permissions, ... } }
      const { data } = await api.get('/api/auth/me/')
      user.value = data?.user || null

      if (!user.value) {
        console.warn('[Auth] fetchUser: la respuesta no trajo datos de usuario')
      }
    } catch (error) {
      console.warn('[Auth] No se pudo obtener el usuario:', error?.response?.status, error?.message)
      user.value = null
    }
  }

  // ===== HELPERS DE PERMISOS =====

  /** Superuser o staff → acceso total al frontend */
  const isAdmin = computed(() =>
    !!(user.value?.is_superuser || user.value?.is_staff)
  )

  /**
   * Verifica si el usuario tiene UN permiso específico de Django.
   * Formato: 'app_label.codename'
   * Ejemplo: hasPerm('ventas.view_comprobanteventa')
   */
  function hasPerm(perm) {
    if (!user.value) return false
    if (user.value.is_superuser) return true
    return (user.value.permissions || []).includes(perm)
  }

  /**
   * Verifica si el usuario tiene AL MENOS UNO de los permisos indicados.
   * Ejemplo: hasAnyPerm('ventas.view_comprobanteventa', 'ventas.add_comprobanteventa')
   */
  function hasAnyPerm(...perms) {
    if (!user.value) return false
    if (user.value.is_superuser) return true
    const userPerms = user.value.permissions || []
    return perms.some(p => userPerms.includes(p))
  }

  /**
   * Verifica acceso a un módulo completo por app_label de Django.
   * Devuelve true si el usuario tiene CUALQUIER permiso de esa app.
   *
   * Ejemplos:
   *   canAccess('ventas')           → true si tiene ventas.view_*, ventas.add_*, etc.
   *   canAccess('ventas', 'compras')→ true si tiene permisos en ventas O en compras
   *
   * IMPORTANTE: is_staff ya NO da acceso automático aquí.
   * Solo is_superuser tiene acceso total implícito.
   * Los usuarios staff deben tener sus permisos asignados explícitamente en Django Admin.
   */
  function canAccess(...apps) {
    if (!user.value) return false
    if (user.value.is_superuser) return true
    const userPerms = user.value.permissions || []
    return apps.some(app =>
      userPerms.some(p => p.startsWith(app + '.'))
    )
  }

  /**
   * hasRole: alias de canAccess, mantenido por compatibilidad.
   * Acepta app_labels: hasRole('ventas', 'compras')
   */
  function hasRole(...apps) {
    return canAccess(...apps)
  }

  // ===== RESTAURAR SESIÓN (cuando el usuario refresca la página) =====
  async function restoreSession() {
    if (!accessToken.value) return  // sin token → nada que restaurar
    try {
      await fetchUser()
    } catch {
      // Si falla (ej: token expirado y no hay refresh), limpiar todo
      logout()
    }
  }

  // ===== LOGOUT =====
  function logout() {
    accessToken.value  = null
    refreshToken.value = null
    user.value         = null

    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }

  return {
    // State
    accessToken,
    refreshToken,
    user,
    loading,

    // Computed
    isAuthenticated,
    isAdmin,

    // Acciones
    login,
    logout,
    restoreSession,
    fetchUser,

    // Helpers de permisos
    hasPerm,
    hasAnyPerm,
    hasRole,
    canAccess,
  }
})
