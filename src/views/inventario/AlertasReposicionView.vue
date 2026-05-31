<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ReloadOutlined, EyeOutlined, ShoppingCartOutlined,
  WarningOutlined, FileExcelOutlined,
  AlertOutlined, CheckCircleOutlined,
} from '@ant-design/icons-vue'
import { articulosService } from '@/services/inventario'

const router  = useRouter()
const loading = ref(false)
const alertas = ref([])

const columns = [
  { key: 'cod_articulo',    title: 'Código',        dataIndex: 'cod_articulo',     width: 110, fixed: 'left', sorter: (a,b) => a.cod_articulo.localeCompare(b.cod_articulo) },
  { key: 'descripcion',     title: 'Descripción',   dataIndex: 'descripcion',      ellipsis: true },
  { key: 'rubro_nombre',    title: 'Rubro',         dataIndex: 'rubro_nombre',     width: 140, ellipsis: true },
  { key: 'marca_nombre',    title: 'Marca',         dataIndex: 'marca_nombre',     width: 130, ellipsis: true },
  { key: 'stock_disponible',title: 'Stock Actual',  dataIndex: 'stock_disponible', width: 120, align: 'right', sorter: (a,b) => a.stock_disponible - b.stock_disponible },
  { key: 'stock_minimo',    title: 'Stock Mínimo',  dataIndex: 'stock_minimo',     width: 120, align: 'right' },
  { key: 'diff',            title: 'Faltante',      key: 'diff',                   width: 110, align: 'right', sorter: (a,b) => diff(a) - diff(b) },
  { key: 'acciones',        title: 'Acciones',      key: 'acciones',               width: 120, align: 'center', fixed: 'right' },
]

const summary = computed(() => {
  const list = alertas.value
  const criticos = list.filter(a => diff(a) >= parseFloat(a.stock_minimo || 0))
  return {
    total:    list.length,
    criticos: criticos.length,
    sinStock: list.filter(a => parseFloat(a.stock_disponible ?? 0) <= 0).length,
  }
})

const cargar = async () => {
  loading.value = true
  try {
    const res = await articulosService.alertas()
    alertas.value = (res.data.results ?? res.data).sort((a, b) => diff(b) - diff(a))
  } catch { message.error('Error al cargar alertas.') }
  finally   { loading.value = false }
}

const diff = (record) => {
  const disp = parseFloat(record.stock_disponible ?? 0)
  const min  = parseFloat(record.stock_minimo ?? 0)
  return +(min - disp).toFixed(3)
}

const gravedad = (record) => {
  const d = diff(record)
  const min = parseFloat(record.stock_minimo ?? 0)
  if (parseFloat(record.stock_disponible ?? 0) <= 0) return 'sin-stock'
  if (d >= min * 0.5) return 'critico'
  return 'bajo'
}

const exportarCSV = () => {
  if (!alertas.value.length) { message.warning('Sin datos'); return }
  const rows = [
    ['Código', 'Descripción', 'Rubro', 'Stock Actual', 'Stock Mínimo', 'Faltante'],
    ...alertas.value.map(a => [
      a.cod_articulo, a.descripcion, a.rubro_nombre ?? '',
      a.stock_disponible, a.stock_minimo, diff(a),
    ]),
  ]
  const csv  = rows.map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `alertas_reposicion_${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

const fmtNum = (v) => v != null ? parseFloat(v).toFixed(3) : '—'

onMounted(cargar)
</script>

<template>
  <div class="alertas-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Control de Stock</div>
        <h1 class="hero__title">Alertas de Reposición</h1>
        <p class="hero__subtitle">Artículos que están por debajo del stock mínimo configurado.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" @click="exportarCSV">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>
            Exportar CSV
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
        <div class="kpi-card__icon kpi-card__icon--gold"><AlertOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Total alertas</div>
          <div class="kpi-card__value">{{ summary.total }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><WarningOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Críticos (≥50% del mínimo)</div>
          <div class="kpi-card__value">{{ summary.criticos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--dark"><CheckCircleOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Sin stock</div>
          <div class="kpi-card__value">{{ summary.sinStock }}</div>
        </div>
      </a-card>
    </section>

    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="columns"
        :data-source="alertas"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 30, showTotal: t => `${t} artículos`, showSizeChanger: true }"
        :scroll="{ x: 1000 }"
        :row-class-name="(r) => `row-${gravedad(r)}`"
      >
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'stock_disponible'">
            <span :class="['stock-val', parseFloat(record.stock_disponible ?? 0) <= 0 ? 'stock-zero' : '']">
              {{ fmtNum(record.stock_disponible) }}
            </span>
          </template>

          <template v-if="column.key === 'diff'">
            <span class="diff-val">
              <WarningOutlined style="margin-right:4px;color:#ef4444" />
              {{ fmtNum(diff(record)) }}
            </span>
          </template>

          <template v-if="column.key === 'acciones'">
            <a-space>
              <a-tooltip title="Ver ficha">
                <a-button size="small" @click="router.push({ name: 'articulo-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="Nueva compra">
                <a-button size="small" type="primary"
                  @click="router.push({ name: 'compra-factura-nueva' })">
                  <template #icon><ShoppingCartOutlined /></template>
                </a-button>
              </a-tooltip>
            </a-space>
          </template>

        </template>
        <template #emptyText>
          <a-empty description="¡Sin alertas! Todos los artículos están sobre el mínimo." :image="false">
            <template #image><CheckCircleOutlined style="font-size:40px;color:#22c55e" /></template>
          </a-empty>
        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.alertas-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:20px 22px; border-radius:6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; line-height:1.08; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.kpis { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
.kpi-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display:flex; align-items:center; gap:14px; }
.kpi-card__icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; font-size:20px; }
.kpi-card__icon--gold  { background:color-mix(in srgb,#f59e0b 14%,transparent); color:#d97706; }
.kpi-card__icon--red   { background:color-mix(in srgb,#ef4444 14%,transparent); color:#dc2626; }
.kpi-card__icon--dark  { background:color-mix(in srgb,#475569 14%,transparent); color:#475569; }
.kpi-card__label { font-size:12px; color:var(--text-2); }
.kpi-card__value { font-size:24px; font-weight:800; color:var(--text-0); }
.table-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.stock-val  { font-variant-numeric:tabular-nums; font-weight:600; }
.stock-zero { color:#dc2626; font-weight:800; }
.diff-val   { font-variant-numeric:tabular-nums; color:#dc2626; font-weight:700; }
:deep(.row-sin-stock td:first-child) { border-left:3px solid #dc2626!important; }
:deep(.row-critico td:first-child)   { border-left:3px solid #f59e0b!important; }
:deep(.row-bajo td:first-child)      { border-left:3px solid #3b82f6!important; }
@media (max-width:900px) { .kpis { grid-template-columns:1fr 1fr; } .hero { flex-direction:column; } }
</style>
