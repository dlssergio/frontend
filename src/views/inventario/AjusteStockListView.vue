<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, CheckOutlined,
  StopOutlined, EyeOutlined, DeleteOutlined,
  FilterOutlined,
} from '@ant-design/icons-vue'
import { ajustesService, depositosService, motivosAjusteService } from '@/services/inventario'

const router = useRouter()

const loading  = ref(false)
const ajustes  = ref([])
const depositos = ref([])
const motivos   = ref([])

const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const filters = reactive({ deposito: null, estado: '', motivo: null, desde: null, hasta: null })
const filtersVisible = ref(false)

// ─── Columnas ──────────────────────────────────────────────
const columns = [
  { title: '#',         dataIndex: 'id',            width: 65,  align: 'center' },
  { title: 'Fecha',     dataIndex: 'fecha',          width: 160 },
  { title: 'Depósito',  dataIndex: 'deposito_nombre',width: 140, ellipsis: true },
  { title: 'Motivo',    dataIndex: 'motivo_nombre',  ellipsis: true },
  { title: 'Ítems',     dataIndex: 'total_items',    width: 70,  align: 'center' },
  { title: 'Estado',    dataIndex: 'estado',         width: 120, align: 'center' },
  { title: '',          key: 'actions',              width: 110, align: 'center', fixed: 'right' },
]

const ESTADO_CONFIG = {
  BR: { label: 'Borrador',   color: 'default' },
  CN: { label: 'Confirmado', color: 'success' },
  AN: { label: 'Anulado',    color: 'error'   },
}

// ─── Carga ─────────────────────────────────────────────────
const cargar = async () => {
  loading.value = true
  try {
    const params = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.deposito) params.deposito = filters.deposito
    if (filters.estado)   params.estado   = filters.estado
    if (filters.motivo)   params.motivo   = filters.motivo
    if (filters.desde)    params.desde    = filters.desde
    if (filters.hasta)    params.hasta    = filters.hasta

    const res = await ajustesService.listar(params)
    const data = res.data
    ajustes.value      = data.results ?? data
    pagination.total   = data.count   ?? ajustes.value.length
  } catch {
    message.error('Error al cargar ajustes.')
  } finally {
    loading.value = false
  }
}

const cargarAuxiliares = async () => {
  const [dR, mR] = await Promise.allSettled([
    depositosService.listar(),
    motivosAjusteService.listar(),
  ])
  if (dR.status === 'fulfilled') depositos.value = dR.value.data.results ?? dR.value.data
  if (mR.status === 'fulfilled') motivos.value   = mR.value.data.results ?? mR.value.data
}

const onTableChange = (pag) => {
  pagination.current  = pag.current
  pagination.pageSize = pag.pageSize
  cargar()
}

const resetFilters = () => {
  Object.assign(filters, { deposito: null, estado: '', motivo: null, desde: null, hasta: null })
  pagination.current = 1
  cargar()
}

// ─── Acciones ──────────────────────────────────────────────
const confirmar = (record) => {
  Modal.confirm({
    title:   `¿Confirmar Ajuste #${record.id}?`,
    content: 'Esta acción aplicará los cambios de stock. No se puede deshacer directamente.',
    okText:  'Confirmar',
    okType:  'primary',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await ajustesService.confirmar(record.id)
        message.success('Ajuste confirmado. Stock actualizado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo confirmar.')
      }
    },
  })
}

const anular = (record) => {
  Modal.confirm({
    title:   `¿Anular Ajuste #${record.id}?`,
    okText:  'Anular',
    okType:  'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await ajustesService.anular(record.id)
        message.success('Ajuste anulado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo anular.')
      }
    },
  })
}

const eliminar = (record) => {
  Modal.confirm({
    title:   `¿Eliminar Ajuste #${record.id}?`,
    content: 'Solo se pueden eliminar ajustes en Borrador.',
    okText:  'Eliminar',
    okType:  'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await ajustesService.eliminar(record.id)
        message.success('Ajuste eliminado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo eliminar.')
      }
    },
  })
}

const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'

onMounted(() => { cargarAuxiliares(); cargar() })
</script>
<template>
  <div class="ajustes-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Gestión de Stock</div>
        <h1 class="hero__title">Ajustes de Stock</h1>
        <p class="hero__subtitle">Correcciones manuales de inventario con trazabilidad completa.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :loading="loading" @click="cargar">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
          <a-button type="primary" size="large" @click="router.push({ name: 'ajuste-crear' })">
            <template #icon><PlusOutlined /></template>Nuevo Ajuste
          </a-button>
        </a-space>
      </div>
    </section>

    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.deposito" size="large" allow-clear
            placeholder="Depósito" style="width:180px" @change="() => { pagination.current=1; cargar() }">
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.motivo" size="large" allow-clear
            placeholder="Motivo" style="width:180px" @change="() => { pagination.current=1; cargar() }">
            <a-select-option v-for="m in motivos" :key="m.id" :value="m.id">{{ m.nombre }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.estado" size="large" style="width:140px"
            @change="() => { pagination.current=1; cargar() }">
            <a-select-option value="">Todos</a-select-option>
            <a-select-option value="BR">Borrador</a-select-option>
            <a-select-option value="CN">Confirmado</a-select-option>
            <a-select-option value="AN">Anulado</a-select-option>
          </a-select>
          <a-input type="date" v-model:value="filters.desde" size="large" style="width:140px" @change="() => { pagination.current=1; cargar() }" />
          <span style="color:var(--text-2);align-self:center">—</span>
          <a-input type="date" v-model:value="filters.hasta" size="large" style="width:140px" @change="() => { pagination.current=1; cargar() }" />
          <a-button size="large" @click="resetFilters">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="columns" :data-source="ajustes" :loading="loading"
        row-key="id"
        :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, showTotal: t => t + ' ajustes' }"
        :scroll="{ x: 900 }" @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fecha'">{{ fmtFecha(record.fecha) }}</template>
          <template v-if="column.dataIndex === 'estado'">
            <a-tag :color="ESTADO_CONFIG[record.estado]?.color">
              {{ ESTADO_CONFIG[record.estado]?.label ?? record.estado }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip title="Ver detalle">
                <a-button size="small" @click="router.push({ name: 'ajuste-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado === 'BR'" title="Confirmar">
                <a-button size="small" @click="confirmar(record)">
                  <template #icon><CheckOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado !== 'AN'" title="Anular">
                <a-button size="small" danger @click="anular(record)">
                  <template #icon><StopOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado === 'BR'" title="Eliminar">
                <a-button size="small" danger @click="eliminar(record)">
                  <template #icon><DeleteOutlined /></template>
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
.ajustes-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }
.hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px 22px; border-radius: 6px; background: radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent)); border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }
.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.filters-toolbar { display: flex; }
.filters-toolbar__right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
@media (max-width: 1100px) { .hero { flex-direction: column; } }
</style>
