<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FilePdfOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  UserOutlined,
  PrinterOutlined,
  SendOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import { imprimirEstadoCuenta as generarEstadoCuenta } from '@/utils/estadoCuentaImprimible'

const route  = useRoute()
const router = useRouter()

const clienteId = computed(() => route.params.id)

const loading   = ref(false)
const dashboard = ref(null)
const cliente   = ref(null)
const error     = ref(null)

// ── Helpers ──────────────────────────────────────────────────────────────────
const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatFecha = (iso) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return iso }
}

const riesgoColor = computed(() => {
  const r = dashboard.value?.riesgo
  if (r === 'EXCEDIDO')    return 'danger'
  if (r === 'SEGUIMIENTO') return 'warning'
  return 'success'
})

const riesgoLabel = computed(() => {
  const r = dashboard.value?.riesgo
  if (r === 'EXCEDIDO')    return 'Límite excedido'
  if (r === 'SEGUIMIENTO') return 'En seguimiento'
  return 'Normal'
})

const creditoPct = computed(() => {
  const d = dashboard.value
  if (!d) return 0
  const limite = d.limite_credito || 0
  if (limite <= 0) return 0
  return Math.min(100, Math.round((d.saldo_total / limite) * 100))
})

const agingRows = computed(() => {
  const a = dashboard.value?.aging
  if (!a) return []
  return [
    { label: '0 – 30 días',  value: a.bucket_0_30,    color: '#10b981' },
    { label: '31 – 60 días', value: a.bucket_31_60,   color: '#f59e0b' },
    { label: '61 – 90 días', value: a.bucket_61_90,   color: '#f97316' },
    { label: '+ 90 días',    value: a.bucket_90_plus, color: '#ef4444' },
  ].filter(r => r.value > 0)
})

const maxAging = computed(() =>
  Math.max(...agingRows.value.map(r => r.value), 1)
)

// ── Data fetching ─────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  error.value   = null
  try {
    const [dashRes, clienteRes] = await Promise.all([
      api.get(`/api/clientes-admin/${clienteId.value}/dashboard/`),
      api.get(`/api/clientes/${clienteId.value}/`),
    ])
    dashboard.value = dashRes.data
    cliente.value   = clienteRes.data
  } catch (e) {
    error.value = e?.response?.data?.detail || 'No se pudo cargar la información del cliente.'
  } finally {
    loading.value = false
  }
}

const abrirPdf = async (id) => {
  try {
    const res = await api.get(`/api/comprobantes-venta/${id}/pdf/`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    const win = window.open(url, '_blank')
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
    else setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { /* ignore */ }
}

const estadoPagoTag = (comp) => {
  if (comp.saldo <= 0)             return { color: 'success', label: 'Pagado'    }
  if (comp.saldo < comp.total)     return { color: 'warning', label: 'Parcial'   }
  return                                   { color: 'error',   label: 'Pendiente' }
}

// ── Email ─────────────────────────────────────────────────────────────────────
const enviandoEmail  = ref(false)
const emailModalOpen = ref(false)
const emailDestino   = ref('')

const abrirEmailModal = () => {
  emailDestino.value = (
    cliente.value?.contacto_email ||
    cliente.value?.entidad?.email ||
    ''
  )
  emailModalOpen.value = true
}

const enviarEmailEstadoCuenta = async () => {
  enviandoEmail.value = true
  try {
    const payload = emailDestino.value.trim() ? { email: emailDestino.value.trim() } : {}
    const { data } = await api.post(
      `/api/clientes-admin/${clienteId.value}/enviar-estado-cuenta/`,
      payload
    )
    message.success(data.mensaje || 'Estado de cuenta enviado correctamente')
    emailModalOpen.value = false
  } catch (e) {
    message.error(e?.response?.data?.error || 'Error al enviar el email')
  } finally {
    enviandoEmail.value = false
  }
}

// ── Imprimir ──────────────────────────────────────────────────────────────────
const imprimirEstadoCuenta = () => generarEstadoCuenta(clienteId.value, api)

onMounted(fetchData)
</script>

<template>
  <div class="ccc-root">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="ccc-header">
      <a-button type="text" @click="router.back()">
        <ArrowLeftOutlined /> Volver
      </a-button>
      <div class="ccc-header-title">
        <UserOutlined class="ccc-header-icon" />
        <div>
          <h1 class="ccc-title">
            {{ cliente?.entidad?.razon_social || `Cliente #${clienteId}` }}
          </h1>
          <p class="ccc-subtitle">
            {{ cliente?.entidad?.cuit || '' }}
            <span v-if="cliente?.codigo_cliente" class="ccc-code">
              · {{ cliente.codigo_cliente }}
            </span>
          </p>
        </div>
      </div>
      <a-button @click="imprimirEstadoCuenta">
        <PrinterOutlined /> Imprimir
      </a-button>
      <a-button @click="abrirEmailModal">
        <SendOutlined /> Enviar por email
      </a-button>
      <a-button :loading="loading" @click="fetchData">
        <ReloadOutlined /> Actualizar
      </a-button>
    </div>

    <!-- ── Error ───────────────────────────────────────────────────────────── -->
    <a-alert v-if="error" :message="error" type="error" show-icon style="margin-bottom:16px" />

    <a-spin :spinning="loading">
      <template v-if="dashboard">

        <!-- ── KPI Cards ──────────────────────────────────────────────────── -->
        <div class="kpi-grid">

          <div class="kpi-card" :class="`kpi-card--${riesgoColor}`">
            <div class="kpi-label">Saldo total</div>
            <div class="kpi-value">$ {{ money(dashboard.saldo_total) }}</div>
            <div class="kpi-sub">
              <a-tag :color="riesgoColor === 'danger' ? 'error' : riesgoColor === 'warning' ? 'warning' : 'success'">
                <WarningOutlined v-if="riesgoColor === 'danger'" />
                <ExclamationCircleOutlined v-else-if="riesgoColor === 'warning'" />
                <CheckCircleOutlined v-else />
                {{ riesgoLabel }}
              </a-tag>
            </div>
          </div>

          <div class="kpi-card" :class="dashboard.deuda_vencida > 0 ? 'kpi-card--danger' : 'kpi-card--ok'">
            <div class="kpi-label">Deuda vencida</div>
            <div class="kpi-value kpi-value--red">$ {{ money(dashboard.deuda_vencida) }}</div>
            <div class="kpi-sub">
              <span class="kpi-sub-text">No vencida: $ {{ money(dashboard.deuda_no_vencida) }}</span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Límite de crédito</div>
            <div class="kpi-value">$ {{ money(dashboard.limite_credito) }}</div>
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

          <div class="kpi-card">
            <div class="kpi-label">Ventas últimos 30 días</div>
            <div class="kpi-value">$ {{ money(dashboard.kpis.total_vendido_30d) }}</div>
            <div class="kpi-sub">
              <span class="kpi-sub-text">
                Ticket prom. 90d: $ {{ money(dashboard.kpis.ticket_promedio_90d) }}
              </span>
            </div>
          </div>

          <div class="kpi-card" :class="dashboard.comprobantes_impagos > 0 ? 'kpi-card--warn' : 'kpi-card--ok'">
            <div class="kpi-label">Comprobantes impagos</div>
            <div class="kpi-value">{{ dashboard.comprobantes_impagos }}</div>
            <div class="kpi-sub">
              <span class="kpi-sub-text" v-if="dashboard.kpis.dias_desde_ultima_compra != null">
                Última compra hace {{ dashboard.kpis.dias_desde_ultima_compra }} días
              </span>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-label">Deuda por tipo</div>
            <div class="kpi-dual">
              <div class="kpi-dual-item">
                <span class="kpi-dual-label">Cta. Cte.</span>
                <span class="kpi-dual-val">$ {{ money(dashboard.deuda_cta_cte) }}</span>
              </div>
              <div class="kpi-dual-item">
                <span class="kpi-dual-label">Contado</span>
                <span class="kpi-dual-val">$ {{ money(dashboard.deuda_contado) }}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- ── Aging ──────────────────────────────────────────────────────── -->
        <div v-if="agingRows.length" class="section-card">
          <div class="section-title"><ClockCircleOutlined /> Antigüedad de deuda</div>
          <div class="aging-list">
            <div v-for="row in agingRows" :key="row.label" class="aging-row">
              <span class="aging-label">{{ row.label }}</span>
              <div class="aging-bar-wrap">
                <div
                  class="aging-bar-fill"
                  :style="{ width: `${(row.value / maxAging) * 100}%`, background: row.color }"
                />
              </div>
              <span class="aging-val">$ {{ money(row.value) }}</span>
            </div>
          </div>
        </div>

        <!-- ── Movimientos cuenta corriente ───────────────────────────────── -->
        <div class="section-card" v-if="dashboard.movimientos_cta_cte?.length">
          <div class="section-title"><DollarOutlined /> Movimientos cuenta corriente</div>
          <a-table
            :data-source="dashboard.movimientos_cta_cte"
            :pagination="{ pageSize: 20, showSizeChanger: true }"
            size="small"
            :row-key="(r, i) => i"
          >
            <a-table-column title="Fecha"  data-index="fecha" width="110"
              :customRender="({ text }) => formatFecha(text)" />
            <a-table-column title="Tipo"   data-index="tipo"  width="90" />
            <a-table-column title="Número" data-index="numero" />
            <a-table-column title="Debe"   data-index="debe"  align="right" width="130"
              :customRender="({ text }) => text > 0 ? `$ ${money(text)}` : '—'" />
            <a-table-column title="Haber"  data-index="haber" align="right" width="130"
              :customRender="({ text }) => text > 0 ? `$ ${money(text)}` : '—'" />
            <a-table-column title="Saldo"  data-index="saldo" align="right" width="130">
              <template #default="{ record }">
                <span :class="record.saldo > 0 ? 'text-deuda' : 'text-ok'">
                  $ {{ money(record.saldo) }}
                </span>
              </template>
            </a-table-column>
          </a-table>
        </div>

        <!-- ── Últimos comprobantes ───────────────────────────────────────── -->
        <div class="section-card">
          <div class="section-title"><FileTextOutlined /> Últimos comprobantes</div>
          <a-table
            :data-source="dashboard.ultimos_comprobantes"
            :pagination="false"
            size="small"
            :row-key="r => r.id"
          >
            <a-table-column title="Fecha"  data-index="fecha" width="110"
              :customRender="({ text }) => formatFecha(text)" />
            <a-table-column title="Tipo"   data-index="tipo"  width="140" />
            <a-table-column title="Número" data-index="numero" />
            <a-table-column title="Condición" data-index="condicion_venta" width="120"
              :customRender="({ text }) => text === 'CC' ? 'Cta. Cte.' : 'Contado'" />
            <a-table-column title="Total"  data-index="total" align="right" width="130"
              :customRender="({ text }) => `$ ${money(text)}`" />
            <a-table-column title="Saldo"  data-index="saldo" align="right" width="130">
              <template #default="{ record }">
                <span :class="record.saldo > 0 ? 'text-deuda' : 'text-ok'">
                  $ {{ money(record.saldo) }}
                </span>
              </template>
            </a-table-column>
            <a-table-column title="Estado" width="110">
              <template #default="{ record }">
                <a-tag :color="estadoPagoTag(record).color">
                  {{ estadoPagoTag(record).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="" width="60" align="center">
              <template #default="{ record }">
                <a-tooltip title="Ver PDF">
                  <a-button type="text" size="small" @click="abrirPdf(record.id)">
                    <FilePdfOutlined />
                  </a-button>
                </a-tooltip>
              </template>
            </a-table-column>
          </a-table>
        </div>

      </template>
    </a-spin>

    <!-- ── Modal enviar email ──────────────────────────────────────────────── -->
    <a-modal
      v-model:open="emailModalOpen"
      title="Enviar estado de cuenta por email"
      ok-text="Enviar"
      cancel-text="Cancelar"
      :confirm-loading="enviandoEmail"
      @ok="enviarEmailEstadoCuenta"
    >
      <div style="display:flex;flex-direction:column;gap:12px;padding:8px 0">
        <p style="margin:0;color:var(--text-1,#334155);font-size:13px">
          Se enviará el estado de cuenta de
          <strong>{{ cliente?.entidad?.razon_social }}</strong>
          al siguiente email:
        </p>
        <a-input
          v-model:value="emailDestino"
          placeholder="email@ejemplo.com"
          type="email"
          size="large"
        />
        <p style="margin:0;font-size:11.5px;color:var(--text-2,#64748b)">
          Si el campo está vacío se usará el email registrado del cliente.
          Podés modificarlo para enviarlo a otra dirección.
        </p>
      </div>
    </a-modal>

  </div>
</template>

<style scoped>
.ccc-root {
  padding: 20px 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.ccc-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.ccc-header-title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ccc-header-icon {
  font-size: 32px;
  color: var(--primary, #1677ff);
  opacity: 0.7;
  flex-shrink: 0;
}
.ccc-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: var(--text-0, #0f172a);
  line-height: 1.2;
}
.ccc-subtitle {
  font-size: 12px;
  color: var(--text-2, #64748b);
  margin: 0;
  font-family: ui-monospace, monospace;
}
.ccc-code {
  color: var(--primary, #1677ff);
  font-weight: 700;
}

/* ─── KPI Grid ───────────────────────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
@media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .kpi-grid { grid-template-columns: 1fr; } }

.kpi-card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  padding: 16px 18px;
  border-top: 3px solid transparent;
  transition: box-shadow 0.15s;
}
.kpi-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
.kpi-card--danger  { border-top-color: #ef4444; }
.kpi-card--warning,
.kpi-card--warn    { border-top-color: #f59e0b; }
.kpi-card--success,
.kpi-card--ok      { border-top-color: #10b981; }

.kpi-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2, #64748b);
  margin-bottom: 6px;
}
.kpi-value {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  margin-bottom: 6px;
}
.kpi-value--red { color: #ef4444; }
.kpi-sub { display: flex; align-items: center; gap: 6px; }
.kpi-sub-text { font-size: 11.5px; color: var(--text-2, #64748b); }

.kpi-credit-bar { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.kpi-credit-track {
  flex: 1; height: 6px;
  background: rgba(148,163,184,0.18);
  border-radius: 3px; overflow: hidden;
}
.kpi-credit-fill {
  height: 100%; background: #10b981;
  border-radius: 3px; transition: width 0.4s ease;
}
.kpi-credit-fill--warn { background: #f59e0b; }
.kpi-credit-fill--over { background: #ef4444; }
.kpi-credit-pct { font-size: 11px; font-weight: 700; color: var(--text-2,#64748b); white-space: nowrap; }

.kpi-dual { display: flex; gap: 16px; margin-top: 4px; }
.kpi-dual-item { display: flex; flex-direction: column; gap: 2px; }
.kpi-dual-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-2,#64748b); }
.kpi-dual-val { font-size: 13px; font-weight: 700; color: var(--text-0,#0f172a); font-variant-numeric: tabular-nums; }

/* ─── Sections ───────────────────────────────────────────────────────────── */
.section-card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 12px; font-weight: 800;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-2, #64748b);
  margin-bottom: 14px;
  display: flex; align-items: center; gap: 7px;
}

/* ─── Aging ──────────────────────────────────────────────────────────────── */
.aging-list { display: flex; flex-direction: column; gap: 10px; }
.aging-row  { display: flex; align-items: center; gap: 12px; }
.aging-label { width: 100px; font-size: 12px; font-weight: 600; color: var(--text-1,#334155); flex-shrink: 0; }
.aging-bar-wrap { flex: 1; height: 10px; background: rgba(148,163,184,0.12); border-radius: 5px; overflow: hidden; }
.aging-bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
.aging-val { width: 120px; text-align: right; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-0,#0f172a); flex-shrink: 0; }

/* ─── Table helpers ──────────────────────────────────────────────────────── */
.text-deuda { color: #ef4444; font-weight: 700; }
.text-ok    { color: #10b981; font-weight: 700; }
</style>
