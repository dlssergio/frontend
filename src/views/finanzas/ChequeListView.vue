<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ReloadOutlined, PlusOutlined, CheckOutlined,
  BankOutlined, DollarOutlined, WarningOutlined,
  CloseCircleOutlined, FileExcelOutlined, SearchOutlined,
} from '@ant-design/icons-vue'
import { chequesService, bancosService } from '@/services/finanzas'
import api from '@/services/api'

const loading  = ref(false)
const cheques  = ref([])
const total    = ref(0)
const bancos   = ref([])
const resumen  = ref({ en_cartera_count: 0, en_cartera_monto: 0, vencen_7_dias_count: 0, vencen_7_dias_monto: 0, rechazados_mes: 0 })
const modalNuevo = ref(false)
const submitting = ref(false)

const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({
  search:     '',
  estado:     '',
  origen:     '',
  vence_desde:'',
  vence_hasta:'',
})

const nuevoForm = reactive({
  numero: '', banco: null, origen: 'T', tipo_cheque: 'FIS',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_pago: '', monto: '',
  nombre_librador: '', cuit_librador: '', observaciones: '',
})

// ─── KPIs desde el resumen ────────────────────────────────────
const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtFecha = (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString('es-AR') : '—'
const hoy = () => new Date().toISOString().slice(0, 10)

const ESTADO_COLOR = {
  CA: 'blue', DE: 'processing', CO: 'success',
  EN: 'default', RE: 'error', AN: 'default', CU: 'warning',
}

const columns = [
  { key: 'numero',         title: 'N° Cheque',    dataIndex: 'numero',       width: 130 },
  { key: 'banco_nombre',   title: 'Banco',        dataIndex: 'banco_nombre', width: 160, ellipsis: true },
  { key: 'origen_display', title: 'Origen',       dataIndex: 'origen_display', width: 110 },
  { key: 'nombre_librador',title: 'Librador',     dataIndex: 'nombre_librador', ellipsis: true },
  { key: 'fecha_pago',     title: 'Vence',        dataIndex: 'fecha_pago',   width: 110 },
  { key: 'dias',           title: 'Días',         width: 80, align: 'center' },
  { key: 'monto',          title: 'Monto',        dataIndex: 'monto',        width: 150, align: 'right' },
  { key: 'estado_display', title: 'Estado',       dataIndex: 'estado_display', width: 140 },
  { key: 'actions',        title: 'Acciones',     width: 160, align: 'center', fixed: 'right' },
]

// ─── Carga ────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const params = {
      limit:  pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }
    if (filters.search)      params.search      = filters.search
    if (filters.estado)      params.estado      = filters.estado
    if (filters.origen)      params.origen      = filters.origen
    if (filters.vence_desde) params.vence_desde = filters.vence_desde
    if (filters.vence_hasta) params.vence_hasta = filters.vence_hasta
    const res = await chequesService.listar(params)
    cheques.value = res.data.results ?? res.data
    total.value   = res.data.count   ?? cheques.value.length
  } catch { message.error('Error al cargar cheques.') }
  finally   { loading.value = false }
}

async function loadResumen() {
  try {
    const res = await chequesService.resumen()
    resumen.value = res.data
  } catch { /* silencioso */ }
}

function onTableChange(p) { pagination.current = p.current; pagination.pageSize = p.pageSize; load() }
function onSearch()       { pagination.current = 1; load() }
function onReset()        {
  Object.assign(filters, { search: '', estado: '', origen: '', vence_desde: '', vence_hasta: '' })
  pagination.current = 1; load()
}

// ─── Acciones de estado ───────────────────────────────────────
const accion = (titulo, fn, cheque) =>
  Modal.confirm({
    title: titulo,
    okText: 'Confirmar', cancelText: 'Cancelar',
    async onOk() {
      try { await fn(cheque.id); message.success('Estado actualizado.'); load(); loadResumen() }
      catch (e) { message.error(e.response?.data?.error ?? 'No se pudo actualizar.') }
    },
  })

// ─── Crear cheque ─────────────────────────────────────────────
function abrirNuevo() {
  Object.assign(nuevoForm, {
    numero: '', banco: null, origen: 'T', tipo_cheque: 'FIS',
    fecha_emision: hoy(), fecha_pago: '', monto: '',
    nombre_librador: '', cuit_librador: '', observaciones: '',
  })
  modalNuevo.value = true
}

async function guardarCheque() {
  if (!nuevoForm.numero || !nuevoForm.banco || !nuevoForm.monto || !nuevoForm.fecha_pago) {
    message.error('Completá número, banco, monto y fecha de pago.'); return
  }
  submitting.value = true
  try {
    await chequesService.crear({
      numero:          nuevoForm.numero,
      banco:           nuevoForm.banco,
      origen:          nuevoForm.origen,
      tipo_cheque:     nuevoForm.tipo_cheque,
      fecha_emision:   nuevoForm.fecha_emision,
      fecha_pago:      nuevoForm.fecha_pago,
      monto:           parseFloat(nuevoForm.monto),
      nombre_librador: nuevoForm.nombre_librador,
      cuit_librador:   nuevoForm.cuit_librador,
      observaciones:   nuevoForm.observaciones,
    })
    message.success('Cheque registrado.')
    modalNuevo.value = false
    load(); loadResumen()
  } catch (e) {
    message.error(e.response?.data?.error ?? 'No se pudo guardar.')
  } finally { submitting.value = false }
}

// ─── Exportar CSV ─────────────────────────────────────────────
const exportarCSV = () => {
  if (!cheques.value.length) { message.warning('Sin datos'); return }
  const rows = [
    ['N° Cheque', 'Banco', 'Origen', 'Librador', 'CUIT', 'Fecha Emisión', 'Vence', 'Monto', 'Estado'],
    ...cheques.value.map(c => [
      c.numero, c.banco_nombre, c.origen_display, c.nombre_librador,
      c.cuit_librador, fmtFecha(c.fecha_emision), fmtFecha(c.fecha_pago),
      parseFloat(c.monto).toFixed(2), c.estado_display,
    ]),
  ]
  const csv  = rows.map(r => r.join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `cheques_${hoy()}.csv`; a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => { load(); loadResumen(); bancosService.listar().then(r => bancos.value = r.data.results ?? r.data) })
</script>

<template>
  <div class="cheques-page">

    <!-- Modal nuevo cheque -->
    <a-modal v-model:open="modalNuevo" title="Registrar Cheque" :footer="null" width="580px">
      <div class="cheque-form">
        <div class="form-grid-2">
          <div class="form-field">
            <label>Origen</label>
            <a-radio-group v-model:value="nuevoForm.origen" button-style="solid" style="width:100%">
              <a-radio-button value="T" style="width:50%;text-align:center">Tercero (Recibido)</a-radio-button>
              <a-radio-button value="P" style="width:50%;text-align:center">Propio (Emitido)</a-radio-button>
            </a-radio-group>
          </div>
          <div class="form-field">
            <label>Formato</label>
            <a-radio-group v-model:value="nuevoForm.tipo_cheque" button-style="solid" style="width:100%">
              <a-radio-button value="FIS" style="width:50%;text-align:center">Físico</a-radio-button>
              <a-radio-button value="ECH" style="width:50%;text-align:center">E-Cheq</a-radio-button>
            </a-radio-group>
          </div>
          <div class="form-field">
            <label class="req">N° Cheque</label>
            <a-input v-model:value="nuevoForm.numero" allow-clear placeholder="Nro. de cheque" />
          </div>
          <div class="form-field">
            <label class="req">Banco</label>
            <a-select v-model:value="nuevoForm.banco" style="width:100%" placeholder="Seleccioná">
              <a-select-option v-for="b in bancos" :key="b.id" :value="b.id">{{ b.nombre }}</a-select-option>
            </a-select>
          </div>
          <div class="form-field">
            <label class="req">Fecha Emisión</label>
            <a-input type="date" v-model:value="nuevoForm.fecha_emision" style="width:100%" />
          </div>
          <div class="form-field">
            <label class="req">Fecha de Pago</label>
            <a-input type="date" v-model:value="nuevoForm.fecha_pago" style="width:100%" />
          </div>
          <div class="form-field form-field--full">
            <label class="req">Monto</label>
            <a-input-number v-model:value="nuevoForm.monto" :min="0.01" :precision="2" addon-before="$" style="width:100%" />
          </div>
          <div class="form-field">
            <label>Librador</label>
            <a-input v-model:value="nuevoForm.nombre_librador" allow-clear />
          </div>
          <div class="form-field">
            <label>CUIT Librador</label>
            <a-input v-model:value="nuevoForm.cuit_librador" allow-clear />
          </div>
          <div class="form-field form-field--full">
            <label>Observaciones</label>
            <a-textarea v-model:value="nuevoForm.observaciones" :rows="2" allow-clear />
          </div>
        </div>
        <div class="form-footer">
          <a-button @click="modalNuevo = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardarCheque">Registrar</a-button>
        </div>
      </div>
    </a-modal>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Finanzas · Cartera de Valores</div>
        <h1 class="hero__title">Cheques</h1>
        <p class="hero__subtitle">Gestión de cheques propios y de terceros — físicos y e-cheqs.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" @click="exportarCSV">
            <template #icon><FileExcelOutlined style="color:#22c55e" /></template>Exportar
          </a-button>
          <a-button size="large" :loading="loading" @click="() => { load(); loadResumen() }">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
          <a-button type="primary" size="large" @click="abrirNuevo">
            <template #icon><PlusOutlined /></template>Nuevo Cheque
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPIs -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><BankOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">En Cartera</div>
          <div class="kpi-card__value">{{ resumen.en_cartera_count }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Monto Cartera</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(resumen.en_cartera_monto) }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><WarningOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Vencen en 7 días</div>
          <div class="kpi-card__value" :class="resumen.vencen_7_dias_count > 0 ? 'kpi-warn' : ''">
            {{ resumen.vencen_7_dias_count }}
          </div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><CloseCircleOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Rechazados (mes)</div>
          <div class="kpi-card__value" :class="resumen.rechazados_mes > 0 ? 'kpi-danger' : ''">
            {{ resumen.rechazados_mes }}
          </div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-input-search v-model:value="filters.search" size="large" allow-clear
            placeholder="N° cheque, banco, librador, CUIT…" @search="onSearch">
            <template #prefix><SearchOutlined /></template>
          </a-input-search>
        </div>
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.estado" size="large" style="width:160px" allow-clear
            placeholder="Estado" @change="onSearch">
            <a-select-option value="CA">En Cartera</a-select-option>
            <a-select-option value="DE">Depositado</a-select-option>
            <a-select-option value="CO">Cobrado</a-select-option>
            <a-select-option value="EN">Entregado</a-select-option>
            <a-select-option value="RE">Rechazado</a-select-option>
            <a-select-option value="AN">Anulado</a-select-option>
          </a-select>
          <a-select v-model:value="filters.origen" size="large" style="width:140px" allow-clear
            placeholder="Origen" @change="onSearch">
            <a-select-option value="T">Tercero</a-select-option>
            <a-select-option value="P">Propio</a-select-option>
          </a-select>
          <a-input type="date" v-model:value="filters.vence_desde" size="large" style="width:140px" @change="onSearch" />
          <span style="color:var(--text-2);align-self:center">—</span>
          <a-input type="date" v-model:value="filters.vence_hasta" size="large" style="width:140px" @change="onSearch" />
          <a-button size="large" @click="onReset">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="columns" :data-source="cheques" :loading="loading"
        row-key="id"
        :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total, showSizeChanger: true, showTotal: t => `${t} cheques` }"
        :scroll="{ x: 1200 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'fecha_pago'">
            <span class="date-cell">{{ fmtFecha(record.fecha_pago) }}</span>
          </template>
          <template v-if="column.key === 'dias'">
            <span
              class="dias-badge"
              :class="record.dias_para_vencer < 0 ? 'dias-vencido' : record.dias_para_vencer <= 7 ? 'dias-urgente' : ''"
            >
              {{ record.dias_para_vencer < 0 ? `${Math.abs(record.dias_para_vencer)}d venc.` : `${record.dias_para_vencer}d` }}
            </span>
          </template>
          <template v-if="column.key === 'monto'">
            <span class="num-cell">{{ money(record.monto) }}</span>
          </template>
          <template v-if="column.key === 'estado_display'">
            <a-tag :color="ESTADO_COLOR[record.estado]">{{ record.estado_display }}</a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip v-if="record.estado === 'CA'" title="Depositar">
                <a-button size="small" @click="accion('¿Depositar este cheque?', chequesService.depositar, record)">
                  <template #icon><BankOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="['CA','DE'].includes(record.estado)" title="Marcar cobrado">
                <a-button size="small" @click="accion('¿Marcar como cobrado?', chequesService.cobrar, record)">
                  <template #icon><CheckOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="['CA','DE'].includes(record.estado)" title="Rechazar">
                <a-button size="small" danger @click="accion('¿Marcar como rechazado?', chequesService.rechazar, record)">
                  <template #icon><CloseCircleOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado !== 'AN'" title="Anular">
                <a-button size="small" danger @click="accion('¿Anular este cheque?', chequesService.anular, record)">
                  Anular
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="Sin cheques para los filtros seleccionados" />
        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.cheques-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }
.hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px 22px; border-radius: 6px; background: radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent)); border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
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
.kpi-card__icon--red   { background: color-mix(in srgb, #ef4444 14%, transparent); color: #dc2626; }
.kpi-card__label { font-size: 12px; color: var(--text-2); }
.kpi-card__value { font-size: 24px; font-weight: 800; color: var(--text-0); }
.kpi-card__value--money { font-size: 18px; }
.kpi-warn   { color: #b45309 !important; }
.kpi-danger { color: #dc2626 !important; }
.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.filters-toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.filters-toolbar__left  { flex: 1; min-width: 260px; }
.filters-toolbar__right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.date-cell { font-size: 12px; }
.num-cell  { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }
.dias-badge  { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: var(--surface-1,#f1f5f9); }
.dias-urgente{ background: #fef9c3; color: #854d0e; }
.dias-vencido{ background: #fee2e2; color: #b91c1c; }
.cheque-form { padding-top: 8px; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-field { display: flex; flex-direction: column; gap: 4px; }
.form-field--full { grid-column: 1 / -1; }
.form-field label { font-size: 11px; font-weight: 600; color: var(--text-2); }
.form-field label.req::after { content: ' *'; color: #ef4444; }
.form-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 8px; }
@media (max-width: 1200px) { .kpis { grid-template-columns: repeat(2, 1fr); } .hero { flex-direction: column; } }
</style>
