<script setup>
/**
 * FacturaVentaCreate.vue — Factura Administrativa Enterprise v3
 *
 * - SIN header propio (el layout padre provee "Factura Administrativa")
 * - Barra superior STICKY: cliente + cabecera comprobante siempre visible
 * - Columna izquierda: tabla de ítems | Columna derecha: pestañas
 *   Tab 1: Totales + Pago  |  Tab 2: Comprobantes de origen  |  Tab 3: Opciones
 * - PaymentModal real (mismo del POS con medios de pago del sistema)
 * - CTA_CTE auto si el cliente lo permite
 * - Guard "Cambios sin guardar" igual al POS
 * - ArticuloSearchModal igual al POS
 * - Toggle imágenes en barra de tabla (miniatura bajo descripción)
 * - Descuento global: modo % o monto
 */
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import dayjs from 'dayjs'
import { message, Modal } from 'ant-design-vue'
import {
  SaveOutlined, PlusOutlined, DeleteOutlined,
  UserOutlined, FileTextOutlined, SearchOutlined,
  BarcodeOutlined, NumberOutlined, CalendarOutlined,
  TeamOutlined, CheckCircleOutlined, FilePdfOutlined,
  AppstoreOutlined, LinkOutlined, CloseOutlined,
  WarningOutlined, PercentageOutlined, MailOutlined,
  CheckOutlined, InfoCircleOutlined, SettingOutlined,
  EyeOutlined, EyeInvisibleOutlined,
} from '@ant-design/icons-vue'

import api from '@/services/api'
import { useConfigStore } from '@/stores/config'
import { fetchCliente } from '@/services/clientes'
import ArticuloSearchModal from '@/components/ventas/ArticuloSearchModal.vue'
import PaymentModal from '@/components/ventas/PaymentModal.vue'

const router = useRouter()
const route  = useRoute()
const configStore = useConfigStore()

const isDark = computed(() => (configStore.currentTheme || 'light') === 'dark')

// ── Estado ────────────────────────────────────────────────────────────────────
const loading          = ref(false)
const cargandoClientes = ref(false)
const cargandoTipos    = ref(false)
const cargandoOrigen   = ref(false)
const showImages       = ref(false)
const articuloModalOpen = ref(false)
const paymentOpen       = ref(false)
const printModalOpen    = ref(false)
const finalConfirmOpen  = ref(false)
const rightTab          = ref('totales')   // 'totales' | 'origen' | 'opciones'

// ── Guard de navegación (idéntico al POS) ─────────────────────────────────────
const hasUnsavedChanges = ref(false)
const allowRouteLeave   = ref(false)
const leaveModalOpen    = ref(false)
const leaveLoading      = ref(false)
const pendingRoute      = ref(null)

const markDirty = () => { if (!allowRouteLeave.value) hasUnsavedChanges.value = true }

const handleBeforeUnload = (e) => {
  if (!hasUnsavedChanges.value) return
  e.preventDefault(); e.returnValue = ''
}
watch(hasUnsavedChanges, (dirty) => {
  if (dirty) window.addEventListener('beforeunload', handleBeforeUnload)
  else        window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave((to) => {
  if (allowRouteLeave.value || !hasUnsavedChanges.value) return true
  pendingRoute.value = to
  leaveModalOpen.value = true
  return false
})

const closeLeaveModal = () => { leaveModalOpen.value = false; pendingRoute.value = null }
const leaveAndDiscard = async () => {
  const to = pendingRoute.value
  closeLeaveModal()
  allowRouteLeave.value = true
  hasUnsavedChanges.value = false
  await router.push(to?.fullPath || to?.path || '/')
  allowRouteLeave.value = false
}
const leaveAndSave = async () => {
  leaveLoading.value = true
  try { await guardarBorrador() } finally { leaveLoading.value = false }
  if (!hasUnsavedChanges.value) await leaveAndDiscard()
}

// ── Formulario ────────────────────────────────────────────────────────────────
const formState = reactive({
  clienteId:           null,
  tipoComprobanteId:   null,
  puntoVenta:          1,
  numero:              '',
  fecha:               dayjs(),
  fechaVencimiento:    dayjs().add(30, 'day'),
  vendedorId:          null,
  condicionPago:       'CONTADO',
  descuentoGlobal:     0,
  descuentoGlobalModo: 'pct',
  observaciones:       '',
  generarRemito:       false,
})

// ── Datos maestros ────────────────────────────────────────────────────────────
const clientes         = ref([])
const vendedores       = ref([])
const tiposComprobante = ref([])
const tiposRemito      = ref([])
const draftId          = ref(null)

// ── Cobro — igual que POS ────────────────────────────────────────────────────
const pendingPagos      = ref([])
const pendingRecargos   = ref(0)
const pendingDescuentos = ref(0)

const resetPendingCobro = () => {
  pendingPagos.value = []; pendingRecargos.value = 0; pendingDescuentos.value = 0
}

const onConfirmPayment = ({ pagos, recargos_total = 0, descuentos_total = 0 } = {}) => {
  paymentOpen.value        = false
  pendingPagos.value       = pagos || []
  pendingRecargos.value    = Number(recargos_total || 0)
  pendingDescuentos.value  = Number(descuentos_total || 0)
  finalConfirmOpen.value   = true
}
const onCancelPayment = () => resetPendingCobro()

// ── Comprobantes de origen ────────────────────────────────────────────────────
const origenSearch       = ref('')
const origenResultados   = ref([])
const comprobantesOrigen = ref([])

// ── Items ─────────────────────────────────────────────────────────────────────
const items              = ref([])
const productOptions     = ref([])
const selectedRowKey     = ref(null)
const activeSearchRowKey = ref(null)
let   prodSearchT        = null
let   normalizing        = false

// ── Post-guardado ─────────────────────────────────────────────────────────────
const ventaFinalizada = reactive({ id: null, numero: '', pdfLoading: false })

// ── Helpers ───────────────────────────────────────────────────────────────────
const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const createEmptyRow = () => ({
  key: Date.now() + Math.random(),
  articuloId: null, articuloPk: null, codigo: '', descripcion: '',
  cantidad: 1, precio: 0, descuento: 0,
  foto: null, stock: 0, ubicacion: '', ivaRate: 21, origenId: null,
})

const isBlankRow = (r) => !r?.articuloId && !String(r?.codigo || '').trim()

const ensureSingleBlankRow = () => {
  if (!Array.isArray(items.value)) items.value = []
  if (!items.value.length) { items.value = [createEmptyRow()]; return }
  const dataRows  = items.value.filter(r => !isBlankRow(r))
  const firstBlank = items.value.find(r => isBlankRow(r)) || createEmptyRow()
  items.value = [...dataRows, firstBlank]
}

watch(items, async () => {
  if (normalizing) return
  normalizing = true
  try {
    await nextTick()
    if (items.value.filter(r => isBlankRow(r)).length > 1 || !items.value.length)
      ensureSingleBlankRow()
  } finally { normalizing = false }
}, { deep: true, flush: 'post' })

watch([() => formState.clienteId, () => formState.tipoComprobanteId, () => formState.condicionPago], markDirty)
watch(
  () => items.value.map(r => `${r.articuloId}|${r.cantidad}|${r.precio}`).join(','),
  (sig) => { if (items.value.some(i => i.articuloId)) markDirty() },
  { flush: 'post' }
)

// ── Totales ───────────────────────────────────────────────────────────────────
const validItems = computed(() => items.value.filter(i => i.articuloId && Number(i.cantidad || 0) > 0))

const subtotalNeto = computed(() =>
  validItems.value.reduce((acc, i) =>
    acc + Number(i.cantidad || 0) * Number(i.precio || 0) * (1 - Number(i.descuento || 0) / 100), 0)
)

const ivaRows = computed(() => {
  const map = new Map()
  for (const i of validItems.value) {
    const neto = Number(i.cantidad || 0) * Number(i.precio || 0) * (1 - Number(i.descuento || 0) / 100)
    const rate = Number(i.ivaRate || 0)
    const lbl  = `IVA ${Number.isInteger(rate) ? rate : String(rate).replace('.', ',')}%`
    map.set(lbl, (map.get(lbl) || 0) + neto * rate / 100)
  }
  return [...map.entries()].map(([label, amount]) => ({ label, amount }))
})

const totalIVA   = computed(() => ivaRows.value.reduce((a, r) => a + r.amount, 0))
const totalBruto = computed(() => subtotalNeto.value + totalIVA.value)

const descGlobalMonto = computed(() => {
  if (formState.descuentoGlobalModo === 'monto')
    return Math.min(Number(formState.descuentoGlobal || 0), totalBruto.value)
  return totalBruto.value * Number(formState.descuentoGlobal || 0) / 100
})
const descGlobalPct = computed(() => {
  if (formState.descuentoGlobalModo === 'pct') return Number(formState.descuentoGlobal || 0)
  return totalBruto.value > 0
    ? Number(((descGlobalMonto.value / totalBruto.value) * 100).toFixed(4)) : 0
})

const totalFinal      = computed(() => totalBruto.value - descGlobalMonto.value)
const totalConRecargos = computed(() =>
  totalFinal.value + pendingRecargos.value - pendingDescuentos.value
)

// ── Cliente / comprobante ────────────────────────────────────────────────────
const extractPermiteCtaCte = (c) => Boolean(
  c?.permite_cta_cte ?? c?.entidad?.permite_cta_cte ?? c?.datos?.permite_cta_cte ?? false
)

const clienteInfo = computed(() =>
  formState.clienteId ? clientes.value.find(c => c.value === formState.clienteId) ?? null : null
)
const clienteDisplay = computed(() => {
  if (!clienteInfo.value) return null
  return {
    nombre: clienteInfo.value.label,
    cuit:   clienteInfo.value.cuit,
    condicion: clienteInfo.value.condicion,
    saldo: clienteInfo.value.saldo || 0,
    permite_cta_cte: !!clienteInfo.value.permite_cta_cte,
  }
})

const tipoSeleccionado = computed(() =>
  formState.tipoComprobanteId
    ? tiposComprobante.value.find(t => t.value === formState.tipoComprobanteId) ?? null : null
)
const esNumeracionManual = computed(() => !tipoSeleccionado.value?.fullData?.numeracion_automatica)
const canUseCtaCte = computed(() => !!clienteInfo.value?.permite_cta_cte)

const estadoOperacion = computed(() => {
  if (!clienteInfo.value) return { text: 'Sin cliente', cls: 'neutral' }
  if (!validItems.value.length) return { text: 'Sin artículos', cls: 'warn' }
  if (formState.condicionPago === 'CTA_CTE' && !canUseCtaCte.value)
    return { text: 'Cta. Cte. no habilitada', cls: 'danger' }
  return { text: 'Listo para emitir', cls: 'ok' }
})

const resumenFormaPago = computed(() => {
  if (formState.condicionPago === 'CTA_CTE') return 'Cuenta Corriente'
  if (!pendingPagos.value.length) return '—'
  return pendingPagos.value
    .map(p => `${p?.descripcion || p?.medio_pago || 'Pago'}: $${money(p?.importe ?? p?.monto ?? 0)}`)
    .join(' | ')
})

// ── Watches ───────────────────────────────────────────────────────────────────
watch(esNumeracionManual, (m) => { if (!m) formState.numero = '' })

watch(() => formState.condicionPago, (val) => {
  formState.fechaVencimiento = val === 'CONTADO' ? formState.fecha : dayjs(formState.fecha).add(30, 'day')
  resetPendingCobro()
})

watch(() => formState.fecha, (val) => {
  if (!val) return
  formState.fechaVencimiento = formState.condicionPago === 'CONTADO' ? val : dayjs(val).add(30, 'day')
})

// Auto CTA_CTE si el cliente lo permite (comportamiento admin diferente al POS)
watch(clienteInfo, (c) => {
  if (!c) return
  formState.condicionPago = c.permite_cta_cte ? 'CTA_CTE' : 'CONTADO'
})

// ── Clientes ──────────────────────────────────────────────────────────────────
const searchClientes = async (txt) => {
  const q = (txt || '').trim()
  if (q.length < 3) { clientes.value = clienteInfo.value ? [clienteInfo.value] : []; return }
  cargandoClientes.value = true
  try {
    const { data } = await api.get('/api/clientes/', { params: { search: q } })
    clientes.value = (data?.results ?? data ?? []).map(c => {
      const ent = c.entidad ?? c
      return {
        value: ent?.id, label: ent?.razon_social, cuit: ent?.cuit,
        condicion: ent?.situacion_iva?.nombre || 'Consumidor Final',
        saldo: c?.saldo ?? 0, permite_cta_cte: extractPermiteCtaCte(c),
        codigo_cliente: c?.codigo_cliente ?? '',
      }
    })
  } catch { message.error('No se pudieron buscar clientes') }
  finally { cargandoClientes.value = false }
}

const ensureClienteOption = async (clienteId) => {
  if (!clienteId || clientes.value.some(c => c.value === Number(clienteId))) return
  try {
    const { data } = await fetchCliente(clienteId)
    const ent = data?.entidad ?? data
    clientes.value = [...clientes.value, {
      value: ent?.id, label: ent?.razon_social, cuit: ent?.cuit,
      condicion: ent?.situacion_iva?.nombre || '',
      saldo: data?.saldo ?? 0, permite_cta_cte: extractPermiteCtaCte(data),
      codigo_cliente: data?.codigo_cliente ?? '',
    }]
  } catch {}
}

// ── Tipos comprobante ─────────────────────────────────────────────────────────
const fetchTiposComprobante = async () => {
  cargandoTipos.value = true
  try {
    const { data } = await api.get('/api/tipos-comprobante/')
    const lista = data?.results ?? data ?? []
    tiposComprobante.value = lista
      .filter(t => t.clase === 'V'
        && !String(t.nombre || '').toLowerCase().includes('remito')
        && !String(t.nombre || '').toLowerCase().includes('presupuesto'))
      .map(t => ({ value: t.id, label: t.nombre, fullData: t }))
    tiposRemito.value = lista
      .filter(t => t.clase === 'V' && String(t.nombre || '').toLowerCase().includes('remito'))
      .map(t => ({ value: t.id, label: t.nombre }))
    if (!formState.tipoComprobanteId && tiposComprobante.value.length)
      formState.tipoComprobanteId = tiposComprobante.value[0].value
  } catch { message.error('No se pudieron cargar los tipos de comprobante') }
  finally { cargandoTipos.value = false }
}

// ── Vendedores ────────────────────────────────────────────────────────────────
const fetchVendedores = async () => {
  try {
    const { data } = await api.get('/api/auth/me/')
    if (data?.id) {
      vendedores.value = [{ value: data.id, label: data.username || data.nombre || `Usuario ${data.id}` }]
      formState.vendedorId = data.id
    }
  } catch { vendedores.value = [] }
}

// ── Comprobantes de origen ────────────────────────────────────────────────────
const buscarOrigen = async () => {
  const q = (origenSearch.value || '').trim()
  if (q.length < 2) return
  cargandoOrigen.value = true
  try {
    const { data } = await api.get('/api/comprobantes-venta/', {
      params: { search: q, estado: 'CN', cliente: formState.clienteId || undefined, page_size: 20 }
    })
    origenResultados.value = (data?.results ?? data ?? [])
      .filter(c => !comprobantesOrigen.value.some(o => o.id === c.id))
      .map(c => ({
        id: c.id,
        numero: c.numero_completo || `#${c.id}`,
        tipo: c.tipo_comprobante_nombre || c.tipo_comprobante?.nombre || '—',
        total: c.total || 0,
        fecha: c.fecha,
      }))
  } catch {}
  finally { cargandoOrigen.value = false }
}

const agregarOrigen = async (comp) => {
  if (comprobantesOrigen.value.some(o => o.id === comp.id)) { message.warning('Ya vinculado'); return }
  try {
    const { data } = await api.get(`/api/comprobantes-venta/${comp.id}/`)
    const nuevos = (data?.items ?? []).map(i => ({
      ...createEmptyRow(),
      articuloId: i.articulo_codigo || i.articulo?.cod_articulo || '',
      articuloPk: i.articulo?.id || null,
      codigo:     i.articulo_codigo || i.articulo?.cod_articulo || '',
      descripcion: i.articulo_descripcion || i.articulo?.descripcion || '',
      cantidad:   Number(i.cantidad || 1),
      precio:     Number(i.precio_unitario_original || 0),
      descuento:  Number(i.descuento_pct || 0),
      ivaRate:    Number(i.iva_rate || 21),
      origenId:   comp.id,
    }))
    items.value = [...items.value.filter(r => !isBlankRow(r)), ...nuevos, createEmptyRow()]
    comprobantesOrigen.value.push({ ...comp, itemsCount: nuevos.length })
    origenResultados.value = []
    origenSearch.value = ''
    message.success(`${nuevos.length} artículo(s) importados de ${comp.numero}`)
  } catch { message.error('No se pudo importar el comprobante') }
}

const quitarOrigen = (id) => {
  comprobantesOrigen.value = comprobantesOrigen.value.filter(o => o.id !== id)
  items.value = items.value.filter(i => i.origenId !== id || isBlankRow(i))
  ensureSingleBlankRow()
}

// ── Artículos ─────────────────────────────────────────────────────────────────
const parsePrice = (p) => {
  if (!p?.precio_venta) return 0
  const raw = typeof p.precio_venta === 'object' ? p.precio_venta.amount : p.precio_venta
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

const parseIvaRate = (p) => {
  for (const c of [p?.iva_rate, p?.alicuota_iva, p?.iva_alicuota, p?.iva_porcentaje, p?.iva_percent, p?.iva]) {
    if (c == null) continue
    const n = Number(String(c).replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  return 21
}

const searchArticulos = async (txt) => {
  const q = (txt || '').trim()
  if (q.length < 3) { productOptions.value = []; return }
  if (prodSearchT) clearTimeout(prodSearchT)
  const ownerKey = activeSearchRowKey.value
  prodSearchT = setTimeout(async () => {
    try {
      const { data } = await api.get('/api/articulos/', { params: { search: q } })
      if (activeSearchRowKey.value !== ownerKey) return
      productOptions.value = (data?.results ?? data ?? []).map(a => ({
        value: a.cod_articulo, label: a.descripcion, fullData: a,
      }))
    } catch {}
  }, 150)
}

const onSearchFocus = (rowKey) => {
  if (activeSearchRowKey.value !== rowKey) productOptions.value = []
  activeSearchRowKey.value = rowKey
}

const agregarProductoFila = async (producto, index, qty = 1) => {
  const item = items.value[index] ?? createEmptyRow()
  if (!items.value[index]) items.value.splice(index, 0, item)
  item.articuloId  = producto.cod_articulo
  item.articuloPk  = producto.id ?? null
  item.codigo      = producto.cod_articulo
  item.descripcion = producto.descripcion
  item.precio      = parsePrice(producto)
  item.foto        = producto.foto ?? null
  item.stock       = parseFloat(producto.stock_total || 0)
  item.ubicacion   = producto.ubicacion || ''
  item.ivaRate     = parseIvaRate(producto)
  item.cantidad    = Math.max(1, Number(qty || 1))
  selectedRowKey.value     = item.key
  productOptions.value     = []
  activeSearchRowKey.value = null
  ensureSingleBlankRow()
  resetPendingCobro()
  await nextTick()
}

const onSelectArticulo = async (val, option, rowKey) => {
  const index = items.value.findIndex(r => r.key === rowKey)
  if (index === -1) return
  await agregarProductoFila(option.fullData, index, 1)
}

const handleProductEnterByCode = async (val, rowKey) => {
  const code = String(val || '').trim()
  if (!code) return
  const index = items.value.findIndex(r => r.key === rowKey)
  if (index === -1) return
  const current = items.value[index]
  if (current?.articuloId && (current.articuloId === code || current.codigo === code)) {
    current.cantidad = Math.max(1, Number(current.cantidad || 1) + 1); return
  }
  try {
    const { data } = await api.get('/api/articulos/', { params: { search: code } })
    const res = data?.results ?? data ?? []
    const exact = res.find(p => p.cod_articulo === code || p.ean === code) || (res.length === 1 ? res[0] : null)
    if (exact) { await agregarProductoFila(exact, index, 1); message.success('Artículo agregado') }
    else if (res.length > 1) message.info('Múltiples coincidencias — use búsqueda avanzada')
    else message.warning('Artículo no encontrado')
  } catch {}
}

const addItemsFromModal = async ({ items: payloadItems, close }) => {
  ensureSingleBlankRow()
  for (const it of payloadItems || []) {
    const producto = it?.producto
    if (!producto?.cod_articulo) continue
    const qty = Math.max(1, Math.floor(Number(it?.cantidad) || 1))
    const existing = items.value.find(r => r.articuloId === producto.cod_articulo)
    if (existing) { existing.cantidad = Math.max(1, (Number(existing.cantidad) || 1) + qty); continue }
    const emptyIdx = items.value.findIndex(r => isBlankRow(r))
    if (emptyIdx >= 0) await agregarProductoFila(producto, emptyIdx, qty)
    else { items.value.push(createEmptyRow()); await agregarProductoFila(producto, items.value.length - 1, qty) }
  }
  ensureSingleBlankRow()
  if (close) articuloModalOpen.value = false
}

const removeItem = (index) => {
  if (items.value.length <= 1) { message.warning('Debe existir al menos un renglón'); return }
  items.value.splice(index, 1)
  ensureSingleBlankRow()
  resetPendingCobro()
}

const itemInfo = computed(() =>
  selectedRowKey.value ? items.value.find(i => i.key === selectedRowKey.value) ?? null : null
)
const getImageUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${api.defaults?.baseURL || ''}${path}`
}

// ── Columnas tabla ────────────────────────────────────────────────────────────
const columns = [
  { title: '#',        dataIndex: 'index',     width: 40,  align: 'center' },
  { title: 'Código',   dataIndex: 'codigo',    width: 120               },
  { title: 'Descripción', dataIndex: 'descripcion'                    },
  { title: 'Cant.',    dataIndex: 'cantidad',  width: 86,  align: 'center' },
  { title: 'P. Unit.', dataIndex: 'precio',    width: 130, align: 'right'  },
  { title: 'Desc %',   dataIndex: 'descuento', width: 80,  align: 'right'  },
  { title: 'IVA',      dataIndex: 'ivaRate',   width: 68,  align: 'center' },
  { title: 'Subtotal', dataIndex: 'subtotal',  width: 130, align: 'right'  },
  { title: '',         dataIndex: 'actions',   width: 44,  align: 'center' },
]

// ── Payload ───────────────────────────────────────────────────────────────────
const buildPayload = (estado = 'CN', pagosArg = []) => ({
  cliente:              Number(formState.clienteId),
  tipo_comprobante:     Number(formState.tipoComprobanteId),
  punto_venta:          Number(formState.puntoVenta || 1),
  numero:               esNumeracionManual.value ? Number(formState.numero || 0) : 0,
  fecha:                dayjs(formState.fecha).format('YYYY-MM-DD'),
  fecha_vencimiento:    dayjs(formState.fechaVencimiento).format('YYYY-MM-DD'),
  vendedor_id:          formState.vendedorId ? Number(formState.vendedorId) : null,
  observaciones:        formState.observaciones || '',
  descuento_global_pct: descGlobalPct.value,
  condicion_venta:      formState.condicionPago === 'CTA_CTE' ? 'CC' : 'CO',
  estado,
  comprobantes_origen:  comprobantesOrigen.value.map(o => o.id),
  items: validItems.value.map(i => ({
    articulo:                 i.articuloId,   // SlugRelatedField espera cod_articulo string
    cantidad:                 Number(i.cantidad || 0),
    precio_unitario_original: Number(i.precio || 0),
    descuento_pct:            Number(i.descuento || 0),
  })),
  pagos: formState.condicionPago === 'CONTADO' ? (pagosArg || []) : [],
})

// ── Validación ────────────────────────────────────────────────────────────────
const validar = () => {
  if (!formState.clienteId)         { message.warning('Debe seleccionar un cliente'); return false }
  if (!formState.tipoComprobanteId) { message.warning('Tipo de comprobante requerido'); return false }
  if (!validItems.value.length)     { message.warning('Agregue al menos un artículo'); return false }
  if (formState.condicionPago === 'CTA_CTE' && !canUseCtaCte.value) {
    message.error('El cliente no tiene habilitada la cuenta corriente'); return false
  }
  if (esNumeracionManual.value && !String(formState.numero || '').trim()) {
    message.warning('Ingrese el número del comprobante'); return false
  }
  return true
}

// ── Guardar borrador ──────────────────────────────────────────────────────────
const guardarBorrador = async () => {
  if (!formState.clienteId || !validItems.value.length) {
    message.warning('Cliente y artículos son requeridos'); return
  }
  loading.value = true
  try {
    const url    = draftId.value ? `/api/comprobantes-venta/${draftId.value}/` : '/api/comprobantes-venta/'
    const method = draftId.value ? 'patch' : 'post'
    const { data } = method === 'patch'
      ? await api.patch(url, buildPayload('BR'))
      : await api.post(url, buildPayload('BR'))
    draftId.value = data?.id ?? data?.pk ?? draftId.value ?? null
    hasUnsavedChanges.value = false
    message.success('Borrador guardado')
  } catch (e) {
    const d = e?.response?.data
    message.error(String(d?.detail || d?.error || 'Error al guardar'))
  } finally { loading.value = false }
}

// ── Abrir finalizar ───────────────────────────────────────────────────────────
const openFinalizar = () => {
  if (!validar()) return
  if (formState.condicionPago === 'CTA_CTE') {
    resetPendingCobro(); finalConfirmOpen.value = true; return
  }
  paymentOpen.value = true
}

// ── Confirmar y generar ───────────────────────────────────────────────────────
const confirmarYGenerar = async () => {
  finalConfirmOpen.value = false
  loading.value = true
  try {
    const { data } = await api.post('/api/comprobantes-venta/', buildPayload('CN', pendingPagos.value))
    ventaFinalizada.id     = data?.id ?? data?.pk ?? null
    ventaFinalizada.numero = data?.numero_completo || 'Comprobante generado'
    hasUnsavedChanges.value = false
    resetPendingCobro()
    printModalOpen.value = true
    if (formState.generarRemito && ventaFinalizada.id) {
      try {
        const { data: reglas } = await api.get(`/api/comprobantes-venta/${ventaFinalizada.id}/reglas-conversion/`)
        const r = (reglas || []).find(x =>
          String(x.etiqueta || '').toLowerCase().includes('remito') ||
          String(x.tipo_destino_nombre || '').toLowerCase().includes('remito'))
        if (r) {
          await api.post(`/api/comprobantes-venta/${ventaFinalizada.id}/convertir/`, { regla_id: r.id })
          message.success('Remito generado automáticamente')
        }
      } catch { message.warning('No se pudo generar el remito') }
    }
    message.success('Factura emitida correctamente')
  } catch (e) {
    const d = e?.response?.data
    message.error(String(d?.detail || d?.error || 'Error al emitir la factura'))
  } finally { loading.value = false }
}

// ── PDF / Email ───────────────────────────────────────────────────────────────
const abrirPdf = async (id) => {
  if (!id) return
  ventaFinalizada.pdfLoading = true
  try {
    const res = await api.get(`/api/comprobantes-venta/${id}/pdf/`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const win = window.open(url, '_blank')
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
    else setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { message.error('No se pudo abrir el PDF') }
  finally { ventaFinalizada.pdfLoading = false }
}

const enviarEmail = async () => {
  if (!ventaFinalizada.id) return
  try {
    await api.post(`/api/comprobantes-venta/${ventaFinalizada.id}/enviar-email/`)
    message.success('Email enviado')
  } catch (e) { message.error(e?.response?.data?.error || 'Error al enviar email') }
}

// ── Limpiar / Post-print ──────────────────────────────────────────────────────
const limpiarPantalla = async () => {
  items.value = [createEmptyRow()]
  selectedRowKey.value = null
  comprobantesOrigen.value = []
  origenSearch.value = ''
  origenResultados.value = []
  draftId.value = null
  resetPendingCobro()
  Object.assign(formState, {
    numero: '', observaciones: '', descuentoGlobal: 0, descuentoGlobalModo: 'pct',
    fecha: dayjs(), fechaVencimiento: dayjs().add(30, 'day'),
    condicionPago: 'CONTADO', generarRemito: false,
  })
  const keepCliente = route.query?.cliente ? Number(route.query.cliente) : null
  if (keepCliente) { await ensureClienteOption(keepCliente); formState.clienteId = keepCliente }
  else formState.clienteId = null
  hasUnsavedChanges.value = false
}

const onPrintAndNew = async () => { printModalOpen.value = false; await abrirPdf(ventaFinalizada.id); await limpiarPantalla() }
const onPrintOnly   = async () => { await abrirPdf(ventaFinalizada.id) }
const onSkipPrint   = async () => { printModalOpen.value = false; await limpiarPantalla() }

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (prodSearchT) clearTimeout(prodSearchT)
})

onMounted(async () => {
  items.value = [createEmptyRow()]
  await Promise.all([fetchTiposComprobante(), fetchVendedores()])
  const clienteId = route.query?.cliente
  if (clienteId) { await ensureClienteOption(clienteId); formState.clienteId = Number(clienteId) }
})
</script>

<template>
  <div class="fa-wrap" :class="[isDark ? 'fa-dark' : 'fa-light']">

    <!-- ══════════════════════════════════════════════════════════════════
         BARRA SUPERIOR STICKY
         Cliente + info del comprobante — sin redundancia con layout padre
    ══════════════════════════════════════════════════════════════════ -->
    <div class="fa-topbar">
      <div class="fa-topbar-inner">

        <!-- ── Bloque cliente ── -->
        <div class="fa-tb-block fa-tb-client">
          <div class="fa-tb-label"><UserOutlined /> Cliente *</div>
          <a-select
            v-model:value="formState.clienteId"
            :options="clientes"
            show-search :filter-option="false"
            :loading="cargandoClientes"
            placeholder="Buscar por nombre o CUIT…"
            size="large"
            style="width:100%"
            @search="searchClientes"
          >
            <template #option="{ label, cuit, condicion }">
              <div class="fa-cli-opt">
                <span class="fa-cli-opt-name">{{ label }}</span>
                <span class="fa-cli-opt-meta">{{ cuit }} · {{ condicion }}</span>
              </div>
            </template>
          </a-select>
          <transition name="fa-slide">
            <div v-if="clienteDisplay" class="fa-cli-chip">
              <div class="fa-cli-av">{{ clienteDisplay.nombre?.charAt(0)?.toUpperCase() }}</div>
              <div class="fa-cli-body">
                <span class="fa-cli-nombre">{{ clienteDisplay.nombre }}</span>
                <span class="fa-cli-cuit">{{ clienteDisplay.cuit }}</span>
              </div>
              <div class="fa-cli-right">
                <a-tag :color="clienteDisplay.condicion?.toLowerCase().includes('inscripto') ? 'blue' : 'default'"
                  style="margin:0;font-size:10px;padding:0 5px">{{ clienteDisplay.condicion }}</a-tag>
                <span :class="['fa-cte-badge', clienteDisplay.permite_cta_cte ? 'cte-ok' : 'cte-no']">
                  {{ clienteDisplay.permite_cta_cte ? '✓ Cta. Cte.' : '✗ Sin Cta. Cte.' }}
                </span>
                <span class="fa-saldo">Saldo ${{ money(clienteDisplay.saldo) }}</span>
              </div>
            </div>
          </transition>
        </div>

        <div class="fa-tb-sep" />

        <!-- ── Bloque comprobante ── -->
        <div class="fa-tb-block fa-tb-comp">
          <div class="fa-comp-grid">
            <div class="fa-cf">
              <div class="fa-tb-label">Tipo *</div>
              <a-select v-model:value="formState.tipoComprobanteId" :options="tiposComprobante"
                size="large" style="min-width:150px" :loading="cargandoTipos" />
            </div>
            <div class="fa-cf">
              <div class="fa-tb-label">Pt. Venta</div>
              <a-input-number v-model:value="formState.puntoVenta" :min="1" size="large" style="width:76px" />
            </div>
            <div class="fa-cf">
              <div class="fa-tb-label">Número</div>
              <a-input v-model:value="formState.numero" :disabled="!esNumeracionManual"
                size="large" style="width:110px" placeholder="Auto">
                <template #prefix><NumberOutlined /></template>
              </a-input>
            </div>
            <div class="fa-cf">
              <div class="fa-tb-label">Fecha</div>
              <a-date-picker v-model:value="formState.fecha" size="large" format="DD/MM/YYYY" style="width:134px">
                <template #suffixIcon><CalendarOutlined /></template>
              </a-date-picker>
            </div>
            <div class="fa-cf">
              <div class="fa-tb-label">Vencimiento</div>
              <a-date-picker v-model:value="formState.fechaVencimiento" size="large" format="DD/MM/YYYY"
                style="width:134px" :disabled="formState.condicionPago === 'CONTADO'">
                <template #suffixIcon><CalendarOutlined /></template>
              </a-date-picker>
            </div>
            <div class="fa-cf">
              <div class="fa-tb-label">Condición</div>
              <a-radio-group v-model:value="formState.condicionPago" button-style="solid" size="large">
                <a-radio-button value="CONTADO">Contado</a-radio-button>
                <a-radio-button value="CTA_CTE" :disabled="!canUseCtaCte">Cta. Cte.</a-radio-button>
              </a-radio-group>
            </div>
          </div>
        </div>

        <div class="fa-tb-sep" />

        <!-- ── Bloque estado + acciones ── -->
        <div class="fa-tb-block fa-tb-actions">
          <div :class="['fa-status-pill', `fa-sp-${estadoOperacion.cls}`]">
            <span class="fa-sp-dot" />{{ estadoOperacion.text }}
          </div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <a-button :loading="loading" @click="guardarBorrador"
              :disabled="!validItems.length" title="Guardar borrador (Ctrl+S)">
              <SaveOutlined />
            </a-button>
            <a-button type="primary" :loading="loading" @click="openFinalizar" :disabled="!validItems.length">
              <CheckCircleOutlined /> Emitir
            </a-button>
          </div>
        </div>

      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════
         BODY: tabla izquierda | panel derecho con pestañas
    ══════════════════════════════════════════════════════════════════ -->
    <div class="fa-body">

      <!-- ── Columna izquierda: ítems + observaciones ── -->
      <div class="fa-left-col">

        <!-- Tarjeta tabla de ítems -->
        <div class="fa-card fa-items-card">

          <!-- Barra ítems -->
          <div class="fa-items-bar">
            <div class="fa-ib-left">
              <span class="fa-sec-title">Artículos</span>
              <span class="fa-count-badge">{{ validItems.length }}</span>
              <span v-if="comprobantesOrigen.length" class="fa-orig-badge">
                <LinkOutlined /> {{ comprobantesOrigen.length }} origen{{ comprobantesOrigen.length > 1 ? 'es' : '' }}
              </span>
            </div>
            <div class="fa-ib-right">
              <button :class="['fa-img-btn', showImages && 'fa-img-btn-on']" @click="showImages = !showImages">
                <EyeOutlined v-if="!showImages" /><EyeInvisibleOutlined v-else />
                {{ showImages ? 'Ocultar' : 'Imágenes' }}
              </button>
              <a-button size="small" @click="articuloModalOpen = true">
                <AppstoreOutlined /> Buscar
              </a-button>
            </div>
          </div>

          <!-- Tabla -->
          <a-table
            :columns="columns" :data-source="items" :pagination="false"
            rowKey="key" size="middle"
            :scroll="{ y: 'calc(100vh - 370px)', x: 'max-content' }"
            :customRow="(record) => ({
              onClick: () => { selectedRowKey = record.key },
              class: ['fa-tr',
                record.key === selectedRowKey ? 'fa-tr-sel' : '',
                record.origenId ? 'fa-tr-orig' : ''].join(' '),
            })"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.dataIndex === 'index'">
                <span class="fa-ln">{{ index + 1 }}</span>
              </template>
              <template v-if="column.dataIndex === 'codigo'">
                <a-auto-complete
                  v-model:value="record.codigo"
                  :options="activeSearchRowKey === record.key ? productOptions : []"
                  @search="searchArticulos" @focus="onSearchFocus(record.key)"
                  @select="(v, opt) => onSelectArticulo(v, opt, record.key)"
                  style="width:100%" :bordered="false"
                  @keydown.enter.prevent="handleProductEnterByCode(record.codigo, record.key)"
                >
                  <a-input placeholder="Código…" :bordered="false" size="small">
                    <template #prefix><BarcodeOutlined class="fa-px" /></template>
                  </a-input>
                  <template #option="{ fullData }">
                    <div class="fa-art-opt">
                      <span class="fa-art-n">{{ fullData.descripcion }}</span>
                      <span class="fa-art-m">{{ fullData.marca_nombre || '—' }} · {{ fullData.stock_total }} u.</span>
                    </div>
                  </template>
                </a-auto-complete>
              </template>
              <template v-if="column.dataIndex === 'descripcion'">
                <div class="fa-desc-cell">
                  <span class="fa-desc-t">{{ record.descripcion || '' }}</span>
                  <div v-if="record.origenId" class="fa-desc-o"><LinkOutlined /> origen</div>
                </div>
                <div v-if="showImages && record.foto && record.articuloId" class="fa-inline-img">
                  <img :src="getImageUrl(record.foto)" :alt="record.descripcion" />
                </div>
              </template>
              <template v-if="column.dataIndex === 'cantidad'">
                <a-input-number v-model:value="record.cantidad" :min="0" :bordered="false"
                  style="width:100%" size="small" class="fa-inp-c" />
              </template>
              <template v-if="column.dataIndex === 'precio'">
                <a-input-number v-model:value="record.precio" :min="0" :bordered="false"
                  style="width:100%" size="small" class="fa-inp-r"
                  :formatter="v => `$${Number(v).toLocaleString('es-AR',{minimumFractionDigits:2})}`"
                  :parser="v => v.replace(/[^\d.,]/g,'').replace(',','.')" />
              </template>
              <template v-if="column.dataIndex === 'descuento'">
                <a-input-number v-model:value="record.descuento" :min="0" :max="100"
                  :bordered="false" style="width:100%" size="small" class="fa-inp-c"
                  :formatter="v => v > 0 ? `${v}%` : ''" :parser="v => String(v).replace('%','')" />
              </template>
              <template v-if="column.dataIndex === 'ivaRate'">
                <span v-if="record.articuloId" class="fa-iva">{{ record.ivaRate }}%</span>
              </template>
              <template v-if="column.dataIndex === 'subtotal'">
                <span v-if="record.articuloId" class="fa-sub">
                  ${{ money(Number(record.cantidad||0)*Number(record.precio||0)*(1-Number(record.descuento||0)/100)) }}
                </span>
              </template>
              <template v-if="column.dataIndex === 'actions'">
                <a-button type="text" danger size="small" @click.stop="removeItem(index)">
                  <DeleteOutlined />
                </a-button>
              </template>
            </template>
          </a-table>

          <!-- Pie tabla -->
          <div class="fa-items-foot">
            <a-button type="dashed" size="small" @click="() => items.push(createEmptyRow())">
              <PlusOutlined /> Renglón
            </a-button>
            <span class="fa-foot-info">
              {{ validItems.length }} art. · {{ validItems.reduce((a,i) => a+Number(i.cantidad||0), 0).toLocaleString('es-AR') }} un.
            </span>
          </div>
        </div>

        <!-- Observaciones -->
        <div class="fa-card fa-obs">
          <div class="fa-sec-title" style="margin-bottom:8px"><FileTextOutlined /> Observaciones</div>
          <a-textarea v-model:value="formState.observaciones"
            placeholder="Condiciones, instrucciones, referencias…" :rows="3" />
        </div>
      </div>

      <!-- ── Columna derecha: pestañas ── -->
      <div class="fa-right-col">

        <!-- Pestañas -->
        <div class="fa-tabs">
          <button :class="['fa-tab', rightTab==='totales' && 'fa-tab-on']" @click="rightTab='totales'">
            <PercentageOutlined /> Pago
          </button>
          <button :class="['fa-tab', rightTab==='origen' && 'fa-tab-on']" @click="rightTab='origen'">
            <LinkOutlined /> Origen
            <span v-if="comprobantesOrigen.length" class="fa-tab-n">{{ comprobantesOrigen.length }}</span>
          </button>
          <button :class="['fa-tab', rightTab==='opciones' && 'fa-tab-on']" @click="rightTab='opciones'">
            <SettingOutlined /> Opciones
          </button>
        </div>

        <!-- Tab panel container -->
        <div class="fa-tab-body">

          <!-- ── Tab TOTALES Y PAGO ── -->
          <div v-show="rightTab==='totales'">

            <!-- Preview imagen si showImages -->
            <transition name="fa-fade">
              <div v-if="showImages && itemInfo?.articuloId && itemInfo?.foto" class="fa-card fa-img-preview">
                <div class="fa-ip-title"><InfoCircleOutlined /> {{ itemInfo.descripcion }}</div>
                <img :src="getImageUrl(itemInfo.foto)" class="fa-ip-img" :alt="itemInfo.descripcion" />
                <div class="fa-ip-meta">
                  <span>Stock <strong>{{ itemInfo.stock }}</strong></span>
                  <span>IVA <strong>{{ itemInfo.ivaRate }}%</strong></span>
                  <span v-if="itemInfo.ubicacion">Ubic. <strong>{{ itemInfo.ubicacion }}</strong></span>
                </div>
              </div>
            </transition>

            <!-- Totales financieros -->
            <div class="fa-totals">
              <div class="fa-tot-hd">Resumen financiero</div>
              <div class="fa-tot-rows">
                <div class="fa-tot-r"><span>Subtotal neto</span><span>${{ money(subtotalNeto) }}</span></div>
                <div v-for="tax in ivaRows" :key="tax.label" class="fa-tot-r fa-tot-sub">
                  <span>{{ tax.label }}</span><span>${{ money(tax.amount) }}</span>
                </div>
                <div class="fa-tot-r"><span>Total bruto</span><span>${{ money(totalBruto) }}</span></div>
              </div>

              <!-- Descuento global -->
              <div class="fa-disc-row">
                <span class="fa-disc-lbl"><PercentageOutlined /> Desc. global</span>
                <div class="fa-disc-ctrl">
                  <a-select v-model:value="formState.descuentoGlobalModo" size="small" style="width:56px"
                    @change="formState.descuentoGlobal=0">
                    <a-select-option value="pct">%</a-select-option>
                    <a-select-option value="monto">$</a-select-option>
                  </a-select>
                  <a-input-number v-model:value="formState.descuentoGlobal" :min="0"
                    :max="formState.descuentoGlobalModo==='pct' ? 100 : undefined"
                    size="small" style="width:86px"
                    :formatter="v => formState.descuentoGlobalModo==='pct' ? `${v}%` : `$${v}`"
                    :parser="v => String(v).replace(/[%$]/g,'')" />
                </div>
              </div>
              <div v-if="formState.descuentoGlobal > 0" class="fa-tot-r fa-tot-disc">
                <span>Descuento</span><span>-${{ money(descGlobalMonto) }}</span>
              </div>
              <div v-if="pendingRecargos > 0" class="fa-tot-r fa-tot-rec">
                <span>Recargos</span><span>+${{ money(pendingRecargos) }}</span>
              </div>
              <div v-if="pendingDescuentos > 0" class="fa-tot-r fa-tot-disc">
                <span>Desc. pago</span><span>-${{ money(pendingDescuentos) }}</span>
              </div>

              <div class="fa-tot-fin">
                <span>TOTAL</span>
                <div class="fa-tot-amt">${{ money(totalConRecargos) }}</div>
              </div>

              <!-- Condición resumida -->
              <div :class="['fa-cond', formState.condicionPago==='CTA_CTE' ? 'fa-cond-cc' : 'fa-cond-co']">
                {{ formState.condicionPago === 'CTA_CTE' ? '⇄ Cuenta Corriente' : '✓ Contado' }}
                <span v-if="pendingPagos.length" class="fa-cond-fp"> · {{ resumenFormaPago }}</span>
              </div>

              <!-- Botones -->
              <a-button type="primary" block size="large" class="fa-emit-btn"
                :loading="loading" @click="openFinalizar" :disabled="!validItems.length">
                <CheckCircleOutlined /> Emitir factura
              </a-button>
              <a-button block size="large" :loading="loading"
                @click="guardarBorrador" :disabled="!validItems.length" style="margin-top:8px">
                <SaveOutlined /> Guardar borrador
              </a-button>
            </div>
          </div>

          <!-- ── Tab ORIGEN ── -->
          <div v-show="rightTab==='origen'">
            <div class="fa-card" style="padding:14px 16px">
              <div class="fa-sec-title" style="margin-bottom:6px"><LinkOutlined /> Comprobantes de origen</div>
              <p class="fa-hint">Vinculá presupuestos, notas de pedido o remitos para importar sus ítems.</p>
              <a-input-search v-model:value="origenSearch"
                placeholder="Buscar por número o cliente…"
                :loading="cargandoOrigen" @search="buscarOrigen" @pressEnter="buscarOrigen"
                style="margin-bottom:10px" />

              <div v-if="origenResultados.length" class="fa-orig-res">
                <div v-for="c in origenResultados" :key="c.id" class="fa-orig-row">
                  <div class="fa-orig-inf">
                    <span class="fa-orig-num">{{ c.numero }}</span>
                    <span class="fa-orig-tipo">{{ c.tipo }}</span>
                    <span class="fa-orig-tot">${{ money(c.total) }}</span>
                  </div>
                  <a-button type="primary" size="small" ghost @click="agregarOrigen(c)">
                    <PlusOutlined /> Importar
                  </a-button>
                </div>
              </div>

              <div v-if="comprobantesOrigen.length" class="fa-orig-vinc">
                <div class="fa-orig-vinc-hd">Vinculados</div>
                <div v-for="o in comprobantesOrigen" :key="o.id" class="fa-orig-vinc-r">
                  <CheckOutlined class="fa-vinc-ok" />
                  <div class="fa-vinc-info">
                    <span class="fa-orig-num">{{ o.numero }}</span>
                    <span class="fa-orig-tipo">{{ o.tipo }}</span>
                    <span class="fa-vinc-sub">{{ o.itemsCount }} ítems</span>
                  </div>
                  <a-button type="text" size="small" danger @click="quitarOrigen(o.id)">
                    <CloseOutlined />
                  </a-button>
                </div>
              </div>

              <div v-if="!origenResultados.length && !comprobantesOrigen.length" class="fa-orig-empty">
                <LinkOutlined /><p>Buscá y vinculá comprobantes de origen para importar sus artículos</p>
              </div>
            </div>
          </div>

          <!-- ── Tab OPCIONES ── -->
          <div v-show="rightTab==='opciones'">
            <div class="fa-card" style="padding:14px 16px">
              <div class="fa-sec-title" style="margin-bottom:14px"><SettingOutlined /> Opciones</div>

              <div class="fa-opt-g">
                <div class="fa-opt-l">Vendedor</div>
                <a-select v-model:value="formState.vendedorId" :options="vendedores"
                  size="large" style="width:100%" placeholder="—">
                  <template #suffixIcon><TeamOutlined /></template>
                </a-select>
              </div>

              <div class="fa-opt-g">
                <div class="fa-opt-l">Al confirmar</div>
                <a-checkbox v-model:checked="formState.generarRemito" :disabled="!tiposRemito.length">
                  Generar remito de salida automáticamente
                </a-checkbox>
                <div v-if="!tiposRemito.length" class="fa-opt-h">Sin tipos de remito configurados.</div>
              </div>

              <div class="fa-opt-g" v-if="draftId">
                <div class="fa-opt-l">Borrador activo</div>
                <div style="display:flex;align-items:center;gap:8px">
                  <a-tag color="blue">#{{ draftId }}</a-tag>
                  <a-button size="small" type="link" danger @click="() => { draftId = null }">
                    Desvincular
                  </a-button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div><!-- /fa-body -->

    <!-- ══════════════════════════════════════════════════════════════════
         MODALES
    ══════════════════════════════════════════════════════════════════ -->

    <!-- Modal búsqueda avanzada artículos -->
    <ArticuloSearchModal v-model:open="articuloModalOpen" @add-items="addItemsFromModal" />

    <!-- Modal de pago real del sistema (igual al POS) -->
    <PaymentModal
      v-model:open="paymentOpen"
      :total="totalFinal"
      @confirm="onConfirmPayment"
      @cancel="onCancelPayment"
    />

    <!-- Confirmación final -->
    <a-modal v-model:open="finalConfirmOpen" title="Confirmar emisión" centered :maskClosable="false" width="480px">
      <div class="fa-cfm">
        <div class="fa-cfm-r"><span>Tipo</span><strong>{{ tipoSeleccionado?.label || '—' }}</strong></div>
        <div class="fa-cfm-r"><span>Cliente</span><strong>{{ clienteDisplay?.nombre || '—' }}</strong></div>
        <div class="fa-cfm-r"><span>Condición</span><strong>{{ formState.condicionPago === 'CTA_CTE' ? 'Cuenta Corriente' : 'Contado' }}</strong></div>
        <div class="fa-cfm-r"><span>Forma de pago</span><strong>{{ resumenFormaPago }}</strong></div>
        <div v-if="pendingRecargos > 0" class="fa-cfm-r"><span>Recargos</span><strong>+${{ money(pendingRecargos) }}</strong></div>
        <div v-if="descGlobalMonto > 0" class="fa-cfm-r fa-cfm-disc"><span>Descuento global</span><strong>-${{ money(descGlobalMonto) }}</strong></div>
        <div v-if="comprobantesOrigen.length" class="fa-cfm-r">
          <span>Orígenes</span><strong>{{ comprobantesOrigen.map(o => o.numero).join(', ') }}</strong>
        </div>
        <div class="fa-cfm-r fa-cfm-tot"><span>TOTAL A COBRAR</span><strong>${{ money(totalConRecargos) }}</strong></div>
      </div>
      <template #footer>
        <a-button @click="finalConfirmOpen = false">Volver</a-button>
        <a-button type="primary" :loading="loading" @click="confirmarYGenerar">Confirmar y emitir</a-button>
      </template>
    </a-modal>

    <!-- Modal cambios sin guardar -->
    <a-modal v-model:open="leaveModalOpen" title="Cambios sin guardar"
      centered :maskClosable="false" :closable="false" width="440px">
      <div class="fa-leave">
        <WarningOutlined class="fa-leave-ico" />
        <div>
          <strong>Tenés cambios sin guardar.</strong><br>
          <span>¿Qué querés hacer antes de salir?</span>
        </div>
      </div>
      <template #footer>
        <a-button @click="closeLeaveModal">Seguir editando</a-button>
        <a-button :loading="leaveLoading" @click="leaveAndSave">Guardar y salir</a-button>
        <a-button danger @click="leaveAndDiscard">Descartar y salir</a-button>
      </template>
    </a-modal>

    <!-- Modal post-emisión -->
    <a-modal v-model:open="printModalOpen" title="Comprobante emitido"
      centered :maskClosable="false" :closable="false" width="420px">
      <div class="fa-print">
        <CheckCircleOutlined class="fa-print-ico" />
        <h3>Factura generada correctamente</h3>
        <p class="fa-print-num">{{ ventaFinalizada.numero }}</p>
        <p class="fa-print-hint">¿Querés ver o imprimir el comprobante?</p>
      </div>
      <template #footer>
        <div class="fa-print-ft">
          <a-button type="primary" size="large" :loading="ventaFinalizada.pdfLoading" @click="onPrintAndNew">
            <FilePdfOutlined /> Ver PDF · Nueva factura
          </a-button>
          <a-button size="large" :loading="ventaFinalizada.pdfLoading" @click="onPrintOnly">
            <FilePdfOutlined /> Solo PDF
          </a-button>
          <a-button size="large" @click="enviarEmail"><MailOutlined /> Email</a-button>
          <a-button size="large" @click="onSkipPrint">Omitir</a-button>
        </div>
      </template>
    </a-modal>

  </div>
</template>

<style scoped>
/* ── Variables — hereda del sistema de temas del layout ───────────────────── */
.fa-light {
  --fa-bg:      var(--app-bg, #f1f5f9);
  --fa-surf:    var(--surface-1, #fff);
  --fa-surf2:   var(--surface-2, #f8fafc);
  --fa-bdr:     var(--border, rgba(15,23,42,.10));
  --fa-t1:      var(--text-0, #0f172a);
  --fa-t2:      var(--text-1, #475569);
  --fa-t3:      var(--text-2, #94a3b8);
  --fa-acc:     var(--primary, #2563eb);
  --fa-acc-bg:  rgba(37,99,235,.06);
  --fa-tb-bg:   var(--surface-1, #fff);
  --fa-tot-bg:  #0f172a;
  --fa-tot-c:   #f8fafc;
  --fa-sh:      0 1px 3px rgba(0,0,0,.04), 0 4px 12px rgba(15,23,42,.05);
}
.fa-dark {
  --fa-bg:      var(--app-bg, #0b1220);
  --fa-surf:    var(--surface-1, #111827);
  --fa-surf2:   var(--surface-2, #1e293b);
  --fa-bdr:     var(--border, rgba(148,163,184,.12));
  --fa-t1:      var(--text-0, #f1f5f9);
  --fa-t2:      var(--text-1, #94a3b8);
  --fa-t3:      var(--text-2, #475569);
  --fa-acc:     var(--primary, #60a5fa);
  --fa-acc-bg:  rgba(96,165,250,.08);
  --fa-tb-bg:   var(--surface-1, #111827);
  --fa-tot-bg:  #020617;
  --fa-tot-c:   #f1f5f9;
  --fa-sh:      0 1px 4px rgba(0,0,0,.22), 0 4px 16px rgba(0,0,0,.18);
}

.fa-wrap { display:flex; flex-direction:column; min-height:calc(100vh - 80px); background:var(--fa-bg); color:var(--fa-t1); font-family:inherit; }

/* ── Topbar ─────────────────────────────────────────────────────────────────*/
.fa-topbar { position:sticky; top:0; z-index:50; background:var(--fa-tb-bg); border-bottom:1px solid var(--fa-bdr); box-shadow:0 2px 10px rgba(0,0,0,.06); }
.fa-topbar-inner { display:flex; align-items:flex-start; gap:0; padding:12px 18px; flex-wrap:wrap; gap:12px; overflow-x:auto; }
.fa-tb-sep { width:1px; align-self:stretch; background:var(--fa-bdr); margin:0 2px; flex-shrink:0; }
.fa-tb-label { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--fa-t3); margin-bottom:5px; display:flex; align-items:center; gap:5px; }
.fa-tb-block { display:flex; flex-direction:column; }
.fa-tb-client { flex:0 0 auto; min-width:240px; max-width:340px; }
.fa-tb-comp { flex:1; min-width:0; }
.fa-tb-actions { flex:0 0 auto; justify-content:center; }
.fa-comp-grid { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; }
.fa-cf { display:flex; flex-direction:column; gap:4px; }

/* Cliente chip */
.fa-cli-opt { display:flex; flex-direction:column; gap:1px; padding:2px 0; }
.fa-cli-opt-name { font-weight:700; font-size:13px; }
.fa-cli-opt-meta { font-size:11px; color:var(--fa-t3); }
.fa-cli-chip { display:flex; align-items:center; gap:8px; margin-top:8px; padding:6px 10px; border-radius:8px; background:var(--fa-acc-bg); border:1px solid rgba(37,99,235,.1); }
.fa-cli-av { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:.95rem; font-weight:900; color:var(--fa-acc); background:rgba(37,99,235,.12); flex-shrink:0; }
.fa-cli-body { flex:1; min-width:0; display:flex; flex-direction:column; }
.fa-cli-nombre { font-weight:700; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fa-cli-cuit { font-size:10px; color:var(--fa-t3); font-family:monospace; }
.fa-cli-right { display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; }
.fa-cte-badge { font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; }
.cte-ok { background:rgba(16,185,129,.1); color:#059669; border:1px solid rgba(16,185,129,.2); }
.cte-no { background:rgba(148,163,184,.08); color:var(--fa-t3); border:1px solid var(--fa-bdr); }
.fa-saldo { font-size:10px; color:var(--fa-t3); }

/* Status pill */
.fa-status-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; border:1px solid currentColor; white-space:nowrap; }
.fa-sp-dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
.fa-sp-ok      { color:#10b981; }
.fa-sp-warn    { color:#f59e0b; }
.fa-sp-danger  { color:#ef4444; }
.fa-sp-neutral { color:var(--fa-t3); }

/* ── Body ────────────────────────────────────────────────────────────────────*/
.fa-body { flex:1; display:grid; grid-template-columns:1fr 320px; gap:14px; padding:14px 18px; align-items:start; }
@media(max-width:1280px){ .fa-body{grid-template-columns:1fr 296px} }
@media(max-width:1040px){ .fa-body{grid-template-columns:1fr} }

/* ── Cards ───────────────────────────────────────────────────────────────────*/
.fa-card { background:var(--fa-surf); border:1px solid var(--fa-bdr); border-radius:10px; box-shadow:var(--fa-sh); }
.fa-sec-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--fa-t2); display:inline-flex; align-items:center; gap:6px; }

/* ── Tabla ───────────────────────────────────────────────────────────────────*/
.fa-left-col { display:flex; flex-direction:column; gap:10px; }
.fa-items-card { overflow:hidden; }
.fa-items-bar { padding:10px 14px; border-bottom:1px solid var(--fa-bdr); background:var(--fa-surf2); display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
.fa-ib-left { display:flex; align-items:center; gap:8px; }
.fa-count-badge { background:var(--fa-acc-bg); color:var(--fa-acc); border-radius:99px; padding:1px 8px; font-size:11px; font-weight:700; }
.fa-orig-badge { background:rgba(99,102,241,.1); color:#818cf8; border-radius:99px; padding:1px 8px; font-size:11px; font-weight:700; display:inline-flex; align-items:center; gap:4px; }
.fa-ib-right { display:flex; align-items:center; gap:8px; }
.fa-img-btn { display:inline-flex; align-items:center; gap:5px; padding:4px 10px; border-radius:7px; border:1px solid var(--fa-bdr); background:transparent; color:var(--fa-t2); cursor:pointer; font-size:12px; font-weight:600; font-family:inherit; transition:all .15s; }
.fa-img-btn:hover, .fa-img-btn-on { background:var(--fa-acc-bg); border-color:var(--fa-acc); color:var(--fa-acc); }

:deep(.ant-table-thead > tr > th) { background:var(--fa-surf2) !important; color:var(--fa-t2) !important; font-size:10.5px !important; font-weight:800 !important; text-transform:uppercase !important; letter-spacing:.06em !important; border-bottom:1px solid var(--fa-bdr) !important; padding:7px 10px !important; }
:deep(.ant-table-tbody > tr > td) { border-bottom:1px solid var(--fa-bdr) !important; padding:5px 10px !important; color:var(--fa-t1) !important; }
:deep(.ant-table-tbody > tr:hover > td) { background:var(--fa-acc-bg) !important; }
:deep(.fa-tr-sel > td) { background:var(--fa-acc-bg) !important; box-shadow:inset 3px 0 0 var(--fa-acc); }
:deep(.fa-tr-orig > td) { background:rgba(99,102,241,.04) !important; }

.fa-ln { font-size:11px; font-weight:800; color:var(--fa-t3); }
.fa-px { opacity:.35; font-size:12px; }
.fa-art-opt { display:flex; flex-direction:column; gap:2px; padding:2px 0; }
.fa-art-n { font-size:13px; font-weight:600; color:var(--fa-t1); }
.fa-art-m { font-size:11px; color:var(--fa-t3); }
.fa-desc-cell { display:flex; flex-direction:column; gap:1px; }
.fa-desc-t { font-size:13px; font-weight:600; }
.fa-desc-o { font-size:10px; color:#818cf8; display:flex; align-items:center; gap:3px; }
.fa-inline-img { margin-top:3px; }
.fa-inline-img img { height:38px; width:auto; object-fit:contain; border-radius:4px; border:1px solid var(--fa-bdr); }
.fa-inp-c :deep(.ant-input-number-input) { text-align:center; }
.fa-inp-r :deep(.ant-input-number-input) { text-align:right; }
.fa-iva { font-size:11px; color:var(--fa-t3); font-weight:700; }
.fa-sub { font-weight:800; font-variant-numeric:tabular-nums; font-size:13px; }
.fa-items-foot { padding:8px 14px; border-top:1px solid var(--fa-bdr); background:var(--fa-surf2); display:flex; align-items:center; gap:12px; }
.fa-foot-info { font-size:11px; color:var(--fa-t3); margin-left:auto; }
.fa-obs { padding:14px 16px; }

/* ── Panel derecho ───────────────────────────────────────────────────────────*/
.fa-right-col { display:flex; flex-direction:column; position:sticky; top:8px; }
.fa-tabs { display:flex; background:var(--fa-surf); border:1px solid var(--fa-bdr); border-bottom:none; border-radius:10px 10px 0 0; overflow:hidden; }
.fa-tab { flex:1; padding:9px 6px; border:none; background:transparent; color:var(--fa-t2); font-size:11px; font-weight:700; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px; border-right:1px solid var(--fa-bdr); transition:all .15s; }
.fa-tab:last-child { border-right:none; }
.fa-tab:hover { background:var(--fa-acc-bg); color:var(--fa-acc); }
.fa-tab-on { background:var(--fa-surf) !important; color:var(--fa-acc) !important; box-shadow:inset 0 -2px 0 var(--fa-acc); }
.fa-tab-n { background:var(--fa-acc); color:#fff; border-radius:99px; padding:0 5px; font-size:10px; font-weight:900; min-width:16px; text-align:center; }
.fa-tab-body { background:var(--fa-bg); border:1px solid var(--fa-bdr); border-top:none; border-radius:0 0 10px 10px; padding:10px; display:flex; flex-direction:column; gap:10px; }

/* Imagen preview */
.fa-img-preview { padding:10px; text-align:center; }
.fa-ip-title { font-size:11px; font-weight:700; color:var(--fa-t1); margin-bottom:7px; text-align:left; display:flex; align-items:center; gap:5px; }
.fa-ip-img { max-height:100px; max-width:100%; object-fit:contain; border-radius:7px; border:1px solid var(--fa-bdr); background:#fff; padding:4px; }
.fa-ip-meta { display:flex; justify-content:center; gap:10px; margin-top:7px; font-size:11px; color:var(--fa-t2); flex-wrap:wrap; }

/* Totales */
.fa-totals { background:var(--fa-tot-bg); color:var(--fa-tot-c); border-radius:10px; padding:14px; }
.fa-tot-hd { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.09em; opacity:.6; margin-bottom:10px; }
.fa-tot-rows { display:flex; flex-direction:column; gap:3px; margin-bottom:8px; }
.fa-tot-r { display:flex; justify-content:space-between; font-size:13px; opacity:.85; gap:8px; }
.fa-tot-sub { opacity:.65; font-size:12px; }
.fa-tot-disc { color:#34d399; }
.fa-tot-rec  { color:#fbbf24; }
.fa-disc-row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-top:1px solid rgba(255,255,255,.1); margin-bottom:6px; }
.fa-disc-lbl { font-size:12px; opacity:.8; display:flex; align-items:center; gap:5px; }
.fa-disc-ctrl { display:flex; gap:4px; align-items:center; }
.fa-tot-fin { display:flex; justify-content:space-between; align-items:baseline; padding:10px 0 12px; margin-top:4px; border-top:1px solid rgba(255,255,255,.15); font-size:13px; font-weight:800; opacity:.9; }
.fa-tot-amt { font-size:1.85rem; font-weight:900; color:#60a5fa; letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
.fa-cond { border-radius:7px; padding:6px 10px; font-size:12px; font-weight:700; margin-bottom:10px; text-align:center; }
.fa-cond-cc { background:rgba(99,102,241,.15); color:#a5b4fc; border:1px solid rgba(99,102,241,.25); }
.fa-cond-co { background:rgba(16,185,129,.12); color:#34d399; border:1px solid rgba(16,185,129,.2); }
.fa-cond-fp { font-weight:400; opacity:.8; font-size:11px; }
.fa-emit-btn { height:46px; font-size:14px; font-weight:900; }

/* Origen tab */
.fa-hint { font-size:12px; color:var(--fa-t3); margin:0 0 10px; line-height:1.5; }
.fa-orig-res { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
.fa-orig-row { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; border-radius:7px; background:var(--fa-surf2); border:1px solid var(--fa-bdr); }
.fa-orig-inf { display:flex; flex-direction:column; gap:2px; }
.fa-orig-num { font-weight:700; font-size:12px; font-family:monospace; }
.fa-orig-tipo { font-size:11px; color:var(--fa-t3); }
.fa-orig-tot { font-size:11px; font-weight:700; color:var(--fa-acc); }
.fa-orig-vinc { margin-top:10px; border-top:1px dashed var(--fa-bdr); padding-top:10px; }
.fa-orig-vinc-hd { font-size:10px; font-weight:800; text-transform:uppercase; color:var(--fa-t3); margin-bottom:6px; letter-spacing:.06em; }
.fa-orig-vinc-r { display:flex; align-items:center; gap:6px; padding:4px 0; }
.fa-vinc-ok { color:#10b981; flex-shrink:0; }
.fa-vinc-info { flex:1; display:flex; flex-direction:column; gap:1px; }
.fa-vinc-sub { font-size:10px; color:var(--fa-t3); }
.fa-orig-empty { text-align:center; padding:20px; color:var(--fa-t3); font-size:13px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.fa-orig-empty .anticon { font-size:26px; opacity:.3; }

/* Opciones */
.fa-opt-g { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; padding-bottom:14px; border-bottom:1px dashed var(--fa-bdr); }
.fa-opt-g:last-child { border-bottom:none; margin-bottom:0; padding-bottom:0; }
.fa-opt-l { font-size:11px; font-weight:700; color:var(--fa-t2); text-transform:uppercase; letter-spacing:.06em; }
.fa-opt-h { font-size:11px; color:var(--fa-t3); }

/* Confirmación */
.fa-cfm { display:flex; flex-direction:column; gap:5px; padding:4px 0; }
.fa-cfm-r { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 10px; border-radius:6px; background:rgba(148,163,184,.04); border:1px solid var(--fa-bdr); font-size:13px; color:var(--fa-t2); }
.fa-cfm-r strong { color:var(--fa-t1); font-weight:700; text-align:right; }
.fa-cfm-disc strong { color:#10b981; }
.fa-cfm-tot { font-size:14px; font-weight:800; background:var(--fa-acc-bg); border-color:var(--fa-acc); color:var(--fa-t1); margin-top:4px; }
.fa-cfm-tot strong { color:var(--fa-acc); font-size:16px; }

/* Leave modal */
.fa-leave { display:flex; align-items:flex-start; gap:14px; padding:8px 0; }
.fa-leave-ico { font-size:32px; color:#f59e0b; flex-shrink:0; }
.fa-leave div { font-size:14px; line-height:1.6; }

/* Print modal */
.fa-print { display:flex; flex-direction:column; align-items:center; gap:8px; padding:12px 0 4px; text-align:center; }
.fa-print-ico { font-size:48px; color:#10b981; }
.fa-print h3 { font-size:18px; font-weight:900; margin:0; color:var(--fa-t1); }
.fa-print-num { font-family:monospace; font-weight:800; font-size:14px; color:#2563eb; background:rgba(37,99,235,.08); border:1px solid rgba(37,99,235,.18); border-radius:8px; padding:4px 14px; margin:0; }
.fa-print-hint { font-size:13px; color:var(--fa-t2); margin:0; }
.fa-print-ft { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }

/* Transitions */
.fa-fade-enter-active, .fa-fade-leave-active { transition:opacity .18s ease; }
.fa-fade-enter-from, .fa-fade-leave-to { opacity:0; }
.fa-slide-enter-active, .fa-slide-leave-active { transition:all .2s ease; }
.fa-slide-enter-from, .fa-slide-leave-to { opacity:0; transform:translateY(-5px); }

@media(max-width:900px){ .fa-topbar-inner{ gap:10px } .fa-comp-grid{ gap:8px } .fa-tb-client{min-width:200px;max-width:100%} .fa-body{padding:10px 12px;gap:10px} }
@media(max-width:640px){ .fa-tb-sep{display:none} .fa-tot-amt{font-size:1.5rem} }
</style>
