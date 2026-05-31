<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, EditOutlined, StopOutlined, CheckOutlined,
  SettingOutlined, ShopOutlined, DollarOutlined,
  CloseCircleOutlined, TeamOutlined,
} from '@ant-design/icons-vue'
import { proveedoresService } from '@/services/compras'

const router = useRouter()
const STORAGE_KEY = 'proveedores-lista-columnas-v1'
const loading = ref(false)
const rows    = ref([])
const total   = ref(0)
const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({ search: '', estado: '' })

const allColumns = [
  { key: 'codigo_proveedor', title: 'Código',          dataIndex: 'codigo_proveedor', width: 110, defaultVisible: true },
  { key: 'razon_social',     title: 'Razón Social',    dataIndex: 'razon_social',     width: 280, defaultVisible: true },
  { key: 'nombre_fantasia',  title: 'Nombre Fantasía', dataIndex: 'nombre_fantasia',  width: 200, defaultVisible: true },
  { key: 'cuit',             title: 'CUIT',            dataIndex: 'cuit',             width: 150, defaultVisible: true },
  { key: 'situacion_iva',    title: 'Cond. IVA',       dataIndex: 'situacion_iva',    width: 170, defaultVisible: true },
  { key: 'plazo_pago_dias',  title: 'Plazo (días)',    dataIndex: 'plazo_pago_dias',  width: 110, defaultVisible: true },
  { key: 'saldo_deuda',      title: 'Saldo Deuda',     dataIndex: 'saldo_deuda',      width: 150, defaultVisible: true },
  { key: 'esta_activo',      title: 'Estado',          dataIndex: 'esta_activo',      width: 110, defaultVisible: true },
]

const visibleColumnKeys = ref((() => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(s) && s.length) return s
  } catch (_) {}
  return allColumns.filter(c => c.defaultVisible).map(c => c.key)
})())

watch(visibleColumnKeys, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true })

const tableColumns = computed(() => [
  ...allColumns.filter(c => visibleColumnKeys.value.includes(c.key)),
  { title: 'Acciones', key: 'acciones', width: 140, fixed: 'right' },
])
const columnOptions = computed(() => allColumns.map(c => ({ label: c.title, value: c.key })))

const summary = computed(() => {
  const list = rows.value
  return {
    activos:    list.filter(x => x.esta_activo).length,
    inactivos:  list.filter(x => !x.esta_activo).length,
    conDeuda:   list.filter(x => parseFloat(x.saldo_deuda) > 0).length,
    saldoTotal: list.reduce((a, x) => a + parseFloat(x.saldo_deuda || 0), 0),
  }
})

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0))

async function load() {
  loading.value = true
  try {
    const params = {
      limit:  pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }
    if (filters.search) params.search = filters.search
    if (filters.estado === 'activos')   params.activo = 'true'
    if (filters.estado === 'inactivos') params.activo = 'false'
    const { data } = await proveedoresService.listar(params)
    rows.value  = data?.results ?? data ?? []
    total.value = data?.count   ?? rows.value.length
  } catch { message.error('No se pudieron cargar los proveedores') }
  finally   { loading.value = false }
}

function onTableChange(p) { pagination.current = p.current || 1; pagination.pageSize = p.pageSize || 20; load() }
function onBuscar()       { pagination.current = 1; load() }
function onReset()        { filters.search = ''; filters.estado = ''; pagination.current = 1; load() }

async function toggleActivo(record) {
  const accion = record.esta_activo ? 'Desactivar' : 'Activar'
  if (record.esta_activo) {
    Modal.confirm({
      title: 'Desactivar proveedor',
      content: 'El proveedor quedará inactivo pero sus datos se conservan.',
      okText: 'Desactivar', cancelText: 'Cancelar',
      async onOk() {
        await proveedoresService.actualizar(record.id, { esta_activo: false })
        message.success('Proveedor desactivado'); load()
      },
    })
  } else {
    await proveedoresService.actualizar(record.id, { esta_activo: true })
    message.success('Proveedor activado'); load()
  }
}

onMounted(load)
</script>

<template>
  <div class="proveedores-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Supplier Master · ERP Enterprise</div>
        <h1 class="hero__title">Proveedores</h1>
        <p class="hero__subtitle">Administración comercial, cuenta corriente y órdenes de pago.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-dropdown trigger="click">
            <a-button size="large"><template #icon><SettingOutlined /></template>Columnas</a-button>
            <template #overlay>
              <a-menu class="columns-menu">
                <div class="columns-menu__title">Columnas visibles</div>
                <div class="columns-menu__content">
                  <a-checkbox-group v-model:value="visibleColumnKeys" :options="columnOptions" />
                </div>
              </a-menu>
            </template>
          </a-dropdown>
          <a-button size="large" @click="load"><template #icon><ReloadOutlined /></template>Actualizar</a-button>
          <a-button type="primary" size="large" @click="router.push({ name: 'proveedor-crear' })">
            <template #icon><PlusOutlined /></template>Nuevo Proveedor
          </a-button>
        </a-space>
      </div>
    </section>

    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><TeamOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Activos</div>
          <div class="kpi-card__value">{{ summary.activos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><CloseCircleOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Inactivos</div>
          <div class="kpi-card__value">{{ summary.inactivos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><ShopOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Con deuda pendiente</div>
          <div class="kpi-card__value">{{ summary.conDeuda }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo deuda visible</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.saldoTotal) }}</div>
        </div>
      </a-card>
    </section>

    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-input-search v-model:value="filters.search" size="large" allow-clear
            placeholder="Buscar por código, razón social, CUIT, nombre fantasía" @search="onBuscar">
            <template #prefix><SearchOutlined /></template>
          </a-input-search>
        </div>
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.estado" size="large" allow-clear
            placeholder="Estado" style="width:160px" @change="onBuscar">
            <a-select-option value="activos">Activos</a-select-option>
            <a-select-option value="inactivos">Inactivos</a-select-option>
          </a-select>
          <a-button size="large" @click="onReset">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="tableColumns" :data-source="rows" :loading="loading"
        :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total, showTotal: t => `${t} proveedores`, showSizeChanger: true }"
        row-key="id" :scroll="{ x: 1400 }" @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'razon_social'">
            <div class="main-cell">
              <div class="main-cell__title">{{ record.razon_social || '—' }}</div>
              <div v-if="record.nombre_fantasia" class="main-cell__subtitle">{{ record.nombre_fantasia }}</div>
            </div>
          </template>
          <template v-else-if="column.dataIndex === 'saldo_deuda'">
            <span class="saldo-cell" :class="parseFloat(record.saldo_deuda) > 0 ? 'saldo-debt' : ''">
              {{ money(record.saldo_deuda) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'esta_activo'">
            <a-badge :status="record.esta_activo ? 'success' : 'default'"
              :text="record.esta_activo ? 'Activo' : 'Inactivo'" />
          </template>
          <template v-else-if="column.key === 'acciones'">
            <a-space>
              <a-tooltip title="Ver ficha">
                <a-button size="small" @click="router.push({ name: 'proveedor-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="Editar">
                <a-button size="small" @click="router.push({ name: 'proveedor-editar', params: { id: record.id } })">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip :title="record.esta_activo ? 'Desactivar' : 'Activar'">
                <a-button size="small" :danger="record.esta_activo" @click="toggleActivo(record)">
                  <template #icon><StopOutlined v-if="record.esta_activo" /><CheckOutlined v-else /></template>
                </a-button>
              </a-tooltip>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

  </div>
</template>

<style scoped>
.proveedores-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; padding:20px 22px; border-radius:6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; line-height:1.08; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.kpi-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display:flex; align-items:center; gap:14px; }
.kpi-card__icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; font-size:20px; }
.kpi-card__icon--blue  { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 14%,transparent); color:rgba(var(--accent-rgb),1); }
.kpi-card__icon--green { background:color-mix(in srgb,#16a34a 14%,transparent); color:#16a34a; }
.kpi-card__icon--red   { background:color-mix(in srgb,#ef4444 14%,transparent); color:#dc2626; }
.kpi-card__icon--gold  { background:color-mix(in srgb,#f59e0b 14%,transparent); color:#d97706; }
.kpi-card__label { font-size:12px; color:var(--text-2); }
.kpi-card__value { font-size:24px; font-weight:800; color:var(--text-0); }
.kpi-card__value--money { font-size:18px; }
.filters-card,.table-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.filters-toolbar { display:flex; justify-content:space-between; gap:16px; align-items:center; }
.filters-toolbar__left { flex:1; min-width:280px; }
.filters-toolbar__right { display:flex; gap:12px; flex-wrap:wrap; }
.main-cell__title { font-weight:700; color:var(--text-0); }
.main-cell__subtitle { font-size:12px; color:var(--text-2); }
.saldo-cell { font-weight:600; font-variant-numeric:tabular-nums; }
.saldo-debt { color:#dc2626; }
.columns-menu { padding:10px 0; min-width:250px; background:var(--surface-0); }
.columns-menu__title { padding:0 14px 10px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2); }
.columns-menu__content { padding:0 14px 8px; }
.columns-menu__content :deep(.ant-checkbox-group) { display:grid; gap:10px; }
@media (max-width:1200px) { .kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .filters-toolbar { flex-direction:column; align-items:stretch; } .hero { flex-direction:column; } }
@media (max-width:768px) { .kpis { grid-template-columns:1fr; } .hero { padding:16px; } .hero__title { font-size:24px; } }
</style>
