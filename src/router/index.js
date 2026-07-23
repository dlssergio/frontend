// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import MainLayout   from '@/layouts/MainLayout.vue'
import HomeView     from '../views/HomeView.vue'
import VentaPOSView from '../views/ventas/VentaPOSView.vue'

// ── Ventas ───────────────────────────────────────────────────
const PresupuestoCreate    = () => import('../views/ventas/PresupuestoCreate.vue')
const RemitoVentaCreate    = () => import('../views/ventas/RemitoVentaCreate.vue')
const FacturaVentaCreate   = () => import('../views/ventas/FacturaVentaCreate.vue')
const ConsultaComprobantes = () => import('../views/ventas/ConsultaComprobantes.vue')
const MonitorAFIP = () => import('../views/ventas/MonitorAFIP.vue')

// ── Clientes ──────────────────────────────────────────────────
const ClienteListView   = () => import('../views/clientes/ClienteListView.vue')
const ClienteFormView   = () => import('../views/clientes/ClienteFormView.vue')
const ClienteDetailView = () => import('../views/clientes/ClienteDetailView.vue')

// ── Inventario ────────────────────────────────────────────────
const InventarioDashboard      = () => import('../views/inventario/InventarioDashboard.vue')
const ArticuloListView         = () => import('../views/inventario/ArticuloListView.vue')
const ArticuloDetailView       = () => import('../views/inventario/ArticuloDetailView.vue')
const ArticuloFormView         = () => import('../views/inventario/ArticuloFormView.vue')
const MarcasRubrosView         = () => import('../views/inventario/MarcasRubrosView.vue')
const AjusteStockListView      = () => import('../views/inventario/AjusteStockListView.vue')
const AjusteStockFormView      = () => import('../views/inventario/AjusteStockFormView.vue')
const TransferenciaListView    = () => import('../views/inventario/TransferenciaListView.vue')
const TransferenciaFormView    = () => import('../views/inventario/TransferenciaFormView.vue')
const AlertasReposicionView    = () => import('../views/inventario/AlertasReposicionView.vue')
const LedgerView               = () => import('../views/inventario/LedgerView.vue')
const ReporteValorizacionView  = () => import('../views/inventario/ReporteValorizacionView.vue')
const KardexView               = () => import('../views/inventario/KardexView.vue')
const DepositosView            = () => import('../views/inventario/DepositosView.vue')
const ActualizacionPreciosView = () => import('../views/inventario/ActualizacionPreciosView.vue')

// ── Compras ───────────────────────────────────────────────────
const ProveedorListView          = () => import('../views/compras/ProveedorListView.vue')
const ProveedorDetailView        = () => import('../views/compras/ProveedorDetailView.vue')
const ProveedorFormView          = () => import('../views/compras/ProveedorFormView.vue')
const ProveedorCuentaCorriente   = () => import('../views/compras/ProveedorCuentaCorriente.vue') // <-- NUEVO
const ComprobantesCompraListView = () => import('../views/compras/ComprobantesCompraListView.vue')
const ComprobanteDetailView      = () => import('../views/compras/ComprobanteDetailView.vue')
const FacturaCreate              = () => import('../views/compras/FacturaCreate.vue')
const RemitoCreate               = () => import('../views/compras/RemitoCreate.vue')
const OrdenCompraCreate          = () => import('../views/compras/OrdenCompraCreate.vue')
const OrdenPagoListView          = () => import('../views/compras/OrdenPagoListView.vue')
const OrdenPagoFormView          = () => import('../views/compras/OrdenPagoFormView.vue')
const ListasPreciosView          = () => import('../views/compras/ListasPreciosView.vue')
const CuentaCorrienteProveedoresGlobal = () => import('../views/compras/CuentaCorrienteProveedoresGlobal.vue')

// ── Finanzas ──────────────────────────────────────────────────
const CajaListView   = () => import('../views/finanzas/CajaListView.vue')
const ChequeListView = () => import('../views/finanzas/ChequeListView.vue')

// ── Parámetros ────────────────────────────────────────────────
const ImportacionDatosView = () => import('../views/parametros/ImportacionDatosView.vue')
const ConfiguracionView    = () => import('../views/parametros/ConfiguracionView.vue')
const UsuariosView         = () => import('../views/admin/UsuariosView.vue')

// ─────────────────────────────────────────────────────────────
// Control de acceso basado en permisos reales de Django.
//
// meta.requiresAuth : true  → el usuario debe estar autenticado
// meta.staffOnly    : true  → solo superuser o is_staff pueden entrar
// meta.perms        : [...] → lista de app_labels de Django.
//                             El usuario accede si es superuser O tiene
//                             CUALQUIER permiso de alguna de las apps.
//                             Ejemplo: perms:['ventas'] permite entrar si
//                             el usuario tiene ventas.view_*, ventas.add_*, etc.
//
// Sin meta.perms → cualquier usuario autenticado puede acceder.
// ─────────────────────────────────────────────────────────────

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },

    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [

        // ── Dashboard — accesible para todos los usuarios autenticados ──
        { path: '', name: 'home', component: HomeView,
          meta: { title: 'Dashboard Ejecutivo' } },

        // ── Ventas ────────────────────────────────────────────
        { path: 'ventas/pos',
          name: 'venta-pos',
          component: VentaPOSView,
          meta: { title: 'Punto de Venta', posMode: true, perms: ['ventas'] } },

        { path: 'ventas/presupuesto/nuevo',
          name: 'venta-presupuesto-nuevo',
          component: PresupuestoCreate,
          meta: { title: 'Nuevo Presupuesto', perms: ['ventas'] } },

        { path: 'ventas/remito/nuevo',
          name: 'venta-remito-nuevo',
          component: RemitoVentaCreate,
          meta: { title: 'Nuevo Remito de Salida', perms: ['ventas', 'inventario'] } },

        { path: 'ventas/factura-admin/nueva',
          name: 'venta-factura-admin-nueva',
          component: FacturaVentaCreate,
          meta: { title: 'Nueva Factura Administrativa', perms: ['ventas'] } },

        { path: 'ventas/comprobantes',
          name: 'consulta-comprobantes',
          component: ConsultaComprobantes,
          meta: { title: 'Consulta de Comprobantes', perms: ['ventas'] } },

        { path: 'ventas/dashboard',
          name: 'ventas-dashboard',
          component: () => import('@/views/ventas/DashboardVentasView.vue'),
          meta: { title: 'Dashboard de Ventas', perms: ['ventas'] } },

        { path: 'ventas/reglas-conversion',
          name: 'reglas-conversion',
          component: () => import('@/views/ventas/ReglaConversionView.vue'),
          meta: { title: 'Reglas de Conversión', perms: ['ventas'] } },

        { path: 'ventas/nota-pedido/nueva',
          name: 'venta-nota-pedido-nueva',
          component: () => import('@/views/ventas/NotaPedidoCreate.vue'),
          meta: { title: 'Nueva Nota de Pedido', perms: ['ventas'] } },

        { path: 'ventas/nota-credito/nueva',
          name: 'venta-nota-credito-nueva',
          component: () => import('@/views/ventas/NotaCreditoCreate.vue'),
          meta: { title: 'Nueva Nota de Crédito / Débito', perms: ['ventas'] } },

        { path: 'cuenta-corriente',
          name: 'cuenta-corriente-global',
          component: () => import('@/views/ventas/CuentaCorrienteGlobalView.vue'),
          meta: { title: 'Cuenta Corriente', perms: ['ventas', 'finanzas'] },
        },

        { path: 'ventas/monitor-afip',
          name: 'monitor-afip',
          component: MonitorAFIP,
          meta: { title: 'Monitor AFIP', perms: ['ventas'] } },

        // ── Clientes — rutas estáticas primero ───────────────
        { path: 'clientes',
          name: 'clientes-lista',
          component: ClienteListView,
          meta: { title: 'Clientes', perms: ['ventas'] } },

        { path: 'clientes/nuevo',
          name: 'cliente-crear',
          component: ClienteFormView,
          meta: { title: 'Nuevo Cliente', perms: ['ventas'] } },

        { path: 'clientes/informes',
          name: 'clientes-informes',
          component: () => import('@/views/clientes/InformeClientesView.vue'),
          meta: { title: 'Informes de Clientes', perms: ['ventas'] } },

        // ── Clientes — rutas dinámicas después ───────────────
        { path: 'clientes/:id',
          name: 'cliente-detalle',
          component: ClienteDetailView,
          meta: { title: 'Detalle de Cliente', perms: ['ventas'] } },

        { path: 'clientes/:id/editar',
          name: 'cliente-editar',
          component: ClienteFormView,
          meta: { title: 'Editar Cliente', perms: ['ventas'] } },

        { path: 'clientes/:id/cuenta-corriente',
          name: 'cliente-cuenta-corriente',
          component: () => import('@/views/clientes/ClienteCuentaCorrienteView.vue'),
          meta: { title: 'Cuenta Corriente', perms: ['ventas', 'finanzas'] } },

        // ── Inventario — Panel ────────────────────────────────
        { path: 'inventario',
          name: 'inventario-dashboard',
          component: InventarioDashboard,
          meta: { title: 'Panel de Inventario', perms: ['inventario', 'compras'] } },

        // ── Inventario — Artículos ────────────────────────────
        { path: 'inventario/articulos',
          name: 'articulo-lista',
          component: ArticuloListView,
          meta: { title: 'Artículos', perms: ['inventario', 'ventas', 'compras'] } },

        { path: 'inventario/articulos/nuevo',
          name: 'articulo-crear',
          component: ArticuloFormView,
          meta: { title: 'Nuevo Artículo', perms: ['inventario'] } },

        { path: 'inventario/articulos/:id',
          name: 'articulo-detalle',
          component: ArticuloDetailView,
          meta: { title: 'Ficha de Artículo', perms: ['inventario', 'ventas', 'compras'] } },

        { path: 'inventario/articulos/:id/editar',
          name: 'articulo-editar',
          component: ArticuloFormView,
          meta: { title: 'Editar Artículo', perms: ['inventario'] } },

        // ── Inventario — Ajustes ──────────────────────────────
        { path: 'inventario/ajustes',
          name: 'ajustes-lista',
          component: AjusteStockListView,
          meta: { title: 'Ajustes de Stock', perms: ['inventario'] } },

        { path: 'inventario/ajustes/nuevo',
          name: 'ajuste-crear',
          component: AjusteStockFormView,
          meta: { title: 'Nuevo Ajuste', perms: ['inventario'] } },

        { path: 'inventario/ajustes/:id',
          name: 'ajuste-detalle',
          component: AjusteStockFormView,
          meta: { title: 'Ajuste de Stock', perms: ['inventario'] } },

        // ── Inventario — Transferencias ───────────────────────
        { path: 'inventario/transferencias',
          name: 'transferencias-lista',
          component: TransferenciaListView,
          meta: { title: 'Transferencias', perms: ['inventario'] } },

        { path: 'inventario/transferencias/nuevo',
          name: 'transferencia-crear',
          component: TransferenciaFormView,
          meta: { title: 'Nueva Transferencia', perms: ['inventario'] } },

        { path: 'inventario/transferencias/:id',
          name: 'transferencia-detalle',
          component: TransferenciaFormView,
          meta: { title: 'Transferencia', perms: ['inventario'] } },

        // ── Inventario — Reportes ─────────────────────────────
        { path: 'inventario/alertas',
          name: 'alertas-reposicion',
          component: AlertasReposicionView,
          meta: { title: 'Alertas de Reposición', perms: ['inventario', 'compras'] } },

        { path: 'inventario/historial',
          name: 'ledger-lista',
          component: LedgerView,
          meta: { title: 'Historial de Movimientos', perms: ['inventario', 'compras'] } },

        { path: 'inventario/valorizacion',
          name: 'inventario-valorizacion',
          component: ReporteValorizacionView,
          meta: { title: 'Valorización de Inventario', perms: ['inventario', 'finanzas'] } },

        { path: 'inventario/kardex',
          name: 'kardex',
          component: KardexView,
          meta: { title: 'Kardex de Stock', perms: ['inventario'] } },

        { path: 'inventario/depositos',
          name: 'depositos-lista',
          component: DepositosView,
          meta: { title: 'Depósitos', perms: ['inventario'] } },

        { path: 'inventario/actualizar-precios',
          name: 'actualizacion-precios',
          component: ActualizacionPreciosView,
          meta: { title: 'Actualización de Precios', perms: ['inventario'] } },

        // ── Inventario — Configuración ────────────────────────
        { path: 'inventario/marcas-rubros',
          name: 'marcas-rubros',
          component: MarcasRubrosView,
          meta: { title: 'Marcas y Rubros', perms: ['inventario'] } },

        // ── Compras ───────────────────────────────────────────
        { path: 'proveedores',
          name: 'proveedores-lista',
          component: ProveedorListView,
          meta: { title: 'Proveedores', perms: ['compras'] } },

        { path: 'proveedores/nuevo',
          name: 'proveedor-crear',
          component: ProveedorFormView,
          meta: { title: 'Nuevo Proveedor', perms: ['compras'] } },

        { path: 'proveedores/:id',
          name: 'proveedor-detalle',
          component: ProveedorDetailView,
          meta: { title: 'Ficha de Proveedor', perms: ['compras'] } },

        { path: 'proveedores/:id/editar',
          name: 'proveedor-editar',
          component: ProveedorFormView,
          meta: { title: 'Editar Proveedor', perms: ['compras'] } },

        { path: 'proveedores/:id/cuenta-corriente',
          name: 'proveedor-cuenta-corriente',
          component: ProveedorCuentaCorriente,
          meta: { title: 'Cuenta Corriente Proveedor', perms: ['compras', 'finanzas'] } },

        { path: 'compras/comprobantes',
          name: 'compras-lista',
          component: ComprobantesCompraListView,
          meta: { title: 'Comprobantes de Compra', perms: ['compras'] } },

        { path: 'compras/comprobantes/:id',
          name: 'compra-detalle',
          component: ComprobanteDetailView,
          meta: { title: 'Detalle de Comprobante', perms: ['compras'] } },

        { path: 'compras/factura/nueva',
          name: 'compra-factura-nueva',
          component: FacturaCreate,
          meta: { title: 'Nueva Factura de Compra', perms: ['compras'] } },

        { path: 'compras/remito/nuevo',
          name: 'compra-remito-nuevo',
          component: RemitoCreate,
          meta: { title: 'Nuevo Remito de Compra', perms: ['compras', 'inventario'] } },

        { path: 'compras/orden/nueva',
          name: 'compra-orden-nueva',
          component: OrdenCompraCreate,
          meta: { title: 'Nueva Orden de Compra', perms: ['compras'] } },

        { path: 'compras/ordenes-pago',
          name: 'ordenes-pago-lista',
          component: OrdenPagoListView,
          meta: { title: 'Órdenes de Pago', perms: ['compras', 'finanzas'] } },

        { path: 'compras/ordenes-pago/nueva',
          name: 'orden-pago-nueva',
          component: OrdenPagoFormView,
          meta: { title: 'Nueva Orden de Pago', perms: ['compras', 'finanzas'] } },

        { path: 'compras/ordenes-pago/:id',
          name: 'orden-pago-detalle',
          component: OrdenPagoFormView,
          meta: { title: 'Orden de Pago', perms: ['compras', 'finanzas'] } },

        { path: 'compras/listas-precios',
          name: 'listas-precios',
          component: ListasPreciosView,
          meta: { title: 'Listas de Precios', perms: ['compras'] } },

        { path: 'compras/cuenta-corriente',
          name: 'proveedores-cuenta-corriente-global',
          component: CuentaCorrienteProveedoresGlobal,
          meta: { title: 'Cartera de Proveedores', perms: ['compras', 'finanzas'] } },

        // ── Finanzas ──────────────────────────────────────────
        { path: 'finanzas/cajas',
          name: 'caja-lista',
          component: CajaListView,
          meta: { title: 'Cajas y Bancos', perms: ['finanzas'] } },

        { path: 'finanzas/cheques',
          name: 'cheques-lista',
          component: ChequeListView,
          meta: { title: 'Cheques', perms: ['finanzas'] } },

        // ── Parámetros / Configuración — solo staff/superuser ─
        { path: 'importar-datos',
          name: 'importacion-masiva',
          component: ImportacionDatosView,
          meta: { title: 'Importación Masiva', staffOnly: true } },

        { path: 'configuracion',
          name: 'configuracion',
          component: ConfiguracionView,
          meta: { title: 'Configuración', staffOnly: true } },

        { path: 'usuarios',
          name: 'usuarios',
          component: UsuariosView,
          meta: { title: 'Usuarios y Roles', staffOnly: true } },

        // ── Redirects de compatibilidad ───────────────────────
        { path: 'articulos',            redirect: { name: 'articulo-lista' } },
        { path: 'articulos/nuevo',      redirect: { name: 'articulo-crear' } },
        { path: 'articulos/editar/:id', redirect: to => ({ name: 'articulo-editar', params: { id: to.params.id } }) },
      ],
    },
  ],
})

// ─────────────────────────────────────────────────────────────
// Guard de navegación — se ejecuta antes de cada cambio de ruta
// ─────────────────────────────────────────────────────────────
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // 1. Ruta pública (ej: /login) → pasar siempre
  if (!to.meta.requiresAuth) return next()

  // 2. Sin token → redirigir al login
  if (!authStore.isAuthenticated) return next({ name: 'login' })

  // 3. Cargar datos del usuario si aún no se cargaron
  //    (puede pasar si el usuario navega directamente a una URL sin pasar por main.js)
  if (!authStore.user) {
    await authStore.fetchUser()
  }

  const user = authStore.user

  // 4. Si después de fetchUser sigue sin haber usuario, el token es inválido → login
  if (!user) return next({ name: 'login' })

  // 5. Superuser tiene acceso total a todo
  if (user.is_superuser) return next()

  // 6. Rutas que requieren staff o superuser (ej: configuración, importación)
  if (to.meta.staffOnly) {
    if (!user.is_staff) {
      return next({ name: 'home', query: { forbidden: to.name } })
    }
    return next()
  }

  // 7. Verificar permisos por app_label de Django
  //    NOTA: is_staff ya NO da acceso automático a todas las rutas.
  //    Los usuarios staff deben tener sus permisos asignados en el Admin de Django.
  const perms = to.meta.perms
  if (perms && perms.length > 0) {
    const tieneAcceso = authStore.canAccess(...perms)
    if (!tieneAcceso) {
      return next({ name: 'home', query: { forbidden: to.name } })
    }
  }

  next()
})

export default router
