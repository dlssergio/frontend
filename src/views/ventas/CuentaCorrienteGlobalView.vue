<script setup>
/**
 * CuentaCorrienteGlobalView.vue
 * Gestión global de Cuenta Corriente de Clientes
 *
 * Tabs:
 *   1. Cartera (saldos a una fecha)      → GET /api/clientes-admin/resumen-cartera/?fecha_hasta=
 *   2. Estado de cuenta (por cliente)    → GET /api/clientes-admin/<pk>/cuenta-corriente/
 *   3. Resumen de cuenta (por cliente)   → GET /api/clientes-admin/<pk>/cuenta-corriente/?modo=resumen
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ReloadOutlined, SearchOutlined, SendOutlined, EyeOutlined,
  DollarOutlined, WarningOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, TeamOutlined, PrinterOutlined,
  FileTextOutlined, BarChartOutlined, FilterOutlined,
  CloseCircleOutlined, DownOutlined, RightOutlined,
  CalendarOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'

const router = useRouter()

// ── Tabs ───────────────────────────────────────────────────────────────────
const tabActivo = ref('cartera')  // 'cartera' | 'extracto' | 'resumen'

// ══════════════════════════════════════════════════════════════════════════
// TAB 1: CARTERA — todos los clientes a una fecha de corte
// ══════════════════════════════════════════════════════════════════════════
const cargandoCartera  = ref(false)
const carteraData      = ref(null)  // { results, totales }
const selectedRowKeys  = ref([])

const filtrosCartera = ref({
  fecha_hasta: new Date().toISOString().slice(0, 10),
  search:      '',
  riesgo:      '',
  con_saldo:   true,
  ordering:    '-saldo_total',
})

const fetchCartera = async () => {
  cargandoCartera.value = true
  try {
    const p = {}
    if (filtrosCartera.value.fecha_hasta) p.fecha_hasta = filtrosCartera.value.fecha_hasta
    if (filtrosCartera.value.search)      p.search      = filtrosCartera.value.search
    if (filtrosCartera.value.riesgo)      p.riesgo      = filtrosCartera.value.riesgo
    if (filtrosCartera.value.con_saldo)   p.con_saldo   = 'true'
    p.ordering = filtrosCartera.value.ordering
    const { data } = await api.get('/api/clientes-admin/resumen-cartera/', { params: p })
    carteraData.value = data
    selectedRowKeys.value = []
  } catch (e) {
    message.error('No se pudo cargar la cartera')
  } finally {
    cargandoCartera.value = false
  }
}

onMounted(fetchCartera)

const carteraResultados = computed(() => carteraData.value?.results || [])
const carteraTotales    = computed(() => carteraData.value?.totales  || {})

// Selección en lote
const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: keys => { selectedRowKeys.value = keys },
}))
const seleccionados = computed(() =>
  carteraResultados.value.filter(c => selectedRowKeys.value.includes(c.id))
)
const abrirSeleccionados = () => {
  if (!seleccionados.value.length) return
  seleccionados.value.forEach(c =>
    window.open(router.resolve({ name: 'cliente-cuenta-corriente', params: { id: c.id } }).href, '_blank')
  )
  message.info(`Se abrieron ${seleccionados.value.length} cuentas corrientes`)
}

// Columnas cartera
const colsCartera = [
  { title: 'Cliente',       key: 'cliente',      width: 260 },
  { title: 'CUIT',          dataIndex: 'cuit',   width: 140 },
  { title: 'Saldo total',   key: 'saldo',        width: 140, align: 'right',
    sorter: (a, b) => a.saldo_total - b.saldo_total },
  { title: 'Vencida',       key: 'vencida',      width: 130, align: 'right',
    sorter: (a, b) => a.deuda_vencida - b.deuda_vencida },
  { title: 'No vencida',    key: 'no_vencida',   width: 130, align: 'right' },
  { title: 'Lím. crédito',  key: 'limite',       width: 120, align: 'right' },
  { title: 'Última activ.', key: 'ultima',       width: 120 },
  { title: 'Riesgo',        key: 'riesgo',       width: 110, align: 'center' },
  { title: '',              key: 'acc',          width: 88,  fixed: 'right' },
]

// ══════════════════════════════════════════════════════════════════════════
// TAB 2 & 3: EXTRACTO / RESUMEN POR CLIENTE
// ══════════════════════════════════════════════════════════════════════════
const cargandoDetalle = ref(false)
const detalleData     = ref(null)
const clienteSelId    = ref(null)
const clienteSelNombre = ref('')
const reciboExpandido = ref(null)

// Búsqueda de cliente dentro del tab (autocomplete desde cartera)
const busqCliente    = ref('')
const clienteOptions = computed(() =>
  carteraResultados.value
    .filter(c =>
      !busqCliente.value ||
      c.razon_social.toLowerCase().includes(busqCliente.value.toLowerCase()) ||
      (c.cuit || '').includes(busqCliente.value) ||
      (c.codigo || '').toLowerCase().includes(busqCliente.value.toLowerCase())
    )
    .slice(0, 12)
    .map(c => ({ value: c.id, label: `${c.razon_social} — ${c.cuit || c.codigo || ''}` }))
)

const filtrosDetalle = ref({
  fecha_desde: '',
  fecha_hasta: new Date().toISOString().slice(0, 10),
  tipo:        '',
  modo:        'extracto',  // 'extracto' | 'resumen'
  page:        1,
  page_size:   50,
})

const fetchDetalle = async () => {
  if (!clienteSelId.value) return
  cargandoDetalle.value = true
  try {
    const p = { modo: filtrosDetalle.value.modo }
    if (filtrosDetalle.value.fecha_desde) p.fecha_desde = filtrosDetalle.value.fecha_desde
    if (filtrosDetalle.value.fecha_hasta) p.fecha_hasta = filtrosDetalle.value.fecha_hasta
    if (filtrosDetalle.value.tipo)        p.tipo        = filtrosDetalle.value.tipo
    if (filtrosDetalle.value.modo === 'extracto') {
      p.page      = filtrosDetalle.value.page
      p.page_size = filtrosDetalle.value.page_size
    }
    const { data } = await api.get(
      `/api/clientes-admin/${clienteSelId.value}/cuenta-corriente/`, { params: p }
    )
    detalleData.value = data
  } catch (e) {
    message.error('No se pudo cargar la cuenta corriente del cliente')
  } finally {
    cargandoDetalle.value = false
  }
}

const seleccionarCliente = (id) => {
  const c = carteraResultados.value.find(x => x.id === id)
  if (c) {
    clienteSelId.value     = id
    clienteSelNombre.value = c.razon_social
    busqCliente.value      = c.razon_social
    fetchDetalle()
  }
}

watch(() => filtrosDetalle.value.modo, () => {
  filtrosDetalle.value.page = 1
  fetchDetalle()
})

// helpers extracto
const movimientos    = computed(() => detalleData.value?.movimientos || [])
const paginacion     = computed(() => detalleData.value?.paginacion  || {})
const saldoAnterior  = computed(() => detalleData.value?.saldo_anterior ?? null)
const saldoFinal     = computed(() => detalleData.value?.saldo_final ?? null)
const kpis           = computed(() => detalleData.value?.kpis || null)
const resumenPer     = computed(() => detalleData.value?.resumen_periodo || null)
const impagos        = computed(() => detalleData.value?.comprobantes_impagos || [])
const recibos        = computed(() => detalleData.value?.recibos || [])

const colsExtracto = [
  { title: 'Fecha',      key: 'fecha',   width: 96 },
  { title: 'Tipo',       key: 'tipo',    width: 150 },
  { title: 'Número',     key: 'numero'              },
  { title: 'Debe',       key: 'debe',    width: 130, align: 'right' },
  { title: 'Haber',      key: 'haber',   width: 130, align: 'right' },
  { title: 'Saldo acum.', key: 'saldo',  width: 140, align: 'right' },
  { title: '',           key: 'pdf',     width: 44,  align: 'center' },
]

const abrirPdf = async (id) => {
  try {
    const res = await api.get(`/api/comprobantes-venta/${id}/pdf/`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { message.error('No se pudo abrir el PDF') }
}

// ── Email ──────────────────────────────────────────────────────────────────
const emailModal   = ref(false)
const emailId      = ref(null)
const emailNombre  = ref('')
const emailDest    = ref('')
const enviandoEmail = ref(false)

const abrirEmail = (c) => {
  emailId.value     = c.id
  emailNombre.value = c.razon_social
  emailDest.value   = ''
  emailModal.value  = true
}
const enviarEmail = async () => {
  enviandoEmail.value = true
  try {
    const p = emailDest.value.trim() ? { email: emailDest.value.trim() } : {}
    await api.post(`/api/clientes-admin/${emailId.value}/enviar-estado-cuenta/`, p)
    message.success('Estado de cuenta enviado')
    emailModal.value = false
  } catch (e) {
    message.error(e?.response?.data?.error || 'Error al enviar')
  } finally { enviandoEmail.value = false }
}

// ── Helpers visuales ───────────────────────────────────────────────────────
const money = n =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmt = iso => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' }) }
  catch { return iso }
}

const riesgoTag = r =>
  r === 'EXCEDIDO'    ? { color: 'error',   label: 'Excedido' }   :
  r === 'SEGUIMIENTO' ? { color: 'warning',  label: 'Seguimiento' } :
                        { color: 'success',  label: 'Normal' }

const estadoPagoTag = ep =>
  ep === 'PAGADO'  ? { color: 'success', label: 'Pagado'    } :
  ep === 'PARCIAL' ? { color: 'warning', label: 'Parcial'   } :
                     { color: 'error',   label: 'Pendiente' }
</script>

<template>
  <div class="cc-root">

    <!-- ═══ HERO ══════════════════════════════════════════════════════════ -->
    <div class="cc-hero">
      <div>
        <div class="cc-eyebrow">Finanzas · Cartera de Clientes</div>
        <h1 class="cc-title">Cuenta Corriente</h1>
        <p class="cc-subtitle">
          Consulta de saldos a fecha de corte, extracto de movimientos por período
          y resúmenes de cuenta individuales o en lote.
        </p>
      </div>
    </div>

    <!-- ═══ TABS ══════════════════════════════════════════════════════════ -->
    <div class="cc-tabs">
      <button class="cc-tab" :class="{ 'cc-tab--active': tabActivo === 'cartera' }"
        @click="tabActivo = 'cartera'">
        <TeamOutlined /> Cartera de clientes
      </button>
      <button class="cc-tab" :class="{ 'cc-tab--active': tabActivo === 'extracto' }"
        @click="tabActivo = 'extracto'">
        <FileTextOutlined /> Estado de cuenta (extracto)
      </button>
      <button class="cc-tab" :class="{ 'cc-tab--active': tabActivo === 'resumen' }"
        @click="tabActivo = 'resumen'">
        <BarChartOutlined /> Resumen de cuenta
      </button>
    </div>

    <!-- ═══ TAB 1: CARTERA ════════════════════════════════════════════════ -->
    <div v-show="tabActivo === 'cartera'" class="cc-card">

      <!-- KPIs dinámicos -->
      <div class="cc-kpis" v-if="carteraTotales.clientes != null">
        <div class="cc-kpi">
          <div class="cc-kpi-icon cc-kpi-icon--blue"><TeamOutlined /></div>
          <div>
            <div class="cc-kpi-lbl">Clientes en vista</div>
            <div class="cc-kpi-val">{{ carteraTotales.clientes }}</div>
          </div>
        </div>
        <div class="cc-kpi">
          <div class="cc-kpi-icon cc-kpi-icon--amber"><DollarOutlined /></div>
          <div>
            <div class="cc-kpi-lbl">Saldo total al {{ fmt(carteraTotales.fecha_hasta) }}</div>
            <div class="cc-kpi-val">${{ money(carteraTotales.saldo) }}</div>
          </div>
        </div>
        <div class="cc-kpi" :class="carteraTotales.vencida > 0 ? 'cc-kpi--alert' : ''">
          <div class="cc-kpi-icon cc-kpi-icon--red"><WarningOutlined /></div>
          <div>
            <div class="cc-kpi-lbl">Deuda vencida</div>
            <div class="cc-kpi-val" :class="carteraTotales.vencida > 0 ? 'c-red' : ''">${{ money(carteraTotales.vencida) }}</div>
          </div>
        </div>
        <div class="cc-kpi">
          <div class="cc-kpi-icon cc-kpi-icon--green"><CheckCircleOutlined /></div>
          <div>
            <div class="cc-kpi-lbl">No vencida</div>
            <div class="cc-kpi-val">${{ money(carteraTotales.no_vencida) }}</div>
          </div>
        </div>
        <div class="cc-kpi" :class="carteraTotales.excedidos > 0 ? 'cc-kpi--alert' : ''">
          <div class="cc-kpi-icon cc-kpi-icon--red"><ExclamationCircleOutlined /></div>
          <div>
            <div class="cc-kpi-lbl">Límite excedido</div>
            <div class="cc-kpi-val" :class="carteraTotales.excedidos > 0 ? 'c-red' : ''">
              {{ carteraTotales.excedidos }} cliente{{ carteraTotales.excedidos !== 1 ? 's' : '' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Filtros cartera -->
      <div class="cc-toolbar">
        <div class="cc-toolbar-row">
          <label class="cc-lbl">Fecha de corte</label>
          <a-input v-model:value="filtrosCartera.fecha_hasta" type="date" size="small" style="width:150px" />

          <label class="cc-lbl">Buscar</label>
          <a-input-search
            v-model:value="filtrosCartera.search"
            placeholder="Razón social / CUIT / código"
            allow-clear size="small" style="width:240px"
            @search="fetchCartera"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input-search>

          <a-select v-model:value="filtrosCartera.riesgo" placeholder="Riesgo" allow-clear size="small" style="width:140px">
            <a-select-option value="EXCEDIDO">Excedido</a-select-option>
            <a-select-option value="SEGUIMIENTO">Seguimiento</a-select-option>
            <a-select-option value="NORMAL">Normal</a-select-option>
          </a-select>

          <a-checkbox v-model:checked="filtrosCartera.con_saldo" size="small">Solo con saldo</a-checkbox>

          <a-button type="primary" size="small" :loading="cargandoCartera" @click="fetchCartera">
            <ReloadOutlined /> Consultar
          </a-button>
        </div>

        <!-- Batch bar -->
        <transition name="slide-down">
          <div v-if="selectedRowKeys.length > 0" class="cc-batch">
            <span class="cc-batch-lbl">
              {{ selectedRowKeys.length }} cliente{{ selectedRowKeys.length !== 1 ? 's' : '' }} seleccionado{{ selectedRowKeys.length !== 1 ? 's' : '' }}
            </span>
            <div style="display:flex;gap:8px">
              <a-button size="small" type="primary" ghost @click="abrirSeleccionados">
                <PrinterOutlined /> Abrir cuentas corrientes
              </a-button>
              <a-button size="small" type="text" @click="selectedRowKeys = []">Deseleccionar</a-button>
            </div>
          </div>
        </transition>
      </div>

      <!-- Tabla cartera -->
      <a-spin :spinning="cargandoCartera">
        <a-table
          :data-source="carteraResultados"
          :columns="colsCartera"
          :row-selection="rowSelection"
          :row-key="r => r.id"
          :pagination="{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ['25','50','100'],
            showTotal: (t, r) => `${r[0]}–${r[1]} de ${t}` }"
          size="small"
          :scroll="{ x: 1120 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'cliente'">
              <div style="display:flex;align-items:center;gap:9px">
                <div class="cc-av">{{ (record.razon_social||'?')[0].toUpperCase() }}</div>
                <div>
                  <div class="cc-nombre">{{ record.razon_social }}</div>
                  <div class="cc-codigo" v-if="record.codigo">{{ record.codigo }}</div>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'saldo'">
              <span :class="record.saldo_total > 0 ? 'n-deuda' : 'n-ok'">${{ money(record.saldo_total) }}</span>
            </template>
            <template v-else-if="column.key === 'vencida'">
              <span v-if="record.deuda_vencida > 0" class="n-red">${{ money(record.deuda_vencida) }}</span>
              <span v-else class="n-muted">—</span>
            </template>
            <template v-else-if="column.key === 'no_vencida'">
              <span v-if="record.deuda_no_vencida > 0" class="n-amber">${{ money(record.deuda_no_vencida) }}</span>
              <span v-else class="n-muted">—</span>
            </template>
            <template v-else-if="column.key === 'limite'">
              <span v-if="record.limite_credito > 0" class="n-muted">${{ money(record.limite_credito) }}</span>
              <span v-else class="n-muted">—</span>
            </template>
            <template v-else-if="column.key === 'ultima'">
              <span class="n-fecha">{{ fmt(record.ultima_actividad) }}</span>
            </template>
            <template v-else-if="column.key === 'riesgo'">
              <a-tag :color="riesgoTag(record.riesgo).color" size="small">
                {{ riesgoTag(record.riesgo).label }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'acc'">
              <a-space size="small">
                <a-tooltip title="Ver cuenta corriente">
                  <a-button type="primary" size="small" ghost
                    @click="router.push({ name: 'cliente-cuenta-corriente', params: { id: record.id } })">
                    <EyeOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Enviar por email">
                  <a-button size="small" @click="abrirEmail(record)"><SendOutlined /></a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>

          <template #summary>
            <a-table-summary fixed>
              <a-table-summary-row>
                <a-table-summary-cell :index="0" />
                <a-table-summary-cell :index="1">
                  <strong>TOTALES — {{ carteraTotales.clientes || 0 }} clientes</strong>
                </a-table-summary-cell>
                <a-table-summary-cell :index="2" />
                <a-table-summary-cell :index="3" align="right">
                  <strong class="n-deuda">${{ money(carteraTotales.saldo) }}</strong>
                </a-table-summary-cell>
                <a-table-summary-cell :index="4" align="right">
                  <strong class="n-red">${{ money(carteraTotales.vencida) }}</strong>
                </a-table-summary-cell>
                <a-table-summary-cell :index="5" align="right">
                  <strong class="n-amber">${{ money(carteraTotales.no_vencida) }}</strong>
                </a-table-summary-cell>
                <a-table-summary-cell :index="6" /><a-table-summary-cell :index="7" />
                <a-table-summary-cell :index="8" /><a-table-summary-cell :index="9" />
              </a-table-summary-row>
            </a-table-summary>
          </template>
        </a-table>
      </a-spin>
    </div>

    <!-- ═══ TABS 2 & 3: SELECTOR DE CLIENTE COMPARTIDO ════════════════════ -->
    <div v-show="tabActivo === 'extracto' || tabActivo === 'resumen'" class="cc-card">

      <!-- Selector de cliente + filtros -->
      <div class="cc-detalle-header">
        <div class="cc-toolbar-row cc-toolbar-row--wrap">
          <div style="display:flex;flex-direction:column;gap:4px;min-width:280px">
            <label class="cc-lbl">Cliente</label>
            <a-auto-complete
              v-model:value="busqCliente"
              :options="clienteOptions"
              placeholder="Buscar cliente..."
              style="width:280px"
              @select="(val) => seleccionarCliente(val)"
              @search="() => {}"
            />
          </div>

          <div style="display:flex;flex-direction:column;gap:4px">
            <label class="cc-lbl">Desde</label>
            <a-input v-model:value="filtrosDetalle.fecha_desde" type="date" size="small" style="width:150px" />
          </div>

          <div style="display:flex;flex-direction:column;gap:4px">
            <label class="cc-lbl">Hasta</label>
            <a-input v-model:value="filtrosDetalle.fecha_hasta" type="date" size="small" style="width:150px" />
          </div>

          <div v-if="tabActivo === 'extracto'" style="display:flex;flex-direction:column;gap:4px">
            <label class="cc-lbl">Tipo movimiento</label>
            <a-select v-model:value="filtrosDetalle.tipo" allow-clear size="small" style="width:150px" placeholder="Todos">
              <a-select-option value="comprobante">Comprobantes</a-select-option>
              <a-select-option value="recibo">Recibos</a-select-option>
            </a-select>
          </div>

          <div style="display:flex;align-items:flex-end">
            <a-button
              type="primary"
              size="small"
              :loading="cargandoDetalle"
              :disabled="!clienteSelId"
              @click="fetchDetalle"
            >
              <ReloadOutlined /> Consultar
            </a-button>
          </div>
        </div>
      </div>

      <!-- Sin cliente seleccionado -->
      <div v-if="!clienteSelId" class="cc-empty">
        <SearchOutlined style="font-size:36px;opacity:.25" />
        <p>Seleccioná un cliente para ver su {{ tabActivo === 'extracto' ? 'extracto' : 'resumen' }} de cuenta</p>
        <p class="cc-empty-sub">Podés buscarlo por nombre, CUIT o código</p>
      </div>

      <a-spin :spinning="cargandoDetalle" v-else-if="detalleData">

        <!-- KPIs del cliente -->
        <div class="cc-cliente-header" v-if="kpis">
          <div class="cc-cliente-av">{{ (detalleData.cliente?.razon_social || '?')[0].toUpperCase() }}</div>
          <div class="cc-cliente-info">
            <h2 class="cc-cliente-nombre">{{ detalleData.cliente?.razon_social }}</h2>
            <div class="cc-cliente-meta">
              <span v-if="detalleData.cliente?.cuit" class="cc-chip">CUIT {{ detalleData.cliente.cuit }}</span>
              <span v-if="detalleData.cliente?.codigo_cliente" class="cc-chip cc-chip--blue">{{ detalleData.cliente.codigo_cliente }}</span>
              <a-tag :color="riesgoTag(kpis.riesgo).color" size="small">{{ riesgoTag(kpis.riesgo).label }}</a-tag>
            </div>
          </div>
          <div class="cc-cliente-kpis">
            <div class="cc-mini-kpi">
              <div class="cc-mini-lbl">Saldo actual</div>
              <div class="cc-mini-val" :class="kpis.saldo_total > 0 ? 'c-red' : 'c-green'">${{ money(kpis.saldo_total) }}</div>
            </div>
            <div class="cc-mini-kpi">
              <div class="cc-mini-lbl">Vencida</div>
              <div class="cc-mini-val" :class="kpis.deuda_vencida > 0 ? 'c-red' : ''">${{ money(kpis.deuda_vencida) }}</div>
            </div>
            <div class="cc-mini-kpi">
              <div class="cc-mini-lbl">Disponible</div>
              <div class="cc-mini-val" :class="kpis.credito_disponible < 0 ? 'c-red' : 'c-green'">${{ money(kpis.credito_disponible) }}</div>
            </div>
            <div class="cc-mini-kpi">
              <div class="cc-mini-lbl">Impagos</div>
              <div class="cc-mini-val">{{ kpis.comprobantes_impagos }}</div>
            </div>
          </div>
        </div>

        <!-- ══ EXTRACTO ══════════════════════════════════════════════════ -->
        <template v-if="tabActivo === 'extracto'">

          <!-- Saldo anterior -->
          <div v-if="saldoAnterior !== null && filtrosDetalle.fecha_desde" class="cc-saldo-ant">
            <span>Saldo anterior al {{ fmt(filtrosDetalle.fecha_desde) }}</span>
            <strong :class="saldoAnterior > 0 ? 'c-red' : 'c-green'">${{ money(saldoAnterior) }}</strong>
          </div>

          <a-table
            :data-source="movimientos"
            :columns="colsExtracto"
            :pagination="false"
            size="small"
            :row-key="(r, i) => `${r.clase}-${r.id}-${i}`"
            :scroll="{ x: 720 }"
            :row-class-name="(r) => r.es_nc ? 'row-nc' : ''"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'fecha'">{{ fmt(record.fecha) }}</template>
              <template v-else-if="column.key === 'tipo'">
                <span class="mov-badge" :class="record.clase === 'recibo' ? 'mov-badge--rec' : record.es_nc ? 'mov-badge--nc' : 'mov-badge--fac'">
                  {{ record.tipo }}
                </span>
              </template>
              <template v-else-if="column.key === 'numero'">
                <span class="n-mono">{{ record.numero }}</span>
              </template>
              <template v-else-if="column.key === 'debe'">
                <span v-if="record.debe > 0" class="n-deuda">${{ money(record.debe) }}</span>
                <span v-else class="n-muted">—</span>
              </template>
              <template v-else-if="column.key === 'haber'">
                <span v-if="record.haber > 0" class="n-ok">${{ money(record.haber) }}</span>
                <span v-else class="n-muted">—</span>
              </template>
              <template v-else-if="column.key === 'saldo'">
                <span :class="record.saldo > 0 ? 'n-deuda' : 'n-ok'">${{ money(record.saldo) }}</span>
              </template>
              <template v-else-if="column.key === 'pdf'">
                <a-button v-if="record.clase === 'comprobante'" type="text" size="small" @click="abrirPdf(record.ref_id)">
                  <FileTextOutlined />
                </a-button>
              </template>
            </template>
          </a-table>

          <!-- Saldo final -->
          <div class="cc-saldo-final">
            <span>SALDO AL {{ fmt(filtrosDetalle.fecha_hasta || new Date().toISOString()) }}</span>
            <strong :class="saldoFinal > 0 ? 'c-red' : 'c-green'">${{ money(saldoFinal) }}</strong>
          </div>

          <!-- Paginación -->
          <div class="cc-pag" v-if="paginacion.total_pages > 1">
            <a-pagination
              v-model:current="filtrosDetalle.page"
              :total="paginacion.total"
              :page-size="filtrosDetalle.page_size"
              show-size-changer
              show-quick-jumper
              :show-total="(t, r) => `${r[0]}–${r[1]} de ${t}`"
              @change="(p) => { filtrosDetalle.page = p; fetchDetalle() }"
              @showSizeChange="(_, s) => { filtrosDetalle.page_size = s; filtrosDetalle.page = 1; fetchDetalle() }"
            />
          </div>
        </template>

        <!-- ══ RESUMEN ══════════════════════════════════════════════════ -->
        <template v-if="tabActivo === 'resumen' && resumenPer">
          <div class="cc-resumen-grid">

            <div class="cc-resumen-card cc-resumen-card--ant">
              <div class="cc-resumen-lbl">Saldo anterior</div>
              <div class="cc-resumen-val" :class="resumenPer.saldo_anterior > 0 ? 'c-red' : 'c-green'">
                ${{ money(resumenPer.saldo_anterior) }}
              </div>
              <div class="cc-resumen-sub">
                Al {{ filtrosDetalle.fecha_desde ? fmt(filtrosDetalle.fecha_desde) : 'inicio' }}
              </div>
            </div>

            <div class="cc-resumen-card cc-resumen-card--debe">
              <div class="cc-resumen-lbl">Total DEBE del período</div>
              <div class="cc-resumen-val c-red">${{ money(resumenPer.total_debe) }}</div>
              <div class="cc-resumen-sub">Facturas + Notas de Débito</div>
            </div>

            <div class="cc-resumen-card cc-resumen-card--haber">
              <div class="cc-resumen-lbl">Total HABER del período</div>
              <div class="cc-resumen-val c-green">${{ money(resumenPer.total_haber) }}</div>
              <div class="cc-resumen-sub">Recibos + Notas de Crédito</div>
            </div>

            <div class="cc-resumen-card cc-resumen-card--neto">
              <div class="cc-resumen-lbl">Neto del período</div>
              <div class="cc-resumen-val" :class="resumenPer.saldo_periodo > 0 ? 'c-red' : 'c-green'">
                ${{ money(resumenPer.saldo_periodo) }}
              </div>
              <div class="cc-resumen-sub">Debe − Haber del período</div>
            </div>

            <div class="cc-resumen-card cc-resumen-card--final">
              <div class="cc-resumen-lbl">SALDO FINAL</div>
              <div class="cc-resumen-val-big" :class="resumenPer.saldo_final > 0 ? 'c-red' : 'c-green'">
                ${{ money(resumenPer.saldo_final) }}
              </div>
              <div class="cc-resumen-sub">Al {{ fmt(filtrosDetalle.fecha_hasta) }}</div>
            </div>

          </div>

          <!-- Desglose por tipo de documento -->
          <div class="cc-desglose" v-if="resumenPer.desglose?.length">
            <div class="cc-section-title">Desglose por tipo de documento</div>
            <a-table
              :data-source="resumenPer.desglose"
              :row-key="r => r.tipo"
              :pagination="false"
              size="small"
              :columns="[
                { title: 'Tipo', dataIndex: 'tipo', key: 'tipo' },
                { title: 'Clase', dataIndex: 'clase', key: 'clase', width: 110 },
                { title: 'Cantidad', dataIndex: 'cantidad', key: 'cantidad', align: 'center', width: 90 },
                { title: 'DEBE', dataIndex: 'debe', key: 'debe', align: 'right', width: 140 },
                { title: 'HABER', dataIndex: 'haber', key: 'haber', align: 'right', width: 140 },
              ]"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'clase'">
                  <span class="mov-badge" :class="record.clase === 'recibo' ? 'mov-badge--rec' : 'mov-badge--fac'">
                    {{ record.clase === 'recibo' ? 'Recibo' : 'Comprobante' }}
                  </span>
                </template>
                <template v-else-if="column.key === 'debe'">
                  <span v-if="record.debe > 0" class="n-deuda">${{ money(record.debe) }}</span>
                  <span v-else class="n-muted">—</span>
                </template>
                <template v-else-if="column.key === 'haber'">
                  <span v-if="record.haber > 0" class="n-ok">${{ money(record.haber) }}</span>
                  <span v-else class="n-muted">—</span>
                </template>
              </template>
            </a-table>
          </div>

          <!-- Comprobantes impagos en el resumen -->
          <div class="cc-desglose" v-if="impagos.length">
            <div class="cc-section-title">Comprobantes pendientes de pago</div>
            <a-table
              :data-source="impagos"
              :row-key="r => r.id"
              :pagination="{ pageSize: 10 }"
              size="small"
              :columns="[
                { title: 'Fecha',      key: 'fecha',    width: 96 },
                { title: 'Tipo',       dataIndex: 'tipo' },
                { title: 'Número',     dataIndex: 'numero' },
                { title: 'Vto.',       key: 'vto',      width: 96 },
                { title: 'Mora',       key: 'mora',     width: 80, align: 'center' },
                { title: 'Saldo',      key: 'saldo_p',  width: 130, align: 'right' },
                { title: 'Estado',     key: 'ep',       width: 100, align: 'center' },
              ]"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'fecha'">{{ fmt(record.fecha) }}</template>
                <template v-else-if="column.key === 'vto'">
                  <span :class="record.vencido ? 'c-red' : ''">{{ fmt(record.fecha_vencimiento) }}</span>
                </template>
                <template v-else-if="column.key === 'mora'">
                  <a-tag v-if="record.dias_mora > 0" color="error" size="small">{{ record.dias_mora }}d</a-tag>
                  <a-tag v-else color="success" size="small">Al día</a-tag>
                </template>
                <template v-else-if="column.key === 'saldo_p'">
                  <span class="n-deuda">${{ money(record.saldo_pendiente) }}</span>
                </template>
                <template v-else-if="column.key === 'ep'">
                  <a-tag :color="estadoPagoTag(record.estado_pago).color" size="small">
                    {{ estadoPagoTag(record.estado_pago).label }}
                  </a-tag>
                </template>
              </template>
            </a-table>
          </div>

        </template>

      </a-spin>
      <div v-else-if="clienteSelId && !cargandoDetalle" class="cc-empty">
        <p>Completá los filtros y presioná <strong>Consultar</strong></p>
      </div>
    </div>

    <!-- Modal email -->
    <a-modal v-model:open="emailModal" title="Enviar estado de cuenta"
      ok-text="Enviar" cancel-text="Cancelar"
      :confirm-loading="enviandoEmail" @ok="enviarEmail">
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
        <p style="margin:0;font-size:13px">Estado de cuenta de <strong>{{ emailNombre }}</strong></p>
        <a-input v-model:value="emailDest"
          placeholder="email@ejemplo.com (vacío = usa el del cliente)"
          type="email" size="large" />
      </div>
    </a-modal>

  </div>
</template>

<style scoped>
.cc-root { display:flex; flex-direction:column; gap:14px; padding:4px 0; }

/* Hero */
.cc-hero {
  padding:18px 22px; border-radius:8px; flex-wrap:wrap;
  background: radial-gradient(circle at top right, rgba(var(--accent-rgb),.1), transparent 35%),
    linear-gradient(135deg, color-mix(in srgb,var(--surface-1) 92%,transparent), color-mix(in srgb,var(--surface-0) 96%,transparent));
  border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent);
  box-shadow:0 8px 20px rgba(0,0,0,.07);
}
.cc-eyebrow { font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--text-2,#64748b); margin-bottom:4px; }
.cc-title   { margin:0; font-size:24px; font-weight:800; color:var(--text-0,#0f172a); }
.cc-subtitle{ margin:6px 0 0; color:var(--text-1,#334155); font-size:13px; }

/* Tabs */
.cc-tabs { display:flex; border-radius:8px 8px 0 0; overflow:hidden; border:1px solid var(--border,rgba(148,163,184,.2)); border-bottom:none; }
.cc-tab {
  flex:1; padding:10px 14px; font-size:12.5px; font-weight:600;
  color:var(--text-2,#64748b); background:var(--surface-2,#f8fafc);
  border:none; border-right:1px solid var(--border,rgba(148,163,184,.2));
  cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;
  transition:background .12s, color .12s;
}
.cc-tab:last-child { border-right:none; }
.cc-tab:hover { background:var(--surface-1,#fff); color:var(--text-0,#0f172a); }
.cc-tab--active { background:var(--surface-1,#fff); color:var(--primary,#1677ff); box-shadow:inset 0 -2px 0 var(--primary,#1677ff); }

/* Card */
.cc-card {
  background:var(--surface-1,#fff);
  border:1px solid var(--border,rgba(148,163,184,.18));
  border-top:none; border-radius:0 0 8px 8px;
  padding:16px 18px;
  box-shadow:0 4px 14px rgba(0,0,0,.05);
}

/* KPIs */
.cc-kpis { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:14px; }
@media(max-width:1100px){ .cc-kpis{ grid-template-columns:repeat(3,1fr); } }
@media(max-width:700px) { .cc-kpis{ grid-template-columns:repeat(2,1fr); } }
.cc-kpi {
  background:var(--surface-2,#f8fafc);
  border:1px solid var(--border,rgba(148,163,184,.15));
  border-radius:7px; padding:12px 14px;
  display:flex; gap:10px; align-items:center;
}
.cc-kpi--alert { border-left:3px solid #ef4444; }
.cc-kpi-icon { width:34px; height:34px; border-radius:8px; display:grid; place-items:center; font-size:16px; flex-shrink:0; }
.cc-kpi-icon--blue  { background:rgba(22,119,255,.1);  color:#1677ff; }
.cc-kpi-icon--amber { background:rgba(245,158,11,.1);  color:#d97706; }
.cc-kpi-icon--red   { background:rgba(239,68,68,.1);   color:#ef4444; }
.cc-kpi-icon--green { background:rgba(16,185,129,.1);  color:#10b981; }
.cc-kpi-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2,#64748b); margin-bottom:2px; }
.cc-kpi-val { font-size:1.05rem; font-weight:900; color:var(--text-0,#0f172a); font-variant-numeric:tabular-nums; white-space:nowrap; }

/* Toolbar */
.cc-toolbar { margin-bottom:12px; }
.cc-toolbar-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; margin-bottom:8px; }
.cc-toolbar-row--wrap { flex-wrap:wrap; }
.cc-lbl { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2,#64748b); }

/* Batch bar */
.cc-batch {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  background:rgba(22,119,255,.05); border:1px solid rgba(22,119,255,.15);
  border-radius:6px; padding:8px 14px; margin-top:8px; flex-wrap:wrap;
}
.cc-batch-lbl { font-size:12px; font-weight:700; color:var(--primary,#1677ff); }

.slide-down-enter-active, .slide-down-leave-active { transition:all .18s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity:0; transform:translateY(-4px); }

/* Cliente header (extracto/resumen) */
.cc-detalle-header { border-bottom:1px solid var(--border,rgba(148,163,184,.15)); padding-bottom:14px; margin-bottom:14px; }
.cc-cliente-header {
  display:flex; align-items:center; gap:14px; flex-wrap:wrap;
  background:var(--surface-2,#f8fafc); border:1px solid var(--border,rgba(148,163,184,.15));
  border-radius:8px; padding:12px 16px; margin-bottom:14px;
}
.cc-cliente-av {
  width:44px; height:44px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,var(--primary,#1677ff),#0ea5e9);
  color:#fff; font-size:18px; font-weight:900; display:grid; place-items:center;
}
.cc-cliente-info { flex:1; min-width:0; }
.cc-cliente-nombre { margin:0; font-size:16px; font-weight:800; color:var(--text-0,#0f172a); }
.cc-cliente-meta { display:flex; gap:6px; flex-wrap:wrap; margin-top:4px; align-items:center; }
.cc-chip { padding:1px 8px; border-radius:20px; font-size:11px; font-weight:600; background:rgba(148,163,184,.12); color:var(--text-2,#64748b); font-family:ui-monospace,monospace; }
.cc-chip--blue { background:rgba(22,119,255,.08); color:var(--primary,#1677ff); }
.cc-cliente-kpis { display:flex; gap:20px; flex-wrap:wrap; }
.cc-mini-kpi { text-align:right; }
.cc-mini-lbl { font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-2,#64748b); }
.cc-mini-val { font-size:1rem; font-weight:900; font-variant-numeric:tabular-nums; color:var(--text-0,#0f172a); }

/* Saldo anterior / final */
.cc-saldo-ant, .cc-saldo-final {
  display:flex; justify-content:space-between; align-items:center;
  padding:8px 10px; border-radius:6px; font-size:12.5px; font-weight:700;
  margin-bottom:8px;
}
.cc-saldo-ant  { background:rgba(148,163,184,.08); border:1px solid rgba(148,163,184,.15); }
.cc-saldo-final{ background:rgba(22,119,255,.05);  border:1px solid rgba(22,119,255,.15); font-size:13.5px; margin-top:8px; }

/* Paginación */
.cc-pag { display:flex; justify-content:flex-end; margin-top:12px; }

/* Badges movimientos */
.mov-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:10.5px; font-weight:700; }
.mov-badge--fac { background:#dbeafe; color:#1e40af; }
.mov-badge--rec { background:#dcfce7; color:#166534; }
.mov-badge--nc  { background:#fef3c7; color:#92400e; }

/* Resumen cards */
.cc-resumen-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-bottom:18px; }
@media(max-width:1100px){ .cc-resumen-grid{ grid-template-columns:repeat(3,1fr); } }
@media(max-width:700px) { .cc-resumen-grid{ grid-template-columns:repeat(2,1fr); } }
.cc-resumen-card {
  border-radius:8px; padding:14px 16px;
  border:1px solid var(--border,rgba(148,163,184,.18));
  background:var(--surface-2,#f8fafc);
}
.cc-resumen-card--ant   { border-top:3px solid #94a3b8; }
.cc-resumen-card--debe  { border-top:3px solid #ef4444; }
.cc-resumen-card--haber { border-top:3px solid #10b981; }
.cc-resumen-card--neto  { border-top:3px solid #f59e0b; }
.cc-resumen-card--final { border-top:3px solid var(--primary,#1677ff); background:rgba(22,119,255,.04); }
.cc-resumen-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-2,#64748b); margin-bottom:6px; }
.cc-resumen-val { font-size:1.2rem; font-weight:900; font-variant-numeric:tabular-nums; }
.cc-resumen-val-big { font-size:1.5rem; font-weight:900; font-variant-numeric:tabular-nums; }
.cc-resumen-sub { font-size:10.5px; color:var(--text-2,#64748b); margin-top:4px; }

/* Desglose */
.cc-desglose { margin-top:16px; }
.cc-section-title { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-2,#64748b); margin-bottom:8px; }

/* Empty */
.cc-empty { text-align:center; padding:48px 20px; color:var(--text-2,#64748b); }
.cc-empty-sub { font-size:12px; margin-top:4px; opacity:.7; }

/* Colores reutilizables */
.c-red   { color:#ef4444 !important; }
.c-green { color:#10b981 !important; }
.n-deuda { color:#ef4444; font-weight:700; font-variant-numeric:tabular-nums; }
.n-red   { color:#ef4444; font-weight:700; font-variant-numeric:tabular-nums; }
.n-amber { color:#d97706; font-weight:600; font-variant-numeric:tabular-nums; }
.n-ok    { color:#10b981; font-weight:600; font-variant-numeric:tabular-nums; }
.n-muted { color:var(--text-2,#94a3b8); }
.n-fecha { font-size:12px; color:var(--text-1,#334155); }
.n-mono  { font-family:ui-monospace,monospace; font-size:11.5px; color:var(--text-1,#334155); }

/* Fila nota de crédito */
:deep(.row-nc td) { background:rgba(245,158,11,.04) !important; }

/* Avatar en tabla cartera */
.cc-av {
  width:30px; height:30px; border-radius:7px; flex-shrink:0;
  background:linear-gradient(135deg,var(--primary,#1677ff),#0ea5e9);
  color:#fff; font-size:12px; font-weight:900; display:grid; place-items:center;
}
.cc-nombre { font-weight:600; font-size:13px; color:var(--text-0,#0f172a); }
.cc-codigo { font-size:11px; color:var(--text-2,#64748b); font-family:ui-monospace,monospace; }
</style>
