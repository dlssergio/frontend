<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleFilled, CloseCircleFilled, SaveOutlined,
} from '@ant-design/icons-vue'
import { depositosService } from '@/services/inventario'

const loading   = ref(false)
const depositos = ref([])
const drawerOpen = ref(false)
const submitting = ref(false)

const formVacio = () => ({
  id:                    null,
  nombre:                '',
  direccion:             '',
  es_principal:          false,
  permite_stock_negativo:false,
})

const form = reactive(formVacio())
const drawerTitle = ref('Nuevo Depósito')

const columns = [
  { title: 'Nombre',             dataIndex: 'nombre',                 ellipsis: true },
  { title: 'Dirección',          dataIndex: 'direccion',              ellipsis: true },
  { title: 'Principal',          dataIndex: 'es_principal',          width: 100, align: 'center' },
  { title: 'Permite Neg.',       dataIndex: 'permite_stock_negativo', width: 120, align: 'center' },
  { title: '',                   key: 'actions',                      width: 100, align: 'center' },
]

const cargar = async () => {
  loading.value = true
  try {
    const res = await depositosService.listar()
    depositos.value = res.data.results ?? res.data
  } catch {
    message.error('Error al cargar depósitos.')
  } finally {
    loading.value = false
  }
}

const abrirNuevo = () => {
  Object.assign(form, formVacio())
  drawerTitle.value = 'Nuevo Depósito'
  drawerOpen.value  = true
}

const abrirEditar = (record) => {
  Object.assign(form, {
    id:                     record.id,
    nombre:                 record.nombre,
    direccion:              record.direccion ?? '',
    es_principal:           record.es_principal,
    permite_stock_negativo: record.permite_stock_negativo,
  })
  drawerTitle.value = 'Editar Depósito'
  drawerOpen.value  = true
}

const guardar = async () => {
  if (!form.nombre?.trim()) { message.error('El nombre es obligatorio.'); return }
  submitting.value = true
  try {
    const payload = {
      nombre:                 form.nombre,
      direccion:              form.direccion || '',
      es_principal:           form.es_principal,
      permite_stock_negativo: form.permite_stock_negativo,
    }
    if (form.id) {
      await depositosService.actualizar(form.id, payload)
      message.success('Depósito actualizado.')
    } else {
      await depositosService.crear(payload)
      message.success('Depósito creado.')
    }
    drawerOpen.value = false
    cargar()
  } catch (e) {
    const err = e.response?.data
    message.error(err?.nombre?.[0] ?? err?.detail ?? 'No se pudo guardar.')
  } finally {
    submitting.value = false
  }
}

const eliminar = (record) => {
  Modal.confirm({
    title:   `¿Eliminar "${record.nombre}"?`,
    content: 'Si tiene movimientos o stock asociado, la eliminación será rechazada.',
    okText:  'Eliminar',
    okType:  'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await depositosService.eliminar(record.id)
        message.success('Depósito eliminado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se puede eliminar: tiene datos asociados.')
      }
    },
  })
}

onMounted(cargar)
</script>

<template>
  <div class="page-root">

    <div class="toolbar">
      <h1 class="page-title">Depósitos</h1>
      <a-button type="primary" @click="abrirNuevo">
        <PlusOutlined /> Nuevo Depósito
      </a-button>
    </div>

    <a-table
      :columns="columns"
      :data-source="depositos"
      :loading="loading"
      row-key="id"
      :pagination="false"
      size="middle"
      class="erp-table"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'es_principal'">
          <CheckCircleFilled v-if="record.es_principal" class="flag-on" />
          <span v-else class="flag-off">—</span>
        </template>
        <template v-if="column.dataIndex === 'permite_stock_negativo'">
          <CheckCircleFilled v-if="record.permite_stock_negativo" class="flag-warn" />
          <span v-else class="flag-off">—</span>
        </template>
        <template v-if="column.key === 'actions'">
          <a-space size="small">
            <a-tooltip title="Editar">
              <a-button type="text" size="small" class="btn-icon btn-edit" @click="abrirEditar(record)">
                <EditOutlined />
              </a-button>
            </a-tooltip>
            <a-tooltip title="Eliminar">
              <a-button type="text" size="small" class="btn-icon btn-del" @click="eliminar(record)">
                <DeleteOutlined />
              </a-button>
            </a-tooltip>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="No hay depósitos configurados" />
      </template>
    </a-table>

    <!-- Drawer de formulario -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="drawerTitle"
      width="420"
      :body-style="{ padding: '24px' }"
    >
      <div class="form-fields">
        <div class="field">
          <label class="field-label req">Nombre</label>
          <a-input v-model:value="form.nombre" placeholder="Ej: Depósito Central" allow-clear />
        </div>
        <div class="field">
          <label class="field-label">Dirección</label>
          <a-input v-model:value="form.direccion" placeholder="Dirección física (opcional)" allow-clear />
        </div>
        <div class="field">
          <a-checkbox v-model:checked="form.es_principal">
            Depósito Principal
            <span class="hint">El depósito por defecto para operaciones.</span>
          </a-checkbox>
        </div>
        <div class="field">
          <a-checkbox v-model:checked="form.permite_stock_negativo">
            Permite Stock Negativo
            <span class="hint warning">⚠ Usar con precaución — permite egresos sin stock suficiente.</span>
          </a-checkbox>
        </div>
      </div>

      <template #footer>
        <div class="drawer-footer">
          <a-button @click="drawerOpen = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardar">
            <SaveOutlined /> Guardar
          </a-button>
        </div>
      </template>
    </a-drawer>

  </div>
</template>

<style scoped>
.page-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); }
.toolbar { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); }
.page-title { margin:0; font-size:18px; font-weight:700; color:var(--text-0); }
.erp-table :deep(.ant-table-thead > tr > th) { background:var(--surface-1,#f8fafc); font-weight:600; font-size:12px; color:var(--text-1); }
.flag-on   { color:#22c55e; font-size:16px; }
.flag-warn { color:#f59e0b; font-size:16px; }
.flag-off  { color:var(--text-2); }
.btn-icon  { border-radius:6px!important; width:28px; height:28px; padding:0!important; }
.btn-edit  { color:#6366f1; } .btn-edit:hover  { background:#f5f3ff!important; }
.btn-del   { color:#ef4444; } .btn-del:hover   { background:#fef2f2!important; }
.form-fields { display:flex; flex-direction:column; gap:18px; }
.field { display:flex; flex-direction:column; gap:5px; }
.field-label { font-size:12px; font-weight:600; color:var(--text-1); }
.field-label.req::after { content:' *'; color:#ef4444; }
.hint { font-size:11px; color:var(--text-2); display:block; margin-top:2px; }
.hint.warning { color:#b45309; }
.drawer-footer { display:flex; justify-content:flex-end; gap:8px; }
</style>
