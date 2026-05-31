<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  InboxOutlined, WarningOutlined, DollarOutlined,
  RightOutlined, PlusOutlined, SwapOutlined,
  ToolOutlined, ReloadOutlined, BarChartOutlined,
  StopOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { articulosService } from '@/services/inventario'

const router  = useRouter()
const loading = ref(false)
const loadingChart = ref(false)

const kpis = ref({
  total_articulos_activos: 0,
  articulos_sin_stock:     0,
  articulos_bajo_minimo:   0,
  valor_stock_total:       0,
  ultimos_movimientos:     [],
})

const chartRubros = ref([])  // [{ rubro, valor_costo, valor_venta }]

// ─── Carga ─────────────────────────────────────────────────
const cargar = async () => {
  loading.value = true
  try {
    const res = await articulosService.dashboard()
    kpis.value = res.data
  } catch { /* silencioso */ }
  finally { loading.value = false }
}

const cargarChart = async () => {
  loadingChart.value = true
  try {
    const res  = await api.get('/api/inventario/valorizacion/')
    const lineas = res.data.lineas ?? []

    const map = {}
    for (const l of lineas) {
      const r = l.rubro || 'Sin rubro'
      if (!map[r]) map[r] = { costo: 0, venta: 0 }
      map[r].costo += parseFloat(l.subtotal_costo) || 0
      map[r].venta += parseFloat(l.subtotal_venta) || 0
    }
    chartRubros.value = Object.entries(map)
      .map(([rubro, v]) => ({ rubro, costo: Math.round(v.costo), venta: Math.round(v.venta) }))
      .sort((a, b) => b.costo - a.costo)
      .slice(0, 7)
  } catch { /* silencioso */ }
  finally { loadingChart.value = false }
}

// ─── SVG bar chart (sin librerías) ────────────────────────
const CW = 560
const CH = 210
const PAD = { top: 12, right: 16, bottom: 56, left: 68 }

const svgBars = computed(() => {
  if (!chartRubros.value.length) return null
  const data   = chartRubros.value
  const innerW = CW - PAD.left - PAD.right
  const innerH = CH - PAD.top  - PAD.bottom
  const maxVal = Math.max(...data.map(d => Math.max(d.costo, d.venta)), 1)
  const groupW = innerW / data.length
  const barW   = Math.min(30, groupW * 0.35)

  const groups = data.map((d, i) => {
    const cx     = PAD.left + i * groupW + groupW / 2
    const hCosto = (d.costo / maxVal) * innerH
    const hVenta = (d.venta / maxVal) * innerH
    return {
      label:  d.rubro.length > 12 ? d.rubro.slice(0, 11) + '…' : d.rubro,
      labelX: cx,
      labelY: PAD.top + innerH + 14,
      costo: { x: cx - barW - 2, y: PAD.top + innerH - hCosto, w: barW, h: Math.max(hCosto, 1) },
      venta: { x: cx + 2,        y: PAD.top + innerH - hVenta, w: barW, h: Math.max(hVenta, 1) },
      tooltip: `${d.rubro}\nCosto: $${fmtK(d.costo)}\nVenta: $${fmtK(d.venta)}`,
    }
  })

  const gridY = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + innerH * (1 - f),
    label: fmtK(maxVal * f),
  }))

  return { groups, gridY, innerH }
})

// ─── Helpers ───────────────────────────────────────────────
const fmtMoneda = (v) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)

// Formato compacto para el card de valor del stock
// Muestra el número abreviado (M, K) cuando es grande, evitando el corte en dos líneas
const fmtMonedaCard = (v) => {
  const n = parseFloat(v) || 0
  if (n >= 1_000_000_000) return `$ ${(n / 1_000_000_000).toFixed(2)} B`
  if (n >= 1_000_000)     return `$ ${(n / 1_000_000).toFixed(2)} M`
  if (n >= 1_000)         return `$ ${(n / 1_000).toFixed(1)} K`
  return `$ ${fmtMoneda(n)}`
}

const fmtK = (v) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${Math.round(v)}`
}

const movsCols = [
  { title: 'Fecha',     dataIndex: 'fecha_registro',       width: 155, ellipsis: true },
  { title: 'Artículo',  dataIndex: 'articulo_descripcion', ellipsis: true },
  { title: 'Depósito',  dataIndex: 'deposito_nombre',      width: 120 },
  { title: 'Origen',    dataIndex: 'origen_sistema',       width: 120 },
  { title: 'Cantidad',  dataIndex: 'cantidad',              width: 90, align: 'right' },
]

onMounted(() => { cargar(); cargarChart() })
</script>

<template>
  <div class="dash-root">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Panel de Control</div>
        <h1 class="hero__title">Panel de Inventario</h1>
        <p class="hero__subtitle">Resumen del estado del stock, valor del inventario y últimos movimientos.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :loading="loading || loadingChart" @click="cargar(); cargarChart()">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
          <a-button size="large" @click="router.push({ name: 'ajuste-crear' })">
            <ToolOutlined /> Ajuste
          </a-button>
          <a-button size="large" @click="router.push({ name: 'transferencia-crear' })">
            <SwapOutlined /> Transferencia
          </a-button>
          <a-button type="primary" size="large" @click="router.push({ name: 'articulo-crear' })">
            <PlusOutlined /> Nuevo Artículo
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- ── KPIs ────────────────────────────────────────────── -->
    <div class="kpi-grid">

      <div class="kpi-card kpi-card--clickable"
        @click="router.push({ name: 'articulo-lista' })">
        <div class="kpi-icon-wrap kpi-icon-wrap--blue">
          <InboxOutlined />
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Artículos activos</span>
          <a-skeleton-button v-if="loading" active size="small" style="margin-top:6px" />
          <span v-else class="kpi-value">{{ kpis.total_articulos_activos.toLocaleString() }}</span>
        </div>
        <RightOutlined class="kpi-arr" />
      </div>

      <div class="kpi-card kpi-card--clickable"
        :class="kpis.articulos_bajo_minimo > 0 ? 'kpi-card--warn' : 'kpi-card--ok'"
        @click="router.push({ name: 'alertas-reposicion' })">
        <div class="kpi-icon-wrap" :class="kpis.articulos_bajo_minimo > 0 ? 'kpi-icon-wrap--amber' : 'kpi-icon-wrap--green'">
          <WarningOutlined />
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Bajo mínimo</span>
          <a-skeleton-button v-if="loading" active size="small" style="margin-top:6px" />
          <span v-else class="kpi-value"
            :class="kpis.articulos_bajo_minimo > 0 ? 'kpi-value--amber' : ''">
            {{ kpis.articulos_bajo_minimo.toLocaleString() }}
          </span>
          <span class="kpi-sub">artículos a reponer</span>
        </div>
        <RightOutlined class="kpi-arr" />
      </div>

      <div class="kpi-card kpi-card--clickable"
        :class="kpis.articulos_sin_stock > 0 ? 'kpi-card--danger' : 'kpi-card--ok'"
        @click="router.push({ name: 'articulo-lista' })">
        <div class="kpi-icon-wrap" :class="kpis.articulos_sin_stock > 0 ? 'kpi-icon-wrap--red' : 'kpi-icon-wrap--green'">
          <StopOutlined />
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Sin stock</span>
          <a-skeleton-button v-if="loading" active size="small" style="margin-top:6px" />
          <span v-else class="kpi-value"
            :class="kpis.articulos_sin_stock > 0 ? 'kpi-value--red' : ''">
            {{ kpis.articulos_sin_stock.toLocaleString() }}
          </span>
          <span class="kpi-sub">artículos agotados</span>
        </div>
        <RightOutlined class="kpi-arr" />
      </div>

      <div class="kpi-card kpi-card--featured">
        <div class="kpi-icon-wrap kpi-icon-wrap--white">
          <DollarOutlined />
        </div>
        <div class="kpi-body">
          <span class="kpi-label">Valor del stock</span>
          <a-skeleton-button v-if="loading" active size="small" style="margin-top:6px" />
          <a-tooltip
            v-else
            :title="`$ ${fmtMoneda(kpis.valor_stock_total)}`"
            placement="bottom"
            :overlay-inner-style="{ fontSize: '14px', fontWeight: '600' }"
          >
            <span class="kpi-value kpi-value--money">
              {{ fmtMonedaCard(kpis.valor_stock_total) }}
            </span>
          </a-tooltip>
          <span class="kpi-sub kpi-sub--light">al costo · hover para ver total</span>
        </div>
      </div>

    </div>

    <!-- ── Fila central: gráfico + accesos rápidos ─────────── -->
    <div class="mid-row">

      <!-- Gráfico de barras agrupadas: Costo vs Venta por rubro -->
      <div class="chart-card">
        <div class="section-header">
          <span class="section-title"><BarChartOutlined style="margin-right:6px" />Valor por Rubro — Costo vs Venta</span>
          <a-button type="link" size="small" @click="router.push({ name: 'inventario-valorizacion' })">
            Ver reporte <RightOutlined />
          </a-button>
        </div>
        <div class="chart-body">
          <a-spin :spinning="loadingChart">
            <template v-if="svgBars && chartRubros.length > 0">
              <div class="chart-legend">
                <span class="legend-item legend-item--costo">Costo</span>
                <span class="legend-item legend-item--venta">Venta</span>
              </div>
              <svg :viewBox="`0 0 ${CW} ${CH}`" class="bar-svg">
                <!-- Grid -->
                <line
                  v-for="g in svgBars.gridY" :key="`gl${g.y}`"
                  :x1="PAD.left" :y1="g.y"
                  :x2="CW - PAD.right" :y2="g.y"
                  class="grid-line"
                />
                <text
                  v-for="g in svgBars.gridY" :key="`gt${g.y}`"
                  :x="PAD.left - 6" :y="g.y + 4"
                  class="grid-label" text-anchor="end"
                >{{ g.label }}</text>

                <!-- Barras agrupadas -->
                <g v-for="grp in svgBars.groups" :key="grp.label">
                  <rect
                    :x="grp.costo.x" :y="grp.costo.y"
                    :width="grp.costo.w" :height="grp.costo.h"
                    class="bar-costo" rx="2"
                  />
                  <rect
                    :x="grp.venta.x" :y="grp.venta.y"
                    :width="grp.venta.w" :height="grp.venta.h"
                    class="bar-venta" rx="2"
                  />
                  <text
                    :x="grp.labelX" :y="grp.labelY"
                    class="bar-label" text-anchor="middle"
                  >{{ grp.label }}</text>
                </g>
              </svg>
            </template>
            <a-empty
              v-else-if="!loadingChart"
              description="Sin datos de stock valorizado"
              :image="false"
              style="padding:36px 0"
            />
          </a-spin>
        </div>
      </div>

      <!-- Accesos rápidos -->
      <div class="quick-card">
        <div class="section-header">
          <span class="section-title">Accesos rápidos</span>
        </div>
        <div class="quick-grid">
          <div class="qi" @click="router.push({ name: 'articulo-lista' })">
            <InboxOutlined class="qi-icon qi-icon--blue" />
            <span>Artículos</span>
          </div>
          <div class="qi" @click="router.push({ name: 'ajustes-lista' })">
            <ToolOutlined class="qi-icon qi-icon--purple" />
            <span>Ajustes</span>
          </div>
          <div class="qi" @click="router.push({ name: 'transferencias-lista' })">
            <SwapOutlined class="qi-icon qi-icon--teal" />
            <span>Transferencias</span>
          </div>
          <div class="qi" @click="router.push({ name: 'alertas-reposicion' })">
            <WarningOutlined class="qi-icon qi-icon--amber" />
            <span>Alertas</span>
          </div>
          <div class="qi" @click="router.push({ name: 'kardex' })">
            <BarChartOutlined class="qi-icon qi-icon--blue" />
            <span>Kardex</span>
          </div>
          <div class="qi" @click="router.push({ name: 'inventario-valorizacion' })">
            <DollarOutlined class="qi-icon qi-icon--green" />
            <span>Valorización</span>
          </div>
          <div class="qi" @click="router.push({ name: 'ledger-lista' })">
            <ArrowUpOutlined class="qi-icon qi-icon--slate" />
            <span>Historial</span>
          </div>
          <div class="qi" @click="router.push({ name: 'actualizacion-precios' })">
            <ThunderboltOutlined class="qi-icon qi-icon--amber" />
            <span>Actualizar Precios</span>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Últimos movimientos ──────────────────────────────── -->
    <div class="section-card">
      <div class="section-header">
        <span class="section-title">Últimos movimientos de stock</span>
        <a-button type="link" size="small" @click="router.push({ name: 'ledger-lista' })">
          Ver todos <RightOutlined />
        </a-button>
      </div>
      <a-table
        :columns="movsCols"
        :data-source="kpis.ultimos_movimientos"
        :loading="loading"
        :pagination="false"
        size="small"
        row-key="id"
        class="movs-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fecha_registro'">
            {{ new Date(record.fecha_registro).toLocaleString('es-AR') }}
          </template>
          <template v-if="column.dataIndex === 'cantidad'">
            <span :class="parseFloat(record.cantidad) >= 0 ? 'qty-in' : 'qty-out'">
              {{ parseFloat(record.cantidad) >= 0 ? '+' : '' }}{{ parseFloat(record.cantidad).toFixed(3) }}
            </span>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="Sin movimientos recientes" :image="false" />
        </template>
      </a-table>
    </div>

  </div>
</template>

<style scoped>
.hero {
  display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
  padding: 20px 22px; border-radius: 6px;
  background: radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0,0,0,.08); margin-bottom: 0;
}
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }
.dash-root { display:flex; flex-direction:column; gap:16px; }

/* Header */
.dash-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.dash-title  { margin:0; font-size:22px; font-weight:700; color:var(--text-0,#0f172a); }
.dash-actions{ display:flex; gap:8px; flex-wrap:wrap; }

/* KPI grid */
.kpi-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));
  gap:12px;
}
.kpi-card {
  background:var(--surface-0,#fff);
  border-radius:var(--radius-lg,10px);
  padding:16px 18px;
  display:flex; align-items:center; gap:14px;
  border:1px solid var(--border,#e2e8f0);
  box-shadow:0 1px 4px rgba(0,0,0,.05);
  transition:box-shadow .15s, transform .15s;
}
.kpi-card--clickable { cursor:pointer; }
.kpi-card--clickable:hover { box-shadow:0 6px 20px rgba(0,0,0,.1); transform:translateY(-2px); }
.kpi-card--featured {
  background:linear-gradient(135deg, var(--primary,#1e40af) 0%, #2563eb 100%);
  color:#fff; border:none;
  min-width:220px;
}
.kpi-card--warn   { border-color:#fbbf24; background:#fffbeb; }
.kpi-card--danger { border-color:#f87171; background:#fff5f5; }
.kpi-card--ok     { border-color:#86efac; background:#f0fdf4; }

.kpi-icon-wrap {
  width:40px; height:40px;
  border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  font-size:20px; flex-shrink:0;
}
.kpi-icon-wrap--blue  { background:#eff6ff; color:#1e40af; }
.kpi-icon-wrap--amber { background:#fef3c7; color:#b45309; }
.kpi-icon-wrap--green { background:#dcfce7; color:#15803d; }
.kpi-icon-wrap--red   { background:#fee2e2; color:#b91c1c; }
.kpi-icon-wrap--white { background:rgba(255,255,255,.2); color:#fff; }

.kpi-body { flex:1; display:flex; flex-direction:column; gap:1px; min-width:0; }
.kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2,#64748b); }
.kpi-card--featured .kpi-label { color:rgba(255,255,255,.7); }
.kpi-value { font-size:26px; font-weight:800; line-height:1.1; color:var(--text-0,#0f172a); font-variant-numeric:tabular-nums; }
.kpi-value--money {
  /* font-size se sobreescribe dinámicamente con :style desde el computed moneyFontSize */
  font-size:22px;
  line-height:1.2;
}
.kpi-value--amber { color:#b45309; }
.kpi-value--red   { color:#b91c1c; }
.kpi-card--featured .kpi-value { color:#fff; }
.kpi-sub  { font-size:10px; color:var(--text-2,#94a3b8); }
.kpi-sub--light { color:rgba(255,255,255,.6); }
.kpi-arr  { opacity:.25; font-size:11px; flex-shrink:0; }

/* Mid row */
.mid-row {
  display:grid;
  grid-template-columns:1fr 220px;
  gap:16px;
}
@media (max-width:860px) { .mid-row { grid-template-columns:1fr; } }

/* Shared card structure */
.chart-card, .quick-card, .section-card {
  background:var(--surface-0,#fff);
  border-radius:var(--radius-lg,10px);
  border:1px solid var(--border,#e2e8f0);
  overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.04);
}
.section-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 16px;
  border-bottom:1px solid var(--border,#f0f0f0);
}
.section-title { font-size:13px; font-weight:700; color:var(--text-0); }

/* Chart */
.chart-body { padding:14px 16px 8px; }
.chart-legend {
  display:flex; gap:16px; margin-bottom:8px; padding-left:4px;
}
.legend-item {
  display:flex; align-items:center; gap:5px;
  font-size:11px; font-weight:600; color:var(--text-2);
}
.legend-item::before { content:''; display:block; width:10px; height:10px; border-radius:2px; }
.legend-item--costo::before { background:var(--primary,#1e40af); opacity:.75; }
.legend-item--venta::before { background:#22c55e; opacity:.75; }

.bar-svg    { width:100%; height:auto; display:block; overflow:visible; }
.grid-line  { stroke:var(--border,#e2e8f0); stroke-width:.5; }
.grid-label { font-size:9px; fill:var(--text-2,#94a3b8); font-family:monospace; }
.bar-costo  { fill:var(--primary,#1e40af); opacity:.75; transition:opacity .1s; }
.bar-costo:hover { opacity:1; }
.bar-venta  { fill:#22c55e; opacity:.75; transition:opacity .1s; }
.bar-venta:hover { opacity:1; }
.bar-label  { font-size:9px; fill:var(--text-2,#64748b); }

/* Quick panel */
.quick-grid {
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:1px;
  background:var(--border,#e2e8f0);
}
.qi {
  background:var(--surface-0,#fff);
  display:flex; flex-direction:column; align-items:center; gap:5px;
  padding:13px 6px;
  cursor:pointer; font-size:10px; font-weight:600;
  color:var(--text-1,#334155); text-align:center;
  transition:background .12s;
}
.qi:hover { background:var(--surface-1,#f8fafc); }
.qi-icon { font-size:17px; }
.qi-icon--blue   { color:#1e40af; }
.qi-icon--purple { color:#7c3aed; }
.qi-icon--teal   { color:#0f766e; }
.qi-icon--amber  { color:#b45309; }
.qi-icon--green  { color:#15803d; }
.qi-icon--slate  { color:#64748b; }
.qi-icon--red    { color:#b91c1c; }

/* Movimientos */
.movs-table :deep(.ant-table-thead > tr > th) {
  background:var(--surface-1,#f8fafc);
  font-size:11px; font-weight:700;
  text-transform:uppercase; letter-spacing:.04em;
  color:var(--text-2);
}
.qty-in  { color:#15803d; font-weight:700; font-variant-numeric:tabular-nums; }
.qty-out { color:#b91c1c; font-weight:700; font-variant-numeric:tabular-nums; }
</style>
