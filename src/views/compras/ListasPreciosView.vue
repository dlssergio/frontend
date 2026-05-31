<script setup>
/**
 * ListasPreciosView.vue — Enterprise Edition
 *
 * Flujo:   Proveedor → Listas del proveedor → Ítems de cada lista
 *
 * Acciones masivas disponibles sobre ítems seleccionados (o todos):
 *   1. Ajuste de precio por % o monto fijo (aumentar / reducir)
 *   2. Reemplazar / agregar / limpiar descuentos adicionales
 *   3. Reemplazar / agregar / limpiar descuentos financieros
 *   4. Modificar bonificación en masa
 *   5. Copiar lista completa (nueva vigencia)
 *   6. Exportar CSV
 *   7. Historial de cambios de precio
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, SearchOutlined, TagOutlined, CheckCircleOutlined,
  ShopOutlined, DownloadOutlined, HistoryOutlined, CopyOutlined,
  PercentageOutlined, MinusCircleOutlined, ArrowUpOutlined,
  ArrowDownOutlined, ThunderboltOutlined, FileTextOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import ArticulosSelectorModal from '@/components/compras/ArticulosSelectorModal.vue'
import { listasPreciosService, proveedoresService } from '@/services/compras'

// ─────────────────────────────────────────────────────────────
// NIVEL 1: selección de proveedor
// ─────────────────────────────────────────────────────────────
const proveedores       = ref([])
const proveedorActivo   = ref(null)   // objeto completo del proveedor
const loadingProvs      = ref(false)
const searchProv        = ref('')

const proveedoresFiltrados = computed(() => {
  if (!searchProv.value) return proveedores.value
  const q = searchProv.value.toLowerCase()
  return proveedores.value.filter(p =>
    p.razon_social.toLowerCase().includes(q) || (p.cuit || '').includes(q))
})

async function loadProveedores() {
  loadingProvs.value = true
  try {
    const res = await proveedoresService.listar({ page_size: 500, esta_activo: true })
    proveedores.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar proveedores.') }
  finally   { loadingProvs.value = false }
}

// ─────────────────────────────────────────────────────────────
// NIVEL 2: listas del proveedor seleccionado
// ─────────────────────────────────────────────────────────────
const listas        = ref([])
const loadingListas = ref(false)
const modalLista    = ref(false)
const submittingL   = ref(false)
const formLista     = reactive({
  id: null, proveedor: null, nombre: '', codigo: '',
  vigente_desde: new Date().toISOString().slice(0,10),
  vigente_hasta: '', es_activa: true, es_principal: false, observaciones: '',
})

async function loadListas() {
  if (!proveedorActivo.value) return
  loadingListas.value = true
  try {
    const res = await listasPreciosService.listar({ proveedor: proveedorActivo.value.id, page_size: 100 })
    listas.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar listas.') }
  finally   { loadingListas.value = false }
}

watch(() => proveedorActivo.value, () => { listas.value = []; if (proveedorActivo.value) loadListas() })

function seleccionarProveedor(p) {
  proveedorActivo.value = p
}

function abrirNuevaLista() {
  Object.assign(formLista, {
    id: null, proveedor: proveedorActivo.value?.id, nombre: '', codigo: '',
    vigente_desde: new Date().toISOString().slice(0,10),
    vigente_hasta: '', es_activa: true, es_principal: false, observaciones: '',
  })
  modalLista.value = true
}

function editarLista(l) {
  Object.assign(formLista, {
    id: l.id, proveedor: l.proveedor, nombre: l.nombre, codigo: l.codigo ?? '',
    vigente_desde: l.vigente_desde ?? '', vigente_hasta: l.vigente_hasta ?? '',
    es_activa: l.es_activa, es_principal: l.es_principal, observaciones: l.observaciones ?? '',
  })
  modalLista.value = true
}

async function guardarLista() {
  if (!formLista.nombre) { message.error('El nombre es obligatorio.'); return }
  submittingL.value = true
  try {
    const payload = { ...formLista }
    if (!payload.vigente_hasta) payload.vigente_hasta = null
    formLista.id
      ? await listasPreciosService.actualizar(formLista.id, payload)
      : await listasPreciosService.crear(payload)
    message.success(formLista.id ? 'Lista actualizada.' : 'Lista creada.')
    modalLista.value = false; loadListas()
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
      : 'No se pudo guardar.')
  } finally { submittingL.value = false }
}

async function eliminarLista(id) {
  Modal.confirm({
    title: '¿Eliminar esta lista?', content: 'Se eliminarán todos sus artículos.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await listasPreciosService.eliminar(id); message.success('Eliminada.'); loadListas() }
      catch { message.error('No se pudo eliminar.') }
    },
  })
}

// ─────────────────────────────────────────────────────────────
// NIVEL 3: DRAWER de ítems de una lista
// ─────────────────────────────────────────────────────────────
const drawerOpen    = ref(false)
const modalSelector = ref(false)
const listaActiva   = ref(null)
const loadingItems  = ref(false)
const selectedRowKeys = ref([])   // IDs de ítems seleccionados

async function abrirDrawer(lista) {
  listaActiva.value = null
  selectedRowKeys.value = []
  drawerOpen.value = true
  loadingItems.value = true
  try {
    const res = await listasPreciosService.obtener(lista.id)
    listaActiva.value = res.data
  } catch { message.error('Error al cargar artículos.') }
  finally   { loadingItems.value = false }
}

async function recargarItems() {
  if (!listaActiva.value) return
  loadingItems.value = true
  try {
    const res = await listasPreciosService.obtener(listaActiva.value.id)
    listaActiva.value = res.data
  } finally { loadingItems.value = false }
}

const itemsSeleccionados = computed(() =>
  selectedRowKeys.value.length
    ? listaActiva.value?.items?.filter(i => selectedRowKeys.value.includes(i.id)) ?? []
    : listaActiva.value?.items ?? []
)
const cantSel = computed(() => selectedRowKeys.value.length
  ? `${selectedRowKeys.value.length} seleccionados`
  : `Todos (${listaActiva.value?.items?.length ?? 0})`)

// ─────────────────────────────────────────────────────────────
// MODAL: agregar / editar ítem
// ─────────────────────────────────────────────────────────────
const modalItem      = ref(false)
const itemEditando   = ref(null)
const submittingItem = ref(false)
const artOpts        = ref([])
const artBuscando    = ref(false)
const monedas        = ref([])
const unidades       = ref([])

const formItem = reactive({
  articulo: null, unidad_medida_compra: null,
  precio_lista_monto: '', precio_lista_moneda: null,
  bonificacion_porcentaje: 0,
  descuentos_adicionales: [], descuentos_financieros: [],
  cantidad_minima: 1, codigo_articulo_proveedor: '',
})

const costoPreview = computed(() => {
  let c = parseFloat(formItem.precio_lista_monto) || 0
  if (!c) return null
  c *= (1 - (parseFloat(formItem.bonificacion_porcentaje) || 0) / 100)
  for (const d of formItem.descuentos_adicionales)  c *= (1 + (parseFloat(d)||0)/100)
  for (const d of formItem.descuentos_financieros)  c *= (1 + (parseFloat(d)||0)/100)
  return c
})

async function onArticulosSeleccionados(articulos) {
  if (!articulos.length || !listaActiva.value) return
  let agregados = 0; const errores = []
  for (const art of articulos) {
    try {
      await listasPreciosService.agregarItem(listaActiva.value.id, {
        articulo: art.id,
        precio_lista_monto: parseFloat(art.precio_costo_monto) || 0,
        bonificacion_porcentaje: 0, descuentos_adicionales: [],
        descuentos_financieros: [], cantidad_minima: 1, codigo_articulo_proveedor: '',
      })
      agregados++
    } catch (e) {
      const msg = e.response?.data?.non_field_errors?.[0] ?? ''
      errores.push(art.cod_articulo + (msg.includes('ya existe') ? ' (ya estaba)' : ''))
    }
  }
  if (agregados) { message.success(agregados + ' artículo(s) agregado(s).'); await recargarItems(); loadListas() }
  if (errores.length) message.warning('No agregados: ' + errores.join(', '))
}

let artTimer = null
function buscarArticulo(txt) {
  if (!txt || txt.length < 2) { artOpts.value = []; return }
  clearTimeout(artTimer)
  artTimer = setTimeout(async () => {
    artBuscando.value = true
    try {
      // Sin filtro por proveedor: busca en TODOS los artículos activos
      // El filtro por proveedor excluiría artículos aún no vinculados, lo que impediría agregarlos
      const res = await api.get('/api/articulos/', { params: { search: txt, page_size: 30 } })
      artOpts.value = (res.data.results ?? res.data).map(a => ({
        value: a.id, label: `${a.cod_articulo} — ${a.descripcion}`,
      }))
    } finally { artBuscando.value = false }
  }, 300)
}

function abrirNuevoItem() {
  itemEditando.value = null
  Object.assign(formItem, {
    articulo: null, unidad_medida_compra: unidades.value[0]?.id ?? null,
    precio_lista_monto: '', precio_lista_moneda: monedas.value[0]?.id ?? null,
    bonificacion_porcentaje: 0, descuentos_adicionales: [], descuentos_financieros: [],
    cantidad_minima: 1, codigo_articulo_proveedor: '',
  })
  artOpts.value = []; modalItem.value = true
}

function abrirEditarItem(item) {
  itemEditando.value = item
  artOpts.value = item.articulo_data
    ? [{ value: item.articulo, label: `${item.articulo_data.cod_articulo} — ${item.articulo_data.descripcion}` }]
    : []
  Object.assign(formItem, {
    articulo: item.articulo, unidad_medida_compra: item.unidad_medida_compra ?? (unidades.value[0]?.id ?? null),
    precio_lista_monto: item.precio_lista_monto, precio_lista_moneda: item.precio_lista_moneda ?? (monedas.value[0]?.id ?? null),
    bonificacion_porcentaje: parseFloat(item.bonificacion_porcentaje || 0),
    descuentos_adicionales: (item.descuentos_adicionales || []).map(Number),
    descuentos_financieros: (item.descuentos_financieros || []).map(Number),
    cantidad_minima: parseFloat(item.cantidad_minima || 1),
    codigo_articulo_proveedor: item.codigo_articulo_proveedor || '',
  })
  modalItem.value = true
}

async function guardarItem() {
  if (!formItem.articulo) { message.error('Seleccioná un artículo.'); return }
  if (!formItem.precio_lista_monto || parseFloat(formItem.precio_lista_monto) <= 0) {
    message.error('El precio debe ser mayor a cero.'); return
  }
  submittingItem.value = true
  try {
    const payload = {
      articulo: formItem.articulo, unidad_medida_compra: formItem.unidad_medida_compra,
      precio_lista_monto: parseFloat(formItem.precio_lista_monto),
      precio_lista_moneda: formItem.precio_lista_moneda,
      bonificacion_porcentaje: parseFloat(formItem.bonificacion_porcentaje) || 0,
      descuentos_adicionales: formItem.descuentos_adicionales.map(Number).filter(n => !isNaN(n)),
      descuentos_financieros: formItem.descuentos_financieros.map(Number).filter(n => !isNaN(n)),
      cantidad_minima: parseFloat(formItem.cantidad_minima) || 1,
      codigo_articulo_proveedor: formItem.codigo_articulo_proveedor || '',
    }
    itemEditando.value
      ? await listasPreciosService.editarItem(listaActiva.value.id, itemEditando.value.id, payload)
      : await listasPreciosService.agregarItem(listaActiva.value.id, payload)
    message.success(itemEditando.value ? 'Artículo actualizado.' : 'Artículo agregado.')
    modalItem.value = false; await recargarItems(); loadListas()
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
      : 'No se pudo guardar.')
  } finally { submittingItem.value = false }
}

async function eliminarItem(itemId) {
  Modal.confirm({
    title: '¿Quitar este artículo?', okText: 'Quitar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try {
        await listasPreciosService.eliminarItem(listaActiva.value.id, itemId)
        message.success('Quitado.'); await recargarItems(); loadListas()
      } catch { message.error('No se pudo eliminar.') }
    },
  })
}

function addDesc(tipo) {
  tipo === 'ad' ? formItem.descuentos_adicionales.push(0) : formItem.descuentos_financieros.push(0)
}
function removeDesc(tipo, i) {
  tipo === 'ad' ? formItem.descuentos_adicionales.splice(i,1) : formItem.descuentos_financieros.splice(i,1)
}
function updateDesc(tipo, i, v) {
  if (tipo === 'ad') formItem.descuentos_adicionales[i] = parseFloat(v)||0
  else               formItem.descuentos_financieros[i] = parseFloat(v)||0
}

// ─────────────────────────────────────────────────────────────
// MODAL: Acciones masivas
// ─────────────────────────────────────────────────────────────
const modalBulk     = ref(false)
const bulkTab       = ref('precio')
const submittingB   = ref(false)

const bulkPrecio = reactive({ tipo: 'porcentaje', valor: '', operacion: 'aumentar', motivo: '' })
const bulkDesc   = reactive({ tipo: 'adicionales', accion: 'reemplazar', valores: [0] })
const bulkBonif  = reactive({ valor: '' })
const bulkCopia  = reactive({ nombre: '', vigente_desde: new Date().toISOString().slice(0,10), vigente_hasta: '', es_principal: false })

function addBulkDesc() { bulkDesc.valores.push(0) }
function removeBulkDesc(i) { bulkDesc.valores.splice(i,1) }

async function ejecutarBulk() {
  submittingB.value = true
  const ids = selectedRowKeys.value.length ? selectedRowKeys.value : null
  try {
    let res, msg
    if (bulkTab.value === 'precio') {
      if (!bulkPrecio.valor || parseFloat(bulkPrecio.valor) <= 0) { message.error('Ingresá un valor.'); return }
      res = await listasPreciosService.bulkAjustePrecio(listaActiva.value.id, {
        tipo: bulkPrecio.tipo, valor: parseFloat(bulkPrecio.valor),
        operacion: bulkPrecio.operacion, motivo: bulkPrecio.motivo || 'Ajuste masivo.',
        item_ids: ids,
      })
      msg = res.data.mensaje
      if (res.data.errores?.length) message.warning(`Advertencias: ${res.data.errores.join(', ')}`)
    } else if (bulkTab.value === 'descuentos') {
      res = await listasPreciosService.bulkDescuentos(listaActiva.value.id, {
        tipo: bulkDesc.tipo, accion: bulkDesc.accion,
        valores: bulkDesc.tipo === 'bonificacion' ? parseFloat(bulkBonif.valor)||0 : bulkDesc.valores.map(Number),
        item_ids: ids,
      })
      msg = res.data.mensaje
    } else if (bulkTab.value === 'bonificacion') {
      res = await listasPreciosService.bulkDescuentos(listaActiva.value.id, {
        tipo: 'bonificacion', accion: 'reemplazar',
        valores: parseFloat(bulkBonif.valor) || 0,
        item_ids: ids,
      })
      msg = res.data.mensaje
    } else if (bulkTab.value === 'copiar') {
      if (!bulkCopia.nombre) { message.error('Ingresá un nombre para la nueva lista.'); return }
      res = await listasPreciosService.copiarLista(listaActiva.value.id, {
        nombre: bulkCopia.nombre, vigente_desde: bulkCopia.vigente_desde,
        vigente_hasta: bulkCopia.vigente_hasta || null, es_principal: bulkCopia.es_principal,
      })
      msg = `Lista "${res.data.nombre}" creada con ${listaActiva.value.items?.length ?? 0} artículos.`
    }
    message.success(msg ?? 'Operación completada.')
    modalBulk.value = false; selectedRowKeys.value = []
    await recargarItems(); loadListas()
  } catch (e) {
    const err = e.response?.data
    message.error(err?.error ?? err?.detail ?? 'Error al ejecutar la operación.')
  } finally { submittingB.value = false }
}

// ─────────────────────────────────────────────────────────────
// MODAL: Historial de precios
// ─────────────────────────────────────────────────────────────
const modalHistorial  = ref(false)
const historialData   = ref([])
const loadingHistorial = ref(false)

async function verHistorial() {
  modalHistorial.value = true
  loadingHistorial.value = true
  try {
    const res = await listasPreciosService.historial(listaActiva.value.id)
    historialData.value = res.data
  } catch { message.error('Error al cargar historial.') }
  finally   { loadingHistorial.value = false }
}

const colsHistorial = [
  { key: 'fecha',     title: 'Fecha',       width: 155 },
  { key: 'articulo',  title: 'Artículo',    ellipsis: true },
  { key: 'anterior',  title: 'Precio Ant.', width: 130, align: 'right' },
  { key: 'nuevo',     title: 'Precio Nuevo',width: 130, align: 'right' },
  { key: 'var',       title: 'Variación',   width: 100, align: 'right' },
  { key: 'motivo',    title: 'Motivo',      ellipsis: true },
]

// ─────────────────────────────────────────────────────────────
// Exportar CSV
// ─────────────────────────────────────────────────────────────
async function exportarCSV() {
  try {
    const res = await listasPreciosService.exportarCSV(listaActiva.value.id)
    const url = URL.createObjectURL(res.data)
    const a   = document.createElement('a')
    a.href = url; a.download = `lista_${listaActiva.value.id}_${listaActiva.value.nombre}.csv`
    a.click(); URL.revokeObjectURL(url)
    message.success('CSV descargado.')
  } catch { message.error('Error al exportar.') }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const money   = (v, sim = '$') =>
  `${sim} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v)||0)}`
const pct     = (v) => `${parseFloat(v||0).toFixed(2)}%`
const fmtDate = (v) => v ? new Date(v).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }) : '—'
const fmtYMD  = (v) => v ? new Date(v+'T00:00:00').toLocaleDateString('es-AR') : '∞'

const colsItems = [
  { key: 'sel',      width: 40, align: 'center' },
  { key: 'cod',      title: 'Código',        width: 110 },
  { key: 'desc',     title: 'Artículo',      ellipsis: true },
  { key: 'um',       title: 'UM',            width: 55, align: 'center' },
  { key: 'precio',   title: 'Precio Lista',  width: 130, align: 'right' },
  { key: 'bonif',    title: 'Bonif.',        width: 75,  align: 'right' },
  { key: 'desc_ad',  title: 'Desc. Adic.',   width: 100, align: 'center' },
  { key: 'desc_fin', title: 'Desc. Fin.',    width: 100, align: 'center' },
  { key: 'costo_ef', title: 'Costo Ef.',     width: 130, align: 'right' },
  { key: 'acc_i',    title: '',              width: 75,  align: 'center', fixed: 'right' },
]

// ─────────────────────────────────────────────────────────────
// onMounted
// ─────────────────────────────────────────────────────────────
onMounted(async () => {
  loadProveedores()
  const [mR, uR] = await Promise.allSettled([
    api.get('/api/monedas/'),
    api.get('/api/unidades-medida/'),
  ])
  if (mR.status === 'fulfilled') {
    monedas.value = mR.value.data.results ?? mR.value.data
    formItem.precio_lista_moneda = monedas.value[0]?.id ?? null
  }
  if (uR.status === 'fulfilled') {
    unidades.value = uR.value.data.results ?? uR.value.data
    formItem.unidad_medida_compra = unidades.value[0]?.id ?? null
  }
})
</script>

<template>
<div class="listas-page">

  <!-- ══════════════════════════════════════════════════════════
       MODAL: Crear / Editar Lista
  ══════════════════════════════════════════════════════════ -->
  <a-modal v-model:open="modalLista"
    :title="formLista.id ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'"
    :footer="null" width="560px" destroy-on-close>
    <div class="mw">
      <div class="mg2">
        <div class="mf full">
          <label class="req">Nombre de la lista</label>
          <a-input v-model:value="formLista.nombre" allow-clear placeholder="Ej: Lista Verano 2025" />
        </div>
        <div class="mf"><label>Código interno</label><a-input v-model:value="formLista.codigo" allow-clear /></div>
        <div class="mf">
          <label>Vigente Desde</label>
          <a-input type="date" v-model:value="formLista.vigente_desde" style="width:100%" />
        </div>
        <div class="mf">
          <label>Vigente Hasta</label>
          <a-input type="date" v-model:value="formLista.vigente_hasta" style="width:100%" />
          <span class="hint">Vacío = sin vencimiento</span>
        </div>
        <div class="mf full">
          <a-space>
            <a-checkbox v-model:checked="formLista.es_activa">Lista Activa</a-checkbox>
            <a-checkbox v-model:checked="formLista.es_principal">Lista Principal del proveedor</a-checkbox>
          </a-space>
        </div>
      </div>
      <div class="mf-foot">
        <a-button @click="modalLista = false">Cancelar</a-button>
        <a-button type="primary" :loading="submittingL" @click="guardarLista">
          {{ formLista.id ? 'Guardar cambios' : 'Crear Lista' }}
        </a-button>
      </div>
    </div>
  </a-modal>

  <!-- ══════════════════════════════════════════════════════════
       MODAL: Agregar / Editar Ítem
  ══════════════════════════════════════════════════════════ -->
  <a-modal v-model:open="modalItem"
    :title="itemEditando ? 'Editar — ' + (itemEditando.articulo_data?.descripcion ?? '') : 'Agregar artículo a ' + (listaActiva?.nombre ?? '')"
    :footer="null" width="640px" destroy-on-close>
    <div class="mw">
      <div class="mg2">
        <div v-if="!itemEditando" class="mf full">
          <label class="req">Artículo</label>
          <a-select v-model:value="formItem.articulo" show-search :filter-option="false"
            :loading="artBuscando" :not-found-content="artBuscando ? undefined : 'Escribí 2+ caracteres'"
            style="width:100%" placeholder="Buscar por código o descripción…" @search="buscarArticulo">
            <a-select-option v-for="a in artOpts" :key="a.value" :value="a.value">{{ a.label }}</a-select-option>
          </a-select>
        </div>
        <div class="mf">
          <label class="req">Precio de Lista</label>
          <a-input-number v-model:value="formItem.precio_lista_monto" :min="0.0001" :precision="4" addon-before="$" style="width:100%" />
        </div>
        <div class="mf">
          <label>Moneda</label>
          <a-select v-model:value="formItem.precio_lista_moneda" style="width:100%">
            <a-select-option v-for="m in monedas" :key="m.id" :value="m.id">{{ m.nombre }} ({{ m.simbolo }})</a-select-option>
          </a-select>
        </div>
        <div class="mf">
          <label>Unidad de Compra</label>
          <a-select v-model:value="formItem.unidad_medida_compra" style="width:100%">
            <a-select-option v-for="u in unidades" :key="u.id" :value="u.id">{{ u.simbolo }} — {{ u.nombre }}</a-select-option>
          </a-select>
        </div>
        <div class="mf">
          <label>Cant. Mínima</label>
          <a-input-number v-model:value="formItem.cantidad_minima" :min="0.001" :precision="3" style="width:100%" />
        </div>
        <div class="mf">
          <label>Bonificación %</label>
          <a-input-number v-model:value="formItem.bonificacion_porcentaje" :min="0" :max="100" :precision="2" addon-after="%" style="width:100%" />
        </div>
        <div class="mf">
          <label>Código Proveedor</label>
          <a-input v-model:value="formItem.codigo_articulo_proveedor" allow-clear />
        </div>

        <!-- Descuentos adicionales -->
        <div class="mf full">
          <div class="desc-hdr">
            <span class="desc-title">Descuentos Adicionales</span>
            <span class="desc-sub">Se aplican en cascada sobre el precio c/bonif.</span>
            <a-button size="small" type="dashed" @click="addDesc('ad')"><PlusOutlined /></a-button>
          </div>
          <div v-if="!formItem.descuentos_adicionales.length" class="desc-empty">Sin descuentos adicionales</div>
          <div v-for="(d,i) in formItem.descuentos_adicionales" :key="'a'+i" class="desc-row">
            <span class="desc-n">{{ i+1 }}</span>
            <a-input-number :value="d" :min="-100" :max="100" :precision="2" addon-after="%" style="flex:1"
              @change="v => updateDesc('ad',i,v)" />
            <span class="desc-label" :class="d>0?'up':d<0?'dn':''">{{ d>0?'▲ Recargo':d<0?'▼ Dto':'—' }}</span>
            <a-button type="text" danger size="small" @click="removeDesc('ad',i)"><MinusCircleOutlined /></a-button>
          </div>
        </div>

        <!-- Descuentos financieros -->
        <div class="mf full">
          <div class="desc-hdr">
            <span class="desc-title">Descuentos Financieros</span>
            <span class="desc-sub">Pago contado, cheque, transferencia, etc.</span>
            <a-button size="small" type="dashed" @click="addDesc('fin')"><PlusOutlined /></a-button>
          </div>
          <div v-if="!formItem.descuentos_financieros.length" class="desc-empty">Sin descuentos financieros</div>
          <div v-for="(d,i) in formItem.descuentos_financieros" :key="'f'+i" class="desc-row">
            <span class="desc-n">{{ i+1 }}</span>
            <a-input-number :value="d" :min="-100" :max="100" :precision="2" addon-after="%" style="flex:1"
              @change="v => updateDesc('fin',i,v)" />
            <span class="desc-label" :class="d>0?'up':d<0?'dn':''">{{ d>0?'▲ Recargo':d<0?'▼ Dto':'—' }}</span>
            <a-button type="text" danger size="small" @click="removeDesc('fin',i)"><MinusCircleOutlined /></a-button>
          </div>
        </div>

        <!-- Preview costo efectivo -->
        <div v-if="costoPreview !== null" class="costo-preview full">
          <div class="cp-row"><span>Precio lista:</span><strong>$ {{ Number(formItem.precio_lista_monto||0).toFixed(2) }}</strong></div>
          <div v-if="parseFloat(formItem.bonificacion_porcentaje)>0" class="cp-row">
            <span>Con bonificación ({{ formItem.bonificacion_porcentaje }}%):</span>
            <strong>$ {{ (Number(formItem.precio_lista_monto||0)*(1-Number(formItem.bonificacion_porcentaje)/100)).toFixed(2) }}</strong>
          </div>
          <div class="cp-row cp-final">
            <span><b>Costo efectivo estimado:</b></span>
            <span class="cp-val">$ {{ costoPreview.toFixed(4) }}</span>
          </div>
        </div>
      </div>
      <div class="mf-foot">
        <a-button @click="modalItem = false">Cancelar</a-button>
        <a-button type="primary" :loading="submittingItem" @click="guardarItem">
          {{ itemEditando ? 'Guardar cambios' : 'Agregar Artículo' }}
        </a-button>
      </div>
    </div>
  </a-modal>

  <!-- ══════════════════════════════════════════════════════════
       MODAL: Acciones Masivas
  ══════════════════════════════════════════════════════════ -->
  <a-modal v-model:open="modalBulk" title="Acciones Masivas" :footer="null" width="580px" destroy-on-close>
    <a-alert v-if="selectedRowKeys.length" type="info" show-icon
      :message="'Aplicará sobre ' + cantSel" style="margin-bottom:14px;font-size:12px" />
    <a-alert v-else type="warning" show-icon
      message="Sin selección → aplica a TODOS los artículos de la lista" style="margin-bottom:14px;font-size:12px" />

    <a-tabs v-model:activeKey="bulkTab">

      <!-- Ajuste de precio -->
      <a-tab-pane key="precio">
        <template #tab><PercentageOutlined /> Ajuste de Precio</template>
        <div class="mw">
          <div class="mg2">
            <div class="mf">
              <label>Tipo de ajuste</label>
              <a-radio-group v-model:value="bulkPrecio.tipo" button-style="solid" style="width:100%">
                <a-radio-button value="porcentaje" style="width:50%;text-align:center">Porcentaje (%)</a-radio-button>
                <a-radio-button value="monto_fijo" style="width:50%;text-align:center">Monto Fijo ($)</a-radio-button>
              </a-radio-group>
            </div>
            <div class="mf">
              <label>Operación</label>
              <a-radio-group v-model:value="bulkPrecio.operacion" button-style="solid" style="width:100%">
                <a-radio-button value="aumentar" style="width:50%;text-align:center"><ArrowUpOutlined /> Aumentar</a-radio-button>
                <a-radio-button value="reducir"  style="width:50%;text-align:center"><ArrowDownOutlined /> Reducir</a-radio-button>
              </a-radio-group>
            </div>
            <div class="mf">
              <label class="req">Valor</label>
              <a-input-number v-model:value="bulkPrecio.valor" :min="0.01" :precision="2"
                :addon-after="bulkPrecio.tipo === 'porcentaje' ? '%' : '$'" style="width:100%" />
            </div>
            <div class="mf full">
              <label>Motivo (aparece en historial)</label>
              <a-input v-model:value="bulkPrecio.motivo" placeholder="Ej: Actualización por devaluación" allow-clear />
            </div>
          </div>
        </div>
      </a-tab-pane>

      <!-- Descuentos adicionales/financieros -->
      <a-tab-pane key="descuentos">
        <template #tab><TagOutlined /> Descuentos</template>
        <div class="mw">
          <div class="mg2">
            <div class="mf full">
              <label>Tipo de descuento</label>
              <a-radio-group v-model:value="bulkDesc.tipo" button-style="solid" style="width:100%">
                <a-radio-button value="adicionales" style="width:50%;text-align:center">Adicionales</a-radio-button>
                <a-radio-button value="financieros" style="width:50%;text-align:center">Financieros</a-radio-button>
              </a-radio-group>
            </div>
            <div class="mf full">
              <label>Acción</label>
              <a-radio-group v-model:value="bulkDesc.accion" button-style="solid" style="width:100%">
                <a-radio-button value="reemplazar" style="width:33%;text-align:center">Reemplazar</a-radio-button>
                <a-radio-button value="agregar"    style="width:33%;text-align:center">Agregar</a-radio-button>
                <a-radio-button value="limpiar"    style="width:34%;text-align:center">Limpiar todo</a-radio-button>
              </a-radio-group>
            </div>
            <div v-if="bulkDesc.accion !== 'limpiar'" class="mf full">
              <div class="desc-hdr"><span class="desc-title">Valores</span>
                <a-button size="small" type="dashed" @click="addBulkDesc"><PlusOutlined /></a-button>
              </div>
              <div v-for="(d,i) in bulkDesc.valores" :key="i" class="desc-row">
                <span class="desc-n">{{ i+1 }}</span>
                <a-input-number :value="d" :min="-100" :max="100" :precision="2" addon-after="%" style="flex:1"
                  @change="v => bulkDesc.valores[i] = parseFloat(v)||0" />
                <a-button v-if="bulkDesc.valores.length>1" type="text" danger size="small" @click="removeBulkDesc(i)"><MinusCircleOutlined /></a-button>
              </div>
            </div>
          </div>
        </div>
      </a-tab-pane>

      <!-- Bonificación masiva -->
      <a-tab-pane key="bonificacion">
        <template #tab><PercentageOutlined /> Bonificación</template>
        <div class="mw" style="padding-top:8px">
          <div class="mf">
            <label class="req">Nueva bonificación (reemplaza a todos)</label>
            <a-input-number v-model:value="bulkBonif.valor" :min="0" :max="100" :precision="2"
              addon-after="%" style="width:100%" placeholder="0.00" />
            <span class="hint">Setea exactamente este % en todos los artículos seleccionados</span>
          </div>
        </div>
      </a-tab-pane>

      <!-- Copiar lista -->
      <a-tab-pane key="copiar">
        <template #tab><CopyOutlined /> Copiar Lista</template>
        <div class="mw">
          <a-alert type="info" show-icon message="Crea una nueva lista con todos los artículos y precios actuales de esta." style="margin-bottom:12px;font-size:12px" />
          <div class="mg2">
            <div class="mf full">
              <label class="req">Nombre de la nueva lista</label>
              <a-input v-model:value="bulkCopia.nombre" allow-clear :placeholder="'Copia de ' + (listaActiva?.nombre ?? '')" />
            </div>
            <div class="mf">
              <label>Vigente Desde</label>
              <a-input type="date" v-model:value="bulkCopia.vigente_desde" style="width:100%" />
            </div>
            <div class="mf">
              <label>Vigente Hasta</label>
              <a-input type="date" v-model:value="bulkCopia.vigente_hasta" style="width:100%" />
            </div>
            <div class="mf full">
              <a-checkbox v-model:checked="bulkCopia.es_principal">Marcar como lista principal</a-checkbox>
            </div>
          </div>
        </div>
      </a-tab-pane>

    </a-tabs>

    <div class="mf-foot" style="margin-top:16px">
      <a-button @click="modalBulk = false">Cancelar</a-button>
      <a-button type="primary" :loading="submittingB" @click="ejecutarBulk">
        <ThunderboltOutlined /> Ejecutar
      </a-button>
    </div>
  </a-modal>

  <!-- ══════════════════════════════════════════════════════════
       MODAL: Historial de precios
  ══════════════════════════════════════════════════════════ -->
  <a-modal v-model:open="modalHistorial"
    :title="'Historial de precios — ' + (listaActiva?.nombre ?? '')"
    :footer="null" width="800px">
    <a-table :columns="colsHistorial" :data-source="historialData" :loading="loadingHistorial"
      row-key="id" size="small" :pagination="{ pageSize: 25, simple: true }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'fecha'"><span style="font-size:11px">{{ fmtDate(record.fecha) }}</span></template>
        <template v-if="column.key === 'articulo'">
          <span class="mono-sm">{{ record.cod_articulo }}</span> {{ record.articulo }}
        </template>
        <template v-if="column.key === 'anterior'"><span class="num-cell">$ {{ record.precio_anterior.toFixed(2) }}</span></template>
        <template v-if="column.key === 'nuevo'"><span class="num-cell">$ {{ record.precio_nuevo.toFixed(2) }}</span></template>
        <template v-if="column.key === 'var'">
          <span :class="record.variacion_pct >= 0 ? 'var-up' : 'var-dn'">
            {{ record.variacion_pct >= 0 ? '+' : '' }}{{ record.variacion_pct.toFixed(1) }}%
          </span>
        </template>
        <template v-if="column.key === 'motivo'"><span style="font-size:11px;color:var(--text-2)">{{ record.motivo }}</span></template>
      </template>
      <template #emptyText><a-empty description="Sin cambios registrados" :image="false" /></template>
    </a-table>
  </a-modal>

  <!-- ══════════════════════════════════════════════════════════
       DRAWER: Ítems de la lista (fullscreen lateral)
  ══════════════════════════════════════════════════════════ -->
  <a-drawer v-model:open="drawerOpen" placement="right" :width="'78vw'"
    :closable="true" destroy-on-close
    :body-style="{ padding: '0', background: 'var(--surface-1, #f8fafc)', display:'flex', flexDirection:'column', height:'100%' }">
    <template #title>
      <div class="drawer-title-wrap">
        <div>
          <div class="drawer-lista-nombre">{{ listaActiva?.nombre ?? 'Cargando…' }}</div>
          <div class="drawer-lista-prov">{{ listaActiva?.proveedor_nombre }}</div>
        </div>
        <div class="drawer-badges" v-if="listaActiva">
          <a-tag :color="listaActiva.es_activa ? 'success' : 'default'" style="font-size:11px">
            {{ listaActiva.es_activa ? 'Activa' : 'Inactiva' }}
          </a-tag>
          <a-tag v-if="listaActiva.es_principal" color="blue" style="font-size:11px">Principal</a-tag>
          <span class="drawer-vigencia" v-if="listaActiva.vigente_desde">
            {{ fmtYMD(listaActiva.vigente_desde) }} → {{ fmtYMD(listaActiva.vigente_hasta) }}
          </span>
        </div>
      </div>
    </template>

    <!-- Modal selector masivo -->
    <ArticulosSelectorModal
      v-model:open="modalSelector"
      :ya-en-lista="listaActiva?.items ?? []"
      @confirm="onArticulosSeleccionados"
    />

    <div class="drawer-body">
      <!-- Barra de acciones -->
      <div class="drawer-toolbar">
        <div class="drawer-toolbar-left">
          <span v-if="selectedRowKeys.length" class="sel-badge">
            {{ selectedRowKeys.length }} seleccionado(s)
            <a class="sel-clear" @click="selectedRowKeys = []">✕ Limpiar</a>
          </span>
          <span v-else class="sel-hint">Seleccioná artículos para acciones masivas, o ejecutá sobre todos</span>
        </div>
        <div class="drawer-toolbar-right">
          <a-tooltip title="Agregar artículo">
            <a-button type="primary" @click="abrirNuevoItem" :disabled="!listaActiva">
              <PlusOutlined /> Agregar
            </a-button>
          </a-tooltip>
          <a-tooltip title="Agregar varios artículos a la vez">
            <a-button @click="modalSelector = true" :disabled="!listaActiva">
              <SearchOutlined /> Agregar varios
            </a-button>
          </a-tooltip>
          <a-tooltip title="Acciones masivas">
            <a-button @click="modalBulk = true" :disabled="!listaActiva">
              <ThunderboltOutlined /> Masivo
            </a-button>
          </a-tooltip>
          <a-tooltip title="Historial de cambios de precio">
            <a-button @click="verHistorial" :disabled="!listaActiva">
              <HistoryOutlined />
            </a-button>
          </a-tooltip>
          <a-tooltip title="Exportar CSV">
            <a-button @click="exportarCSV" :disabled="!listaActiva">
              <DownloadOutlined />
            </a-button>
          </a-tooltip>
          <a-button @click="recargarItems" :loading="loadingItems">
            <ReloadOutlined />
          </a-button>
        </div>
      </div>

      <!-- Tabla -->
      <div class="drawer-table-wrap">
        <a-spin :spinning="loadingItems">
          <a-table v-if="listaActiva"
            :columns="colsItems"
            :data-source="listaActiva.items"
            :row-selection="{ selectedRowKeys, onChange: keys => selectedRowKeys = keys }"
            row-key="id" size="small"
            :pagination="{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} artículos` }"
            :scroll="{ x: 1100 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'cod'">
                <span class="mono-sm">{{ record.articulo_data?.cod_articulo }}</span>
              </template>
              <template v-if="column.key === 'desc'">
                <span style="font-size:12px;font-weight:500">{{ record.articulo_data?.descripcion }}</span>
              </template>
              <template v-if="column.key === 'um'">
                <span class="tag-um">{{ record.unidad_nombre || 'UN' }}</span>
              </template>
              <template v-if="column.key === 'precio'">
                <span class="num-cell">{{ money(record.precio_lista_monto, record.moneda_nombre||'$') }}</span>
              </template>
              <template v-if="column.key === 'bonif'">
                <span :class="parseFloat(record.bonificacion_porcentaje)>0 ? 'bonif-v' : 'num-dim'">
                  {{ pct(record.bonificacion_porcentaje) }}
                </span>
              </template>
              <template v-if="column.key === 'desc_ad'">
                <span v-if="record.descuentos_adicionales?.length" class="chips">
                  <span v-for="(d,i) in record.descuentos_adicionales" :key="i" class="chip chip-b">
                    {{ d>0?'+':'' }}{{ d }}%
                  </span>
                </span>
                <span v-else class="num-dim">—</span>
              </template>
              <template v-if="column.key === 'desc_fin'">
                <span v-if="record.descuentos_financieros?.length" class="chips">
                  <span v-for="(d,i) in record.descuentos_financieros" :key="i" class="chip chip-g">
                    {{ d>0?'+':'' }}{{ d }}%
                  </span>
                </span>
                <span v-else class="num-dim">—</span>
              </template>
              <template v-if="column.key === 'costo_ef'">
                <span v-if="record.costo_efectivo != null" class="num-cell num-green">
                  {{ money(record.costo_efectivo, record.moneda_nombre||'$') }}
                </span>
                <span v-else class="num-dim">—</span>
              </template>
              <template v-if="column.key === 'acc_i'">
                <a-space size="small">
                  <a-tooltip title="Editar"><a-button size="small" @click="abrirEditarItem(record)"><EditOutlined /></a-button></a-tooltip>
                  <a-tooltip title="Quitar"><a-button size="small" danger @click="eliminarItem(record.id)"><DeleteOutlined /></a-button></a-tooltip>
                </a-space>
              </template>
            </template>
            <template #emptyText>
              <a-empty description="Sin artículos. Agregá el primero." :image="false" />
            </template>
          </a-table>
        </a-spin>
      </div>
    </div>
  </a-drawer>

  <!-- ══════════════════════════════════════════════════════════
       LAYOUT PRINCIPAL: dos columnas
  ══════════════════════════════════════════════════════════ -->
  <section class="hero">
    <div class="hero__left">
      <div class="hero__eyebrow">Compras · Precios de Proveedores</div>
      <h1 class="hero__title">Listas de Precios</h1>
      <p class="hero__subtitle">Seleccioná un proveedor para administrar sus listas, artículos y descuentos.</p>
    </div>
  </section>

  <div class="two-col">

    <!-- Columna izquierda: lista de proveedores -->
    <div class="prov-col">
      <div class="prov-col-header">
        <span class="prov-col-title">Proveedores</span>
        <a-input-search v-model:value="searchProv" size="small" allow-clear
          placeholder="Buscar…" style="flex:1" @search="() => {}" />
        <a-button size="small" :loading="loadingProvs" @click="loadProveedores"><ReloadOutlined /></a-button>
      </div>
      <a-spin :spinning="loadingProvs">
        <div class="prov-list">
          <div v-if="!proveedoresFiltrados.length && !loadingProvs" class="prov-empty">
            Sin proveedores
          </div>
          <div v-for="p in proveedoresFiltrados" :key="p.id"
            class="prov-item"
            :class="{ 'prov-item--active': proveedorActivo?.id === p.id }"
            @click="seleccionarProveedor(p)">
            <div class="prov-item-name">{{ p.razon_social }}</div>
            <div v-if="p.cuit" class="prov-item-cuit">{{ p.cuit }}</div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- Columna derecha: listas del proveedor -->
    <div class="listas-col">
      <div v-if="!proveedorActivo" class="listas-empty-state">
        <ShopOutlined style="font-size:40px;color:var(--text-2)" />
        <p>Seleccioná un proveedor para ver sus listas de precios</p>
      </div>

      <template v-else>
        <!-- Header del proveedor -->
        <div class="listas-col-header">
          <div>
            <div class="listas-prov-nombre">{{ proveedorActivo.razon_social }}</div>
            <div class="listas-prov-sub">{{ listas.length }} lista(s) configurada(s)</div>
          </div>
          <a-button type="primary" @click="abrirNuevaLista" :disabled="loadingListas">
            <PlusOutlined /> Nueva Lista
          </a-button>
        </div>

        <!-- Tarjetas de listas -->
        <a-spin :spinning="loadingListas">
          <div v-if="!listas.length && !loadingListas" class="listas-vacia">
            <a-empty description="Este proveedor no tiene listas de precios" :image="false">
              <a-button type="primary" @click="abrirNuevaLista"><PlusOutlined /> Crear primera lista</a-button>
            </a-empty>
          </div>
          <div class="listas-grid">
            <div v-for="lista in listas" :key="lista.id" class="lista-card">
              <div class="lista-card-top">
                <div>
                  <div class="lista-card-nombre">{{ lista.nombre }}</div>
                  <div v-if="lista.codigo" class="lista-card-codigo">{{ lista.codigo }}</div>
                </div>
                <div class="lista-card-badges">
                  <a-tag :color="lista.es_activa ? 'success' : 'default'" style="font-size:11px">
                    {{ lista.es_activa ? 'Activa' : 'Inactiva' }}
                  </a-tag>
                  <a-tag v-if="lista.es_principal" color="blue" style="font-size:11px">Principal</a-tag>
                </div>
              </div>

              <div class="lista-card-meta">
                <span><FileTextOutlined style="margin-right:4px" />{{ lista.cant_items }} artículo(s)</span>
                <span>{{ fmtYMD(lista.vigente_desde) }} → {{ fmtYMD(lista.vigente_hasta) }}</span>
              </div>

              <div class="lista-card-actions">
                <a-button type="primary" size="small" @click="abrirDrawer(lista)">
                  <EyeOutlined /> Ver artículos
                </a-button>
                <a-button size="small" @click="editarLista(lista)"><EditOutlined /></a-button>
                <a-button size="small" danger @click="eliminarLista(lista.id)"><DeleteOutlined /></a-button>
              </div>
            </div>
          </div>
        </a-spin>
      </template>
    </div>

  </div>

</div>
</template>

<style scoped>
.listas-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }

/* Hero */
.hero { padding:20px 22px; border-radius:6px; background:radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%),linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }

/* Layout dos columnas */
.two-col { display:grid; grid-template-columns:280px 1fr; gap:16px; min-height:600px; }

/* Columna proveedores */
.prov-col { background:var(--surface-0); border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,.08); display:flex; flex-direction:column; overflow:hidden; }
.prov-col-header { display:flex; align-items:center; gap:8px; padding:12px 14px; border-bottom:1px solid var(--border,#f0f0f0); flex-shrink:0; flex-wrap:wrap; }
.prov-col-title  { font-size:13px; font-weight:700; color:var(--text-0); white-space:nowrap; }
.prov-list       { overflow-y:auto; flex:1; }
.prov-empty      { padding:24px; text-align:center; font-size:12px; color:var(--text-2); }
.prov-item { padding:10px 14px; cursor:pointer; border-bottom:1px solid color-mix(in srgb,var(--border) 60%,transparent); transition:background .12s; }
.prov-item:hover { background:var(--surface-1,#f8fafc); }
.prov-item--active { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 8%,var(--surface-0)); border-left:3px solid rgba(var(--accent-rgb),1); }
.prov-item-name  { font-size:13px; font-weight:600; color:var(--text-0); }
.prov-item-cuit  { font-size:11px; color:var(--text-2); margin-top:2px; }

/* Columna listas */
.listas-col        { background:var(--surface-0); border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,.08); display:flex; flex-direction:column; overflow:hidden; }
.listas-empty-state{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--text-2); font-size:13px; padding:40px; }
.listas-col-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--border,#f0f0f0); flex-shrink:0; }
.listas-prov-nombre { font-size:16px; font-weight:800; color:var(--text-0); }
.listas-prov-sub    { font-size:12px; color:var(--text-2); margin-top:2px; }
.listas-vacia { padding:48px; display:flex; justify-content:center; }
.listas-grid  { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; padding:16px; }

/* Tarjeta de lista */
.lista-card { background:var(--surface-1,#f8fafc); border-radius:8px; border:1px solid var(--border,#e2e8f0); padding:14px; display:flex; flex-direction:column; gap:10px; transition:box-shadow .15s; }
.lista-card:hover { box-shadow:0 4px 14px rgba(0,0,0,.1); }
.lista-card-top    { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.lista-card-nombre { font-size:14px; font-weight:700; color:var(--text-0); }
.lista-card-codigo { font-size:11px; color:var(--text-2); }
.lista-card-badges { display:flex; gap:4px; flex-wrap:wrap; }
.lista-card-meta   { display:flex; gap:12px; font-size:11px; color:var(--text-2); flex-wrap:wrap; }
.lista-card-actions { display:flex; gap:8px; }

/* Drawer */
.drawer-title-wrap { display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap; }
.drawer-lista-nombre { font-size:16px; font-weight:800; color:var(--text-0); }
.drawer-lista-prov   { font-size:12px; color:var(--text-2); margin-top:2px; }
.drawer-badges       { display:flex; gap:6px; align-items:center; flex-wrap:wrap; margin-top:4px; }
.drawer-vigencia     { font-size:11px; color:var(--text-2); }
.drawer-body         { display:flex; flex-direction:column; height:100%; overflow:hidden; }
.drawer-toolbar      { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; background:var(--surface-0,#fff); border-bottom:1px solid var(--border,#f0f0f0); flex-shrink:0; flex-wrap:wrap; gap:8px; }
.drawer-toolbar-left { display:flex; align-items:center; gap:10px; }
.drawer-toolbar-right{ display:flex; gap:8px; align-items:center; }
.sel-badge  { font-size:12px; font-weight:700; color:rgba(var(--accent-rgb),1); background:color-mix(in srgb,rgba(var(--accent-rgb),1) 10%,transparent); padding:4px 10px; border-radius:6px; }
.sel-clear  { margin-left:8px; cursor:pointer; opacity:.6; font-size:11px; }
.sel-hint   { font-size:11px; color:var(--text-2); }
.drawer-table-wrap { flex:1; overflow:auto; padding:0; }

/* Tabla ítems */
.mono-sm { font-family:monospace; font-size:12px; color:var(--text-2); }
.num-cell { font-variant-numeric:tabular-nums; font-weight:600; font-size:12px; }
.num-green{ color:#16a34a; }
.num-dim  { color:var(--text-2); font-size:12px; }
.bonif-v  { font-weight:700; color:#d97706; font-size:12px; }
.tag-um   { font-size:10px; font-weight:700; background:var(--surface-1,#f1f5f9); color:var(--text-2); padding:2px 5px; border-radius:4px; }
.chips    { display:flex; flex-wrap:wrap; gap:3px; }
.chip     { font-size:10px; font-weight:700; padding:1px 5px; border-radius:4px; }
.chip-b   { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 12%,transparent); color:rgba(var(--accent-rgb),1); }
.chip-g   { background:color-mix(in srgb,#16a34a 12%,transparent); color:#16a34a; }
.var-up   { color:#16a34a; font-weight:700; font-size:12px; }
.var-dn   { color:#dc2626; font-weight:700; font-size:12px; }

/* Modales */
.mw { padding-top:8px; }
.mg2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.mf { display:flex; flex-direction:column; gap:4px; }
.mf label { font-size:11px; font-weight:600; color:var(--text-2); }
.mf label.req::after { content:' *'; color:#ef4444; }
.full { grid-column:1/-1; }
.hint { font-size:10px; color:var(--text-2); }
.mf-foot { display:flex; justify-content:flex-end; gap:8px; padding-top:14px; border-top:1px solid var(--border,#f0f0f0); margin-top:12px; }

/* Descuentos */
.desc-hdr   { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
.desc-title { font-size:12px; font-weight:700; color:var(--text-0); }
.desc-sub   { font-size:11px; color:var(--text-2); flex:1; }
.desc-empty { font-size:11px; color:var(--text-2); font-style:italic; padding:2px 0 6px; }
.desc-row   { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.desc-n     { font-size:11px; font-weight:700; color:var(--text-2); width:16px; text-align:right; flex-shrink:0; }
.desc-label { font-size:10px; width:70px; flex-shrink:0; }
.desc-label.up  { color:#d97706; }
.desc-label.dn  { color:#16a34a; }

/* Preview costo */
.costo-preview  { background:var(--surface-1,#f8fafc); border:1px solid var(--border); border-radius:8px; padding:10px 14px; display:flex; flex-direction:column; gap:5px; }
.cp-row         { display:flex; justify-content:space-between; font-size:12px; }
.cp-final       { padding-top:6px; border-top:1px solid var(--border); margin-top:4px; }
.cp-val         { font-size:17px; font-weight:800; color:#16a34a; font-variant-numeric:tabular-nums; }

@media (max-width:1000px) { .two-col { grid-template-columns:1fr; } }
</style>
