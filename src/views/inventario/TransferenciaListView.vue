<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, EyeOutlined,
  SendOutlined, InboxOutlined, StopOutlined, FilterOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons-vue'
import { transferenciasService, depositosService } from '@/services/inventario'

const router = useRouter()

const loading       = ref(false)
const transferencias = ref([])
const depositos      = ref([])

const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const filters    = reactive({ estado: '', origen: null, destino: null, desde: null, hasta: null })
const filtersVisible = ref(false)

const ESTADO_CONFIG = {
  BR: { label: 'Borrador',     color: 'default',  icon: '●' },
  TR: { label: 'En Tránsito',  color: 'processing',icon: '►' },
  CP: { label: 'Completada',   color: 'success',  icon: '✓' },
  AN: { label: 'Anulada',      color: 'error',    icon: '✗' },
}

const columns = [
  { title: '#',          dataIndex: 'id',             width: 65,  align: 'center' },
  { title: 'Fecha',      dataIndex: 'fecha',           width: 155 },
  { title: 'Origen → Destino', key: 'ruta',            ellipsis: true },
  { title: 'Ítems',      dataIndex: 'total_items',     width: 65,  align: 'center' },
  { title: 'Estado',     dataIndex: 'estado',          width: 130, align: 'center' },
  { title: '',           key: 'actions',               width: 120, align: 'center', fixed: 'right' },
]

// ─── Carga ─────────────────────────────────────────────────
const cargar = async () => {
  loading.value = true
  try {
    const params = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.estado)  params.estado  = filters.estado
    if (filters.origen)  params.origen  = filters.origen
    if (filters.destino) params.destino = filters.destino
    if (filters.desde)   params.desde   = filters.desde
    if (filters.hasta)   params.hasta   = filters.hasta

    const res = await transferenciasService.listar(params)
    const data = res.data
    transferencias.value = data.results ?? data
    pagination.total     = data.count   ?? transferencias.value.length
  } catch {
    message.error('Error al cargar transferencias.')
  } finally {
    loading.value = false
  }
}

const cargarDepositos = async () => {
  const res = await depositosService.listar().catch(() => null)
  if (res) depositos.value = res.data.results ?? res.data
}

const onTableChange = (pag) => { pagination.current = pag.current; pagination.pageSize = pag.pageSize; cargar() }
const resetFilters  = () => { Object.assign(filters, { estado:'', origen:null, destino:null, desde:null, hasta:null }); pagination.current=1; cargar() }

// ─── Acciones de flujo ──────────────────────────────────────
const enviar = (record) => {
  Modal.confirm({
    title:   `¿Enviar Transferencia #${record.id}?`,
    content: `Mercadería de "${record.origen_nombre}" hacia "${record.destino_nombre}". Se registrará la salida del depósito origen.`,
    okText:  'Enviar mercadería',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.enviar(record.id)
        message.success('Transferencia enviada. Estado: En Tránsito.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo enviar.')
      }
    },
  })
}

const recibir = (record) => {
  Modal.confirm({
    title:   `¿Confirmar recepción de Transferencia #${record.id}?`,
    content: `Mercadería llegando a "${record.destino_nombre}". Se registrará la entrada en el depósito destino.`,
    okText:  'Confirmar recepción',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.recibir(record.id)
        message.success('Recepción confirmada. Stock actualizado en depósito destino.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo recibir.')
      }
    },
  })
}

const anular = (record) => {
  Modal.confirm({
    title:   `¿Anular Transferencia #${record.id}?`,
    okText:  'Anular',
    okType:  'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.anular(record.id)
        message.success('Transferencia anulada.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo anular.')
      }
    },
  })
}

const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'

onMounted(() => { cargarDepositos(); cargar() })
</script>
<template>
  <div class="transfer-page">

    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Movimientos entre Depósitos</div>
        <h1 class="hero__title">Transferencias</h1>
        <p class="hero__subtitle">Traslado de mercadería entre depósitos con control de tránsito.</p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-button size="large" :loading="loading" @click="cargar">
            <template #icon><ReloadOutlined /></template>Actualizar
          </a-button>
          <a-button type="primary" size="large" @click="router.push({ name: 'transferencia-crear' })">
            <template #icon><PlusOutlined /></template>Nueva Transferencia
          </a-button>
        </a-space>
      </div>
    </section>

    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.origen" size="large" allow-clear
            placeholder="Depósito Origen" style="width:180px" @change="() => { pagination.current=1; cargar() }">
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.destino" size="large" allow-clear
            placeholder="Depósito Destino" style="width:180px" @change="() => { pagination.current=1; cargar() }">
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
          </a-select>
          <a-select v-model:value="filters.estado" size="large" style="width:150px"
            @change="() => { pagination.current=1; cargar() }">
            <a-select-option value="">Todos</a-select-option>
            <a-select-option value="BR">Borrador</a-select-option>
            <a-select-option value="TR">En Tránsito</a-select-option>
            <a-select-option value="CP">Completada</a-select-option>
            <a-select-option value="AN">Anulada</a-select-option>
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
        :columns="columns" :data-source="transferencias" :loading="loading"
        row-key="id"
        :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, showTotal: t => t + ' transferencias' }"
        :scroll="{ x: 900 }" @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fecha'">{{ fmtFecha(record.fecha) }}</template>
          <template v-if="column.key === 'ruta'">
            <span class="ruta-cell">
              {{ record.origen_nombre }}
              <ArrowRightOutlined style="margin:0 6px;color:var(--text-2)" />
              {{ record.destino_nombre }}
            </span>
          </template>
          <template v-if="column.dataIndex === 'estado'">
            <a-tag :color="ESTADO_CONFIG[record.estado]?.color">
              {{ ESTADO_CONFIG[record.estado]?.label ?? record.estado }}
            </a-tag>
          </template>
          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip title="Ver detalle">
                <a-button size="small" @click="router.push({ name: 'transferencia-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado === 'BR'" title="Enviar (En Tránsito)">
                <a-button size="small" @click="enviar(record)">
                  <template #icon><SendOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="record.estado === 'TR'" title="Confirmar Recepción">
                <a-button size="small" type="primary" @click="recibir(record)">
                  <template #icon><InboxOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="['BR','TR'].includes(record.estado)" title="Anular">
                <a-button size="small" danger @click="anular(record)">
                  <template #icon><StopOutlined /></template>
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
.transfer-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }
.hero { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 20px 22px; border-radius: 6px; background: radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%), linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent)); border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }
.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.filters-toolbar__right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.ruta-cell { display: inline-flex; align-items: center; font-size: 13px; font-weight: 500; }
@media (max-width: 1100px) { .hero { flex-direction: column; } }
</style>
