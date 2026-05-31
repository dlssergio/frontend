<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  ShoppingOutlined,
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  CalendarOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import dayjs from 'dayjs'

// ── Estado ────────────────────────────────────────────────────────────────────
const loading  = ref(false)
const data     = ref(null)
const error    = ref(null)

const rangoPreset  = ref('30d')
const fechaDesde   = ref(dayjs().subtract(29, 'day').format('YYYY-MM-DD'))
const fechaHasta   = ref(dayjs().format('YYYY-MM-DD'))
const rangoFechas  = ref([dayjs().subtract(29, 'day'), dayjs()])

const presets = [
  { label: 'Hoy',        value: '1d'   },
  { label: 'Esta semana', value: 'sem' },
  { label: 'Este mes',   value: 'mes'  },
  { label: '30 días',    value: '30d'  },
  { label: '90 días',    value: '90d'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const moneyK = (n) => {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$ ${(v / 1_000).toFixed(1)}K`
  return `$ ${money(v)}`
}

const pctClass  = (v) => v == null ? '' : v >= 0 ? 'pos' : 'neg'
const pctLabel  = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v}%`
const pctIcon   = (v) => v == null ? null : v >= 0 ? 'rise' : 'fall'

const condicionLabel = (c) =>
  c === 'CO' ? 'Contado' : c === 'CC' ? 'Cta. Cte.' : c || '—'

// ── Computed desde data ───────────────────────────────────────────────────────
const maxMonto = computed(() => {
  if (!data.value?.ventas_por_dia?.length) return 1
  return Math.max(...data.value.ventas_por_dia.map(d => d.total), 1)
})

const maxArticulo = computed(() => {
  if (!data.value?.ranking_articulos?.length) return 1
  return Math.max(...data.value.ranking_articulos.map(a => a.monto), 1)
})

const maxVendedor = computed(() => {
  if (!data.value?.ventas_por_vendedor?.length) return 1
  return Math.max(...data.value.ventas_por_vendedor.map(v => v.total), 1)
})

const totalPorCondicion = computed(() => {
  if (!data.value?.por_condicion) return 0
  return data.value.por_condicion.reduce((a, c) => a + c.total, 0)
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  error.value   = null
  try {
    const { data: res } = await api.get('/api/dashboard-ventas/', {
      params: { fecha_desde: fechaDesde.value, fecha_hasta: fechaHasta.value },
    })
    data.value = res
  } catch (e) {
    error.value = e?.response?.data?.error || 'No se pudo cargar el dashboard.'
  } finally {
    loading.value = false
  }
}

// ── Preset selector ───────────────────────────────────────────────────────────
const aplicarPreset = (preset) => {
  rangoPreset.value = preset
  const hoy = dayjs()
  let desde
  switch (preset) {
    case '1d':  desde = hoy;                          break
    case 'sem': desde = hoy.startOf('week');          break
    case 'mes': desde = hoy.startOf('month');         break
    case '30d': desde = hoy.subtract(29, 'day');      break
    case '90d': desde = hoy.subtract(89, 'day');      break
    default:    desde = hoy.subtract(29, 'day')
  }
  fechaDesde.value  = desde.format('YYYY-MM-DD')
  fechaHasta.value  = hoy.format('YYYY-MM-DD')
  rangoFechas.value = [desde, hoy]
  fetchData()
}

const onRangoChange = (dates) => {
  if (!dates || !dates[0] || !dates[1]) return
  rangoPreset.value = null
  fechaDesde.value  = dates[0].format('YYYY-MM-DD')
  fechaHasta.value  = dates[1].format('YYYY-MM-DD')
  fetchData()
}

onMounted(fetchData)
</script>

<template>
  <div class="dv-root">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="dv-header">
      <div>
        <h1 class="dv-title">Dashboard de Ventas</h1>
        <p class="dv-subtitle" v-if="data">
          {{ data.periodo.desde.split('-').reverse().join('/') }}
          al
          {{ data.periodo.hasta.split('-').reverse().join('/') }}
          · {{ data.periodo.dias }} días
          <span class="dv-vs">vs. período anterior</span>
        </p>
      </div>
      <div class="dv-header-actions">
        <!-- Presets -->
        <div class="preset-group">
          <button
            v-for="p in presets"
            :key="p.value"
            class="preset-btn"
            :class="{ active: rangoPreset === p.value }"
            @click="aplicarPreset(p.value)"
          >{{ p.label }}</button>
        </div>
        <!-- Rango personalizado -->
        <a-range-picker
          v-model:value="rangoFechas"
          format="DD/MM/YYYY"
          :allow-clear="false"
          size="small"
          @change="onRangoChange"
        />
        <a-button :loading="loading" size="small" @click="fetchData">
          <ReloadOutlined />
        </a-button>
      </div>
    </div>

    <a-alert v-if="error" :message="error" type="error" show-icon style="margin-bottom:16px" />

    <a-spin :spinning="loading">
      <template v-if="data">

        <!-- ── Bloque rápido: Hoy / Semana / Mes ──────────────────────── -->
        <div class="quick-strip">
          <div class="quick-item">
            <span class="quick-label">Hoy</span>
            <span class="quick-val">$ {{ money(data.hoy.total) }}</span>
            <span class="quick-sub">{{ data.hoy.cantidad }} comp.</span>
          </div>
          <div class="quick-sep" />
          <div class="quick-item">
            <span class="quick-label">Esta semana</span>
            <span class="quick-val">$ {{ money(data.semana.total) }}</span>
            <span class="quick-sub">{{ data.semana.cantidad }} comp.</span>
          </div>
          <div class="quick-sep" />
          <div class="quick-item">
            <span class="quick-label">Este mes</span>
            <span class="quick-val">$ {{ money(data.mes.total) }}</span>
            <span class="quick-sub">{{ data.mes.cantidad }} comp.</span>
          </div>
        </div>

        <!-- ── KPIs del período ────────────────────────────────────────── -->
        <div class="kpi-grid">

          <div class="kpi-card kpi-card--blue">
            <div class="kpi-icon"><DollarOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Total facturado</div>
              <div class="kpi-value">$ {{ money(data.kpis.total_ventas) }}</div>
              <div class="kpi-delta" :class="pctClass(data.kpis.vs_anterior.total_ventas)">
                <RiseOutlined v-if="pctIcon(data.kpis.vs_anterior.total_ventas) === 'rise'" />
                <FallOutlined v-else-if="pctIcon(data.kpis.vs_anterior.total_ventas) === 'fall'" />
                {{ pctLabel(data.kpis.vs_anterior.total_ventas) }} vs. período ant.
              </div>
            </div>
          </div>

          <div class="kpi-card kpi-card--green">
            <div class="kpi-icon"><FileTextOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Comprobantes</div>
              <div class="kpi-value">{{ data.kpis.cantidad_comprobantes }}</div>
              <div class="kpi-delta" :class="pctClass(data.kpis.vs_anterior.cantidad_comprobantes)">
                <RiseOutlined v-if="pctIcon(data.kpis.vs_anterior.cantidad_comprobantes) === 'rise'" />
                <FallOutlined v-else-if="pctIcon(data.kpis.vs_anterior.cantidad_comprobantes) === 'fall'" />
                {{ pctLabel(data.kpis.vs_anterior.cantidad_comprobantes) }} vs. período ant.
              </div>
            </div>
          </div>

          <div class="kpi-card kpi-card--purple">
            <div class="kpi-icon"><ShoppingOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Ticket promedio</div>
              <div class="kpi-value">$ {{ money(data.kpis.ticket_promedio) }}</div>
              <div class="kpi-delta neutral">Período seleccionado</div>
            </div>
          </div>

          <!-- Condición de venta -->
          <div class="kpi-card kpi-card--slate">
            <div class="kpi-icon"><BarChartOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Por condición</div>
              <div class="kpi-condicion">
                <div
                  v-for="c in data.por_condicion"
                  :key="c.condicion"
                  class="kpi-cond-row"
                >
                  <span class="kpi-cond-label">{{ condicionLabel(c.condicion) }}</span>
                  <div class="kpi-cond-bar-wrap">
                    <div
                      class="kpi-cond-bar"
                      :class="c.condicion === 'CO' ? 'bar-contado' : 'bar-cta'"
                      :style="{ width: totalPorCondicion > 0 ? `${(c.total / totalPorCondicion * 100).toFixed(0)}%` : '0%' }"
                    />
                  </div>
                  <span class="kpi-cond-val">{{ moneyK(c.total) }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Gráfico de ventas por día ───────────────────────────────── -->
        <div class="section-card" v-if="data.ventas_por_dia.length">
          <div class="section-title"><BarChartOutlined /> Evolución de ventas por día</div>
          <div class="chart-wrap">
            <div class="chart-bars">
              <div
                v-for="dia in data.ventas_por_dia"
                :key="dia.fecha"
                class="chart-bar-col"
              >
                <a-tooltip :title="`${dia.fecha.split('-').reverse().join('/')}: $ ${money(dia.total)} (${dia.cantidad} comp.)`">
                  <div class="chart-bar-outer">
                    <div
                      class="chart-bar-fill"
                      :style="{ height: `${Math.max(4, (dia.total / maxMonto) * 100)}%` }"
                    />
                  </div>
                </a-tooltip>
                <div class="chart-bar-label">
                  {{ dia.fecha.slice(8) }}/{{ dia.fecha.slice(5, 7) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Ranking artículos + Vendedores ─────────────────────────── -->
        <div class="two-col">

          <!-- Ranking artículos -->
          <div class="section-card">
            <div class="section-title"><ShoppingOutlined /> Top artículos por facturación</div>
            <div class="rank-list">
              <div
                v-for="(art, i) in data.ranking_articulos"
                :key="art.codigo"
                class="rank-row"
              >
                <span class="rank-num" :class="`rank-num--${i < 3 ? i+1 : 'rest'}`">{{ i + 1 }}</span>
                <div class="rank-info">
                  <span class="rank-name">{{ art.descripcion }}</span>
                  <span class="rank-code">{{ art.codigo }} · {{ art.cantidad.toFixed(0) }} un. · {{ art.veces_vendido }} veces</span>
                </div>
                <div class="rank-bar-wrap">
                  <div
                    class="rank-bar-fill"
                    :style="{ width: `${(art.monto / maxArticulo * 100).toFixed(1)}%` }"
                  />
                </div>
                <span class="rank-monto">{{ moneyK(art.monto) }}</span>
              </div>
              <div v-if="!data.ranking_articulos.length" class="empty-msg">
                Sin datos para el período
              </div>
            </div>
          </div>

          <!-- Vendedores -->
          <div class="section-card">
            <div class="section-title"><TeamOutlined /> Ventas por vendedor</div>
            <div class="rank-list">
              <div
                v-for="(v, i) in data.ventas_por_vendedor"
                :key="v.vendedor"
                class="rank-row"
              >
                <span class="rank-num" :class="`rank-num--${i < 3 ? i+1 : 'rest'}`">{{ i + 1 }}</span>
                <div class="rank-info">
                  <span class="rank-name">{{ v.vendedor }}</span>
                  <span class="rank-code">{{ v.cantidad }} comprobantes</span>
                </div>
                <div class="rank-bar-wrap">
                  <div
                    class="rank-bar-fill rank-bar-fill--vendedor"
                    :style="{ width: `${(v.total / maxVendedor * 100).toFixed(1)}%` }"
                  />
                </div>
                <span class="rank-monto">{{ moneyK(v.total) }}</span>
              </div>
              <div v-if="!data.ventas_por_vendedor.length" class="empty-msg">
                Sin datos para el período
              </div>
            </div>
          </div>

        </div>

      </template>
    </a-spin>

  </div>
</template>

<style scoped>
.dv-root {
  padding: 20px 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.dv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.dv-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: var(--text-0, #0f172a);
}
.dv-subtitle {
  font-size: 12px;
  color: var(--text-2, #64748b);
  margin: 2px 0 0;
}
.dv-vs { color: var(--text-3, #94a3b8); margin-left: 6px; }
.dv-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Presets */
.preset-group { display: flex; gap: 4px; }
.preset-btn {
  padding: 3px 10px;
  border: 1px solid var(--border, rgba(148,163,184,0.3));
  border-radius: 4px;
  background: var(--surface-1, #fff);
  font-size: 12px;
  color: var(--text-1, #475569);
  cursor: pointer;
  transition: all 0.15s;
}
.preset-btn:hover { border-color: #1677ff; color: #1677ff; }
.preset-btn.active { background: #1677ff; color: #fff; border-color: #1677ff; font-weight: 700; }

/* ── Quick strip ─────────────────────────────────────────────────────────── */
.quick-strip {
  display: flex;
  align-items: center;
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  padding: 14px 24px;
  margin-bottom: 16px;
  gap: 0;
}
.quick-sep {
  width: 1px;
  height: 36px;
  background: var(--border, rgba(148,163,184,0.2));
  margin: 0 24px;
}
.quick-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}
.quick-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2, #64748b);
}
.quick-val {
  font-size: 17px;
  font-weight: 900;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
}
.quick-sub {
  font-size: 11px;
  color: var(--text-2, #94a3b8);
}

/* ── KPI Grid ────────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .kpi-grid { grid-template-columns: 1fr; } }

.kpi-card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border-top: 3px solid transparent;
}
.kpi-card--blue   { border-top-color: #1677ff; }
.kpi-card--green  { border-top-color: #10b981; }
.kpi-card--purple { border-top-color: #8b5cf6; }
.kpi-card--slate  { border-top-color: #64748b; }

.kpi-icon {
  font-size: 20px;
  opacity: 0.4;
  padding-top: 2px;
  flex-shrink: 0;
}
.kpi-body { flex: 1; min-width: 0; }
.kpi-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2, #64748b);
  margin-bottom: 4px;
}
.kpi-value {
  font-size: 1.4rem;
  font-weight: 900;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
  margin-bottom: 4px;
}
.kpi-delta {
  font-size: 11.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}
.kpi-delta.pos     { color: #10b981; }
.kpi-delta.neg     { color: #ef4444; }
.kpi-delta.neutral { color: var(--text-2, #94a3b8); }

/* Condición bars */
.kpi-condicion { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
.kpi-cond-row  { display: flex; align-items: center; gap: 8px; }
.kpi-cond-label { font-size: 11px; font-weight: 600; width: 65px; flex-shrink: 0; color: var(--text-1,#475569); }
.kpi-cond-bar-wrap { flex: 1; height: 7px; background: rgba(148,163,184,0.15); border-radius: 4px; overflow: hidden; }
.kpi-cond-bar { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
.bar-contado { background: #1677ff; }
.bar-cta     { background: #f59e0b; }
.kpi-cond-val { font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; width: 70px; text-align: right; flex-shrink: 0; color: var(--text-0,#0f172a); }

/* ── Sections ────────────────────────────────────────────────────────────── */
.section-card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 11.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-2, #64748b);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
}

/* ── Bar chart ───────────────────────────────────────────────────────────── */
.chart-wrap { overflow-x: auto; }
.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 140px;
  padding-bottom: 24px;
  min-width: 0;
}
.chart-bar-col {
  flex: 1;
  min-width: 20px;
  max-width: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  position: relative;
}
.chart-bar-outer {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  cursor: pointer;
}
.chart-bar-fill {
  width: 100%;
  background: #1677ff;
  border-radius: 3px 3px 0 0;
  transition: height 0.3s ease;
  opacity: 0.8;
  min-height: 4px;
}
.chart-bar-fill:hover { opacity: 1; }
.chart-bar-label {
  position: absolute;
  bottom: 0;
  font-size: 9px;
  color: var(--text-2, #94a3b8);
  white-space: nowrap;
}

/* ── Two col ─────────────────────────────────────────────────────────────── */
.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }

/* ── Rank list ───────────────────────────────────────────────────────────── */
.rank-list { display: flex; flex-direction: column; gap: 10px; }
.rank-row  { display: flex; align-items: center; gap: 10px; }

.rank-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 900;
  flex-shrink: 0;
  background: rgba(148,163,184,0.1);
  color: var(--text-1, #475569);
}
.rank-num--1 { background: #fef3c7; color: #92400e; }
.rank-num--2 { background: #f1f5f9; color: #334155; }
.rank-num--3 { background: #fff7ed; color: #9a3412; }

.rank-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 0 0 160px;
}
.rank-name {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-0, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-code {
  font-size: 10px;
  color: var(--text-2, #94a3b8);
  font-family: ui-monospace, monospace;
}
.rank-bar-wrap {
  flex: 1;
  height: 7px;
  background: rgba(148,163,184,0.12);
  border-radius: 4px;
  overflow: hidden;
}
.rank-bar-fill {
  height: 100%;
  background: #1677ff;
  border-radius: 4px;
  transition: width 0.4s ease;
  opacity: 0.75;
}
.rank-bar-fill--vendedor { background: #10b981; }
.rank-monto {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-0, #0f172a);
  width: 72px;
  text-align: right;
  flex-shrink: 0;
}

.empty-msg {
  font-size: 12px;
  color: var(--text-2, #94a3b8);
  text-align: center;
  padding: 16px 0;
}
</style>
