<script setup>
/**
 * ComprobantesCompraListView.vue
 * Mismo patrón Enterprise que ConsultaComprobantes de ventas:
 * - Hero section con KPIs
 * - Filtros rápidos (quick ranges) + filtros avanzados
 * - Columnas configurables (localStorage)
 * - Exportar CSV
 * - Sin botón "Nueva Factura" — esa acción va al menú de navegación
 */
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  SearchOutlined, ReloadOutlined, EyeOutlined,
  CheckOutlined, StopOutlined, SettingOutlined,
  FileExcelOutlined, CheckCircleOutlined,
  DollarOutlined, FileTextOutlined, WarningOutlined,
} from '@ant-design/icons-vue'
import { comprobantesCompraService, proveedoresService } from '@/services/compras'
import api from '@/services/api'

const router = useRouter()
const STORAGE_COLS_KEY = 'compras-comprobantes-cols-v1'

// ─── Estado ───────────────────────────────────────────────────
const loading     = ref(false)
const rows        = ref([])
const total       = ref(0)
const proveedores = ref([])
const tiposComp   = ref([])

const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({
  search:          '',
  estado:          'CN',
  proveedor:       null,
  tipo_comprobante:null,
  desde:           '',
  hasta:           '',
})

// Rangos rápidos
const QUICK_RANGES = [
  { label: 'Hoy',      desde: () => hoy(),          hasta: () => hoy() },
  { label: 'Semana',   desde: () => startOfWeek(),  hasta: () => hoy() },
  { label: 'Mes',      desde: () => startOfMonth(), hasta: () => hoy() },
  { label: 'Trimestre',desde: () => startOfQ(),     hasta: () => hoy() },
]

const hoy          = () => new Date().toISOString().slice(0, 10)
const startOfWeek  = () => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10) }
const startOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const startOfQ     = () => {
  const m = new Date().getMonth()
  const q = Math.floor(m / 3) * 3
  return new Date(new Date().getFullYear(), q, 1).toISOString().slice(0, 10)
}

const applyRange = (r) => {
  filters.desde = r.desde()
  filters.hasta = r.hasta()
  load()
}

// ─── Columnas configurables ───────────────────────────────────
const ALL_COLUMNS = [
  { key: 'numero_completo', title: 'Comprobante',   width: 150, fixedLeft: true },
  { key: 'fecha',           title: 'Fecha',          width: 110 },
  { key: 'proveedor_nombre',title: 'Proveedor',      width: 240 },
  { key: 'tipo_nombre',     title: 'Tipo',           width: 130, align: 'center' },
  { key: 'condicion_display',title: 'Condición',     width: 110, align: 'center' },
  { key: 'estado_display',  title: 'Estado',         width: 110, align: 'center' },
  { key: 'total',           title: 'Total',          width: 130, align: 'right' },
  { key: 'saldo_pendiente', title: 'Saldo Pendiente',width: 140, align: 'right' },
  { key: 'actions',         title: '',               width: 100, fixedRight: true },
]

const visibleCols = ref(loadCols())
function loadCols() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_COLS_KEY) || 'null')
    if (Array.isArray(s) && s.length) return new Set(s)
  } catch (_) {}
  return new Set(ALL_COLUMNS.map(c => c.key))
}
watch(visibleCols, (v) => localStorage.setItem(STORAGE_COLS_KEY, JSON.stringify([...v])), { deep: true })

const tableColumns = computed(() => {
  const cols = ALL_COLUMNS.filter(c => visibleCols.value.has(c.key))
  return cols.map(c => ({
    key:       c.key,
    title:     c.title,
    dataIndex: c.key,
    width:     c.width,
    align:     c.align,
    fixed:     c.fixedLeft ? 'left' : (c.fixedRight ? 'right' : undefined),
    ellipsis:  ['proveedor_nombre', 'tipo_nombre'].includes(c.key),
  }))
})

const colOptions = computed(() =>
  ALL_COLUMNS.map(c => ({ label: c.title, value: c.key }))
)

// ─── KPIs de la página actual ─────────────────────────────────
const kpis = computed(() => {
  const conf = rows.value.filter(r => r.estado === 'CN')
  return {
    total:     rows.value.length,
    confirmados: conf.length,
    monto:     conf.reduce((s, r) => s + parseFloat(r.total || 0), 0),
    pendiente: conf.reduce((s, r) => s + parseFloat(r.saldo_pendiente || 0), 0),
  }
})

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtFecha = (v) => v ? new Date(v).toLocaleDateString('es-AR') : '—'

const ESTADO_COLOR = { BR: 'default', CN: 'success', AN: 'error' }

// ─── Carga ────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const params = {
      limit:  pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }
    if (filters.search)            params.search           = filters.search
    if (filters.estado)            params.estado           = filters.estado
    if (filters.proveedor)         params.proveedor        = filters.proveedor
    if (filters.tipo_comprobante)  params.tipo_comprobante = filters.tipo_comprobante
    if (filters.desde)             params.desde            = filters.desde
    if (filters.hasta)             params.hasta            = filters.hasta

    const { data } = await comprobantesCompraService.listar(params)
    rows.value  = data?.results ?? data ?? []
    total.value = data?.count   ?? rows.value.length
  } catch { message.error('Error al cargar comprobantes.') }
  finally   { loading.value = false }
}

function onTableChange(p) { pagination.current = p.current || 1; pagination.pageSize = p.pageSize || 20; load() }
function onSearch()       { pagination.current = 1; load() }
function onReset()        {
  Object.assign(filters, { search: '', estado: 'CN', proveedor: null, tipo_comprobante: null, desde: '', hasta: '' })
  pagination.current = 1; load()
}

// ─── Acciones ─────────────────────────────────────────────────
const confirmar = (r) => {
  Modal.confirm({
    title:   `¿Confirmar ${r.tipo_nombre} ${r.numero_completo}?`,
    content: 'Impacta en stock y cuenta corriente del proveedor.',
    okText: 'Confirmar', okType: 'primary', cancelText: 'Cancelar',
    async onOk() {
      try { await comprobantesCompraService.confirmar(r.id); message.success('Confirmado.'); load() }
      catch (e) { message.error(e.response?.data?.error ?? 'Error al confirmar.') }
    },
  })
}
const anular = (r) => {
  Modal.confirm({
    title: `¿Anular ${r.tipo_nombre} ${r.numero_completo}?`,
    okText: 'Anular', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await comprobantesCompraService.anular(r.id); message.success('Anulado.'); load() }
      catch (e) { message.error(e.response?.data?.error ?? 'Error al anular.') }
    },
  })
}

const exportarCSV = () => {
  if (!rows.value.length) { message.warning('Sin datos.'); return }
  const headers = tableColumns.value.map(c => c.title).filter(Boolean)
  const dataRows = rows.value.map(r => [
    r.numero_completo, fmtFecha(r.fecha), r.proveedor_nombre,
    r.tipo_nombre, r.condicion_display, r.estado_display,
    parseFloat(r.total || 0).toFixed(2),
    parseFloat(r.saldo_pendiente || 0).toFixed(2),
  ])
  const csv  = [headers, ...dataRows].map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `comprobantes_compra_${hoy()}.csv`
  a.click(); URL.revokeObjectURL(url)
  message.success('Exportado.')
}

onMounted(async () => {
  load()
  const [pR, tR] = await Promise.allSettled([
    proveedoresService.listar({ page_size: 300 }),
    api.get('/api/tipos-comprobante/'),
  ])
  if (pR.status === 'fulfilled') proveedores.value = pR.value.data.results ?? pR.value.data
  if (tR.status === 'fulfilled') {
    tiposComp.value = (tR.value.data.results ?? tR.value.data).filter(t => t.clase === 'C')
  }
})
</script>

<template>
  <div class="comprobantes-page">

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Compras · Gestión de Comprobantes</div>
        <h1 class="hero__title">Comprobantes de Compra</h1>
        <p class="hero__subtitle">Facturas, remitos y órdenes de compra recibidos de proveedores.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-dropdown trigger="click">
            <a-button size="large"><template #icon><SettingOutlined /></template>Columnas</a-button>
            <template #overlay>
              <a-menu class="col-menu">
                <div class="col-menu__title">Columnas visibles</div>
                <div class="col-menu__body">
                  <a-checkbox-group
                    :value="[...visibleCols]"
                    :options="colOptions"
                    @change="(v) => visibleCols = new Set(v)"
                  />
                </div>
              </a-menu>
            </template>
          </a-dropdown>
          <a-button size="large" @click="exportarCSV">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>Exportar CSV
          </a-button>
          <a-button size="large" :loading="loading" @click="load">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPI cards -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><FileTextOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total (página)</div>
          <div class="kpi-card__value">{{ kpis.total }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><CheckCircleOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Confirmados</div>
          <div class="kpi-card__value">{{ kpis.confirmados }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total Facturado</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(kpis.monto) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><WarningOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo Pendiente</div>
          <div class="kpi-card__value kpi-card__value--money" style="color:#dc2626">
            {{ money(kpis.pendiente) }}
          </div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <!-- Rangos rápidos -->
      <div class="quick-ranges">
        <span class="quick-label">Período:</span>
        <a-button
          v-for="r in QUICK_RANGES" :key="r.label"
          size="small" @click="applyRange(r)"
        >{{ r.label }}</a-button>
        <a-button size="small" @click="onReset">Todo</a-button>
      </div>

      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-input-search
            v-model:value="filters.search" size="large" allow-clear
            placeholder="N° comprobante, proveedor…" @search="onSearch"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input-search>
        </div>
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.proveedor" show-search allow-clear
            placeholder="Proveedor" size="large" style="width:200px"
            option-filter-prop="label" @change="onSearch">
            <a-select-option v-for="p in proveedores" :key="p.id" :value="p.id" :label="p.razon_social">
              {{ p.razon_social }}
            </a-select-option>
          </a-select>

          <a-select v-model:value="filters.tipo_comprobante" allow-clear
            placeholder="Tipo" size="large" style="width:150px" @change="onSearch">
            <a-select-option v-for="t in tiposComp" :key="t.id" :value="t.id">
              {{ t.nombre }}
            </a-select-option>
          </a-select>

          <a-select v-model:value="filters.estado" size="large" style="width:140px" @change="onSearch">
            <a-select-option value="">Todos los estados</a-select-option>
            <a-select-option value="BR">Borrador</a-select-option>
            <a-select-option value="CN">Confirmado</a-select-option>
            <a-select-option value="AN">Anulado</a-select-option>
          </a-select>

          <a-input type="date" v-model:value="filters.desde" size="large"
            style="width:140px" @change="onSearch" />
          <span style="color:var(--text-2);align-self:center">—</span>
          <a-input type="date" v-model:value="filters.hasta" size="large"
            style="width:140px" @change="onSearch" />

          <a-button size="large" @click="onReset">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="tableColumns"
        :data-source="rows"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: pagination.current, pageSize: pagination.pageSize, total,
          showTotal: t => `${t} comprobantes`,
          showSizeChanger: true, pageSizeOptions: ['10','20','50','100'],
        }"
        :scroll="{ x: 1200 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'numero_completo'">
            <a class="doc-link"
              @click="router.push({ name: 'compra-detalle', params: { id: record.id } })">
              {{ record.numero_completo }}
            </a>
          </template>

          <template v-else-if="column.key === 'fecha'">
            <span class="date-cell">{{ fmtFecha(record.fecha) }}</span>
          </template>

          <template v-else-if="column.key === 'proveedor_nombre'">
            <a class="prov-link"
              @click="router.push({ name: 'proveedor-detalle', params: { id: record.proveedor } })">
              {{ record.proveedor_nombre }}
            </a>
          </template>

          <template v-else-if="column.key === 'tipo_nombre'">
            <a-tag>{{ record.tipo_nombre }}</a-tag>
          </template>

          <template v-else-if="column.key === 'condicion_display'">
            <a-tag color="blue">{{ record.condicion_display }}</a-tag>
          </template>

          <template v-else-if="column.key === 'estado_display'">
            <a-tag :color="ESTADO_COLOR[record.estado]">{{ record.estado_display }}</a-tag>
          </template>

          <template v-else-if="column.key === 'total'">
            <span class="num-cell">{{ money(record.total) }}</span>
          </template>

          <template v-else-if="column.key === 'saldo_pendiente'">
            <span class="num-cell" :class="parseFloat(record.saldo_pendiente) > 0 ? 'debt-cell' : ''">
              {{ money(record.saldo_pendiente) }}
            </span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-tooltip title="Ver detalle">
                <a-button size="small"
                  @click="router.push({ name: 'compra-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado === 'BR'" title="Confirmar">
                <a-button size="small" @click="confirmar(record)">
                  <template #icon><CheckOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado !== 'AN'" title="Anular">
                <a-button size="small" danger @click="anular(record)">
                  <template #icon><StopOutlined /></template>
                </a-button>
              </a-tooltip>
            </a-space>
          </template>

        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.comprobantes-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }

.hero {
  display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
  padding: 20px 22px; border-radius: 6px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--surface-1) 92%, transparent),
      color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0,0,0,.08);
}
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display: flex; align-items: center; gap: 14px; }
.kpi-card__icon { width: 46px; height: 46px; border-radius: 6px; display: grid; place-items: center; font-size: 20px; }
.kpi-card__icon--blue  { background: color-mix(in srgb, rgba(var(--accent-rgb),1) 14%, transparent); color: rgba(var(--accent-rgb),1); }
.kpi-card__icon--green { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.kpi-card__icon--red   { background: color-mix(in srgb, #ef4444 14%, transparent); color: #dc2626; }
.kpi-card__icon--gold  { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #d97706; }
.kpi-card__label { font-size: 12px; color: var(--text-2); }
.kpi-card__value { font-size: 24px; font-weight: 800; color: var(--text-0); }
.kpi-card__value--money { font-size: 18px; }

.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.quick-ranges { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.quick-label  { font-size: 12px; font-weight: 600; color: var(--text-2); }
.filters-toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.filters-toolbar__left  { flex: 1; min-width: 260px; }
.filters-toolbar__right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.doc-link  { font-family: monospace; font-size: 13px; font-weight: 700; color: rgba(var(--accent-rgb),1); cursor: pointer; }
.doc-link:hover { text-decoration: underline; }
.prov-link { color: var(--text-0); cursor: pointer; }
.prov-link:hover { color: rgba(var(--accent-rgb),1); text-decoration: underline; }
.date-cell { font-size: 12px; color: var(--text-1); }
.num-cell  { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12px; }
.debt-cell { color: #dc2626; }

.col-menu { padding: 10px 0; min-width: 260px; background: var(--surface-0); }
.col-menu__title { padding: 0 14px 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
.col-menu__body  { padding: 0 14px 8px; }
.col-menu__body :deep(.ant-checkbox-group) { display: grid; gap: 10px; }

@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hero { flex-direction: column; }
  .filters-toolbar { flex-direction: column; align-items: stretch; }
}
</style>
