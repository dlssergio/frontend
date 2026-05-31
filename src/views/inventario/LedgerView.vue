<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, FilterOutlined } from '@ant-design/icons-vue'
import { ledgerService, depositosService } from '@/services/inventario'
import api from '@/services/api'

const loading  = ref(false)
const registros = ref([])
const depositos = ref([])

const pagination = reactive({ current: 1, pageSize: 25, total: 0 })
const filters    = reactive({ articulo_desc: '', deposito: null, origen_sistema: '', desde: null, hasta: null })
const filtersVisible = ref(false)

const ORIGENES = ['VENTAS', 'COMPRAS', 'AJUSTE_MANUAL', 'MOV_INTERNO', 'TRANSFERENCIA', 'MIGRACION']

const columns = [
  { title: 'Fecha mov.',  dataIndex: 'fecha_movimiento', width: 155, sorter: true },
  { title: 'Artículo',    dataIndex: 'articulo_descripcion', ellipsis: true },
  { title: 'Cód.',        dataIndex: 'articulo_codigo',  width: 90 },
  { title: 'Depósito',    dataIndex: 'deposito_nombre',  width: 130, ellipsis: true },
  { title: 'Tipo Stock',  dataIndex: 'tipo_codigo',      width: 95, align: 'center' },
  { title: 'Origen',      dataIndex: 'origen_sistema',   width: 130 },
  { title: 'Referencia',  dataIndex: 'origen_referencia',ellipsis: true },
  { title: 'Cantidad',    dataIndex: 'cantidad',          width: 100, align: 'right' },
  { title: 'Usuario',     dataIndex: 'usuario_nombre',   width: 110, ellipsis: true },
]

let searchTimer = null
const cargar = async () => {
  loading.value = true
  try {
    const params = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.deposito)        params.deposito        = filters.deposito
    if (filters.origen_sistema)  params.origen_sistema  = filters.origen_sistema
    if (filters.desde)           params.desde           = filters.desde
    if (filters.hasta)           params.hasta           = filters.hasta
    // Búsqueda por descripción de artículo: pasamos como query de artículo si hay texto
    // El endpoint acepta ?articulo=<id>; para buscar por texto habría que resolverlo
    // en un step previo — por ahora filtramos client-side si hay texto en el campo

    const res  = await ledgerService.listar(params)
    const data = res.data
    let rows   = data.results ?? data
    if (filters.articulo_desc) {
      const q = filters.articulo_desc.toLowerCase()
      rows = rows.filter(r =>
        r.articulo_descripcion?.toLowerCase().includes(q) ||
        r.articulo_codigo?.toLowerCase().includes(q)
      )
    }
    registros.value  = rows
    pagination.total = data.count ?? rows.length
  } catch {
    message.error('Error al cargar el historial.')
  } finally {
    loading.value = false
  }
}

const onTableChange = (pag) => { pagination.current = pag.current; pagination.pageSize = pag.pageSize; cargar() }
const resetFilters  = () => { Object.assign(filters, { articulo_desc:'', deposito:null, origen_sistema:'', desde:null, hasta:null }); pagination.current=1; cargar() }

const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'
const fmtQty   = (v) => {
  const n = parseFloat(v)
  return (n >= 0 ? '+' : '') + n.toFixed(3)
}

onMounted(async () => {
  const res = await depositosService.listar().catch(() => null)
  if (res) depositos.value = res.data.results ?? res.data
  cargar()
})
</script>

<template>
  <div class="page-root">

    <div class="toolbar">
      <div class="toolbar-left">
        <h1 class="page-title">Historial de Movimientos</h1>
        <a-badge :count="Object.values(filters).filter(Boolean).length" :offset="[-4,4]">
          <a-button @click="filtersVisible = !filtersVisible" :type="filtersVisible ? 'primary' : 'default'">
            <FilterOutlined /> Filtros
          </a-button>
        </a-badge>
        <a-button @click="resetFilters"><ReloadOutlined /></a-button>
      </div>
      <span class="total-label">{{ pagination.total }} registros</span>
    </div>

    <transition name="slide-down">
      <div v-if="filtersVisible" class="filter-panel">
        <div class="filter-row">
          <div class="filter-field filter-field--wide">
            <label>Artículo</label>
            <a-input
              v-model:value="filters.articulo_desc"
              placeholder="Buscar por código o descripción"
              allow-clear
              @input="() => { clearTimeout(searchTimer); searchTimer = setTimeout(cargar, 350) }"
            />
          </div>
          <div class="filter-field">
            <label>Depósito</label>
            <a-select v-model:value="filters.deposito" allow-clear placeholder="Todos" style="width:100%" @change="cargar">
              <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
            </a-select>
          </div>
          <div class="filter-field">
            <label>Origen del sistema</label>
            <a-select v-model:value="filters.origen_sistema" allow-clear placeholder="Todos" style="width:100%" @change="cargar">
              <a-select-option v-for="o in ORIGENES" :key="o" :value="o">{{ o }}</a-select-option>
            </a-select>
          </div>
          <div class="filter-field">
            <label>Desde</label>
            <a-input type="date" v-model:value="filters.desde" @change="cargar" />
          </div>
          <div class="filter-field">
            <label>Hasta</label>
            <a-input type="date" v-model:value="filters.hasta" @change="cargar" />
          </div>
        </div>
      </div>
    </transition>

    <a-table
      :columns="columns"
      :data-source="registros"
      :loading="loading"
      row-key="id"
      :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, pageSizeOptions: ['25','50','100'], showTotal: t => `${t} registros` }"
      size="small"
      class="erp-table ledger-table"
      bordered
      :scroll="{ x: 1100 }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">

        <template v-if="column.dataIndex === 'fecha_movimiento'">
          <span class="mono-sm">{{ fmtFecha(record.fecha_movimiento) }}</span>
        </template>

        <template v-if="column.dataIndex === 'articulo_codigo'">
          <span class="cod-chip">{{ record.articulo_codigo }}</span>
        </template>

        <template v-if="column.dataIndex === 'tipo_codigo'">
          <a-tag :color="record.tipo_codigo === 'REAL' ? 'blue' : 'default'" style="font-size:10px">
            {{ record.tipo_codigo }}
          </a-tag>
        </template>

        <template v-if="column.dataIndex === 'origen_sistema'">
          <span class="origen-chip" :class="`origen-${record.origen_sistema}`">
            {{ record.origen_sistema }}
          </span>
        </template>

        <template v-if="column.dataIndex === 'cantidad'">
          <span :class="parseFloat(record.cantidad) >= 0 ? 'qty-in' : 'qty-out'">
            {{ fmtQty(record.cantidad) }}
          </span>
        </template>

      </template>
    </a-table>

  </div>
</template>

<style scoped>
.page-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); }
.toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); flex-wrap:wrap; }
.toolbar-left { display:flex; align-items:center; gap:8px; }
.page-title { margin:0; font-size:18px; font-weight:700; color:var(--text-0); }
.total-label { font-size:12px; color:var(--text-2); }
.filter-panel { padding:14px 20px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border,#f0f0f0); }
.filter-row { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
.filter-field { display:flex; flex-direction:column; gap:4px; min-width:130px; flex:1; }
.filter-field--wide { min-width:200px; flex:2; }
.filter-field label { font-size:11px; font-weight:600; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em; }
.erp-table :deep(.ant-table-thead > tr > th) { background:var(--surface-1,#f8fafc); font-weight:600; font-size:11px; color:var(--text-1); text-transform:uppercase; letter-spacing:.03em; }
.ledger-table :deep(.ant-table-tbody > tr > td) { font-size:12px; }
.mono-sm { font-family:monospace; font-size:11px; color:var(--text-1); }
.cod-chip { font-family:monospace; font-size:11px; background:var(--surface-1,#f1f5f9); padding:1px 5px; border-radius:3px; color:var(--text-2); }
.origen-chip { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; text-transform:uppercase; letter-spacing:.04em; background:var(--surface-1,#f1f5f9); color:var(--text-1); }
.origen-VENTAS      { background:#eff6ff; color:#1d4ed8; }
.origen-COMPRAS     { background:#f0fdf4; color:#15803d; }
.origen-AJUSTE_MANUAL { background:#fef3c7; color:#b45309; }
.origen-TRANSFERENCIA { background:#f5f3ff; color:#6d28d9; }
.qty-in  { color:#15803d; font-weight:700; font-variant-numeric:tabular-nums; }
.qty-out { color:#b91c1c; font-weight:700; font-variant-numeric:tabular-nums; }
.slide-down-enter-active,.slide-down-leave-active{transition:all .2s ease}
.slide-down-enter-from,.slide-down-leave-to{opacity:0;transform:translateY(-6px)}
</style>
