<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, EyeOutlined,
  CheckOutlined, StopOutlined, FileExcelOutlined,
  DollarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { ordenesPagoService, proveedoresService } from '@/services/compras'

const router      = useRouter()
const loading     = ref(false)
const lista       = ref([])
const total       = ref(0)
const proveedores = ref([])

const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({ proveedor: null, estado: '', desde: '', hasta: '' })

// ─── KPIs ─────────────────────────────────────────────────────
const summary = computed(() => {
  const conf = lista.value.filter(o => o.estado === 'CN')
  return {
    total:       lista.value.length,
    confirmadas: conf.length,
    monto:       conf.reduce((s, o) => s + parseFloat(o.monto_total || 0), 0),
    borradores:  lista.value.filter(o => o.estado === 'BR').length,
  }
})

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtFecha = (v) => v ? new Date(v).toLocaleDateString('es-AR') : '—'
const hoy = () => new Date().toISOString().slice(0, 10)
const ESTADO_COLOR = { BR: 'default', CN: 'success', AN: 'error' }

// ─── Carga ────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const params = {
      limit:  pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }
    if (filters.proveedor) params.proveedor = filters.proveedor
    if (filters.estado)    params.estado    = filters.estado
    if (filters.desde)     params.desde     = filters.desde
    if (filters.hasta)     params.hasta     = filters.hasta

    const { data } = await ordenesPagoService.listar(params)
    lista.value = data?.results ?? data ?? []
    total.value = data?.count   ?? lista.value.length
  } catch { message.error('Error al cargar órdenes de pago.') }
  finally   { loading.value = false }
}

function onTableChange(p) { pagination.current = p.current; pagination.pageSize = p.pageSize; load() }
function onSearch()       { pagination.current = 1; load() }
function onReset()        { Object.assign(filters, { proveedor: null, estado: '', desde: '', hasta: '' }); pagination.current = 1; load() }

// ─── Acciones ─────────────────────────────────────────────────
const confirmar = (r) => {
  Modal.confirm({
    title: `¿Confirmar Orden de Pago #${r.numero}?`,
    content: 'Se aplicarán los movimientos financieros y se descontará el saldo de las cajas.',
    okText: 'Confirmar', okType: 'primary', cancelText: 'Cancelar',
    async onOk() {
      try { await ordenesPagoService.confirmar(r.id); message.success('Orden confirmada.'); load() }
      catch (e) { message.error(e.response?.data?.error ?? 'Error al confirmar.') }
    },
  })
}

const anular = (r) => {
  Modal.confirm({
    title: `¿Anular Orden de Pago #${r.numero}?`,
    okText: 'Anular', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await ordenesPagoService.anular(r.id); message.success('Orden anulada.'); load() }
      catch (e) { message.error(e.response?.data?.error ?? 'Error al anular.') }
    },
  })
}

const exportarCSV = () => {
  if (!lista.value.length) { message.warning('Sin datos.'); return }
  const rows = [
    ['N°', 'Proveedor', 'Fecha', 'Monto', 'Estado', 'Fin. Aplicado'],
    ...lista.value.map(o => [
      o.numero ?? '', o.proveedor_nombre,
      fmtFecha(o.fecha),
      parseFloat(o.monto_total || 0).toFixed(2),
      o.estado_display,
      o.finanzas_aplicadas ? 'Sí' : 'No',
    ]),
  ]
  const csv  = rows.map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `ordenes_pago_${hoy()}.csv`; a.click()
  URL.revokeObjectURL(url); message.success('Exportado.')
}

const columns = [
  { key: 'numero',           title: 'N°',         dataIndex: 'numero',           width: 90 },
  { key: 'proveedor_nombre', title: 'Proveedor',   dataIndex: 'proveedor_nombre', ellipsis: true },
  { key: 'fecha',            title: 'Fecha',       dataIndex: 'fecha',            width: 110 },
  { key: 'monto_total',      title: 'Monto',       dataIndex: 'monto_total',      width: 150, align: 'right' },
  { key: 'estado_display',   title: 'Estado',      dataIndex: 'estado_display',   width: 110 },
  { key: 'fin_aplicado',     title: 'Fin. Aplic.', width: 100, align: 'center' },
  { key: 'actions',          title: 'Acciones',    width: 110, align: 'center', fixed: 'right' },
]

onMounted(async () => {
  load()
  const res = await proveedoresService.listar({ page_size: 300 })
  proveedores.value = res.data.results ?? res.data
})
</script>

<template>
  <div class="ordenes-page">

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Compras · Gestión de Pagos</div>
        <h1 class="hero__title">Órdenes de Pago</h1>
        <p class="hero__subtitle">
          Registro de pagos a proveedores con imputación a facturas y movimientos financieros.
        </p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" @click="exportarCSV">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>
            Exportar CSV
          </a-button>
          <a-button size="large" :loading="loading" @click="load">
            <template #icon><ReloadOutlined /></template>
            Actualizar
          </a-button>
          <a-button type="primary" size="large" @click="router.push({ name: 'orden-pago-nueva' })">
            <template #icon><PlusOutlined /></template>
            Nueva Orden de Pago
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPI cards -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total (página)</div>
          <div class="kpi-card__value">{{ summary.total }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><CheckCircleOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Confirmadas</div>
          <div class="kpi-card__value">{{ summary.confirmadas }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Monto Pagado</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.monto) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--warn"><WarningOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Borradores</div>
          <div class="kpi-card__value" :class="summary.borradores > 0 ? 'kpi-warn' : ''">
            {{ summary.borradores }}
          </div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-select v-model:value="filters.proveedor" size="large" show-search allow-clear
            placeholder="Todos los proveedores" style="width:100%"
            option-filter-prop="label" @change="onSearch">
            <a-select-option v-for="p in proveedores" :key="p.id" :value="p.id" :label="p.razon_social">
              {{ p.razon_social }}
            </a-select-option>
          </a-select>
        </div>
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.estado" size="large" style="width:140px" @change="onSearch">
            <a-select-option value="">Todos</a-select-option>
            <a-select-option value="BR">Borrador</a-select-option>
            <a-select-option value="CN">Confirmado</a-select-option>
            <a-select-option value="AN">Anulado</a-select-option>
          </a-select>
          <a-input type="date" v-model:value="filters.desde" size="large" style="width:140px" @change="onSearch" />
          <span style="color:var(--text-2);align-self:center">—</span>
          <a-input type="date" v-model:value="filters.hasta" size="large" style="width:140px" @change="onSearch" />
          <a-button size="large" @click="onReset">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="lista"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: pagination.current, pageSize: pagination.pageSize, total,
          showSizeChanger: true,
          showTotal: t => `${t} órdenes`,
        }"
        :scroll="{ x: 900 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'numero'">
            <a class="doc-link"
              @click="router.push({ name: 'orden-pago-detalle', params: { id: record.id } })">
              #{{ record.numero ?? '—' }}
            </a>
          </template>

          <template v-if="column.key === 'proveedor_nombre'">
            <a class="prov-link"
              @click="router.push({ name: 'proveedor-detalle', params: { id: record.proveedor } })">
              {{ record.proveedor_nombre }}
            </a>
          </template>

          <template v-if="column.key === 'fecha'">
            <span class="date-cell">{{ fmtFecha(record.fecha) }}</span>
          </template>

          <template v-if="column.key === 'monto_total'">
            <span class="num-cell">{{ money(record.monto_total) }}</span>
          </template>

          <template v-if="column.key === 'estado_display'">
            <a-tag :color="ESTADO_COLOR[record.estado]">{{ record.estado_display }}</a-tag>
          </template>

          <template v-if="column.key === 'fin_aplicado'">
            <a-badge
              :status="record.finanzas_aplicadas ? 'success' : 'default'"
              :text="record.finanzas_aplicadas ? 'Sí' : 'No'"
            />
          </template>

          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip title="Ver detalle">
                <a-button size="small"
                  @click="router.push({ name: 'orden-pago-detalle', params: { id: record.id } })">
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

        <template #emptyText>
          <a-empty description="Sin órdenes de pago para los filtros seleccionados" />
        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.ordenes-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }

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
.kpi-card__icon--gold  { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #d97706; }
.kpi-card__icon--warn  { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #b45309; }
.kpi-card__label { font-size: 12px; color: var(--text-2); }
.kpi-card__value { font-size: 24px; font-weight: 800; color: var(--text-0); }
.kpi-card__value--money { font-size: 18px; }
.kpi-warn { color: #b45309; }

.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.filters-toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.filters-toolbar__left  { flex: 1; min-width: 260px; }
.filters-toolbar__right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.doc-link  { font-weight: 700; color: rgba(var(--accent-rgb),1); cursor: pointer; }
.doc-link:hover { text-decoration: underline; }
.prov-link { color: var(--text-0); cursor: pointer; }
.prov-link:hover { color: rgba(var(--accent-rgb),1); text-decoration: underline; }
.date-cell { font-size: 12px; color: var(--text-1); }
.num-cell  { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }

@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hero { flex-direction: column; }
  .filters-toolbar { flex-direction: column; align-items: stretch; }
}
</style>
