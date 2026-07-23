<template>
  <div class="dashboard-root">

    <div class="dash-header">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex-between flex-wrap gap-4 mb-6">
          <div>
            <h1 class="dash-title">Centro de Mando</h1>
            <p class="dash-subtitle">Visión general y métricas clave de la empresa en tiempo real.</p>
          </div>

          <div class="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <a-button type="text" size="small" class="font-semibold text-slate-500 hover:text-indigo-600"><CalendarOutlined /> Este Mes</a-button>
            <span class="text-slate-300">|</span>
            <a-button type="text" size="small" class="font-semibold text-slate-500 hover:text-indigo-600">Este Año</a-button>
            <span class="text-slate-300">|</span>
            <a-button type="text" size="small" class="font-semibold text-slate-500 hover:text-indigo-600">Histórico</a-button>
          </div>
        </div>

        <a-segmented
          v-model:value="panelActivo"
          :options="opcionesPanel"
          class="dash-segmented"
        />
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <transition name="fade" mode="out-in">

        <div v-if="panelActivo === 'GLOBAL'" class="space-y-6" key="global">

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="kpi-card">
              <div class="kpi-icon bg-indigo-50 text-indigo-600"><DollarOutlined /></div>
              <div class="kpi-info">
                <span class="kpi-label">Ingresos del Mes</span>
                <span class="kpi-value font-mono">$ 1,245,000.<span class="text-sm text-slate-400">00</span></span>
              </div>
              <div class="kpi-trend trend-up"><ArrowUpOutlined /> 12% vs mes ant.</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon bg-emerald-50 text-emerald-600"><ShopOutlined /></div>
              <div class="kpi-info">
                <span class="kpi-label">Gastos Operativos</span>
                <span class="kpi-value font-mono">$ 840,300.<span class="text-sm text-slate-400">00</span></span>
              </div>
              <div class="kpi-trend trend-down"><ArrowDownOutlined /> 3% vs mes ant.</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon bg-amber-50 text-amber-600"><InboxOutlined /></div>
              <div class="kpi-info">
                <span class="kpi-label">Valorización de Stock</span>
                <span class="kpi-value font-mono">$ 4,500,000.<span class="text-sm text-slate-400">00</span></span>
              </div>
              <div class="kpi-trend text-slate-400">Calculado a precio costo</div>
            </div>

            <div class="kpi-card">
              <div class="kpi-icon bg-red-50 text-red-600"><WarningOutlined /></div>
              <div class="kpi-info">
                <span class="kpi-label">Cuentas por Cobrar</span>
                <span class="kpi-value font-mono text-red-600">$ 320,000.<span class="text-sm text-red-400">00</span></span>
              </div>
              <div class="kpi-trend text-red-500">15 facturas vencidas</div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div class="dash-card lg:col-span-2">
              <div class="card-header">
                <h3>Flujo de Caja (Ingresos vs Egresos)</h3>
                <a-button size="small">Ver reporte completo</a-button>
              </div>
              <div class="card-body flex-center bg-slate-50 border border-slate-100 rounded-lg h-64 mx-6 mb-6">
                <BarChartOutlined class="text-4xl text-slate-300 mb-2" />
                <span class="text-slate-400 font-semibold">Espacio para Chart.js / ApexCharts</span>
              </div>
            </div>

            <div class="dash-card">
              <div class="card-header border-b-0 pb-0">
                <h3>Monitor de Actividad</h3>
              </div>
              <div class="card-body p-0">
                <a-tabs v-model:activeKey="actividadActiva" class="custom-tabs px-6">

                  <a-tab-pane key="VENTAS" tab="Ventas">
                    <div class="feed-list">
                      <div v-for="i in 4" :key="i" class="feed-item">
                        <div class="feed-icon bg-indigo-50 text-indigo-500"><TagOutlined /></div>
                        <div class="feed-content">
                          <p class="feed-title">Factura <strong>A 0001-00045{{i}}</strong></p>
                          <p class="feed-desc">Cliente: Consumidor Final</p>
                        </div>
                        <div class="feed-meta">
                          <span class="feed-amount font-mono text-indigo-700">+$ 15,000</span>
                          <span class="feed-time">Hace {{i * 10}} min</span>
                        </div>
                      </div>
                    </div>
                  </a-tab-pane>

                  <a-tab-pane key="COMPRAS" tab="Compras">
                    <div class="feed-list">
                      <div v-for="i in 3" :key="i" class="feed-item">
                        <div class="feed-icon bg-emerald-50 text-emerald-500"><ShopOutlined /></div>
                        <div class="feed-content">
                          <p class="feed-title">Ingreso de Remito <strong>R 0004-123{{i}}</strong></p>
                          <p class="feed-desc">Proveedor: Distribuidora Sur</p>
                        </div>
                        <div class="feed-meta">
                          <span class="feed-amount font-mono text-emerald-700">Stock</span>
                          <span class="feed-time">Hace {{i}} hr</span>
                        </div>
                      </div>
                    </div>
                  </a-tab-pane>

                  <a-tab-pane key="STOCK" tab="Stock">
                    <div class="feed-list">
                      <div class="feed-item">
                        <div class="feed-icon bg-cyan-50 text-cyan-500"><SwapOutlined /></div>
                        <div class="feed-content">
                          <p class="feed-title">Transferencia <strong>TRF-0012</strong></p>
                          <p class="feed-desc">Dep. Central → Sucursal 1</p>
                        </div>
                        <div class="feed-meta"><span class="feed-time">10:30 AM</span></div>
                      </div>
                      <div class="feed-item">
                        <div class="feed-icon bg-red-50 text-red-500"><WarningOutlined /></div>
                        <div class="feed-content">
                          <p class="feed-title">Ajuste de Inventario <strong>AJ-004</strong></p>
                          <p class="feed-desc">Merma por rotura</p>
                        </div>
                        <div class="feed-meta"><span class="feed-time">Ayer</span></div>
                      </div>
                    </div>
                  </a-tab-pane>

                </a-tabs>
                <div class="p-4 border-t border-slate-100 bg-slate-50 text-center rounded-b-xl">
                  <a href="#" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wider">Ver Auditoría Completa &rarr;</a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="panelActivo === 'VENTAS'" key="ventas">
          <div class="flex-center h-64 text-slate-400 font-bold">Cargando Módulo de Ventas...</div>
        </div>

        <div v-else-if="panelActivo === 'INVENTARIO'" key="inventario">
          <div class="flex-center h-64 text-slate-400 font-bold">Cargando Módulo de Inventario...</div>
        </div>

      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, h } from 'vue'
import {
  AppstoreOutlined, LineChartOutlined, ShoppingOutlined,
  CodeSandboxOutlined, BankOutlined, DollarOutlined,
  ShopOutlined, InboxOutlined, WarningOutlined,
  ArrowUpOutlined, ArrowDownOutlined, BarChartOutlined,
  CalendarOutlined, TagOutlined, SwapOutlined
} from '@ant-design/icons-vue'

const panelActivo = ref('GLOBAL')
const actividadActiva = ref('VENTAS')

// Opciones del Segmented Control (Menú Superior)
const opcionesPanel = [
  { value: 'GLOBAL', payload: { icon: AppstoreOutlined, title: 'Resumen Global' } },
  { value: 'VENTAS', payload: { icon: LineChartOutlined, title: 'Métricas Ventas' } },
  { value: 'COMPRAS', payload: { icon: ShoppingOutlined, title: 'Compras & Prov.' } },
  { value: 'INVENTARIO', payload: { icon: CodeSandboxOutlined, title: 'Logística' } },
  { value: 'FINANZAS', payload: { icon: BankOutlined, title: 'Finanzas' } },
].map(item => ({
  value: item.value,
  label: h('div', { class: 'segmented-item' }, [
    h(item.payload.icon, { class: 'segmented-icon' }),
    h('span', item.payload.title)
  ])
}))
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&display=swap');

.dashboard-root { font-family: 'Inter', sans-serif; background-color: #f8fafc; min-height: 100vh; }
.font-mono { font-family: 'JetBrains Mono', monospace; }

/* UTILS */
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-center { display: flex; justify-content: center; align-items: center; flex-direction: column; }

/* HEADER */
.dash-header { background: white; border-bottom: 1px solid #e2e8f0; }
.dash-title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.5px; }
.dash-subtitle { font-size: 14px; color: #64748b; margin: 4px 0 0 0; }

/* SEGMENTED CONTROL STYLING */
.dash-segmented { background: #f1f5f9; padding: 4px; border-radius: 10px; border: 1px solid #e2e8f0; }
:deep(.ant-segmented-item) { border-radius: 8px; transition: all 0.2s; }
:deep(.ant-segmented-item-selected) { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #cbd5e1; }
:deep(.segmented-item) { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-weight: 600; font-size: 13px; color: #475569; }
:deep(.ant-segmented-item-selected .segmented-item) { color: #4f46e5; }
:deep(.segmented-icon) { font-size: 16px; }

/* KPI CARDS */
.kpi-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px -2px rgba(0,0,0,0.02); display: flex; flex-direction: column; position: relative; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
.kpi-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 16px; }
.kpi-info { display: flex; flex-direction: column; gap: 4px; }
.kpi-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.kpi-value { font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.1; letter-spacing: -0.5px;}
.kpi-trend { margin-top: 16px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 4px; }
.trend-up { color: #10b981; } .trend-down { color: #ef4444; }

/* DASH CARDS */
.dash-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px -2px rgba(0,0,0,0.02); display: flex; flex-direction: column; overflow: hidden;}
.card-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
.card-header h3 { margin: 0; font-size: 15px; font-weight: 800; color: #1e293b; }

/* FEED WIDGET */
.custom-tabs :deep(.ant-tabs-nav) { margin-bottom: 0; }
.custom-tabs :deep(.ant-tabs-tab) { padding: 12px 0; font-weight: 600; color: #64748b; }
.custom-tabs :deep(.ant-tabs-tab-active) { color: #4f46e5; }
.custom-tabs :deep(.ant-tabs-ink-bar) { background: #4f46e5; height: 3px; border-radius: 3px 3px 0 0; }

.feed-list { padding: 12px 0; }
.feed-item { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.feed-item:last-child { border-bottom: none; }
.feed-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
.feed-content { flex: 1; min-width: 0; }
.feed-title { margin: 0 0 2px 0; font-size: 13px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.feed-desc { margin: 0; font-size: 11px; color: #94a3b8; }
.feed-meta { text-align: right; display: flex; flex-direction: column; gap: 2px; }
.feed-amount { font-size: 13px; font-weight: 800; }
.feed-time { font-size: 10px; font-weight: 600; color: #cbd5e1; text-transform: uppercase; }

/* TRANSITIONS */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px); }
</style>
