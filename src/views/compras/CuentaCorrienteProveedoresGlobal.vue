<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { SearchOutlined, ReloadOutlined, BankOutlined, FilterOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { proveedoresService } from '@/services/compras'
import dayjs from 'dayjs'

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const totales = ref({})

const filters = ref({
  search: '',
  con_saldo: true,
  fecha_hasta: dayjs(),
})

const money = (n) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })

const fetchData = async () => {
  loading.value = true
  try {
    const params = {
      search: filters.value.search,
      con_saldo: filters.value.con_saldo,
      fecha_hasta: filters.value.fecha_hasta ? filters.value.fecha_hasta.format('YYYY-MM-DD') : null,
    }
    const { data } = await proveedoresService.resumenCartera(params)
    rows.value = data.results || []
    totales.value = data.totales || {}
  } catch (e) {
    message.error('Error al cargar la cartera de proveedores')
  } finally {
    loading.value = false
  }
}

const irACuentaCorriente = (id) => {
  router.push({ name: 'proveedor-cuenta-corriente', params: { id } })
}

const columns = [
  { title: 'Código', dataIndex: 'codigo', width: 100 },
  { title: 'Razón Social / Proveedor', dataIndex: 'razon_social' },
  { title: 'Deuda Vencida', dataIndex: 'deuda_vencida', align: 'right', width: 150 },
  { title: 'Saldo Total', dataIndex: 'saldo_total', align: 'right', width: 150 },
]

onMounted(fetchData)
</script>

<template>
  <div class="page-root">
    <div class="header">
      <div class="header-title">
        <BankOutlined class="title-icon" />
        <div>
          <h1>Estado de Cartera de Proveedores</h1>
          <p>Visión global de saldos y cuentas corrientes</p>
        </div>
      </div>
      <a-button type="primary" @click="fetchData" :loading="loading">
        <ReloadOutlined /> Actualizar
      </a-button>
    </div>

    <div class="kpis" v-if="totales.proveedores !== undefined">
      <div class="kpi-card">
        <span class="kpi-label">Proveedores con saldo</span>
        <span class="kpi-val">{{ totales.proveedores }}</span>
      </div>
      <div class="kpi-card kpi-card--danger">
        <span class="kpi-label">Total Deuda Vencida</span>
        <span class="kpi-val">$ {{ money(totales.vencida) }}</span>
      </div>
      <div class="kpi-card kpi-card--accent">
        <span class="kpi-label">Saldo Total a Pagar</span>
        <span class="kpi-val">$ {{ money(totales.saldo) }}</span>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <a-input v-model:value="filters.search" placeholder="Buscar proveedor..." style="width: 250px" @press-enter="fetchData">
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-checkbox v-model:checked="filters.con_saldo" @change="fetchData">
          Solo proveedores con saldo a favor
        </a-checkbox>
        <a-date-picker v-model:value="filters.fecha_hasta" format="DD/MM/YYYY" @change="fetchData" placeholder="Saldos a fecha..." />
      </div>

      <a-table :columns="columns" :data-source="rows" :loading="loading" rowKey="id" size="middle" :customRow="(record) => ({ onClick: () => irACuentaCorriente(record.id) })" class="pointer-table">
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'deuda_vencida'">
            <span :class="record.deuda_vencida > 0 ? 'text-danger fw-bold' : 'text-muted'">$ {{ money(record.deuda_vencida) }}</span>
          </template>
          <template v-if="column.dataIndex === 'saldo_total'">
            <span class="fw-bold text-dark">$ {{ money(record.saldo_total) }}</span>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.page-root { padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; }
.header-title { display: flex; align-items: center; gap: 16px; }
.title-icon { font-size: 32px; color: #1677ff; padding: 12px; background: #e6f4ff; border-radius: 12px; }
h1 { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
p { margin: 0; color: #64748b; font-size: 14px; }
.kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kpi-card { background: #fff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px; }
.kpi-card--accent { background: #f8fafc; border-color: #cbd5e1; }
.kpi-card--danger { background: #fef2f2; border-color: #fca5a5; }
.kpi-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; }
.kpi-card--danger .kpi-label { color: #ef4444; }
.kpi-val { font-size: 24px; font-weight: 900; color: #0f172a; }
.kpi-card--danger .kpi-val { color: #dc2626; }
.card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
.toolbar { display: flex; gap: 16px; align-items: center; margin-bottom: 16px; }
.text-danger { color: #ef4444; }
.text-muted { color: #94a3b8; }
.text-dark { color: #0f172a; }
.fw-bold { font-weight: 700; }
:global(.pointer-table .ant-table-tbody > tr) { cursor: pointer; }
:global(.pointer-table .ant-table-tbody > tr:hover > td) { background: #f1f5f9 !important; }
</style>
