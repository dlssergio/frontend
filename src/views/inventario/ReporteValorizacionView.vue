<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined, FileExcelOutlined, FilePdfOutlined,
  BarChartOutlined, DollarOutlined, InboxOutlined, ShopOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'

const loading     = ref(false)
const exportingXls = ref(false)
const exportingPdf = ref(false)
const lineas      = ref([])
const resumen     = ref({ total_cantidad: 0, total_costo: 0, total_venta: 0 })
const depositos   = ref([])
const rubros      = ref([])

const filters = reactive({ deposito: null, rubro: null, solo_positivo: true })

const columns = [
  { title: 'Código',    dataIndex: 'cod_articulo',   width: 110, fixed: 'left' },
  { title: 'Descripción',dataIndex: 'descripcion',   ellipsis: true },
  { title: 'Rubro',     dataIndex: 'rubro',          width: 140, ellipsis: true },
  { title: 'Marca',     dataIndex: 'marca',          width: 120, ellipsis: true },
  { title: 'Depósito',  dataIndex: 'deposito',       width: 130, ellipsis: true },
  { title: 'Cantidad',  dataIndex: 'cantidad',       width: 100, align: 'right' },
  { title: 'Costo Unit.', dataIndex: 'costo_unitario', width: 130, align: 'right' },
  { title: 'Subtotal Costo', dataIndex: 'subtotal_costo', width: 150, align: 'right' },
  { title: 'Subtotal Venta', dataIndex: 'subtotal_venta', width: 150, align: 'right' },
  { title: 'Utilidad %', dataIndex: 'utilidad_pct',  width: 100, align: 'right' },
]

const summary = computed(() => ({
  articulos:   lineas.value.length,
  costo_total: parseFloat(resumen.value.total_costo || 0),
  venta_total: parseFloat(resumen.value.total_venta || 0),
  margen:      (() => {
    const c = parseFloat(resumen.value.total_costo || 0)
    const v = parseFloat(resumen.value.total_venta || 0)
    return c > 0 ? (((v - c) / c) * 100).toFixed(1) : '0.0'
  })(),
}))

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtNum = (v, d = 3) => parseFloat(v || 0).toFixed(d)

const cargar = async () => {
  loading.value = true
  try {
    const params = { solo_positivo: filters.solo_positivo }
    if (filters.deposito) params.deposito = filters.deposito
    if (filters.rubro)    params.rubro    = filters.rubro
    const res = await api.get('/api/inventario/valorizacion/', { params })
    lineas.value  = (res.data.lineas || []).map(l => ({
      ...l, key: `${l.articulo_id}-${l.deposito}`,
    }))
    resumen.value = { total_costo: res.data.total_costo, total_venta: res.data.total_venta, total_cantidad: res.data.total_cantidad }
    if (depositos.value.length === 0 && res.data.depositos) {
      depositos.value = res.data.depositos
    }
  } catch { message.error('Error al cargar la valorización.') }
  finally   { loading.value = false }
}

const exportar = async (formato) => {
  const flag    = formato === 'excel' ? exportingXls : exportingPdf
  flag.value    = true
  try {
    const params  = {}
    if (filters.deposito) params.deposito = filters.deposito
    const url  = `/api/inventario/valorizacion/exportar_${formato === 'excel' ? 'excel' : 'pdf'}/`
    const res  = await api.get(url, { params, responseType: 'blob' })
    const ext  = formato === 'excel' ? 'xlsx' : 'pdf'
    const mime = formato === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf'
    const blob   = new Blob([res.data], { type: mime })
    const link   = document.createElement('a')
    link.href    = URL.createObjectURL(blob)
    link.download = `valorizacion_${new Date().toISOString().slice(0,10)}.${ext}`
    link.click()
    URL.revokeObjectURL(link.href)
  } catch { message.error(`Error al exportar ${formato}.`) }
  finally   { flag.value = false }
}

const cargarAuxiliares = async () => {
  try {
    const [dR, rR] = await Promise.allSettled([
      api.get('/api/inventario/depositos/'),
      api.get('/api/rubros/'),
    ])
    if (dR.status === 'fulfilled') depositos.value = dR.value.data.results ?? dR.value.data
    if (rR.status === 'fulfilled') rubros.value    = rR.value.data.results ?? rR.value.data
  } catch { /* silencioso */ }
}

onMounted(async () => { await cargarAuxiliares(); cargar() })
</script>

<template>
  <div class="valorizacion-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Reportes</div>
        <h1 class="hero__title">Valorización de Inventario</h1>
        <p class="hero__subtitle">Valor del stock actual a costo y precio de venta, por artículo y depósito.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :loading="exportingXls" @click="exportar('excel')">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>
            Excel
          </a-button>
          <a-button size="large" :loading="exportingPdf" @click="exportar('pdf')">
            <template #icon><FilePdfOutlined style="color:#ef4444" /></template>
            PDF
          </a-button>
          <a-button size="large" :loading="loading" @click="cargar">
            <template #icon><ReloadOutlined /></template>
            Actualizar
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPIs -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><InboxOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Artículos en stock</div>
          <div class="kpi-card__value">{{ summary.articulos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Valor a Costo</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.costo_total) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><ShopOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Valor a Precio Venta</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.venta_total) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><BarChartOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Margen sobre Costo</div>
          <div class="kpi-card__value">{{ summary.margen }}%</div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-select v-model:value="filters.deposito" allow-clear placeholder="Todos los depósitos"
            size="large" style="width:220px" @change="cargar">
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.rubro" allow-clear placeholder="Todos los rubros"
            size="large" style="width:200px" @change="cargar">
            <a-select-option v-for="r in rubros" :key="r.id" :value="r.id">{{ r.nombre }}</a-select-option>
          </a-select>
          <a-checkbox v-model:checked="filters.solo_positivo" @change="cargar">
            Solo stock positivo
          </a-checkbox>
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="lineas"
        :loading="loading"
        row-key="key"
        :pagination="{ pageSize: 50, showTotal: t => `${t} ítems`, showSizeChanger: true }"
        :scroll="{ x: 1200 }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'cantidad'">
            <span class="num">{{ fmtNum(record.cantidad) }}</span>
          </template>
          <template v-if="column.dataIndex === 'costo_unitario'">
            <span class="num">{{ money(record.costo_unitario) }}</span>
          </template>
          <template v-if="column.dataIndex === 'subtotal_costo'">
            <span class="num num-bold">{{ money(record.subtotal_costo) }}</span>
          </template>
          <template v-if="column.dataIndex === 'subtotal_venta'">
            <span class="num num-green">{{ money(record.subtotal_venta) }}</span>
          </template>
          <template v-if="column.dataIndex === 'utilidad_pct'">
            <span class="num">{{ fmtNum(record.utilidad_pct, 1) }}%</span>
          </template>
        </template>

        <template #summary>
          <a-table-summary fixed>
            <a-table-summary-row class="summary-row">
              <a-table-summary-cell :index="0" :col-span="7" align="right">
                <strong style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-2)">TOTALES</strong>
              </a-table-summary-cell>
              <a-table-summary-cell :index="7" align="right">
                <strong class="sum-val">{{ money(summary.costo_total) }}</strong>
              </a-table-summary-cell>
              <a-table-summary-cell :index="8" align="right">
                <strong class="sum-val sum-val--green">{{ money(summary.venta_total) }}</strong>
              </a-table-summary-cell>
              <a-table-summary-cell :index="9" align="right">
                <strong class="sum-val">{{ summary.margen }}%</strong>
              </a-table-summary-cell>
            </a-table-summary-row>
          </a-table-summary>
        </template>

      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.valorizacion-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:20px 22px; border-radius:6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; line-height:1.08; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.kpi-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display:flex; align-items:center; gap:14px; }
.kpi-card__icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; font-size:20px; }
.kpi-card__icon--blue  { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 14%,transparent); color:rgba(var(--accent-rgb),1); }
.kpi-card__icon--red   { background:color-mix(in srgb,#ef4444 14%,transparent); color:#dc2626; }
.kpi-card__icon--green { background:color-mix(in srgb,#16a34a 14%,transparent); color:#16a34a; }
.kpi-card__icon--gold  { background:color-mix(in srgb,#f59e0b 14%,transparent); color:#d97706; }
.kpi-card__label { font-size:12px; color:var(--text-2); }
.kpi-card__value { font-size:24px; font-weight:800; color:var(--text-0); }
.kpi-card__value--money { font-size:18px; }
.filters-card,.table-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.filters-toolbar { display:flex; justify-content:space-between; gap:16px; align-items:center; }
.filters-toolbar__left { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
.num       { font-variant-numeric:tabular-nums; font-size:12px; }
.num-bold  { font-weight:700; color:var(--text-0); }
.num-green { font-weight:700; color:#16a34a; }
.summary-row :deep(td) { background:var(--surface-1,#f1f5f9)!important; }
.sum-val       { font-size:13px; font-variant-numeric:tabular-nums; color:var(--text-0); }
.sum-val--green { color:#16a34a; }
@media (max-width:1200px) { .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .hero { flex-direction:column; } }
</style>
