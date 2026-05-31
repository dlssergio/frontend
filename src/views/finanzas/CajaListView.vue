<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ReloadOutlined, PlusOutlined, WalletOutlined,
  BankOutlined, DollarOutlined, ArrowUpOutlined,
  ArrowDownOutlined, FileTextOutlined, CheckCircleOutlined,
} from '@ant-design/icons-vue'
import { cuentasFondoService } from '@/services/finanzas'

// ─── Estado ───────────────────────────────────────────────────
const loading     = ref(false)
const cuentas     = ref([])
const cuentaSel   = ref(null)   // cuenta seleccionada para ver extracto
const movimientos = ref([])
const loadingMovs = ref(false)
const modalMovOpen = ref(false)  // modal de nuevo movimiento manual

const filtroTipo = ref('')        // '' | 'EF' | 'BA' | 'VI' | 'RE'

const movForm = reactive({
  tipo_movimiento: 'IN',
  monto:           '',
  concepto:        '',
})
const submitting = ref(false)

// Filtros extracto
const extractoFiltros = reactive({ desde: '', hasta: '' })

// ─── KPIs ─────────────────────────────────────────────────────
const summary = computed(() => {
  const lista = cuentas.value.filter(c => c.activa)
  return {
    total_cajas:   lista.filter(c => c.tipo === 'EF').length,
    total_bancos:  lista.filter(c => c.tipo === 'BA').length,
    saldo_total:   lista.reduce((s, c) => s + parseFloat(c.saldo_monto || 0), 0),
    saldo_bancos:  lista.filter(c => c.tipo === 'BA').reduce((s, c) => s + parseFloat(c.saldo_monto || 0), 0),
  }
})

const cuentasFiltradas = computed(() =>
  filtroTipo.value
    ? cuentas.value.filter(c => c.tipo === filtroTipo.value)
    : cuentas.value
)

const TIPO_ICONS = { EF: WalletOutlined, BA: BankOutlined, VI: WalletOutlined, RE: BankOutlined }
const TIPO_COLORS = { EF: '#16a34a', BA: '#2563eb', VI: '#7c3aed', RE: '#d97706' }

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

// ─── Carga ────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const res = await cuentasFondoService.listar()
    cuentas.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar cuentas.') }
  finally   { loading.value = false }
}

async function verExtracto(cuenta) {
  cuentaSel.value = cuenta
  loadingMovs.value = true
  movimientos.value = []
  try {
    const params = {}
    if (extractoFiltros.desde) params.desde = extractoFiltros.desde
    if (extractoFiltros.hasta) params.hasta = extractoFiltros.hasta
    const res = await cuentasFondoService.movimientos(cuenta.id, params)
    movimientos.value = res.data.movimientos ?? []
  } catch { message.error('Error al cargar movimientos.') }
  finally   { loadingMovs.value = false }
}

// ─── Movimiento manual ────────────────────────────────────────
function abrirModal(cuenta) {
  cuentaSel.value = cuenta
  Object.assign(movForm, { tipo_movimiento: 'IN', monto: '', concepto: '' })
  modalMovOpen.value = true
}

async function guardarMovimiento() {
  if (!movForm.monto || parseFloat(movForm.monto) <= 0) {
    message.error('El monto debe ser mayor a cero.'); return
  }
  if (!movForm.concepto.trim()) {
    message.error('El concepto es obligatorio.'); return
  }
  submitting.value = true
  try {
    await cuentasFondoService.registrarMovimiento(cuentaSel.value.id, {
      tipo_movimiento: movForm.tipo_movimiento,
      monto:           parseFloat(movForm.monto),
      concepto:        movForm.concepto,
    })
    message.success('Movimiento registrado correctamente.')
    modalMovOpen.value = false
    await load()
    if (cuentaSel.value) await verExtracto(cuentaSel.value)
  } catch (e) {
    message.error(e.response?.data?.error ?? 'No se pudo registrar el movimiento.')
  } finally { submitting.value = false }
}

const colsExtracto = [
  { title: 'Fecha',    dataIndex: 'fecha',      width: 140 },
  { title: 'Concepto', dataIndex: 'concepto',   ellipsis: true },
  { title: 'Ingreso',  dataIndex: 'ingreso',    width: 130, align: 'right' },
  { title: 'Egreso',   dataIndex: 'egreso',     width: 130, align: 'right' },
  { title: 'Saldo',    dataIndex: 'saldo',      width: 140, align: 'right' },
]

onMounted(load)
</script>

<template>
  <div class="caja-page">

    <!-- Modal movimiento manual -->
    <a-modal
      v-model:open="modalMovOpen"
      :title="`Movimiento manual — ${cuentaSel?.nombre}`"
      :footer="null"
      width="440px"
    >
      <div class="mov-form">
        <div class="mov-field">
          <label>Tipo</label>
          <a-radio-group v-model:value="movForm.tipo_movimiento" button-style="solid" style="width:100%">
            <a-radio-button value="IN" style="width:50%;text-align:center">
              <ArrowUpOutlined style="color:#16a34a;margin-right:4px" /> Ingreso
            </a-radio-button>
            <a-radio-button value="EG" style="width:50%;text-align:center">
              <ArrowDownOutlined style="color:#dc2626;margin-right:4px" /> Egreso
            </a-radio-button>
          </a-radio-group>
        </div>
        <div class="mov-field">
          <label>Monto</label>
          <a-input-number v-model:value="movForm.monto" :min="0.01" :precision="2"
            addon-before="$" style="width:100%" placeholder="0,00" />
        </div>
        <div class="mov-field">
          <label>Concepto</label>
          <a-input v-model:value="movForm.concepto"
            placeholder="Ej: Cobro factura, Pago servicio…" allow-clear />
        </div>
        <div class="mov-footer">
          <a-button @click="modalMovOpen = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardarMovimiento">
            Registrar
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Finanzas · Tesorería</div>
        <h1 class="hero__title">Cajas y Bancos</h1>
        <p class="hero__subtitle">Saldos en tiempo real, movimientos y control de tesorería.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :loading="loading" @click="load">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPIs -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><WalletOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Cajas</div>
          <div class="kpi-card__value">{{ summary.total_cajas }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><BankOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Cuentas Bancarias</div>
          <div class="kpi-card__value">{{ summary.total_bancos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo Total</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.saldo_total) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><BankOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo Bancario</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.saldo_bancos) }}</div>
        </div>
      </a-card>
    </section>

    <!-- Filtro tipo -->
    <a-card class="filters-card" :bordered="false">
      <a-radio-group v-model:value="filtroTipo" button-style="outline" size="large">
        <a-radio-button value="">Todas</a-radio-button>
        <a-radio-button value="EF">Efectivo</a-radio-button>
        <a-radio-button value="BA">Banco</a-radio-button>
        <a-radio-button value="VI">Virtual</a-radio-button>
        <a-radio-button value="RE">Recaudadora</a-radio-button>
      </a-radio-group>
    </a-card>

    <!-- Layout principal: tarjetas + extracto -->
    <div class="main-layout">

      <!-- Tarjetas de cuentas -->
      <div class="cuentas-grid">
        <a-spin :spinning="loading">
          <div v-if="!cuentas.length && !loading" class="empty-state">
            <a-empty description="Sin cuentas configuradas" />
          </div>
          <div v-else class="cards-wrap">
            <div
              v-for="c in cuentasFiltradas" :key="c.id"
              class="cuenta-card"
              :class="{ 'cuenta-card--sel': cuentaSel?.id === c.id, 'cuenta-card--inactiva': !c.activa }"
              @click="verExtracto(c)"
            >
              <div class="cuenta-card__header">
                <div class="cuenta-card__icon" :style="{ background: `${TIPO_COLORS[c.tipo]}20`, color: TIPO_COLORS[c.tipo] }">
                  <component :is="TIPO_ICONS[c.tipo]" />
                </div>
                <div class="cuenta-card__info">
                  <div class="cuenta-card__nombre">{{ c.nombre }}</div>
                  <div class="cuenta-card__tipo">{{ c.tipo_display }}</div>
                </div>
                <a-tag v-if="!c.activa" color="default" style="font-size:10px">Inactiva</a-tag>
              </div>
              <div class="cuenta-card__saldo" :class="parseFloat(c.saldo_monto) < 0 ? 'saldo-neg' : ''">
                {{ money(c.saldo_monto) }}
              </div>
              <div v-if="c.banco_nombre" class="cuenta-card__banco">{{ c.banco_nombre }}</div>
              <div class="cuenta-card__actions">
                <a-button size="small" type="dashed" @click.stop="abrirModal(c)">
                  <PlusOutlined /> Movimiento
                </a-button>
                <a-button size="small" @click.stop="verExtracto(c)">
                  <FileTextOutlined /> Extracto
                </a-button>
              </div>
            </div>
          </div>
        </a-spin>
      </div>

      <!-- Panel extracto -->
      <div class="extracto-panel" v-if="cuentaSel">
        <div class="extracto-header">
          <div>
            <div class="extracto-title">{{ cuentaSel.nombre }}</div>
            <div class="extracto-saldo">Saldo: <strong>{{ money(cuentaSel.saldo_monto) }}</strong></div>
          </div>
          <div class="extracto-filtros">
            <a-input type="date" v-model:value="extractoFiltros.desde" size="small"
              style="width:130px" @change="verExtracto(cuentaSel)" />
            <span style="color:var(--text-2)">—</span>
            <a-input type="date" v-model:value="extractoFiltros.hasta" size="small"
              style="width:130px" @change="verExtracto(cuentaSel)" />
          </div>
        </div>

        <a-table
          :columns="colsExtracto"
          :data-source="movimientos"
          :loading="loadingMovs"
          row-key="id"
          size="small"
          :pagination="{ pageSize: 30, simple: true }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'fecha'">
              <span class="fecha-sm">{{ fmtFecha(record.fecha) }}</span>
            </template>
            <template v-if="column.dataIndex === 'ingreso'">
              <span v-if="record.ingreso" class="ingreso-val">+ {{ money(record.ingreso) }}</span>
              <span v-else class="dash">—</span>
            </template>
            <template v-if="column.dataIndex === 'egreso'">
              <span v-if="record.egreso" class="egreso-val">− {{ money(record.egreso) }}</span>
              <span v-else class="dash">—</span>
            </template>
            <template v-if="column.dataIndex === 'saldo'">
              <span class="saldo-val" :class="record.saldo < 0 ? 'saldo-neg' : ''">
                {{ money(record.saldo) }}
              </span>
            </template>
          </template>
          <template #emptyText>
            <a-empty description="Sin movimientos para el período" :image="false" />
          </template>
        </a-table>
      </div>

      <!-- Placeholder cuando no hay cuenta seleccionada -->
      <div class="extracto-empty" v-else>
        <FileTextOutlined style="font-size:40px;color:var(--text-2)" />
        <p>Seleccioná una cuenta para ver su extracto</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.caja-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }

.hero {
  display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
  padding: 20px 22px; border-radius: 6px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%),
    linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0,0,0,.08);
}
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display: flex; align-items: center; gap: 14px; }
.kpi-card__icon { width: 46px; height: 46px; border-radius: 6px; display: grid; place-items: center; font-size: 20px; }
.kpi-card__icon--blue  { background: color-mix(in srgb, rgba(var(--accent-rgb),1) 14%, transparent); color: rgba(var(--accent-rgb),1); }
.kpi-card__icon--green { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.kpi-card__icon--gold  { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #d97706; }
.kpi-card__label { font-size: 12px; color: var(--text-2); }
.kpi-card__value { font-size: 24px; font-weight: 800; color: var(--text-0); }
.kpi-card__value--money { font-size: 18px; }

.filters-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }

/* Layout de tarjetas + extracto */
.main-layout { display: grid; grid-template-columns: 420px 1fr; gap: 16px; align-items: start; }

.cuentas-grid { background: var(--surface-0); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); padding: 16px; }
.cards-wrap   { display: flex; flex-direction: column; gap: 12px; }

.cuenta-card {
  padding: 14px 16px; border-radius: 10px;
  border: 1.5px solid var(--border, #e2e8f0);
  cursor: pointer; transition: all .15s;
  background: var(--surface-0);
}
.cuenta-card:hover { border-color: rgba(var(--accent-rgb),1); box-shadow: 0 2px 10px rgba(var(--accent-rgb),.12); }
.cuenta-card--sel  { border-color: rgba(var(--accent-rgb),1); background: color-mix(in srgb, rgba(var(--accent-rgb),1) 5%, var(--surface-0)); }
.cuenta-card--inactiva { opacity: .55; }

.cuenta-card__header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.cuenta-card__icon   { width: 38px; height: 38px; border-radius: 8px; display: grid; place-items: center; font-size: 18px; flex-shrink: 0; }
.cuenta-card__nombre { font-size: 14px; font-weight: 700; color: var(--text-0); }
.cuenta-card__tipo   { font-size: 11px; color: var(--text-2); }
.cuenta-card__saldo  { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--text-0); margin-bottom: 4px; }
.cuenta-card__banco  { font-size: 11px; color: var(--text-2); margin-bottom: 8px; }
.cuenta-card__actions { display: flex; gap: 8px; }
.saldo-neg { color: #dc2626 !important; }

/* Extracto */
.extracto-panel {
  background: var(--surface-0); border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0,0,0,.08); padding: 16px;
}
.extracto-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.extracto-title  { font-size: 16px; font-weight: 700; color: var(--text-0); }
.extracto-saldo  { font-size: 12px; color: var(--text-2); margin-top: 3px; }
.extracto-filtros{ display: flex; align-items: center; gap: 6px; }

.extracto-empty { background: var(--surface-0); border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 200px; color: var(--text-2); }

.fecha-sm   { font-size: 11px; color: var(--text-2); }
.ingreso-val{ font-variant-numeric: tabular-nums; color: #16a34a; font-weight: 600; font-size: 12px; }
.egreso-val { font-variant-numeric: tabular-nums; color: #dc2626; font-weight: 600; font-size: 12px; }
.saldo-val  { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 12px; }
.dash       { color: var(--text-2); }

/* Modal movimiento */
.mov-form { display: flex; flex-direction: column; gap: 14px; padding-top: 8px; }
.mov-field { display: flex; flex-direction: column; gap: 4px; }
.mov-field label { font-size: 11px; font-weight: 600; color: var(--text-2); }
.mov-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; border-top: 1px solid var(--border); margin-top: 4px; }

.empty-state { padding: 40px; text-align: center; }

@media (max-width: 1100px) {
  .main-layout { grid-template-columns: 1fr; }
  .kpis { grid-template-columns: repeat(2, 1fr); }
  .hero { flex-direction: column; }
}
</style>
