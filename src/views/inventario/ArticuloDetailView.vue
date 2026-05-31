<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined, EditOutlined, PoweroffOutlined,
  DollarOutlined, InboxOutlined, TeamOutlined,
  HistoryOutlined, AppstoreOutlined, InfoCircleOutlined,
  WarningFilled, CheckCircleFilled, CloseCircleFilled,
  BarcodeOutlined, ShopOutlined, ColumnHeightOutlined,
  PlusOutlined, DeleteOutlined, StarOutlined, StarFilled,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { articulosService, proveedorArticuloService } from '@/services/inventario'
import api from '@/services/api'

const router = useRouter()
const route  = useRoute()
const id     = computed(() => route.params.id)

const loading        = ref(false)
const loadingKardex  = ref(false)
const articulo       = ref(null)
const kardexData     = ref([])
const activeTab      = ref('general')

// ─── Carga principal ──────────────────────────────────────────
const cargar = async () => {
  loading.value = true
  try {
    const res = await articulosService.obtener(id.value)
    articulo.value = res.data
  } catch {
    message.error('No se pudo cargar el artículo.')
    router.push({ name: 'articulo-lista' })
  } finally {
    loading.value = false
  }
}

const cargarKardex = async () => {
  if (kardexData.value.length > 0) return  // ya cargado
  loadingKardex.value = true
  try {
    const res = await articulosService.kardex(id.value)
    kardexData.value = res.data.kardex ?? []
  } catch {
    message.error('No se pudo cargar el kardex.')
  } finally {
    loadingKardex.value = false
  }
}

const onTabChange = (key) => {
  activeTab.value = key
  if (key === 'historial') cargarKardex()
}

// ─── Acciones ────────────────────────────────────────────────
const toggleActivo = () => {
  if (!articulo.value) return
  const accion = articulo.value.esta_activo ? 'Desactivar' : 'Activar'
  Modal.confirm({
    title:      `¿${accion} este artículo?`,
    okText:     accion,
    cancelText: 'Cancelar',
    okType:     articulo.value.esta_activo ? 'danger' : 'primary',
    async onOk() {
      try {
        if (articulo.value.esta_activo) await articulosService.desactivar(id.value)
        else                            await articulosService.activar(id.value)
        await cargar()
        message.success('Estado actualizado.')
      } catch {
        message.error('No se pudo cambiar el estado.')
      }
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────
const fmtMoneda = (val) =>
  val != null
    ? new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(val)
    : '—'

const fmtNum = (val, dec = 3) =>
  val != null ? parseFloat(val).toFixed(dec) : '—'

const stockBadgeClass = computed(() => {
  if (!articulo.value?.administra_stock) return 'badge--gray'
  const disp = parseFloat(articulo.value.stock_disponible ?? 0)
  if (disp <= 0) return 'badge--red'
  if (articulo.value.necesita_reposicion) return 'badge--warn'
  return 'badge--green'
})

const stockLabel = computed(() => {
  if (!articulo.value?.administra_stock) return 'Sin control'
  const disp = parseFloat(articulo.value.stock_disponible ?? 0)
  if (disp <= 0) return 'Sin stock'
  if (articulo.value.necesita_reposicion) return 'Bajo mínimo'
  return 'OK'
})

// Columnas del kardex
const kardexCols = [
  { title: 'Fecha',     dataIndex: 'fecha',            width: 150, ellipsis: true },
  { title: 'Depósito',  dataIndex: 'deposito',          width: 120, ellipsis: true },
  { title: 'Origen',    dataIndex: 'origen_sistema',    width: 110 },
  { title: 'Referencia',dataIndex: 'origen_referencia', ellipsis: true },
  { title: 'Entrada',   dataIndex: 'entrada',           width: 90, align: 'right' },
  { title: 'Salida',    dataIndex: 'salida',            width: 90, align: 'right' },
  { title: 'Saldo',     dataIndex: 'saldo',             width: 90, align: 'right' },
]

// Columnas del stock por depósito
const stockCols = [
  { title: 'Depósito',        dataIndex: 'deposito_nombre',    ellipsis: true },
  { title: 'Físico',          dataIndex: 'cantidad_real',      width: 100, align: 'right' },
  { title: 'Comprometido',    dataIndex: 'cantidad_comprometida', width: 120, align: 'right' },
  { title: 'Disponible',      dataIndex: 'cantidad_disponible', width: 110, align: 'right' },
]

// ─── Gestión de Proveedores ───────────────────────────────────
const proveedores        = ref([])
const loadingProveedores = ref(false)
const drawerOpen         = ref(false)
const submittingProv     = ref(false)

// Formulario del drawer
const formProv = ref({
  _id:                    null,  // null = crear, number = editar
  proveedor:              null,
  es_fuente_de_verdad:    false,
  cod_articulo_proveedor: '',
  descripcion_proveedor:  '',
})

// Búsqueda de proveedor en el selector
const provBuscando = ref(false)
const provOptions  = ref([])

const buscarProveedor = async (query) => {
  if (!query || query.length < 2) return
  provBuscando.value = true
  try {
    const res = await api.get('/api/proveedores/', { params: { search: query } })
    const lista = res.data.results ?? res.data
    provOptions.value = lista.map(p => ({
      value: p.id,
      label: p.entidad_data?.razon_social ?? p.entidad?.razon_social ?? `Proveedor #${p.id}`,
    }))
  } finally {
    provBuscando.value = false
  }
}

const cargarProveedores = async () => {
  if (!id.value) return
  loadingProveedores.value = true
  try {
    const res = await proveedorArticuloService.listar(id.value)
    proveedores.value = res.data.results ?? res.data
  } catch {
    message.error('No se pudieron cargar los proveedores.')
  } finally {
    loadingProveedores.value = false
  }
}

const abrirAgregar = () => {
  formProv.value = { _id: null, proveedor: null, es_fuente_de_verdad: false, cod_articulo_proveedor: '', descripcion_proveedor: '' }
  provOptions.value = []
  drawerOpen.value = true
}

const abrirEditar = (pa) => {
  formProv.value = {
    _id:                    pa.id,
    proveedor:              pa.proveedor_id,
    es_fuente_de_verdad:    pa.es_fuente_de_verdad,
    cod_articulo_proveedor: pa.cod_articulo_proveedor ?? '',
    descripcion_proveedor:  pa.descripcion_proveedor  ?? '',
  }
  // Pre-cargar la opción actual en el selector
  provOptions.value = [{ value: pa.proveedor_id, label: pa.razon_social }]
  drawerOpen.value = true
}

const guardarProv = async () => {
  if (!formProv.value.proveedor) { message.error('Seleccioná un proveedor.'); return }
  submittingProv.value = true
  try {
    const payload = {
      proveedor:              formProv.value.proveedor,
      es_fuente_de_verdad:    formProv.value.es_fuente_de_verdad,
      cod_articulo_proveedor: formProv.value.cod_articulo_proveedor || null,
      descripcion_proveedor:  formProv.value.descripcion_proveedor  || null,
    }
    if (formProv.value._id) {
      await proveedorArticuloService.actualizar(id.value, formProv.value._id, payload)
      message.success('Relación actualizada.')
    } else {
      await proveedorArticuloService.crear(id.value, payload)
      message.success('Proveedor agregado al artículo.')
    }
    drawerOpen.value = false
    await cargarProveedores()
    // Refrescar ficha para actualizar proveedor_principal
    await cargar()
  } catch (e) {
    const err = e.response?.data
    if (err && typeof err === 'object') {
      message.error(Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | '))
    } else {
      message.error('No se pudo guardar.')
    }
  } finally {
    submittingProv.value = false
  }
}

const eliminarProv = (pa) => {
  Modal.confirm({
    title:      `¿Quitar a "${pa.razon_social}" como proveedor?`,
    content:    'Se eliminará la relación. El proveedor no se borra del sistema.',
    okText:     'Quitar',
    okType:     'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await proveedorArticuloService.eliminar(id.value, pa.id)
        message.success('Proveedor quitado.')
        await cargarProveedores()
        await cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo eliminar.')
      }
    },
  })
}

const setFuenteDeVerdad = async (pa) => {
  try {
    await proveedorArticuloService.setFuenteDeVerdad(id.value, pa.id)
    message.success(`${pa.razon_social} marcado como fuente de precio de costo.`)
    await cargarProveedores()
    await cargar()
  } catch (e) {
    message.error(e.response?.data?.detail ?? 'No se pudo actualizar.')
  }
}

const onTabChangeConProveedores = (key) => {
  activeTab.value = key
  if (key === 'historial')   cargarKardex()
  if (key === 'proveedores') cargarProveedores()
}

onMounted(cargar)
</script>

<template>
  <div class="detail-root">

    <!-- ── Skeleton ─────────────────────────────────────── -->
    <template v-if="loading">
      <a-skeleton active :paragraph="{ rows: 8 }" />
    </template>

    <template v-else-if="articulo">

      <!-- ── Header de la ficha ─────────────────────────── -->
      <div class="detail-header">
        <div class="header-left">
          <a-button type="text" class="btn-back" @click="router.push({ name: 'articulo-lista' })">
            <ArrowLeftOutlined /> Volver
          </a-button>
          <div class="header-identity">
            <div class="header-top">
              <span class="cod-badge">{{ articulo.cod_articulo }}</span>
              <span v-if="articulo.ean" class="ean-badge">
                <BarcodeOutlined style="margin-right:3px" />{{ articulo.ean }}
              </span>
              <span :class="['status-badge', articulo.esta_activo ? 'status-badge--active' : 'status-badge--inactive']">
                <CheckCircleFilled v-if="articulo.esta_activo" />
                <CloseCircleFilled v-else />
                {{ articulo.esta_activo ? 'Activo' : 'Inactivo' }}
              </span>
              <span :class="['stock-badge', stockBadgeClass]">{{ stockLabel }}</span>
            </div>
            <h1 class="detail-title">{{ articulo.descripcion }}</h1>
            <div class="header-meta">
              <span v-if="articulo.rubro">
                <AppstoreOutlined style="margin-right:3px" />{{ articulo.rubro.nombre }}
              </span>
              <span v-if="articulo.marca">
                <ShopOutlined style="margin-right:3px" />{{ articulo.marca.nombre }}
              </span>
              <span v-if="articulo.es_servicio" class="tag-service">Servicio</span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <a-button
            :type="articulo.esta_activo ? 'default' : 'primary'"
            :danger="articulo.esta_activo"
            @click="toggleActivo"
          >
            <PoweroffOutlined />
            {{ articulo.esta_activo ? 'Desactivar' : 'Activar' }}
          </a-button>
          <a-button
            type="primary"
            @click="router.push({ name: 'articulo-editar', params: { id: articulo.id } })"
          >
            <EditOutlined /> Editar
          </a-button>
        </div>
      </div>

      <!-- ── KPIs rápidos ───────────────────────────────── -->
      <div class="kpi-strip">
        <div class="kpi">
          <span class="kpi-label">Precio Costo</span>
          <span class="kpi-value kpi-value--cost">$ {{ fmtMoneda(articulo.precio_costo_monto) }}</span>
        </div>
        <div class="kpi kpi--featured">
          <span class="kpi-label">Precio Venta</span>
          <span class="kpi-value">$ {{ fmtMoneda(articulo.precio_venta_monto) }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Utilidad</span>
          <span class="kpi-value kpi-value--util">{{ fmtNum(articulo.utilidad, 1) }}%</span>
        </div>
        <div class="kpi" v-if="articulo.administra_stock">
          <span class="kpi-label">Stock Total</span>
          <span class="kpi-value">{{ fmtNum(articulo.stock_total) }}</span>
        </div>
        <div class="kpi" v-if="articulo.administra_stock">
          <span class="kpi-label">Disponible</span>
          <span :class="['kpi-value', articulo.necesita_reposicion ? 'kpi-value--warn' : 'kpi-value--ok']">
            {{ fmtNum(articulo.stock_disponible) }}
          </span>
        </div>
        <div class="kpi" v-if="articulo.administra_stock">
          <span class="kpi-label">Mínimo</span>
          <span class="kpi-value">{{ fmtNum(articulo.stock_minimo) }}</span>
        </div>
      </div>

      <!-- ── Pestañas ───────────────────────────────────── -->
      <a-tabs v-model:activeKey="activeTab" class="detail-tabs" @change="onTabChangeConProveedores">

        <!-- PESTAÑA: GENERAL -->
        <a-tab-pane key="general" tab="General">
          <template #tab>
            <span><InfoCircleOutlined /> General</span>
          </template>
          <div class="tab-content">
            <div class="section-grid">

              <div class="info-block">
                <h3 class="block-title">Identificación</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Código</span>
                    <span class="info-value mono">{{ articulo.cod_articulo }}</span>
                  </div>
                  <div class="info-row" v-if="articulo.ean">
                    <span class="info-label">EAN / Cód. Barras</span>
                    <span class="info-value mono">{{ articulo.ean }}</span>
                  </div>
                  <div class="info-row" v-if="articulo.cod_fabricante">
                    <span class="info-label">Cód. Fabricante</span>
                    <span class="info-value mono">{{ articulo.cod_fabricante }}</span>
                  </div>
                  <div class="info-row" v-if="articulo.qr">
                    <span class="info-label">QR</span>
                    <span class="info-value mono">{{ articulo.qr }}</span>
                  </div>
                </div>
              </div>

              <div class="info-block">
                <h3 class="block-title">Clasificación</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Perfil</span>
                    <span class="info-value">{{ articulo.perfil_display }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Rubro</span>
                    <span class="info-value">{{ articulo.rubro?.nombre ?? '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Marca</span>
                    <span class="info-value">{{ articulo.marca?.nombre ?? '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Tipo</span>
                    <span class="info-value">
                      {{ articulo.es_servicio ? 'Servicio' : articulo.es_bien_de_uso ? 'Bien de Uso' : 'Artículo estándar' }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="info-block info-block--full" v-if="articulo.descripcion_larga">
                <h3 class="block-title">Descripción extendida</h3>
                <p class="desc-larga">{{ articulo.descripcion_larga }}</p>
              </div>

              <div class="info-block info-block--full" v-if="articulo.observaciones">
                <h3 class="block-title">Observaciones internas</h3>
                <p class="desc-larga">{{ articulo.observaciones }}</p>
              </div>

            </div>
          </div>
        </a-tab-pane>

        <!-- PESTAÑA: PRECIOS -->
        <a-tab-pane key="precios">
          <template #tab>
            <span><DollarOutlined /> Precios e Impuestos</span>
          </template>
          <div class="tab-content">
            <div class="section-grid">

              <div class="info-block">
                <h3 class="block-title">Precios</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Precio Costo</span>
                    <span class="info-value">
                      $ {{ fmtMoneda(articulo.precio_costo_monto) }}
                      <span class="moneda-tag">{{ articulo.precio_costo_moneda?.simbolo }}</span>
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Utilidad</span>
                    <span class="info-value">{{ fmtNum(articulo.utilidad, 2) }}%</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Precio Venta</span>
                    <span class="info-value info-value--featured">
                      $ {{ fmtMoneda(articulo.precio_venta_monto) }}
                      <span class="moneda-tag">{{ articulo.precio_venta_moneda?.simbolo }}</span>
                    </span>
                  </div>
                  <div class="info-row" v-if="articulo.precio_final_calculado">
                    <span class="info-label">Precio final (c/imp.)</span>
                    <span class="info-value info-value--featured">
                      $ {{ fmtMoneda(articulo.precio_final_calculado) }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="info-block">
                <h3 class="block-title">Impositivo</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Cat. Impositiva</span>
                    <span class="info-value">{{ articulo.categoria_impositiva?.nombre ?? '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Tasa IVA</span>
                    <span class="info-value">{{ articulo.iva_rate ?? '—' }}%</span>
                  </div>
                </div>
                <div class="impuestos-list" v-if="articulo.impuestos?.length">
                  <h4 class="sub-label">Impuestos adicionales</h4>
                  <div v-for="imp in articulo.impuestos" :key="imp.id" class="imp-chip">
                    {{ imp.nombre }} — {{ imp.tasa }}{{ imp.es_porcentaje ? '%' : ' $' }}
                  </div>
                </div>
              </div>

              <div class="info-block" v-if="articulo.proveedor_principal">
                <h3 class="block-title">Proveedor de costo base</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Proveedor</span>
                    <span class="info-value">{{ articulo.proveedor_principal.razon_social }}</span>
                  </div>
                  <div class="info-row" v-if="articulo.proveedor_principal.cod_articulo_proveedor">
                    <span class="info-label">Cód. en Proveedor</span>
                    <span class="info-value mono">{{ articulo.proveedor_principal.cod_articulo_proveedor }}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </a-tab-pane>

        <!-- PESTAÑA: STOCK -->
        <a-tab-pane key="stock" :disabled="!articulo.administra_stock">
          <template #tab>
            <span><InboxOutlined /> Stock</span>
          </template>
          <div class="tab-content">
            <div class="section-grid">

              <div class="info-block">
                <h3 class="block-title">Configuración de Stock</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Administra Stock</span>
                    <span class="info-value">{{ articulo.administra_stock ? 'Sí' : 'No' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Permite negativo</span>
                    <span class="info-value">{{ articulo.permite_stock_negativo ? 'Sí' : 'No' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Stock Mínimo</span>
                    <span :class="['info-value', articulo.necesita_reposicion ? 'info-value--warn' : '']">
                      {{ fmtNum(articulo.stock_minimo) }}
                      <WarningFilled v-if="articulo.necesita_reposicion" style="color:#f59e0b;margin-left:4px" />
                    </span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Stock Máximo</span>
                    <span class="info-value">{{ fmtNum(articulo.stock_maximo) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Stock de Seguridad</span>
                    <span class="info-value">{{ fmtNum(articulo.stock_seguridad) }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Lead Time</span>
                    <span class="info-value">{{ articulo.lead_time_dias ?? 0 }} días</span>
                  </div>
                </div>
              </div>

              <div class="info-block info-block--full">
                <h3 class="block-title">Stock por Depósito</h3>
                <a-table
                  :columns="stockCols"
                  :data-source="articulo.stocks_por_deposito ?? []"
                  :pagination="false"
                  size="small"
                  row-key="deposito"
                  class="inner-table"
                  bordered
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.dataIndex === 'cantidad_disponible'">
                      <span :class="parseFloat(record.cantidad_disponible) < 0 ? 'qty-negative' : ''">
                        {{ fmtNum(record.cantidad_disponible) }}
                      </span>
                    </template>
                  </template>
                </a-table>
              </div>

              <div class="info-block" v-if="articulo.unidad_medida_stock">
                <h3 class="block-title">Unidades</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">U.M. Stock</span>
                    <span class="info-value">{{ articulo.unidad_medida_stock.nombre }} ({{ articulo.unidad_medida_stock.simbolo }})</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">U.M. Venta</span>
                    <span class="info-value">{{ articulo.unidad_medida_venta?.nombre ?? '—' }} ({{ articulo.unidad_medida_venta?.simbolo ?? '' }})</span>
                  </div>
                </div>
                <div v-if="articulo.conversiones_uom?.length" class="conversiones">
                  <h4 class="sub-label">Factores de conversión</h4>
                  <div v-for="c in articulo.conversiones_uom" :key="c.id" class="conv-row">
                    1 {{ c.unidad_externa_data?.simbolo }} = {{ c.factor_conversion }} {{ articulo.unidad_medida_stock.simbolo }}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </a-tab-pane>

        <!-- PESTAÑA: LOGÍSTICA -->
        <a-tab-pane key="logistica">
          <template #tab>
            <span><ColumnHeightOutlined /> Logística</span>
          </template>
          <div class="tab-content">
            <div class="section-grid">

              <div class="info-block">
                <h3 class="block-title">Dimensiones y Peso</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Peso</span>
                    <span class="info-value">{{ articulo.peso_kg ? `${articulo.peso_kg} kg` : '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Alto</span>
                    <span class="info-value">{{ articulo.alto_cm ? `${articulo.alto_cm} cm` : '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Ancho</span>
                    <span class="info-value">{{ articulo.ancho_cm ? `${articulo.ancho_cm} cm` : '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Profundidad</span>
                    <span class="info-value">{{ articulo.profundidad_cm ? `${articulo.profundidad_cm} cm` : '—' }}</span>
                  </div>
                </div>
              </div>

              <div class="info-block">
                <h3 class="block-title">Almacenamiento</h3>
                <div class="info-rows">
                  <div class="info-row">
                    <span class="info-label">Ubicación física</span>
                    <span class="info-value">{{ articulo.ubicacion || '—' }}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Garantía</span>
                    <span class="info-value">{{ articulo.garantia_meses ? `${articulo.garantia_meses} meses` : '—' }}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </a-tab-pane>

        <!-- PESTAÑA: HISTORIAL (KARDEX) -->
        <a-tab-pane key="historial">
          <template #tab>
            <span><HistoryOutlined /> Historial</span>
          </template>
          <div class="tab-content">
            <a-spin :spinning="loadingKardex">
              <a-empty v-if="!loadingKardex && kardexData.length === 0" description="Sin movimientos registrados" />
              <a-table
                v-else
                :columns="kardexCols"
                :data-source="kardexData"
                :pagination="{ pageSize: 15, showSizeChanger: false }"
                size="small"
                row-key="id"
                class="inner-table kardex-table"
                bordered
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'entrada'">
                    <span v-if="record.entrada > 0" class="qty-in">+{{ fmtNum(record.entrada) }}</span>
                    <span v-else class="qty-zero">—</span>
                  </template>
                  <template v-if="column.dataIndex === 'salida'">
                    <span v-if="record.salida > 0" class="qty-out">-{{ fmtNum(record.salida) }}</span>
                    <span v-else class="qty-zero">—</span>
                  </template>
                  <template v-if="column.dataIndex === 'saldo'">
                    <span :class="record.saldo < 0 ? 'qty-negative' : 'qty-saldo'">
                      {{ fmtNum(record.saldo) }}
                    </span>
                  </template>
                  <template v-if="column.dataIndex === 'fecha'">
                    {{ new Date(record.fecha).toLocaleString('es-AR') }}
                  </template>
                </template>
              </a-table>
            </a-spin>
          </div>
        </a-tab-pane>

        <!-- PESTAÑA: PROVEEDORES -->
        <a-tab-pane key="proveedores">
          <template #tab>
            <span><TeamOutlined /> Proveedores</span>
          </template>
          <div class="tab-content">

            <div class="prov-toolbar">
              <span class="prov-count">
                {{ proveedores.length }} proveedor{{ proveedores.length !== 1 ? 'es' : '' }} vinculado{{ proveedores.length !== 1 ? 's' : '' }}
              </span>
              <a-button type="primary" size="small" @click="abrirAgregar">
                <PlusOutlined /> Agregar proveedor
              </a-button>
            </div>

            <a-spin :spinning="loadingProveedores">
              <a-empty
                v-if="!loadingProveedores && proveedores.length === 0"
                description="Sin proveedores vinculados. Agregá el primero."
                :image="false"
                style="padding: 40px 0"
              />

              <div v-else class="prov-list">
                <div
                  v-for="pa in proveedores"
                  :key="pa.id"
                  class="prov-card"
                  :class="{ 'prov-card--fuente': pa.es_fuente_de_verdad }"
                >
                  <!-- Badge fuente de verdad -->
                  <div class="prov-card-header">
                    <div class="prov-identity">
                      <span class="prov-name">{{ pa.razon_social }}</span>
                      <span v-if="pa.nombre_fantasia" class="prov-fantasia">
                        {{ pa.nombre_fantasia }}
                      </span>
                      <span v-if="pa.codigo_proveedor" class="prov-cod-sys">
                        {{ pa.codigo_proveedor }}
                      </span>
                    </div>
                    <div class="prov-badges">
                      <a-tag v-if="pa.es_fuente_de_verdad" color="gold">
                        <StarFilled style="margin-right:3px" /> Fuente de precio
                      </a-tag>
                    </div>
                  </div>

                  <div class="prov-card-body">
                    <div class="prov-field" v-if="pa.cod_articulo_proveedor">
                      <span class="prov-field-label">Cód. en proveedor</span>
                      <span class="prov-field-value mono">{{ pa.cod_articulo_proveedor }}</span>
                    </div>
                    <div class="prov-field" v-if="pa.descripcion_proveedor">
                      <span class="prov-field-label">Descripción en proveedor</span>
                      <span class="prov-field-value">{{ pa.descripcion_proveedor }}</span>
                    </div>
                    <div class="prov-field" v-if="pa.fecha_relacion">
                      <span class="prov-field-label">Vinculado el</span>
                      <span class="prov-field-value">
                        {{ new Date(pa.fecha_relacion).toLocaleDateString('es-AR') }}
                      </span>
                    </div>
                  </div>

                  <div class="prov-card-actions">
                    <a-tooltip v-if="!pa.es_fuente_de_verdad" title="Marcar como fuente de precio de costo">
                      <a-button type="text" size="small" class="btn-star" @click="setFuenteDeVerdad(pa)">
                        <StarOutlined /> Fuente de precio
                      </a-button>
                    </a-tooltip>
                    <a-button type="text" size="small" class="btn-edit" @click="abrirEditar(pa)">
                      <EditOutlined /> Editar
                    </a-button>
                    <a-button type="text" size="small" danger @click="eliminarProv(pa)">
                      <DeleteOutlined /> Quitar
                    </a-button>
                  </div>
                </div>
              </div>
            </a-spin>

            <!-- Drawer: Agregar / Editar proveedor -->
            <a-drawer
              v-model:open="drawerOpen"
              :title="formProv._id ? 'Editar relación con proveedor' : 'Agregar proveedor al artículo'"
              width="440"
              :body-style="{ padding: '24px' }"
            >
              <div class="drawer-fields">

                <div class="field">
                  <label class="field-label req">Proveedor</label>
                  <a-select
                    :value="formProv.proveedor"
                    show-search
                    placeholder="Buscar proveedor…"
                    :filter-option="false"
                    :not-found-content="provBuscando ? undefined : 'Escribí para buscar'"
                    style="width:100%"
                    :disabled="!!formProv._id"
                    @search="buscarProveedor"
                    @select="(v) => { formProv.proveedor = v }"
                  >
                    <template #suffixIcon>
                      <a-spin v-if="provBuscando" size="small" />
                      <SearchOutlined v-else />
                    </template>
                    <a-select-option
                      v-for="opt in provOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >{{ opt.label }}</a-select-option>
                  </a-select>
                  <span v-if="formProv._id" class="field-hint">
                    El proveedor no se puede cambiar una vez creada la relación.
                  </span>
                </div>

                <div class="field">
                  <label class="field-label">Código del artículo en este proveedor</label>
                  <a-input
                    v-model:value="formProv.cod_articulo_proveedor"
                    placeholder="Ej: PHI-X123 (como aparece en las facturas del proveedor)"
                    allow-clear
                  />
                </div>

                <div class="field">
                  <label class="field-label">Descripción en el proveedor</label>
                  <a-input
                    v-model:value="formProv.descripcion_proveedor"
                    placeholder="Cómo lo llama el proveedor en sus documentos"
                    allow-clear
                  />
                </div>

                <div class="field">
                  <a-checkbox v-model:checked="formProv.es_fuente_de_verdad">
                    <strong>Fuente de precio de costo</strong>
                    <span class="field-hint" style="display:block">
                      Cuando llegue una factura de este proveedor, su precio actualizará
                      automáticamente el costo del artículo.
                      Solo puede haber uno activo por artículo.
                    </span>
                  </a-checkbox>
                </div>

              </div>

              <template #footer>
                <div class="drawer-footer">
                  <a-button @click="drawerOpen = false">Cancelar</a-button>
                  <a-button type="primary" :loading="submittingProv" @click="guardarProv">
                    {{ formProv._id ? 'Guardar cambios' : 'Agregar proveedor' }}
                  </a-button>
                </div>
              </template>
            </a-drawer>

          </div>
        </a-tab-pane>

      </a-tabs>

    </template>

  </div>
</template>

<style scoped>
.detail-root {
  background: var(--surface-0, #fff);
  border-radius: var(--radius-lg, 10px);
  overflow: hidden;
  box-shadow: var(--card-shadow, 0 1px 6px rgba(0,0,0,.07));
}

/* ── Header ──────────────────────────────────────────────── */
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border, #f0f0f0);
  flex-wrap: wrap;
}
.header-left { display: flex; align-items: flex-start; gap: 12px; }
.btn-back { color: var(--text-2, #64748b); padding: 0 8px; }
.header-identity { display: flex; flex-direction: column; gap: 6px; }
.header-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-0, #0f172a);
  line-height: 1.2;
}
.header-meta {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: var(--text-2, #64748b);
}
.header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

/* Badges del header */
.cod-badge {
  font-family: monospace;
  font-size: 12px;
  background: var(--surface-1, #f1f5f9);
  color: var(--text-2);
  padding: 2px 8px;
  border-radius: 4px;
}
.ean-badge {
  font-size: 11px;
  color: var(--text-2);
  background: var(--surface-1, #f1f5f9);
  padding: 2px 7px;
  border-radius: 4px;
}
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
}
.status-badge--active  { background: #dcfce7; color: #15803d; }
.status-badge--inactive{ background: #f1f5f9; color: #94a3b8; }
.stock-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.badge--green { background: #dcfce7; color: #15803d; }
.badge--warn  { background: #fef3c7; color: #b45309; }
.badge--red   { background: #fee2e2; color: #b91c1c; }
.badge--gray  { background: #f1f5f9; color: #64748b; }
.tag-service  { font-size: 11px; background: #e0f2fe; color: #0369a1; padding: 1px 6px; border-radius: 4px; }

/* ── KPI strip ───────────────────────────────────────────── */
.kpi-strip {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border, #f0f0f0);
  overflow-x: auto;
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 24px;
  border-right: 1px solid var(--border, #f0f0f0);
  min-width: 120px;
}
.kpi--featured { background: var(--surface-1, #f8fafc); }
.kpi-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-2, #64748b);
}
.kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
}
.kpi-value--cost { color: var(--text-2, #64748b); font-size: 16px; font-weight: 500; }
.kpi-value--util { color: #7c3aed; }
.kpi-value--ok   { color: #15803d; }
.kpi-value--warn { color: #b45309; }

/* ── Tabs ────────────────────────────────────────────────── */
.detail-tabs :deep(.ant-tabs-nav) { padding: 0 24px; margin: 0; }
.detail-tabs :deep(.ant-tabs-content-holder) { padding: 0; }

/* ── Tab content ─────────────────────────────────────────── */
.tab-content { padding: 24px; }
.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.info-block {
  background: var(--surface-1, #f8fafc);
  border-radius: var(--radius-md, 8px);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.info-block--full { grid-column: 1 / -1; }
.block-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--text-2, #64748b);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

.info-rows { display: flex; flex-direction: column; gap: 8px; }
.info-row  { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.info-label {
  font-size: 12px;
  color: var(--text-2, #64748b);
  flex-shrink: 0;
}
.info-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-0, #0f172a);
  text-align: right;
}
.info-value--featured { font-weight: 700; color: var(--primary, #1e40af); font-size: 15px; }
.info-value--warn { color: #b45309; }
.mono { font-family: monospace; font-size: 12px; }
.moneda-tag {
  font-size: 10px;
  font-weight: 600;
  margin-left: 4px;
  background: var(--surface-0, #fff);
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--text-2);
}

.desc-larga {
  margin: 0;
  font-size: 13px;
  color: var(--text-1, #334155);
  line-height: 1.6;
  white-space: pre-wrap;
}

.sub-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-2);
  margin: 8px 0 4px;
}

.impuestos-list { display: flex; flex-direction: column; gap: 4px; }
.imp-chip {
  font-size: 12px;
  background: var(--surface-0, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 6px;
  padding: 3px 8px;
  color: var(--text-1);
}

.conversiones { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
.conv-row {
  font-size: 12px;
  font-family: monospace;
  color: var(--text-1);
  background: var(--surface-0, #fff);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
}

/* Inner tables */
.inner-table { border-radius: var(--radius-sm, 6px); overflow: hidden; }
.inner-table :deep(.ant-table-thead > tr > th) {
  background: var(--surface-0, #fff);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-2);
}

/* Kardex qty */
.qty-in       { color: #15803d; font-weight: 700; font-variant-numeric: tabular-nums; }
.qty-out      { color: #b91c1c; font-weight: 700; font-variant-numeric: tabular-nums; }
.qty-zero     { color: var(--text-2, #94a3b8); }
.qty-saldo    { font-weight: 700; font-variant-numeric: tabular-nums; }
.qty-negative { color: #b91c1c; font-weight: 700; font-variant-numeric: tabular-nums; }

/* ── Pestaña Proveedores ─────────────────────────────────── */
.prov-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.prov-count { font-size: 13px; color: var(--text-2, #64748b); }

.prov-list { display: flex; flex-direction: column; gap: 12px; }

.prov-card {
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  transition: box-shadow .15s;
}
.prov-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); }
.prov-card--fuente { border-color: #f59e0b; border-left: 4px solid #f59e0b; }

.prov-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface-1, #f8fafc);
  border-bottom: 1px solid var(--border, #f0f0f0);
  flex-wrap: wrap;
  gap: 8px;
}
.prov-identity { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.prov-name     { font-size: 14px; font-weight: 700; color: var(--text-0); }
.prov-fantasia { font-size: 12px; color: var(--text-2); }
.prov-cod-sys  {
  font-family: monospace;
  font-size: 11px;
  background: var(--surface-0, #fff);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--text-2);
}
.prov-badges { display: flex; gap: 6px; flex-wrap: wrap; }

.prov-card-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.prov-field { display: flex; align-items: baseline; gap: 10px; }
.prov-field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .04em;
  min-width: 160px;
  flex-shrink: 0;
}
.prov-field-value { font-size: 13px; color: var(--text-0); }

.prov-card-actions {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid var(--border, #f0f0f0);
  background: var(--surface-1, #f8fafc);
}
.btn-star { color: #b45309; }
.btn-star:hover { background: #fef3c7 !important; }
.btn-edit { color: #6366f1; }
.btn-edit:hover { background: #f5f3ff !important; }

/* Drawer */
.drawer-fields { display: flex; flex-direction: column; gap: 18px; }
.field         { display: flex; flex-direction: column; gap: 5px; }
.field-label   { font-size: 12px; font-weight: 600; color: var(--text-1); }
.field-label.req::after { content: ' *'; color: #ef4444; }
.field-hint    { font-size: 11px; color: var(--text-2); margin-top: 2px; }
.drawer-footer { display: flex; justify-content: flex-end; gap: 8px; }
</style>
