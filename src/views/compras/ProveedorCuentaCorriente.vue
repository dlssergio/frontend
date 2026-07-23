<script setup>
/**
 * ProveedorCuentaCorriente.vue
 *
 * Vista completa de Cuenta Corriente del Proveedor.
 * Consume: GET /api/proveedores-admin/<id>/cuenta-corriente/
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  PrinterOutlined,
  SendOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  FilePdfOutlined,
  EyeOutlined,
  RightOutlined,
  DownOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import { proveedoresService } from '@/services/compras'

const route  = useRoute()
const router = useRouter()

const proveedorId = computed(() => route.params.id)

// ── State ──────────────────────────────────────────────────────────────────
const loading         = ref(false)
const cuentaData      = ref(null)
const error           = ref(null)

// Filtros
const filtros = ref({
  fecha_desde: '',
  fecha_hasta: '',
  tipo: '',          // '' | 'comprobante' | 'orden_pago'
})
const filtrosVisible  = ref(false)

// Paginación movimientos
const paginaActual    = ref(1)
const filasPorPagina  = ref(50)

// UI estado
const seccionActiva   = ref('movimientos') // 'movimientos' | 'impagos' | 'ordenes'
const opExpandida     = ref(null)          // id de la orden de pago visible

// ── Shortcuts a datos ──────────────────────────────────────────────────────
const proveedor           = computed(() => cuentaData.value?.proveedor || null)
const resumen             = computed(() => cuentaData.value?.kpis || null)
const movimientos         = computed(() => cuentaData.value?.movimientos || [])
const paginacion          = computed(() => cuentaData.value?.paginacion || {})
const comprobantesImpagos = computed(() => cuentaData.value?.comprobantes_impagos || [])
const ordenesPago         = computed(() => cuentaData.value?.ordenes_pago || [])

// ── Helpers formato ────────────────────────────────────────────────────────
const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmt = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return iso }
}

const pct = (parte, total) => {
  if (!total || total <= 0) return 0
  return Math.min(100, Math.round((parte / total) * 100))
}

// ── Riesgo ─────────────────────────────────────────────────────────────────
const riesgoColor = computed(() => {
  const r = resumen.value?.riesgo
  if (r === 'EXCEDIDO') return 'error'
  if (r === 'MORA')     return 'warning'
  return 'success'
})

const riesgoLabel = computed(() => {
  const r = resumen.value?.riesgo
  if (r === 'EXCEDIDO') return 'Límite excedido'
  if (r === 'MORA')     return 'Con deuda vencida'
  return 'Al día'
})

const creditoPct = computed(() => {
  const r = resumen.value
  if (!r || !r.limite_credito) return 0
  return pct(r.saldo_total, r.limite_credito)
})

// ── Aging ──────────────────────────────────────────────────────────────────
const agingRows = computed(() => {
  const a = resumen.value?.aging
  if (!a) return []
  return [
    { label: '0 – 30 días',  value: a.bucket_0_30,   color: '#10b981' },
    { label: '31 – 60 días', value: a.bucket_31_60,  color: '#f59e0b' },
    { label: '61 – 90 días', value: a.bucket_61_90,  color: '#f97316' },
    { label: '+ 90 días',    value: a.bucket_90_plus, color: '#ef4444' },
  ].filter(r => r.value > 0)
})

const maxAging = computed(() => Math.max(...agingRows.value.map(r => r.value), 1))

// ── Data fetch ─────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  error.value   = null
  try {
    const params = {
      page:      paginaActual.value,
      page_size: filasPorPagina.value,
    }
    if (filtros.value.fecha_desde) params.fecha_desde = filtros.value.fecha_desde
    if (filtros.value.fecha_hasta) params.fecha_hasta = filtros.value.fecha_hasta
    if (filtros.value.tipo)        params.tipo        = filtros.value.tipo

    const { data } = await proveedoresService.cuentaCorriente(proveedorId.value, params)
    cuentaData.value = data
  } catch (e) {
    error.value = e?.response?.data?.detail || 'No se pudo cargar la cuenta corriente.'
  } finally {
    loading.value = false
  }
}

watch(paginaActual, fetchData)
watch(filasPorPagina, () => { paginaActual.value = 1; fetchData() })

const aplicarFiltros = () => { paginaActual.value = 1; fetchData() }
const limpiarFiltros = () => {
  filtros.value = { fecha_desde: '', fecha_hasta: '', tipo: '' }
  paginaActual.value = 1
  fetchData()
}

const hayFiltrosActivos = computed(() =>
  filtros.value.fecha_desde || filtros.value.fecha_hasta || filtros.value.tipo
)

// ── Estado pago label ───────────────────────────────────────────────────────
const estadoPagoTag = (item) => {
  const ep = item.estado_pago || (item.saldo_pendiente <= 0 ? 'PAGADO' : 'IMPAGO')
  if (ep === 'PAGADO')  return { color: 'success', label: 'Pagado' }
  if (ep === 'PARCIAL') return { color: 'warning', label: 'Parcial' }
  return                       { color: 'error',   label: 'Pendiente' }
}

onMounted(fetchData)
</script>

<template>
  <div class="cc-root">
    <div class="cc-header">
      <a-button type="text" class="cc-back" @click="router.back()">
        <ArrowLeftOutlined /> Volver
      </a-button>

      <div class="cc-header-info">
        <div class="cc-header-avatar" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
          {{ (proveedor?.razon_social || '?')[0].toUpperCase() }}
        </div>
        <div>
          <h1 class="cc-title">
            {{ proveedor?.razon_social || `Proveedor #${proveedorId}` }}
          </h1>
          <div class="cc-meta">
            <span v-if="proveedor?.cuit" class="cc-chip">CUIT {{ proveedor.cuit }}</span>
            <span v-if="proveedor?.codigo" class="cc-chip cc-chip--blue">
              {{ proveedor.codigo }}
            </span>
          </div>
        </div>
      </div>

      <div class="cc-header-actions">
        <a-button :loading="loading" @click="fetchData">
          <ReloadOutlined /> Actualizar
        </a-button>
      </div>
    </div>

    <a-alert v-if="error" :message="error" type="error" show-icon style="margin-bottom:16px" />

    <a-spin :spinning="loading">
      <template v-if="cuentaData">

        <div class="kpi-grid">
          <div class="kpi" :class="`kpi--${riesgoColor}`">
            <div class="kpi-icon"><DollarOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Saldo a Pagar</div>
              <div class="kpi-val">${{ money(resumen?.saldo_total) }}</div>
              <div class="kpi-foot">
                <a-tag :color="riesgoColor === 'error' ? 'error' : riesgoColor === 'warning' ? 'warning' : 'success'" size="small">
                  <WarningOutlined v-if="riesgoColor === 'error'" />
                  <ExclamationCircleOutlined v-else-if="riesgoColor === 'warning'" />
                  <CheckCircleOutlined v-else />
                  {{ riesgoLabel }}
                </a-tag>
              </div>
            </div>
          </div>

          <div class="kpi" :class="resumen?.deuda_vencida > 0 ? 'kpi--error' : 'kpi--ok'">
            <div class="kpi-icon"><ClockCircleOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Deuda vencida</div>
              <div class="kpi-val" :class="resumen?.deuda_vencida > 0 ? 'kpi-val--red' : ''">
                ${{ money(resumen?.deuda_vencida) }}
              </div>
              <div class="kpi-foot">
                <span class="kpi-sub">No vencida: ${{ money(resumen?.deuda_no_vencida) }}</span>
              </div>
            </div>
          </div>

          <div class="kpi">
            <div class="kpi-icon"><BarChartOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Límite de crédito</div>
              <div class="kpi-val">${{ money(resumen?.limite_credito) }}</div>
              <div class="kpi-credit-bar">
                <div class="kpi-credit-track">
                  <div
                    class="kpi-credit-fill"
                    :class="creditoPct >= 100 ? 'kpi-credit-fill--over' : creditoPct >= 80 ? 'kpi-credit-fill--warn' : ''"
                    :style="{ width: `${Math.min(creditoPct, 100)}%` }"
                  />
                </div>
                <span class="kpi-credit-pct">{{ creditoPct }}% usado</span>
              </div>
            </div>
          </div>

          <div class="kpi">
            <div class="kpi-icon"><FileTextOutlined /></div>
            <div class="kpi-body">
              <div class="kpi-label">Comprado 30 días</div>
              <div class="kpi-val">${{ money(resumen?.kpis?.total_comprado_30d) }}</div>
              <div class="kpi-foot">
                <span class="kpi-sub">Pagado 30d: ${{ money(resumen?.kpis?.total_pagado_30d) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="agingRows.length" class="card">
          <div class="card-title"><ClockCircleOutlined /> Antigüedad de deuda vencida</div>
          <div class="aging-list">
            <div v-for="row in agingRows" :key="row.label" class="aging-row">
              <span class="aging-label">{{ row.label }}</span>
              <div class="aging-bar-wrap">
                <div class="aging-bar-fill" :style="{ width: `${(row.value / maxAging) * 100}%`, background: row.color }" />
              </div>
              <span class="aging-val">${{ money(row.value) }}</span>
            </div>
          </div>
        </div>

        <div class="section-tabs">
          <button class="section-tab" :class="{ 'section-tab--active': seccionActiva === 'movimientos' }" @click="seccionActiva = 'movimientos'">
            <DollarOutlined /> Movimientos
            <span class="section-tab-badge">{{ paginacion?.total || 0 }}</span>
          </button>
          <button class="section-tab" :class="{ 'section-tab--active': seccionActiva === 'impagos' }" @click="seccionActiva = 'impagos'">
            <ExclamationCircleOutlined /> Comprobantes a Pagar
            <span class="section-tab-badge" :class="comprobantesImpagos.length > 0 ? 'section-tab-badge--red' : ''">
              {{ comprobantesImpagos.length }}
            </span>
          </button>
          <button class="section-tab" :class="{ 'section-tab--active': seccionActiva === 'ordenes' }" @click="seccionActiva = 'ordenes'">
            <WalletOutlined /> Órdenes de Pago
            <span class="section-tab-badge">{{ ordenesPago.length }}</span>
          </button>
        </div>

        <div v-show="seccionActiva === 'movimientos'" class="card card--no-top-radius">
          <div class="movs-toolbar">
            <div class="movs-toolbar-left">
              <a-button :type="filtrosVisible ? 'primary' : 'default'" ghost @click="filtrosVisible = !filtrosVisible">
                <FilterOutlined /> Filtros
                <a-badge v-if="hayFiltrosActivos" dot style="margin-left:4px" />
              </a-button>
              <a-button v-if="hayFiltrosActivos" type="text" danger size="small" @click="limpiarFiltros">
                <CloseCircleOutlined /> Limpiar filtros
              </a-button>
            </div>
          </div>

          <div v-if="filtrosVisible" class="filtros-panel">
            <div class="filtros-row">
              <div class="filtros-item">
                <label class="filtros-label">Desde</label>
                <a-input v-model:value="filtros.fecha_desde" type="date" size="small" style="width:150px" />
              </div>
              <div class="filtros-item">
                <label class="filtros-label">Hasta</label>
                <a-input v-model:value="filtros.fecha_hasta" type="date" size="small" style="width:150px" />
              </div>
              <div class="filtros-item">
                <label class="filtros-label">Tipo</label>
                <a-select v-model:value="filtros.tipo" size="small" style="width:160px" :options="[
                    { value: '', label: 'Todos' },
                    { value: 'comprobante', label: 'Comprobantes' },
                    { value: 'orden_pago', label: 'Órdenes de Pago' },
                  ]" />
              </div>
              <a-button type="primary" size="small" @click="aplicarFiltros">Aplicar</a-button>
            </div>
          </div>

          <a-table :data-source="movimientos" :pagination="false" size="small" :row-key="(r, i) => `${r.clase}-${r.id}-${i}`" :scroll="{ x: 700 }">
            <a-table-column title="Fecha" data-index="fecha" width="100" :customRender="({ text }) => fmt(text)" />
            <a-table-column title="Tipo" data-index="tipo" width="140">
              <template #default="{ record }">
                <span class="mov-badge" :class="record.clase === 'orden_pago' ? 'mov-badge--recibo' : 'mov-badge--comp'">
                  {{ record.tipo }}
                </span>
              </template>
            </a-table-column>
            <a-table-column title="Número" data-index="numero">
              <template #default="{ record }">
                <span class="mov-numero">{{ record.numero }}</span>
              </template>
            </a-table-column>
            <a-table-column title="Debe (+)" data-index="debe" align="right" width="130">
              <template #default="{ record }">
                <span v-if="record.debe > 0" class="text-deuda">${{ money(record.debe) }}</span>
                <span v-else class="text-empty">—</span>
              </template>
            </a-table-column>
            <a-table-column title="Haber (-)" data-index="haber" align="right" width="130">
              <template #default="{ record }">
                <span v-if="record.haber > 0" class="text-ok">${{ money(record.haber) }}</span>
                <span v-else class="text-empty">—</span>
              </template>
            </a-table-column>
            <a-table-column title="Saldo acum." data-index="saldo" align="right" width="140">
              <template #default="{ record }">
                <span :class="record.saldo > 0 ? 'text-deuda' : 'text-ok'">
                  ${{ money(record.saldo) }}
                </span>
              </template>
            </a-table-column>
          </a-table>

          <div class="movs-total-row">
            <span>SALDO FINAL DEUDOR</span>
            <span class="movs-saldo-final" :class="(resumen?.saldo_total || 0) > 0 ? 'text-deuda' : 'text-ok'">
              ${{ money(resumen?.saldo_total) }}
            </span>
          </div>

          <div class="movs-pagination" v-if="paginacion?.total_pages > 1">
            <a-pagination v-model:current="paginaActual" :total="paginacion?.total || 0" :page-size="filasPorPagina"
              show-size-changer @change="(p) => { paginaActual = p }" @showSizeChange="(_, size) => { filasPorPagina = size; paginaActual = 1 }" />
          </div>
        </div>

        <div v-show="seccionActiva === 'impagos'" class="card card--no-top-radius">
          <div v-if="comprobantesImpagos.length === 0" class="empty-state">
            <CheckCircleOutlined class="empty-icon empty-icon--ok" />
            <p>Sin facturas pendientes de pago</p>
          </div>
          <a-table v-else :data-source="comprobantesImpagos" :pagination="{ pageSize: 20 }" size="small" :row-key="r => r.id" :scroll="{ x: 800 }">
            <a-table-column title="Fecha" data-index="fecha" width="100" :customRender="({ text }) => fmt(text)" />
            <a-table-column title="Tipo" data-index="tipo" width="140" />
            <a-table-column title="Número" data-index="numero">
              <template #default="{ record }"><span class="mov-numero">{{ record.numero }}</span></template>
            </a-table-column>
            <a-table-column title="Vencimiento" width="110">
              <template #default="{ record }">
                <span :class="record.vencido ? 'text-deuda' : ''">{{ fmt(record.fecha_vencimiento) }}</span>
              </template>
            </a-table-column>
            <a-table-column title="Total" data-index="total" align="right" width="120" :customRender="({ text }) => `$${money(text)}`" />
            <a-table-column title="Pagado" data-index="pagado" align="right" width="120">
              <template #default="{ record }"><span class="text-ok">${{ money(record.pagado) }}</span></template>
            </a-table-column>
            <a-table-column title="Saldo" data-index="saldo_pendiente" align="right" width="120">
              <template #default="{ record }"><span class="text-deuda font-bold">${{ money(record.saldo_pendiente) }}</span></template>
            </a-table-column>
          </a-table>
        </div>

        <div v-show="seccionActiva === 'ordenes'" class="card card--no-top-radius">
          <div v-if="ordenesPago.length === 0" class="empty-state">
            <WalletOutlined class="empty-icon" />
            <p>Sin órdenes de pago registradas</p>
          </div>
          <div v-else class="recibos-list">
            <div v-for="op in ordenesPago" :key="op.id" class="recibo-item" :class="{ 'recibo-item--open': opExpandida === op.id }">
              <div class="recibo-header" @click="opExpandida = opExpandida === op.id ? null : op.id">
                <div class="recibo-header-left">
                  <span class="recibo-num">{{ op.numero }}</span>
                  <span class="recibo-fecha">{{ fmt(op.fecha) }}</span>
                </div>
                <div class="recibo-header-right">
                  <span class="recibo-monto text-ok">${{ money(op.monto_total) }}</span>
                  <a-button type="text" size="small" class="recibo-toggle">
                    <DownOutlined v-if="opExpandida === op.id" />
                    <RightOutlined v-else />
                  </a-button>
                </div>
              </div>

              <div v-if="opExpandida === op.id" class="recibo-detail">
                <div class="recibo-section">
                  <div class="recibo-section-title">Facturas Pagadas</div>
                  <div class="recibo-table">
                    <div class="recibo-table-head">
                      <span>Tipo</span><span>Número</span><span class="text-right">Monto cancelado</span>
                    </div>
                    <div v-for="(imp, i) in op.imputaciones" :key="i" class="recibo-table-row">
                      <span>{{ imp.comp_tipo }}</span><span class="mov-numero">{{ imp.comp_numero }}</span>
                      <span class="text-right text-deuda">${{ money(imp.monto) }}</span>
                    </div>
                  </div>
                </div>

                <div class="recibo-section">
                  <div class="recibo-section-title">Salida de Fondos</div>
                  <div class="recibo-table">
                    <div class="recibo-table-head">
                      <span>Tipo</span><span>Caja / Origen</span><span>Referencia</span><span class="text-right">Monto</span>
                    </div>
                    <div v-for="(val, i) in op.valores" :key="i" class="recibo-table-row">
                      <span class="recibo-tipo-valor">{{ val.tipo }}</span><span>{{ val.origen }}</span>
                      <span class="text-muted">{{ val.referencia || '—' }}</span>
                      <span class="text-right font-bold">${{ money(val.monto) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </a-spin>
  </div>
</template>

<style scoped>
/* Los estilos son exactamente idénticos al de ClienteCuentaCorriente.vue
   para garantizar cohesión visual en toda la aplicación. */
.cc-root { padding: 20px 24px; max-width: 1280px; margin: 0 auto; }
.cc-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.cc-back { flex-shrink: 0; }
.cc-header-info { flex: 1; display: flex; align-items: center; gap: 14px; min-width: 0; }
.cc-header-avatar { width: 46px; height: 46px; border-radius: 12px; color: #fff; font-size: 20px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); }
.cc-title { font-size: 18px; font-weight: 800; margin: 0; color: var(--text-0, #0f172a); }
.cc-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 3px; }
.cc-chip { padding: 1px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; background: rgba(148, 163, 184, 0.12); color: var(--text-2, #64748b); border: 1px solid rgba(148, 163, 184, 0.2); font-family: ui-monospace, monospace; }
.cc-chip--blue  { background: rgba(22, 119, 255, 0.08); color: var(--primary, #1677ff); border-color: rgba(22,119,255,.15); }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.kpi { background: var(--surface-1, #fff); border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 10px; padding: 14px 16px; border-top: 3px solid transparent; display: flex; gap: 12px; align-items: flex-start; }
.kpi--error   { border-top-color: #ef4444; }
.kpi--warning { border-top-color: #f59e0b; }
.kpi--success,.kpi--ok { border-top-color: #10b981; }
.kpi-icon { font-size: 20px; color: var(--text-2, #64748b); opacity: 0.5; padding-top: 2px; }
.kpi-body { flex: 1; min-width: 0; }
.kpi-label { font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-2, #64748b); margin-bottom: 4px; }
.kpi-val { font-size: 1.4rem; font-weight: 900; color: var(--text-0, #0f172a); font-variant-numeric: tabular-nums; line-height: 1.1; margin-bottom: 5px; }
.kpi-val--red   { color: #ef4444; }
.kpi-foot  { display: flex; align-items: center; gap: 6px; }
.kpi-sub   { font-size: 11px; color: var(--text-2, #64748b); }
.kpi-credit-bar { display: flex; align-items: center; gap: 8px; margin-top: 5px; }
.kpi-credit-track { flex: 1; height: 5px; background: rgba(148,163,184,.15); border-radius: 3px; overflow: hidden; }
.kpi-credit-fill { height: 100%; background: #10b981; border-radius: 3px; transition: width .4s ease; }
.kpi-credit-fill--warn { background: #f59e0b; }
.kpi-credit-fill--over { background: #ef4444; }
.kpi-credit-pct { font-size: 11px; font-weight: 700; color: var(--text-2,#64748b); white-space: nowrap; }
.aging-list { display: flex; flex-direction: column; gap: 10px; }
.aging-row  { display: flex; align-items: center; gap: 12px; }
.aging-label { width: 100px; font-size: 12px; font-weight: 600; color: var(--text-1,#334155); flex-shrink: 0; }
.aging-bar-wrap { flex: 1; height: 10px; background: rgba(148,163,184,.12); border-radius: 5px; overflow: hidden; }
.aging-bar-fill { height: 100%; border-radius: 5px; transition: width .4s ease; }
.aging-val { width: 130px; text-align: right; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-0,#0f172a); flex-shrink: 0; }
.card { background: var(--surface-1, #fff); border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 10px; padding: 16px 18px; margin-bottom: 14px; }
.card--no-top-radius { border-top-left-radius: 0; border-top-right-radius: 0; border-top: none; }
.card-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--text-2, #64748b); margin-bottom: 14px; display: flex; align-items: center; gap: 7px; }
.section-tabs { display: flex; gap: 0; border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 10px 10px 0 0; overflow: hidden; margin-bottom: 0; }
.section-tab { flex: 1; padding: 10px 16px; font-size: 12.5px; font-weight: 600; color: var(--text-2, #64748b); background: var(--surface-2, #f8fafc); border: none; border-right: 1px solid var(--border, rgba(148,163,184,.2)); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; transition: background .12s, color .12s; }
.section-tab:last-child { border-right: none; }
.section-tab:hover { background: var(--surface-1, #fff); color: var(--text-0, #0f172a); }
.section-tab--active { background: var(--surface-1, #fff); color: var(--primary, #1677ff); box-shadow: inset 0 -2px 0 var(--primary, #1677ff); }
.section-tab-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 18px; padding: 0 5px; border-radius: 9px; font-size: 10px; font-weight: 700; background: rgba(148,163,184,.15); color: var(--text-2, #64748b); }
.section-tab-badge--red { background: rgba(239, 68, 68, .1); color: #ef4444; }
.movs-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
.movs-toolbar-left { display: flex; gap: 8px; align-items: center; }
.filtros-panel { background: var(--surface-2, #f8fafc); border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; }
.filtros-row { display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap; }
.filtros-item { display: flex; flex-direction: column; gap: 4px; }
.filtros-label { font-size: 11px; font-weight: 600; color: var(--text-2,#64748b); text-transform: uppercase; }
.mov-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700; }
.mov-badge--comp   { background: #fee2e2; color: #991b1b; } /* Compras: Rojo porque es deuda */
.mov-badge--recibo { background: #dcfce7; color: #166534; } /* OP: Verde porque cancela deuda */
.mov-numero { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--text-1,#334155); }
.text-deuda { color: #ef4444; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-ok    { color: #10b981; font-weight: 700; font-variant-numeric: tabular-nums; }
.text-empty { color: var(--text-2,#64748b); opacity: 0.5; }
.text-muted { color: var(--text-2,#64748b); font-size: 11.5px; }
.font-bold  { font-weight: 700; }
.text-right { text-align: right; }
.movs-total-row { display: flex; justify-content: space-between; padding: 10px 8px 4px; border-top: 2px solid var(--border, rgba(148,163,184,.2)); font-weight: 800; font-size: 13px; margin-top: 4px; }
.movs-saldo-final { font-size: 15px; }
.movs-pagination { display: flex; justify-content: flex-end; margin-top: 14px; }
.empty-state { text-align: center; padding: 40px 20px; color: var(--text-2,#64748b); }
.empty-icon { font-size: 40px; opacity: 0.3; margin-bottom: 10px; display: block; }
.empty-icon--ok { color: #10b981; opacity: 0.6; }
.recibos-list { display: flex; flex-direction: column; gap: 8px; }
.recibo-item { border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 8px; overflow: hidden; transition: box-shadow .12s; }
.recibo-item:hover { box-shadow: 0 2px 10px rgba(0,0,0,.06); }
.recibo-item--open { border-color: var(--primary, #1677ff); }
.recibo-header { display: flex; align-items: center; justify-content: space-between; padding: 11px 14px; cursor: pointer; background: var(--surface-2, #f8fafc); gap: 12px; }
.recibo-header-left  { display: flex; align-items: center; gap: 12px; }
.recibo-header-right { display: flex; align-items: center; gap: 10px; }
.recibo-num { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 700; color: var(--text-0, #0f172a); }
.recibo-fecha { font-size: 12px; color: var(--text-2, #64748b); }
.recibo-monto { font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; }
.recibo-detail { padding: 14px 16px; background: var(--surface-1, #fff); border-top: 1px solid var(--border, rgba(148,163,184,.15)); display: flex; flex-direction: column; gap: 16px; }
.recibo-section-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: var(--text-2, #64748b); margin-bottom: 8px; }
.recibo-table { border: 1px solid var(--border, rgba(148,163,184,.2)); border-radius: 6px; overflow: hidden; }
.recibo-table-head, .recibo-table-row { display: grid; grid-template-columns: 1.2fr 1.8fr 1.5fr 1fr; gap: 0; }
.recibo-table-head { background: var(--surface-2, #f8fafc); padding: 6px 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-2, #64748b); }
.recibo-table-row { padding: 7px 10px; font-size: 12px; border-top: 1px solid var(--border, rgba(148,163,184,.1)); align-items: center; }
.recibo-tipo-valor { font-weight: 600; color: var(--text-0, #0f172a); }
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
