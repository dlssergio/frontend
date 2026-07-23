<script setup>
/**
 * ClienteCuentaCorrienteView.vue
 *
 * Vista completa de Cuenta Corriente del cliente.
 * Consume: GET /api/clientes-admin/<id>/cuenta-corriente/
 *
 * Secciones:
 *  1. Header con datos del cliente y acciones
 *  2. Tarjetas KPI (saldo, deuda vencida, límite, crédito disponible)
 *  3. Antigüedad de deuda (aging)
 *  4. KPIs comerciales (ventas 30d, 90d, ticket promedio)
 *  5. Movimientos Cuenta Corriente — tabla paginada con filtros
 *  6. Comprobantes con saldo pendiente
 *  7. Recibos de cobro con detalle (imputaciones + medios de pago)
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PrinterOutlined,
  SendOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  FilePdfOutlined,
  EyeOutlined,
  RightOutlined,
  DownOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import { imprimirEstadoCuenta as generarEstadoCuenta } from '@/utils/estadoCuentaImprimible'

const route  = useRoute()
const router = useRouter()

const clienteId = computed(() => route.params.id)

// ── State ──────────────────────────────────────────────────────────────────
const loading         = ref(false)
const cuentaData      = ref(null)
const error           = ref(null)

// Filtros
const filtros = ref({
  fecha_desde: '',
  fecha_hasta: '',
  tipo: '',          // '' | 'comprobante' | 'recibo'
})
const filtrosVisible  = ref(false)

// Paginación movimientos
const paginaActual    = ref(1)
const filasPorPagina  = ref(50)

// UI estado
const seccionActiva   = ref('movimientos') // 'movimientos' | 'impagos' | 'recibos'
const reciboExpandido = ref(null)          // id del recibo con detalle visible

// Modal email
const emailModalOpen  = ref(false)
const emailDestino    = ref('')
const enviandoEmail   = ref(false)

// ── Shortcuts a datos ──────────────────────────────────────────────────────
const cliente           = computed(() => cuentaData.value?.cliente || null)
const resumen           = computed(() => cuentaData.value?.resumen || null)
const movimientos       = computed(() => cuentaData.value?.movimientos || [])
const paginacion        = computed(() => cuentaData.value?.paginacion || {})
const comprobantesImpagos = computed(() => cuentaData.value?.comprobantes_impagos || [])
const recibos           = computed(() => cuentaData.value?.recibos || [])

// ── Helpers formato ────────────────────────────────────────────────────────
const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmt = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return iso }
}

const pct = (parte, total) => {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((parte / total) * 100))
}

// ── Riesgo ─────────────────────────────────────────────────────────────────
const riesgoColor = computed(() => {
  const r = resumen.value?.riesgo
  if (r === 'EXCEDIDO')    return 'error'
  if (r === 'SEGUIMIENTO') return 'warning'
  return 'success'
})

const riesgoLabel = computed(() => {
  const r = resumen.value?.riesgo
  if (r === 'EXCEDIDO')    return 'Límite excedido'
  if (r === 'SEGUIMIENTO') return 'En seguimiento'
  return 'Normal'
})

const creditoPct = computed(() => {
  const r = resumen.value
  if (!r) return 0
  return pct(r.saldo_total, r.limite_credito)
})

// ── Aging ──────────────────────────────────────────────────────────────────
const agingRows = computed(() => {
  const a = resumen.value?.aging
  if (!a) return []
  return [
    { label: '0 – 30 días',  value: a.bucket_0_30,    color: '#10b981' },
    { label: '31 – 60 días', value: a.bucket_31_60,   color: '#f59e0b' },
    { label: '61 – 90 días', value: a.bucket_61_90,   color: '#f97316' },
    { label: '+ 90 días',    value: a.bucket_90_plus, color: '#ef4444' },
  ].filter(r => r.value > 0)
})

const maxAging = computed(() =>
  Math.max(...agingRows.value.map(r => r.value), 1)
)

// ── Data fetch ─────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  error.value   = null
  try {
    const params = {
      page:      paginaActual.value,
      page_size: filasPorPagina.value,
    }
    if (filtros.value.fecha_desde) params.fecha_desde = filtros.value.fecha_desde
    if (filtros.value.fecha_hasta) params.fecha_hasta = filtros.value.fecha_hasta
    if (filtros.value.tipo)        params.tipo        = filtros.value.tipo

    const { data } = await api.get(
      `/api/clientes-admin/${clienteId.value}/cuenta-corriente/`,
      { params }
    )
    cuentaData.value = data
  } catch (e) {
    error.value = e?.response?.data?.detail || 'No se pudo cargar la cuenta corriente.'
  } finally {
    loading.value = false
  }
}

// Cuando cambia la página recargamos
watch(paginaActual, fetchData)
watch(filasPorPagina, () => { paginaActual.value = 1; fetchData() })

const aplicarFiltros = () => {
  paginaActual.value = 1
  fetchData()
}

const limpiarFiltros = () => {
  filtros.value = { fecha_desde: '', fecha_hasta: '', tipo: '' }
  paginaActual.value = 1
  fetchData()
}

const hayFiltrosActivos = computed(() =>
  filtros.value.fecha_desde || filtros.value.fecha_hasta || filtros.value.tipo
)

// ── PDF comprobante ─────────────────────────────────────────────────────────
const abrirPdf = async (id) => {
  try {
    const res = await api.get(`/api/comprobantes-venta/${id}/pdf/`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const win = window.open(url, '_blank')
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
    else setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { message.error('No se pudo abrir el PDF') }
}

// ── Imprimir ────────────────────────────────────────────────────────────────
const imprimirEstadoCuenta = () => generarEstadoCuenta(clienteId.value, api)

// ── Email ───────────────────────────────────────────────────────────────────
const abrirEmailModal = () => {
  emailDestino.value = cliente.value?.email || ''
  emailModalOpen.value = true
}

const enviarEmailEstadoCuenta = async () => {
  enviandoEmail.value = true
  try {
    const payload = emailDestino.value.trim() ? { email: emailDestino.value.trim() } : {}
    const { data } = await api.post(
      `/api/clientes-admin/${clienteId.value}/enviar-estado-cuenta/`,
      payload
    )
    message.success(data.mensaje || 'Estado de cuenta enviado correctamente')
    emailModalOpen.value = false
  } catch (e) {
    message.error(e?.response?.data?.error || 'Error al enviar el email')
  } finally {
    enviandoEmail.value = false
  }
}

// ── Estado pago label ───────────────────────────────────────────────────────
const estadoPagoTag = (item) => {
  const ep = item.estado_pago || (item.saldo_pendiente <= 0 ? 'PAGADO' : 'IMPAGO')
  if (ep === 'PAGADO')  return { color: 'success', label: 'Pagado' }
  if (ep === 'PARCIAL') return { color: 'warning', label: 'Parcial' }
  return                       { color: 'error',   label: 'Pendiente' }
}

onMounted(fetchData)
</script>

<template>
  <div class="cc-root">

    <!-- ─── Header ──────────────────────────────────────────────────────── -->
    <div class="cc-header">
      <a-button type="text" class="cc-back" @click="router.back()">
        <ArrowLeftOutlined /> Volver
      </a-button>

      <div class="cc-header-info">
        <div class="cc-header-avatar">
          {{ (cliente?.razon_social || '?')[0].toUpperCase() }}
        </div>
        <div>
          <h1 class="cc-title">
            {{ cliente?.razon_social || `Cliente #${clienteId}` }}
          </h1>
          <div class="cc-meta">
            <span v-if="cliente?.cuit" class="cc-chip">CUIT {{ cliente.cuit }}</span>
            <span v-if="cliente?.codigo_cliente" class="cc-chip cc-chip--blue">
              {{ cliente.codigo_cliente }}
            </span>
            <span v-if="cliente?.permite_cta_cte" class="cc-chip cc-chip--green">
              Cta. Cte. habilitada
            </span>
            <span v-else class="cc-chip cc-chip--gray">Solo contado</span>
          </div>
        </div>
      </div>

      <div class="cc-header-actions">
        <a-button @click="imprimirEstadoCuenta" title="Imprimir estado de cuenta">
          <PrinterOutlined /> Imprimir
        </a-button>
        <a-button @click="abrirEmailModal" title="Enviar por email">
          <SendOutlined /> Email
        </a-button>
        <a-button :loading="loading" @click="fetchData">
          <ReloadOutlined />
        </a-button>
      </div>
    </div>

    <!-- ─── Error ────────────────────────────────────────────────────────── -->
    <a-alert v-if="error" :message="error" type="error" show-icon
      style="margin-bottom:16px" />

    <a-spin :spinning="loading">
      <template v-if="cuentaData">

        <!-- ─── KPI Cards ────────────────────────────────────────────────── -->
        <div class="kpi-grid">

          <!-- Saldo total -->
          <div class="kpi" :class="`kpi--${riesgoColor}`">
            <div class="kpi-icon"><DollarOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Saldo total</div>
              <div class="kpi-val">${{ money(resumen?.saldo_total) }}</div>
              <div class="kpi-foot">
                <a-tag :color="riesgoColor === 'error' ? 'error' : riesgoColor === 'warning' ? 'warning' : 'success'" size="small">
                  <WarningOutlined v-if="riesgoColor === 'error'" />
                  <ExclamationCircleOutlined v-else-if="riesgoColor === 'warning'" />
                  <CheckCircleOutlined v-else />
                  {{ riesgoLabel }}
                </a-tag>
              </div>
            </div>
          </div>

          <!-- Deuda vencida -->
          <div class="kpi" :class="resumen?.deuda_vencida > 0 ? 'kpi--error' : 'kpi--ok'">
            <div class="kpi-icon"><ClockCircleOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Deuda vencida</div>
              <div class="kpi-val" :class="resumen?.deuda_vencida > 0 ? 'kpi-val--red' : ''">
                ${{ money(resumen?.deuda_vencida) }}
              </div>
              <div class="kpi-foot">
                <span class="kpi-sub">No vencida: ${{ money(resumen?.deuda_no_vencida) }}</span>
              </div>
            </div>
          </div>

          <!-- Límite de crédito -->
          <div class="kpi">
            <div class="kpi-icon"><BarChartOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Límite de crédito</div>
              <div class="kpi-val">${{ money(resumen?.limite_credito) }}</div>
              <div class="kpi-credit-bar">
                <div class="kpi-credit-track">
                  <div
                    class="kpi-credit-fill"
                    :class="creditoPct >= 100 ? 'kpi-credit-fill--over' : creditoPct >= 80 ? 'kpi-credit-fill--warn' : ''"
                    :style="{ width: `${Math.min(creditoPct, 100)}%` }"
                  />
                </div>
                <span class="kpi-credit-pct">{{ creditoPct }}% usado</span>
              </div>
            </div>
          </div>

          <!-- Crédito disponible -->
          <div class="kpi" :class="(resumen?.credito_disponible || 0) < 0 ? 'kpi--error' : 'kpi--ok'">
            <div class="kpi-icon"><CheckCircleOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Crédito disponible</div>
              <div class="kpi-val" :class="(resumen?.credito_disponible || 0) < 0 ? 'kpi-val--red' : 'kpi-val--green'">
                ${{ money(resumen?.credito_disponible) }}
              </div>
              <div class="kpi-foot">
                <span class="kpi-sub">
                  {{ resumen?.comprobantes_impagos }} comprobante{{ resumen?.comprobantes_impagos !== 1 ? 's' : '' }} impago{{ resumen?.comprobantes_impagos !== 1 ? 's' : '' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Ventas 30 días -->
          <div class="kpi">
            <div class="kpi-icon"><FileTextOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Ventas últimos 30 días</div>
              <div class="kpi-val">${{ money(resumen?.kpis?.total_vendido_30d) }}</div>
              <div class="kpi-foot">
                <span class="kpi-sub">
                  {{ resumen?.kpis?.count_30d || 0 }} comprobante{{ resumen?.kpis?.count_30d !== 1 ? 's' : '' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Ticket promedio + días sin comprar -->
          <div class="kpi">
            <div class="kpi-icon"><BarChartOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Ticket promedio 90d</div>
              <div class="kpi-val">${{ money(resumen?.kpis?.ticket_promedio_90d) }}</div>
              <div class="kpi-foot">
                <span class="kpi-sub" v-if="resumen?.kpis?.dias_desde_ultima_compra != null">
                  Última compra hace {{ resumen.kpis.dias_desde_ultima_compra }} días
                </span>
              </div>
            </div>
          </div>

        </div>

        <!-- ─── Aging ─────────────────────────────────────────────────────── -->
        <div v-if="agingRows.length" class="card">
          <div class="card-title"><ClockCircleOutlined /> Antigüedad de deuda vencida</div>
          <div class="aging-list">
            <div v-for="row in agingRows" :key="row.label" class="aging-row">
              <span class="aging-label">{{ row.label }}</span>
              <div class="aging-bar-wrap">
                <div
                  class="aging-bar-fill"
                  :style="{ width: `${(row.value / maxAging) * 100}%`, background: row.color }"
                />
              </div>
              <span class="aging-val">${{ money(row.value) }}</span>
            </div>
          </div>
        </div>

        <!-- ─── Tabs secciones ────────────────────────────────────────────── -->
        <div class="section-tabs">
          <button
            class="section-tab"
            :class="{ 'section-tab--active': seccionActiva === 'movimientos' }"
            @click="seccionActiva = 'movimientos'"
          >
            <DollarOutlined /> Movimientos
            <span class="section-tab-badge">{{ paginacion?.total || 0 }}</span>
          </button>
          <button
            class="section-tab"
            :class="{ 'section-tab--active': seccionActiva === 'impagos' }"
            @click="seccionActiva = 'impagos'"
          >
            <ExclamationCircleOutlined /> Comprobantes impagos
            <span
              class="section-tab-badge"
              :class="comprobantesImpagos.length > 0 ? 'section-tab-badge--red' : ''"
            >
              {{ comprobantesImpagos.length }}
            </span>
          </button>
          <button
            class="section-tab"
            :class="{ 'section-tab--active': seccionActiva === 'recibos' }"
            @click="seccionActiva = 'recibos'"
          >
            <CheckCircleOutlined /> Recibos de cobro
            <span class="section-tab-badge">{{ recibos.length }}</span>
          </button>
        </div>

        <!-- ─── SECCIÓN: Movimientos ──────────────────────────────────────── -->
        <div v-show="seccionActiva === 'movimientos'" class="card card--no-top-radius">

          <!-- Filtros -->
          <div class="movs-toolbar">
            <div class="movs-toolbar-left">
              <a-button
                :type="filtrosVisible ? 'primary' : 'default'"
                ghost
                @click="filtrosVisible = !filtrosVisible"
              >
                <FilterOutlined />
                Filtros
                <a-badge v-if="hayFiltrosActivos" dot style="margin-left:4px" />
              </a-button>
              <a-button
                v-if="hayFiltrosActivos"
                type="text"
                danger
                size="small"
                @click="limpiarFiltros"
              >
                <CloseCircleOutlined /> Limpiar filtros
              </a-button>
            </div>
            <div class="movs-toolbar-right">
              <span class="movs-total-label">
                {{ paginacion?.total || 0 }} movimientos
              </span>
            </div>
          </div>

          <!-- Panel filtros -->
          <div v-if="filtrosVisible" class="filtros-panel">
            <div class="filtros-row">
              <div class="filtros-item">
                <label class="filtros-label">Desde</label>
                <a-input
                  v-model:value="filtros.fecha_desde"
                  type="date"
                  size="small"
                  style="width:150px"
                />
              </div>
              <div class="filtros-item">
                <label class="filtros-label">Hasta</label>
                <a-input
                  v-model:value="filtros.fecha_hasta"
                  type="date"
                  size="small"
                  style="width:150px"
                />
              </div>
              <div class="filtros-item">
                <label class="filtros-label">Tipo</label>
                <a-select
                  v-model:value="filtros.tipo"
                  size="small"
                  style="width:160px"
                  :options="[
                    { value: '', label: 'Todos' },
                    { value: 'comprobante', label: 'Comprobantes' },
                    { value: 'recibo', label: 'Recibos' },
                  ]"
                />
              </div>
              <a-button type="primary" size="small" @click="aplicarFiltros">
                Aplicar
              </a-button>
            </div>
          </div>

          <!-- Tabla movimientos -->
          <a-table
            :data-source="movimientos"
            :pagination="false"
            size="small"
            :row-key="(r, i) => `${r.clase}-${r.id}-${i}`"
            :scroll="{ x: 700 }"
          >
            <a-table-column title="Fecha" data-index="fecha" width="100"
              :customRender="({ text }) => fmt(text)" />

            <a-table-column title="Tipo" data-index="tipo" width="140">
              <template #default="{ record }">
                <span
                  class="mov-badge"
                  :class="record.clase === 'recibo' ? 'mov-badge--recibo' : 'mov-badge--comp'"
                >
                  {{ record.tipo }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Número" data-index="numero">
              <template #default="{ record }">
                <span class="mov-numero">{{ record.numero }}</span>
              </template>
            </a-table-column>

            <a-table-column title="Debe" data-index="debe" align="right" width="130">
              <template #default="{ record }">
                <span v-if="record.debe > 0" class="text-debe">
                  ${{ money(record.debe) }}
                </span>
                <span v-else class="text-empty">—</span>
              </template>
            </a-table-column>

            <a-table-column title="Haber" data-index="haber" align="right" width="130">
              <template #default="{ record }">
                <span v-if="record.haber > 0" class="text-haber">
                  ${{ money(record.haber) }}
                </span>
                <span v-else class="text-empty">—</span>
              </template>
            </a-table-column>

            <a-table-column title="Saldo acum." data-index="saldo" align="right" width="140">
              <template #default="{ record }">
                <span :class="record.saldo > 0 ? 'text-deuda' : 'text-ok'">
                  ${{ money(record.saldo) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="" width="48" align="center">
              <template #default="{ record }">
                <a-tooltip v-if="record.clase === 'comprobante'" title="Ver PDF">
                  <a-button type="text" size="small" @click="abrirPdf(record.ref_id)">
                    <FilePdfOutlined />
                  </a-button>
                </a-tooltip>
              </template>
            </a-table-column>
          </a-table>

          <!-- Fila total visible -->
          <div class="movs-total-row">
            <span>SALDO FINAL</span>
            <span class="movs-saldo-final" :class="(resumen?.saldo_total || 0) > 0 ? 'text-deuda' : 'text-ok'">
              ${{ money(resumen?.saldo_total) }}
            </span>
          </div>

          <!-- Paginación -->
          <div class="movs-pagination" v-if="paginacion?.total_pages > 1">
            <a-pagination
              v-model:current="paginaActual"
              :total="paginacion?.total || 0"
              :page-size="filasPorPagina"
              :page-size-options="['20', '50', '100', '200']"
              show-size-changer
              show-quick-jumper
              :show-total="(total, range) => `${range[0]}–${range[1]} de ${total}`"
              @change="(p) => { paginaActual = p }"
              @showSizeChange="(_, size) => { filasPorPagina = size; paginaActual = 1 }"
            />
          </div>

        </div>

        <!-- ─── SECCIÓN: Comprobantes impagos ─────────────────────────────── -->
        <div v-show="seccionActiva === 'impagos'" class="card card--no-top-radius">

          <div v-if="comprobantesImpagos.length === 0" class="empty-state">
            <CheckCircleOutlined class="empty-icon empty-icon--ok" />
            <p>Sin comprobantes pendientes de pago</p>
          </div>

          <a-table
            v-else
            :data-source="comprobantesImpagos"
            :pagination="{ pageSize: 20, showSizeChanger: true }"
            size="small"
            :row-key="r => r.id"
            :scroll="{ x: 900 }"
          >
            <a-table-column title="Fecha" data-index="fecha" width="100"
              :customRender="({ text }) => fmt(text)" />

            <a-table-column title="Tipo" data-index="tipo" width="140" />

            <a-table-column title="Número" data-index="numero">
              <template #default="{ record }">
                <span class="mov-numero">{{ record.numero }}</span>
              </template>
            </a-table-column>

            <a-table-column title="Vencimiento" width="110">
              <template #default="{ record }">
                <span :class="record.vencido ? 'text-deuda' : ''">
                  {{ fmt(record.fecha_vencimiento) }}
                </span>
              </template>
            </a-table-column>

            <a-table-column title="Mora" width="80" align="center">
              <template #default="{ record }">
                <a-tag v-if="record.dias_mora > 0" color="error" size="small">
                  {{ record.dias_mora }}d
                </a-tag>
                <a-tag v-else color="success" size="small">Al día</a-tag>
              </template>
            </a-table-column>

            <a-table-column title="Total" data-index="total" align="right" width="120"
              :customRender="({ text }) => `$${money(text)}`" />

            <a-table-column title="Pagado" data-index="pagado" align="right" width="120">
              <template #default="{ record }">
                <span class="text-ok">${{ money(record.pagado) }}</span>
              </template>
            </a-table-column>

            <a-table-column title="Saldo" data-index="saldo_pendiente" align="right" width="120">
              <template #default="{ record }">
                <span class="text-deuda font-bold">${{ money(record.saldo_pendiente) }}</span>
              </template>
            </a-table-column>

            <a-table-column title="Estado" width="100" align="center">
              <template #default="{ record }">
                <a-tag :color="estadoPagoTag(record).color">
                  {{ estadoPagoTag(record).label }}
                </a-tag>
              </template>
            </a-table-column>

            <a-table-column title="" width="50" align="center">
              <template #default="{ record }">
                <a-tooltip title="Ver PDF">
                  <a-button type="text" size="small" @click="abrirPdf(record.id)">
                    <FilePdfOutlined />
                  </a-button>
                </a-tooltip>
              </template>
            </a-table-column>

          </a-table>

          <!-- Total saldo pendiente -->
          <div v-if="comprobantesImpagos.length > 0" class="movs-total-row">
            <span>TOTAL PENDIENTE</span>
            <span class="movs-saldo-final text-deuda">
              ${{ money(resumen?.saldo_total) }}
            </span>
          </div>

        </div>

        <!-- ─── SECCIÓN: Recibos ──────────────────────────────────────────── -->
        <div v-show="seccionActiva === 'recibos'" class="card card--no-top-radius">

          <div v-if="recibos.length === 0" class="empty-state">
            <FileTextOutlined class="empty-icon" />
            <p>Sin recibos registrados</p>
          </div>

          <div v-else class="recibos-list">
            <div
              v-for="rec in recibos"
              :key="rec.id"
              class="recibo-item"
              :class="{ 'recibo-item--open': reciboExpandido === rec.id }"
            >
              <!-- Cabecera del recibo -->
              <div class="recibo-header" @click="reciboExpandido = reciboExpandido === rec.id ? null : rec.id">
                <div class="recibo-header-left">
                  <span class="recibo-num">{{ rec.numero }}</span>
                  <span class="recibo-fecha">{{ fmt(rec.fecha) }}</span>
                  <span class="recibo-origen-badge">{{ rec.origen_label }}</span>
                </div>
                <div class="recibo-header-right">
                  <span class="recibo-monto">${{ money(rec.monto_total) }}</span>
                  <a-button type="text" size="small" class="recibo-toggle">
                    <DownOutlined v-if="reciboExpandido === rec.id" />
                    <RightOutlined v-else />
                  </a-button>
                </div>
              </div>

              <!-- Detalle expandible -->
              <div v-if="reciboExpandido === rec.id" class="recibo-detail">

                <!-- Imputaciones -->
                <div class="recibo-section">
                  <div class="recibo-section-title">Comprobantes cancelados</div>
                  <div v-if="rec.imputaciones.length === 0" class="recibo-empty">
                    Sin imputaciones
                  </div>
                  <div v-else class="recibo-table">
                    <div class="recibo-table-head">
                      <span>Tipo</span>
                      <span>Número</span>
                      <span class="text-right">Monto imputado</span>
                    </div>
                    <div
                      v-for="(imp, i) in rec.imputaciones"
                      :key="i"
                      class="recibo-table-row"
                    >
                      <span>{{ imp.comp_tipo }}</span>
                      <span class="mov-numero">{{ imp.comp_numero }}</span>
                      <span class="text-right text-ok">${{ money(imp.monto) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Medios de pago -->
                <div class="recibo-section">
                  <div class="recibo-section-title">Medios de pago</div>
                  <div v-if="rec.valores.length === 0" class="recibo-empty">
                    Sin detalle de valores
                  </div>
                  <div v-else class="recibo-table">
                    <div class="recibo-table-head">
                      <span>Tipo</span>
                      <span>Cuenta / Destino</span>
                      <span>Referencia</span>
                      <span class="text-right">Monto</span>
                    </div>
                    <div
                      v-for="(val, i) in rec.valores"
                      :key="i"
                      class="recibo-table-row"
                    >
                      <span class="recibo-tipo-valor">{{ val.tipo }}</span>
                      <span>{{ val.destino }}</span>
                      <span class="text-muted">{{ val.referencia || '—' }}</span>
                      <span class="text-right font-bold">${{ money(val.monto) }}</span>
                    </div>
                  </div>
                </div>

                <!-- Observaciones + creado por -->
                <div v-if="rec.observaciones || rec.creado_por" class="recibo-footer-detail">
                  <span v-if="rec.observaciones" class="text-muted">
                    Obs: {{ rec.observaciones }}
                  </span>
                  <span v-if="rec.creado_por" class="text-muted">
                    Registrado por: {{ rec.creado_por }}
                  </span>
                </div>

              </div>
            </div>
          </div>
        </div>

      </template>
    </a-spin>

    <!-- ─── Modal email ──────────────────────────────────────────────────── -->
    <a-modal
      v-model:open="emailModalOpen"
      title="Enviar estado de cuenta por email"
      ok-text="Enviar"
      cancel-text="Cancelar"
      :confirm-loading="enviandoEmail"
      @ok="enviarEmailEstadoCuenta"
    >
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
        <p style="margin:0;color:var(--text-1,#334155);font-size:13px">
          Estado de cuenta de
          <strong>{{ cliente?.razon_social }}</strong>
        </p>
        <a-input
          v-model:value="emailDestino"
          placeholder="email@ejemplo.com"
          type="email"
          size="large"
        />
        <p style="margin:0;font-size:11.5px;color:var(--text-2,#64748b)">
          Podés modificar el destinatario. Si se deja vacío se usará el email del cliente.
        </p>
      </div>
    </a-modal>

  </div>
</template>

<style scoped>
/* ── Root ────────────────────────────────────────────────────────────────── */
.cc-root {
  padding: 20px 24px;
  max-width: 1280px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.cc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.cc-back { flex-shrink: 0; }
.cc-header-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.cc-header-avatar {
  width: 46px; height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary, #1677ff) 0%, #0ea5e9 100%);
  color: #fff;
  font-size: 20px;
  font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.25);
}
.cc-title {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
  color: var(--text-0, #0f172a);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 3px;
}
.cc-chip {
  padding: 1px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.12);
  color: var(--text-2, #64748b);
  border: 1px solid rgba(148, 163, 184, 0.2);
  font-family: ui-monospace, monospace;
}
.cc-chip--blue  { background: rgba(22, 119, 255, 0.08); color: var(--primary, #1677ff); border-color: rgba(22,119,255,.15); }
.cc-chip--green { background: rgba(16, 185, 129, 0.08); color: #10b981; border-color: rgba(16,185,129,.15); }
.cc-chip--gray  { background: rgba(148,163,184,.08);    color: #94a3b8; border-color: rgba(148,163,184,.15); }

.cc-header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ── KPI Grid ────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 560px) { .kpi-grid { grid-template-columns: 1fr; } }

.kpi {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 10px;
  padding: 14px 16px;
  border-top: 3px solid transparent;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: box-shadow .15s;
}
.kpi:hover { box-shadow: 0 4px 16px rgba(0,0,0,.06); }
.kpi--error   { border-top-color: #ef4444; }
.kpi--warning { border-top-color: #f59e0b; }
.kpi--success,
.kpi--ok      { border-top-color: #10b981; }

.kpi-icon {
  font-size: 20px;
  color: var(--text-2, #64748b);
  opacity: 0.5;
  flex-shrink: 0;
  padding-top: 2px;
}
.kpi-body { flex: 1; min-width: 0; }
.kpi-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-2, #64748b);
  margin-bottom: 4px;
}
.kpi-val {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  margin-bottom: 5px;
}
.kpi-val--red   { color: #ef4444; }
.kpi-val--green { color: #10b981; }
.kpi-foot  { display: flex; align-items: center; gap: 6px; }
.kpi-sub   { font-size: 11px; color: var(--text-2, #64748b); }

.kpi-credit-bar { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.kpi-credit-track {
  flex: 1; height: 5px;
  background: rgba(148,163,184,.15);
  border-radius: 3px; overflow: hidden;
}
.kpi-credit-fill {
  height: 100%; background: #10b981;
  border-radius: 3px; transition: width .4s ease;
}
.kpi-credit-fill--warn { background: #f59e0b; }
.kpi-credit-fill--over { background: #ef4444; }
.kpi-credit-pct { font-size: 11px; font-weight: 700; color: var(--text-2,#64748b); white-space: nowrap; }

/* ── Aging ───────────────────────────────────────────────────────────────── */
.aging-list { display: flex; flex-direction: column; gap: 10px; }
.aging-row  { display: flex; align-items: center; gap: 12px; }
.aging-label { width: 100px; font-size: 12px; font-weight: 600; color: var(--text-1,#334155); flex-shrink: 0; }
.aging-bar-wrap { flex: 1; height: 10px; background: rgba(148,163,184,.12); border-radius: 5px; overflow: hidden; }
.aging-bar-fill { height: 100%; border-radius: 5px; transition: width .4s ease; }
.aging-val { width: 130px; text-align: right; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-0,#0f172a); flex-shrink: 0; }

/* ── Card genérico ───────────────────────────────────────────────────────── */
.card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.card--no-top-radius { border-top-left-radius: 0; border-top-right-radius: 0; border-top: none; }
.card-title {
  font-size: 11.5px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-2, #64748b);
  margin-bottom: 14px;
  display: flex; align-items: center; gap: 7px;
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.section-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 10px 10px 0 0;
  overflow: hidden;
  margin-bottom: 0;
}
.section-tab {
  flex: 1;
  padding: 10px 16px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-2, #64748b);
  background: var(--surface-2, #f8fafc);
  border: none;
  border-right: 1px solid var(--border, rgba(148,163,184,.2));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: background .12s, color .12s;
}
.section-tab:last-child { border-right: none; }
.section-tab:hover { background: var(--surface-1, #fff); color: var(--text-0, #0f172a); }
.section-tab--active {
  background: var(--surface-1, #fff);
  color: var(--primary, #1677ff);
  box-shadow: inset 0 -2px 0 var(--primary, #1677ff);
}
.section-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px; height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(148,163,184,.15);
  color: var(--text-2, #64748b);
}
.section-tab-badge--red {
  background: rgba(239, 68, 68, .1);
  color: #ef4444;
}

/* ── Toolbar movimientos ────────────────────────────────────────────────── */
.movs-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.movs-toolbar-left { display: flex; gap: 8px; align-items: center; }
.movs-toolbar-right { }
.movs-total-label { font-size: 12px; color: var(--text-2,#64748b); }

.filtros-panel {
  background: var(--surface-2, #f8fafc);
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.filtros-row { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.filtros-item { display: flex; flex-direction: column; gap: 4px; }
.filtros-label { font-size: 11px; font-weight: 600; color: var(--text-2,#64748b); text-transform: uppercase; letter-spacing: .05em; }

/* ── Tabla helpers ───────────────────────────────────────────────────────── */
.mov-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .03em;
}
.mov-badge--comp   { background: #dbeafe; color: #1e40af; }
.mov-badge--recibo { background: #dcfce7; color: #166534; }

.mov-numero { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--text-1,#334155); }

.text-debe  { color: #ef4444; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-haber { color: #10b981; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-deuda { color: #ef4444; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-ok    { color: #10b981; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-empty { color: var(--text-2,#64748b); opacity: 0.5; }
.text-muted { color: var(--text-2,#64748b); font-size: 11.5px; }
.font-bold  { font-weight: 700; }
.text-right { text-align: right; }

.movs-total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 8px 4px;
  border-top: 2px solid var(--border, rgba(148,163,184,.2));
  font-weight: 800;
  font-size: 13px;
  color: var(--text-0, #0f172a);
  margin-top: 4px;
}
.movs-saldo-final { font-size: 15px; }

.movs-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-2,#64748b);
}
.empty-icon { font-size: 40px; opacity: 0.3; display: block; margin-bottom: 10px; }
.empty-icon--ok { color: #10b981; opacity: 0.6; }

/* ── Recibos ─────────────────────────────────────────────────────────────── */
.recibos-list { display: flex; flex-direction: column; gap: 8px; }

.recibo-item {
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow .12s;
}
.recibo-item:hover { box-shadow: 0 2px 10px rgba(0,0,0,.06); }
.recibo-item--open { border-color: var(--primary, #1677ff); }

.recibo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  cursor: pointer;
  background: var(--surface-2, #f8fafc);
  transition: background .1s;
  gap: 12px;
}
.recibo-header:hover { background: var(--surface-1, #fff); }
.recibo-item--open .recibo-header { background: rgba(22,119,255,.04); }

.recibo-header-left  { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.recibo-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.recibo-num {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-0, #0f172a);
}
.recibo-fecha { font-size: 12px; color: var(--text-2, #64748b); }
.recibo-origen-badge {
  padding: 1px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(22,119,255,.08);
  color: var(--primary, #1677ff);
}
.recibo-monto {
  font-size: 14px;
  font-weight: 900;
  color: #10b981;
  font-variant-numeric: tabular-nums;
}
.recibo-toggle { color: var(--text-2, #64748b); }

.recibo-detail {
  padding: 14px 16px;
  background: var(--surface-1, #fff);
  border-top: 1px solid var(--border, rgba(148,163,184,.15));
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.recibo-section {}
.recibo-section-title {
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--text-2, #64748b);
  margin-bottom: 8px;
}
.recibo-empty { font-size: 12px; color: var(--text-2,#64748b); font-style: italic; }

.recibo-table { border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 6px; overflow: hidden; }
.recibo-table-head,
.recibo-table-row {
  display: grid;
  grid-template-columns: 1.2fr 1.8fr 1fr 1fr;
  gap: 0;
}
.recibo-table-head {
  background: var(--surface-2, #f8fafc);
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-2, #64748b);
}
.recibo-table-head span,
.recibo-table-row span { padding: 0 6px; }
.recibo-table-row {
  padding: 7px 10px;
  font-size: 12px;
  border-top: 1px solid var(--border, rgba(148,163,184,.1));
  align-items: center;
}
.recibo-table-row:nth-child(even) { background: var(--surface-2, #f8fafc); }
.recibo-tipo-valor { font-weight: 600; color: var(--text-0, #0f172a); }

.recibo-footer-detail {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  padding-top: 4px;
  border-top: 1px dashed var(--border, rgba(148,163,184,.2));
}
</style>
