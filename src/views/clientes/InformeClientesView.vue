<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  ReloadOutlined,
  WarningOutlined,
  RiseOutlined,
  DollarOutlined,
  FileTextOutlined,
  PrinterOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { imprimirEstadoCuenta as generarEstadoCuenta } from '@/utils/estadoCuentaImprimible'

const router = useRouter()

const loading   = ref(false)
const data      = ref([])
const activeTab = ref('saldos')
const search    = ref('')

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

const riesgoTag = (row) => {
  if (row.riesgo === 'EXCEDIDO') return { color: 'error',   label: 'Excedido' }
  if (row.deuda_vencida > 0)     return { color: 'warning', label: 'Vencida'  }
  return                                 { color: 'success', label: 'Normal'   }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchData = async () => {
  loading.value = true
  try {
    const { data: res } = await api.get('/api/clientes-admin/informe-saldos/')
    data.value = res
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Filtered datasets per tab ─────────────────────────────────────────────────
const q = computed(() => search.value.trim().toLowerCase())

const filtered = computed(() =>
  q.value
    ? data.value.filter(r =>
        r.razon_social.toLowerCase().includes(q.value) ||
        r.cuit.includes(q.value) ||
        r.codigo.toLowerCase().includes(q.value)
      )
    : data.value
)

const conSaldo = computed(() =>
  filtered.value
    .filter(r => r.saldo_total > 0)
    .sort((a, b) => b.saldo_total - a.saldo_total)
)

const conDeudaVencida = computed(() =>
  filtered.value
    .filter(r => r.deuda_vencida > 0)
    .sort((a, b) => b.deuda_vencida - a.deuda_vencida)
)

const ranking = computed(() =>
  filtered.value
    .filter(r => r.total_vendido_90d > 0)
    .sort((a, b) => b.total_vendido_90d - a.total_vendido_90d)
    .map((r, i) => ({ ...r, _rank: i + 1 }))
)

const totalSaldo    = computed(() => conSaldo.value.reduce((a, r) => a + r.saldo_total, 0))
const totalVencida  = computed(() => conDeudaVencida.value.reduce((a, r) => a + r.deuda_vencida, 0))
const totalVentas90 = computed(() => ranking.value.reduce((a, r) => a + r.total_vendido_90d, 0))

// ── Acciones ──────────────────────────────────────────────────────────────────
const imprimirEstadoCuenta = (clienteId) => generarEstadoCuenta(clienteId, api)

const irACuentaCorriente = (id) => {
  router.push({ name: 'cliente-cuenta-corriente', params: { id } })
}

onMounted(fetchData)
</script>

<template>
  <div class="inf-root">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="inf-header">
      <div class="inf-header-left">
        <h1 class="inf-title">Informes de Clientes</h1>
        <p class="inf-subtitle">Saldos · Deuda vencida · Ranking · Estado de cuenta</p>
      </div>
      <div class="inf-header-actions">
        <a-input-search
          v-model:value="search"
          placeholder="Buscar cliente…"
          style="width: 240px"
          allow-clear
        />
        <a-button :loading="loading" @click="fetchData">
          <ReloadOutlined /> Actualizar
        </a-button>
      </div>
    </div>

    <!-- ── Resumen global ──────────────────────────────────────────────────── -->
    <div class="summary-bar">
      <div class="summary-item">
        <span class="summary-label">Clientes con saldo</span>
        <span class="summary-val">{{ conSaldo.length }}</span>
      </div>
      <div class="summary-item summary-item--red">
        <span class="summary-label">Total saldo pendiente</span>
        <span class="summary-val">$ {{ money(totalSaldo) }}</span>
      </div>
      <div class="summary-item summary-item--orange">
        <span class="summary-label">Total deuda vencida</span>
        <span class="summary-val">$ {{ money(totalVencida) }}</span>
      </div>
      <div class="summary-item summary-item--green">
        <span class="summary-label">Ventas 90 días</span>
        <span class="summary-val">$ {{ money(totalVentas90) }}</span>
      </div>
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────────────────── -->
    <a-tabs v-model:activeKey="activeTab" class="inf-tabs">

      <!-- Tab 1: Saldos pendientes -->
      <a-tab-pane key="saldos">
        <template #tab>
          <DollarOutlined /> Saldos pendientes
          <a-badge :count="conSaldo.length" :overflow-count="999" style="margin-left:6px" />
        </template>
        <a-table
          :data-source="conSaldo"
          :loading="loading"
          :pagination="{ pageSize: 20, showSizeChanger: true }"
          size="middle"
          row-key="id"
        >
          <a-table-column title="Cliente" data-index="razon_social"
            :sorter="(a,b) => a.razon_social.localeCompare(b.razon_social)">
            <template #default="{ record }">
              <a @click="irACuentaCorriente(record.id)" class="link-cliente">
                {{ record.razon_social }}
              </a>
              <div class="sub-cuit">{{ record.cuit }}</div>
            </template>
          </a-table-column>
          <a-table-column title="Cód." data-index="codigo" width="90" />
          <a-table-column title="Situación IVA" data-index="situacion_iva" width="160" />
          <a-table-column title="Saldo total" data-index="saldo_total" align="right" width="140"
            :sorter="(a,b) => a.saldo_total - b.saldo_total" default-sort-order="descend">
            <template #default="{ record }">
              <span class="text-deuda">$ {{ money(record.saldo_total) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="Vencida" data-index="deuda_vencida" align="right" width="130"
            :sorter="(a,b) => a.deuda_vencida - b.deuda_vencida">
            <template #default="{ record }">
              <span :class="record.deuda_vencida > 0 ? 'text-deuda' : 'text-muted'">
                $ {{ money(record.deuda_vencida) }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="No vencida" data-index="deuda_no_vencida" align="right" width="130">
            <template #default="{ record }">
              $ {{ money(record.deuda_no_vencida) }}
            </template>
          </a-table-column>
          <a-table-column title="Comprobantes" data-index="comprobantes_impagos" align="center" width="110"
            :sorter="(a,b) => a.comprobantes_impagos - b.comprobantes_impagos" />
          <a-table-column title="Riesgo" width="110" align="center">
            <template #default="{ record }">
              <a-tag :color="riesgoTag(record).color">{{ riesgoTag(record).label }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="" width="80" align="center">
            <template #default="{ record }">
              <a-tooltip title="Estado de cuenta">
                <a-button type="text" size="small" @click="imprimirEstadoCuenta(record.id)">
                  <PrinterOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip title="Ver cuenta corriente">
                <a-button type="text" size="small" @click="irACuentaCorriente(record.id)">
                  <FileTextOutlined />
                </a-button>
              </a-tooltip>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <!-- Tab 2: Deuda vencida -->
      <a-tab-pane key="vencida">
        <template #tab>
          <WarningOutlined /> Deuda vencida
          <a-badge :count="conDeudaVencida.length" :overflow-count="999"
            color="orange" style="margin-left:6px" />
        </template>
        <a-table
          :data-source="conDeudaVencida"
          :loading="loading"
          :pagination="{ pageSize: 20, showSizeChanger: true }"
          size="middle"
          row-key="id"
        >
          <a-table-column title="Cliente" data-index="razon_social"
            :sorter="(a,b) => a.razon_social.localeCompare(b.razon_social)">
            <template #default="{ record }">
              <a @click="irACuentaCorriente(record.id)" class="link-cliente">
                {{ record.razon_social }}
              </a>
              <div class="sub-cuit">{{ record.cuit }}</div>
            </template>
          </a-table-column>
          <a-table-column title="Deuda vencida" data-index="deuda_vencida" align="right" width="150"
            :sorter="(a,b) => a.deuda_vencida - b.deuda_vencida" default-sort-order="descend">
            <template #default="{ record }">
              <span class="text-deuda fw">$ {{ money(record.deuda_vencida) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="Saldo total" data-index="saldo_total" align="right" width="140">
            <template #default="{ record }">$ {{ money(record.saldo_total) }}</template>
          </a-table-column>
          <a-table-column title="Límite crédito" data-index="limite_credito" align="right" width="140">
            <template #default="{ record }">
              {{ record.limite_credito > 0 ? '$ ' + money(record.limite_credito) : '—' }}
            </template>
          </a-table-column>
          <a-table-column title="Comprobantes" data-index="comprobantes_impagos" align="center" width="110" />
          <a-table-column title="Riesgo" width="110" align="center">
            <template #default="{ record }">
              <a-tag :color="riesgoTag(record).color">{{ riesgoTag(record).label }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="" width="60" align="center">
            <template #default="{ record }">
              <a-tooltip title="Estado de cuenta">
                <a-button type="text" size="small" @click="imprimirEstadoCuenta(record.id)">
                  <PrinterOutlined />
                </a-button>
              </a-tooltip>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <!-- Tab 3: Ranking ventas -->
      <a-tab-pane key="ranking">
        <template #tab>
          <RiseOutlined /> Ranking ventas
        </template>
        <a-table
          :data-source="ranking"
          :loading="loading"
          :pagination="{ pageSize: 20, showSizeChanger: true }"
          size="middle"
          row-key="id"
        >
          <a-table-column title="#" data-index="_rank" width="55" align="center">
            <template #default="{ record }">
              <span class="rank-badge"
                :class="`rank-badge--${record._rank <= 3 ? record._rank : 'rest'}`">
                {{ record._rank }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="Cliente" data-index="razon_social"
            :sorter="(a,b) => a.razon_social.localeCompare(b.razon_social)">
            <template #default="{ record }">
              <a @click="irACuentaCorriente(record.id)" class="link-cliente">
                {{ record.razon_social }}
              </a>
              <div class="sub-cuit">{{ record.cuit }}</div>
            </template>
          </a-table-column>
          <a-table-column title="Ventas 90 días" data-index="total_vendido_90d"
            align="right" width="155"
            :sorter="(a,b) => a.total_vendido_90d - b.total_vendido_90d"
            default-sort-order="descend">
            <template #default="{ record }">
              <span class="text-green fw">$ {{ money(record.total_vendido_90d) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="Comprobantes" data-index="cantidad_comprobantes_90d"
            align="center" width="115"
            :sorter="(a,b) => a.cantidad_comprobantes_90d - b.cantidad_comprobantes_90d" />
          <a-table-column title="Ticket promedio" data-index="ticket_promedio_90d"
            align="right" width="140"
            :sorter="(a,b) => a.ticket_promedio_90d - b.ticket_promedio_90d">
            <template #default="{ record }">$ {{ money(record.ticket_promedio_90d) }}</template>
          </a-table-column>
          <a-table-column title="Última compra" data-index="ultima_compra" width="130"
            :sorter="(a,b) => (a.ultima_compra||'').localeCompare(b.ultima_compra||'')">
            <template #default="{ record }">{{ formatFecha(record.ultima_compra) }}</template>
          </a-table-column>
          <a-table-column title="Saldo pend." data-index="saldo_total" align="right" width="130">
            <template #default="{ record }">
              <span :class="record.saldo_total > 0 ? 'text-deuda' : 'text-muted'">
                {{ record.saldo_total > 0 ? '$ ' + money(record.saldo_total) : '—' }}
              </span>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

      <!-- Tab 4: Estado de cuenta -->
      <a-tab-pane key="estado">
        <template #tab>
          <PrinterOutlined /> Estado de cuenta
        </template>
        <div class="estado-info">
          <p>Seleccioná un cliente de cualquier listado y hacé clic en <PrinterOutlined /> para
            generar su estado de cuenta imprimible.</p>
          <p>O buscá un cliente específico y generalo desde acá:</p>
        </div>
        <a-table
          :data-source="conSaldo"
          :loading="loading"
          :pagination="{ pageSize: 10 }"
          size="middle"
          row-key="id"
        >
          <a-table-column title="Cliente" data-index="razon_social">
            <template #default="{ record }">
              <span class="fw">{{ record.razon_social }}</span>
              <div class="sub-cuit">{{ record.cuit }}</div>
            </template>
          </a-table-column>
          <a-table-column title="Saldo" data-index="saldo_total" align="right" width="140">
            <template #default="{ record }">
              <span class="text-deuda">$ {{ money(record.saldo_total) }}</span>
            </template>
          </a-table-column>
          <a-table-column title="Deuda vencida" data-index="deuda_vencida" align="right" width="140">
            <template #default="{ record }">
              <span :class="record.deuda_vencida > 0 ? 'text-deuda' : 'text-muted'">
                $ {{ money(record.deuda_vencida) }}
              </span>
            </template>
          </a-table-column>
          <a-table-column title="Acciones" width="200" align="center">
            <template #default="{ record }">
              <a-space>
                <a-button size="small" @click="imprimirEstadoCuenta(record.id)">
                  <PrinterOutlined /> Imprimir
                </a-button>
                <a-button size="small" type="link" @click="irACuentaCorriente(record.id)">
                  <FileTextOutlined /> Ver detalle
                </a-button>
              </a-space>
            </template>
          </a-table-column>
        </a-table>
      </a-tab-pane>

    </a-tabs>
  </div>
</template>

<style scoped>
.inf-root {
  padding: 20px 24px;
  max-width: 1300px;
  margin: 0 auto;
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.inf-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.inf-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: var(--text-0, #0f172a);
}
.inf-subtitle {
  font-size: 12px;
  color: var(--text-2, #64748b);
  margin: 2px 0 0;
}
.inf-header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

/* ─── Summary bar ────────────────────────────────────────────────────────── */
.summary-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.summary-item {
  flex: 1;
  min-width: 160px;
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2, #64748b);
}
.summary-val {
  font-size: 1.2rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--text-0, #0f172a);
}
.summary-item--red    .summary-val { color: #ef4444; }
.summary-item--orange .summary-val { color: #f97316; }
.summary-item--green  .summary-val { color: #10b981; }

/* ─── Tabs ───────────────────────────────────────────────────────────────── */
.inf-tabs :deep(.ant-tabs-nav) { margin-bottom: 16px; }

/* ─── Table helpers ──────────────────────────────────────────────────────── */
.link-cliente {
  font-weight: 700;
  color: var(--primary, #1677ff);
  cursor: pointer;
  text-decoration: none;
}
.link-cliente:hover { text-decoration: underline; }

.sub-cuit {
  font-size: 11px;
  color: var(--text-2, #64748b);
  font-family: ui-monospace, monospace;
}

.text-deuda { color: #ef4444; }
.text-green { color: #10b981; }
.text-muted { color: var(--text-2, #94a3b8); }
.fw         { font-weight: 700; }

/* ─── Rank badge ─────────────────────────────────────────────────────────── */
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 900;
  background: rgba(148,163,184,0.12);
  color: var(--text-1, #475569);
}
.rank-badge--1 { background: #fef3c7; color: #92400e; }
.rank-badge--2 { background: #f1f5f9; color: #475569; }
.rank-badge--3 { background: #fff7ed; color: #9a3412; }

/* ─── Estado info ────────────────────────────────────────────────────────── */
.estado-info {
  background: rgba(var(--accent-rgb, 99,102,241), 0.05);
  border: 1px solid rgba(var(--accent-rgb, 99,102,241), 0.15);
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--text-1, #334155);
  line-height: 1.7;
}
</style>
