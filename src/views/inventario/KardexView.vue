<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined, SearchOutlined, ArrowLeftOutlined,
  FileExcelOutlined, ArrowUpOutlined, ArrowDownOutlined,
  HistoryOutlined, InboxOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { articulosService, depositosService } from '@/services/inventario'

const route  = useRoute()
const router = useRouter()

const loading     = ref(false)
const artBuscando = ref(false)
const artOptions  = ref([])
const artSelecId  = ref(route.query.articulo ?? null)
const articulo    = ref(null)
const depositos   = ref([])
const kardexFilas = ref([])
const saldoFinal  = ref(0)
const totalMovs   = ref(0)

const filters = reactive({
  deposito: null,
  desde:    '',
  hasta:    '',
  origen:   '',
})

const columns = [
  { title: 'Fecha',     dataIndex: 'fecha',            width: 150 },
  { title: 'Depósito',  dataIndex: 'deposito',         width: 130, ellipsis: true },
  { title: 'Tipo',      dataIndex: 'tipo_nombre',      width: 130, ellipsis: true },
  { title: 'Origen',    dataIndex: 'origen_sistema',   width: 110 },
  { title: 'Referencia',dataIndex: 'origen_referencia',ellipsis: true },
  { title: 'Entrada',   dataIndex: 'entrada',          width: 100, align: 'right' },
  { title: 'Salida',    dataIndex: 'salida',           width: 100, align: 'right' },
  { title: 'Saldo',     dataIndex: 'saldo',            width: 100, align: 'right' },
  { title: 'Usuario',   dataIndex: 'usuario',          width: 130, ellipsis: true },
]

const summary = computed(() => {
  const entradas = kardexFilas.value.reduce((s, r) => s + parseFloat(r.entrada || 0), 0)
  const salidas  = kardexFilas.value.reduce((s, r) => s + parseFloat(r.salida  || 0), 0)
  return { entradas, salidas, saldo: saldoFinal.value, total: totalMovs.value }
})

const fmtNum   = (v) => v && parseFloat(v) !== 0 ? parseFloat(v).toFixed(3) : '—'
const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'

let buscarTimer = null
const buscarArticulo = (query) => {
  if (!query || query.length < 2) { artOptions.value = []; return }
  clearTimeout(buscarTimer)
  buscarTimer = setTimeout(async () => {
    artBuscando.value = true
    try {
      const res = await articulosService.buscar(query)
      const lista = res.data.results ?? res.data
      artOptions.value = lista.map(a => ({
        value: a.id, label: `${a.cod_articulo} — ${a.descripcion}`,
        cod: a.cod_articulo, desc: a.descripcion,
      }))
    } finally { artBuscando.value = false }
  }, 300)
}

const onSelectArticulo = async (id, option) => {
  artSelecId.value = id
  articulo.value   = { id, cod_articulo: option.cod, descripcion: option.desc }
  await cargarKardex()
}

const cargarKardex = async () => {
  if (!artSelecId.value) return
  loading.value = true
  try {
    const params = { articulo: artSelecId.value }
    if (filters.deposito) params.deposito = filters.deposito
    if (filters.desde)    params.desde    = filters.desde
    if (filters.hasta)    params.hasta    = filters.hasta
    const res = await api.get(`/api/articulos/${artSelecId.value}/kardex/`, { params })
    kardexFilas.value = res.data.kardex ?? []
    saldoFinal.value  = res.data.saldo_final ?? 0
    totalMovs.value   = res.data.total_movimientos ?? 0
    if (res.data.cod_articulo) {
      articulo.value = {
        id: artSelecId.value,
        cod_articulo: res.data.cod_articulo,
        descripcion:  res.data.descripcion,
      }
    }
  } catch { message.error('Error al cargar el kardex.') }
  finally   { loading.value = false }
}

const exportarCSV = () => {
  if (!kardexFilas.value.length) { message.warning('Sin datos'); return }
  const rows = [
    ['Fecha', 'Depósito', 'Tipo', 'Origen', 'Referencia', 'Entrada', 'Salida', 'Saldo', 'Usuario'],
    ...kardexFilas.value.map(r => [
      fmtFecha(r.fecha), r.deposito, r.tipo_nombre,
      r.origen_sistema, r.origen_referencia,
      r.entrada || '', r.salida || '', r.saldo, r.usuario ?? '',
    ]),
  ]
  const csv  = rows.map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `kardex_${articulo.value?.cod_articulo ?? 'art'}_${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

onMounted(async () => {
  try {
    const res = await depositosService.listar()
    depositos.value = res.data.results ?? res.data
  } catch { /* silencioso */ }
  if (artSelecId.value) cargarKardex()
})
</script>

<template>
  <div class="kardex-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Trazabilidad</div>
        <h1 class="hero__title">Kardex de Stock</h1>
        <p class="hero__subtitle">Historial completo de movimientos de un artículo con saldo acumulado.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :disabled="!kardexFilas.length" @click="exportarCSV">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>
            Exportar CSV
          </a-button>
          <a-button size="large" :loading="loading" :disabled="!artSelecId" @click="cargarKardex">
            <template #icon><ReloadOutlined /></template>
            Actualizar
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPIs (solo visibles cuando hay datos) -->
    <section v-if="artSelecId" class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><HistoryOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total movimientos</div>
          <div class="kpi-card__value">{{ summary.total }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><ArrowUpOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total Entradas</div>
          <div class="kpi-card__value">{{ summary.entradas.toFixed(3) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><ArrowDownOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total Salidas</div>
          <div class="kpi-card__value">{{ summary.salidas.toFixed(3) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><InboxOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo Final</div>
          <div class="kpi-card__value" :class="summary.saldo <= 0 ? 'kpi-val--red' : ''">
            {{ parseFloat(summary.saldo).toFixed(3) }}
          </div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-select
            v-model:value="artSelecId"
            show-search :filter-option="false"
            placeholder="Buscar artículo por código o descripción…"
            size="large"
            style="width:360px"
            :loading="artBuscando"
            :not-found-content="artBuscando ? undefined : 'Escribí para buscar'"
            @search="buscarArticulo"
            @select="(id, opt) => onSelectArticulo(id, opt)"
          >
            <a-select-option v-for="opt in artOptions" :key="opt.value" :value="opt.value"
              :cod="opt.cod" :desc="opt.desc">
              <span class="opt-cod">{{ opt.cod }}</span>
              <span class="opt-desc">{{ opt.desc }}</span>
            </a-select-option>
          </a-select>

          <a-select v-model:value="filters.deposito" allow-clear placeholder="Todos los depósitos"
            size="large" style="width:200px" @change="cargarKardex">
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
          </a-select>

          <a-input type="date" v-model:value="filters.desde" size="large" style="width:145px" @change="cargarKardex" />
          <span style="color:var(--text-2)">—</span>
          <a-input type="date" v-model:value="filters.hasta" size="large" style="width:145px" @change="cargarKardex" />
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">

      <div v-if="articulo" class="articulo-header">
        <span class="articulo-cod">{{ articulo.cod_articulo }}</span>
        <span class="articulo-desc">{{ articulo.descripcion }}</span>
      </div>

      <a-table
        :columns="columns"
        :data-source="kardexFilas"
        :loading="loading"
        row-key="id"
        size="small"
        :pagination="{ pageSize: 50, showTotal: t => `${t} movimientos`, showSizeChanger: true }"
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fecha'">
            <span class="fecha-cell">{{ fmtFecha(record.fecha) }}</span>
          </template>
          <template v-if="column.dataIndex === 'entrada'">
            <span v-if="record.entrada" class="entrada-val">
              <ArrowUpOutlined style="font-size:10px;margin-right:2px" />
              {{ fmtNum(record.entrada) }}
            </span>
            <span v-else class="dash">—</span>
          </template>
          <template v-if="column.dataIndex === 'salida'">
            <span v-if="record.salida" class="salida-val">
              <ArrowDownOutlined style="font-size:10px;margin-right:2px" />
              {{ fmtNum(record.salida) }}
            </span>
            <span v-else class="dash">—</span>
          </template>
          <template v-if="column.dataIndex === 'saldo'">
            <span class="saldo-val" :class="record.saldo <= 0 ? 'saldo-zero' : ''">
              {{ fmtNum(record.saldo) }}
            </span>
          </template>
        </template>

        <template #emptyText>
          <a-empty
            :description="artSelecId ? 'Sin movimientos para los filtros aplicados' : 'Buscá un artículo para ver su kardex'"
            :image="false"
          />
        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.kardex-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:20px 22px; border-radius:6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; line-height:1.08; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.kpi-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display:flex; align-items:center; gap:14px; }
.kpi-card__icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; font-size:20px; }
.kpi-card__icon--blue  { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 14%,transparent); color:rgba(var(--accent-rgb),1); }
.kpi-card__icon--green { background:color-mix(in srgb,#16a34a 14%,transparent); color:#16a34a; }
.kpi-card__icon--red   { background:color-mix(in srgb,#ef4444 14%,transparent); color:#dc2626; }
.kpi-card__icon--gold  { background:color-mix(in srgb,#f59e0b 14%,transparent); color:#d97706; }
.kpi-card__label { font-size:12px; color:var(--text-2); }
.kpi-card__value { font-size:24px; font-weight:800; color:var(--text-0); }
.kpi-val--red { color:#dc2626; }
.filters-card,.table-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.filters-toolbar { display:flex; justify-content:space-between; gap:16px; align-items:center; }
.filters-toolbar__left { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.opt-cod  { font-family:monospace; font-size:12px; color:var(--text-2); margin-right:6px; }
.opt-desc { font-size:13px; color:var(--text-0); }
.articulo-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; padding-bottom:12px; border-bottom:1px solid var(--border,#f0f0f0); }
.articulo-cod    { font-family:monospace; font-size:13px; font-weight:700; color:var(--primary,#1e40af); background:color-mix(in srgb,rgba(var(--accent-rgb),1) 10%,transparent); padding:3px 10px; border-radius:5px; }
.articulo-desc   { font-size:15px; font-weight:700; color:var(--text-0); }
.fecha-cell  { font-size:12px; color:var(--text-1); }
.entrada-val { font-variant-numeric:tabular-nums; color:#16a34a; font-weight:700; font-size:12px; }
.salida-val  { font-variant-numeric:tabular-nums; color:#dc2626; font-weight:700; font-size:12px; }
.saldo-val   { font-variant-numeric:tabular-nums; font-weight:700; font-size:13px; color:var(--text-0); }
.saldo-zero  { color:#dc2626; }
.dash        { color:var(--text-2); }
@media (max-width:1200px) { .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .hero { flex-direction:column; } }
</style>
