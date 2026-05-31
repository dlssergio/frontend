<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  TagOutlined, AppstoreOutlined, SearchOutlined,
} from '@ant-design/icons-vue'
import { marcasService, rubrosService } from '@/services/inventario'

const activeTab = ref('marcas')

// ─── Marcas ───────────────────────────────────────────────────
const loadingMarcas = ref(false)
const marcas        = ref([])
const searchMarca   = ref('')
const modalMarca    = ref(false)
const submittingM   = ref(false)
const formMarca     = reactive({ id: null, nombre: '' })

const columns = [
  { title: 'Nombre', dataIndex: 'nombre', ellipsis: true },
  { title: 'Acciones', key: 'acciones', width: 120, align: 'center', fixed: 'right' },
]

async function loadMarcas() {
  loadingMarcas.value = true
  try {
    const params = {}
    if (searchMarca.value) params.search = searchMarca.value
    const res = await marcasService.listar(params)
    marcas.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar marcas.') }
  finally   { loadingMarcas.value = false }
}

function abrirNuevaMarca() {
  Object.assign(formMarca, { id: null, nombre: '' }); modalMarca.value = true
}
function editarMarca(r) {
  Object.assign(formMarca, { id: r.id, nombre: r.nombre }); modalMarca.value = true
}
async function guardarMarca() {
  if (!formMarca.nombre.trim()) { message.error('El nombre es obligatorio.'); return }
  submittingM.value = true
  try {
    if (formMarca.id) { await marcasService.actualizar(formMarca.id, { nombre: formMarca.nombre }); message.success('Marca actualizada.') }
    else              { await marcasService.crear({ nombre: formMarca.nombre }); message.success('Marca creada.') }
    modalMarca.value = false; loadMarcas()
  } catch (e) { message.error(e.response?.data?.nombre?.[0] ?? 'No se pudo guardar.') }
  finally { submittingM.value = false }
}
async function eliminarMarca(id) {
  Modal.confirm({
    title: '¿Eliminar esta marca?', content: 'Se eliminará de todos los artículos asociados.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await marcasService.eliminar(id); message.success('Marca eliminada.'); loadMarcas() }
      catch { message.error('No se pudo eliminar. Puede estar en uso.') }
    },
  })
}

// ─── Rubros ───────────────────────────────────────────────────
const loadingRubros = ref(false)
const rubros        = ref([])
const searchRubro   = ref('')
const modalRubro    = ref(false)
const submittingR   = ref(false)
const formRubro     = reactive({ id: null, nombre: '' })

async function loadRubros() {
  loadingRubros.value = true
  try {
    const params = {}
    if (searchRubro.value) params.search = searchRubro.value
    const res = await rubrosService.listar(params)
    rubros.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar rubros.') }
  finally   { loadingRubros.value = false }
}

function abrirNuevoRubro() {
  Object.assign(formRubro, { id: null, nombre: '' }); modalRubro.value = true
}
function editarRubro(r) {
  Object.assign(formRubro, { id: r.id, nombre: r.nombre }); modalRubro.value = true
}
async function guardarRubro() {
  if (!formRubro.nombre.trim()) { message.error('El nombre es obligatorio.'); return }
  submittingR.value = true
  try {
    if (formRubro.id) { await rubrosService.actualizar(formRubro.id, { nombre: formRubro.nombre }); message.success('Rubro actualizado.') }
    else              { await rubrosService.crear({ nombre: formRubro.nombre }); message.success('Rubro creado.') }
    modalRubro.value = false; loadRubros()
  } catch (e) { message.error(e.response?.data?.nombre?.[0] ?? 'No se pudo guardar.') }
  finally { submittingR.value = false }
}
async function eliminarRubro(id) {
  Modal.confirm({
    title: '¿Eliminar este rubro?', content: 'Se eliminará de todos los artículos asociados.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await rubrosService.eliminar(id); message.success('Rubro eliminado.'); loadRubros() }
      catch { message.error('No se pudo eliminar. Puede estar en uso.') }
    },
  })
}

onMounted(() => { loadMarcas(); loadRubros() })
</script>

<template>
  <div class="mr-page">

    <!-- Modales -->
    <a-modal v-model:open="modalMarca" :title="formMarca.id ? 'Editar Marca' : 'Nueva Marca'" :footer="null" width="380px">
      <div class="mini-form">
        <div class="mini-field"><label class="req">Nombre</label>
          <a-input v-model:value="formMarca.nombre" allow-clear @pressEnter="guardarMarca" />
        </div>
        <div class="mini-footer">
          <a-button @click="modalMarca = false">Cancelar</a-button>
          <a-button type="primary" :loading="submittingM" @click="guardarMarca">
            {{ formMarca.id ? 'Guardar' : 'Crear' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <a-modal v-model:open="modalRubro" :title="formRubro.id ? 'Editar Rubro' : 'Nuevo Rubro'" :footer="null" width="380px">
      <div class="mini-form">
        <div class="mini-field"><label class="req">Nombre</label>
          <a-input v-model:value="formRubro.nombre" allow-clear @pressEnter="guardarRubro" />
        </div>
        <div class="mini-footer">
          <a-button @click="modalRubro = false">Cancelar</a-button>
          <a-button type="primary" :loading="submittingR" @click="guardarRubro">
            {{ formRubro.id ? 'Guardar' : 'Crear' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Configuración</div>
        <h1 class="hero__title">Marcas y Rubros</h1>
        <p class="hero__subtitle">Clasificadores del catálogo de artículos para filtros y reportes.</p>
      </div>
    </section>

    <!-- Contenido en dos columnas -->
    <div class="two-cols">

      <!-- Marcas -->
      <a-card class="col-card" :bordered="false">
        <div class="col-header">
          <div class="col-title"><TagOutlined style="margin-right:8px;color:rgba(var(--accent-rgb),1)" />Marcas <span class="count-badge">{{ marcas.length }}</span></div>
          <a-space>
            <a-input-search v-model:value="searchMarca" size="small" allow-clear
              placeholder="Buscar…" style="width:160px" @search="loadMarcas" />
            <a-button size="small" :loading="loadingMarcas" @click="loadMarcas"><ReloadOutlined /></a-button>
            <a-button size="small" type="primary" @click="abrirNuevaMarca"><PlusOutlined /> Nueva</a-button>
          </a-space>
        </div>
        <a-table :columns="columns" :data-source="marcas" :loading="loadingMarcas"
          row-key="id" size="small"
          :pagination="{ pageSize: 20, showTotal: t => `${t} marcas`, simple: true }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'acciones'">
              <a-space>
                <a-tooltip title="Editar">
                  <a-button size="small" @click="editarMarca(record)"><template #icon><EditOutlined /></template></a-button>
                </a-tooltip>
                <a-tooltip title="Eliminar">
                  <a-button size="small" danger @click="eliminarMarca(record.id)"><template #icon><DeleteOutlined /></template></a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
          <template #emptyText><a-empty description="Sin marcas" :image="false" /></template>
        </a-table>
      </a-card>

      <!-- Rubros -->
      <a-card class="col-card" :bordered="false">
        <div class="col-header">
          <div class="col-title"><AppstoreOutlined style="margin-right:8px;color:#d97706" />Rubros <span class="count-badge">{{ rubros.length }}</span></div>
          <a-space>
            <a-input-search v-model:value="searchRubro" size="small" allow-clear
              placeholder="Buscar…" style="width:160px" @search="loadRubros" />
            <a-button size="small" :loading="loadingRubros" @click="loadRubros"><ReloadOutlined /></a-button>
            <a-button size="small" type="primary" @click="abrirNuevoRubro"><PlusOutlined /> Nuevo</a-button>
          </a-space>
        </div>
        <a-table :columns="columns" :data-source="rubros" :loading="loadingRubros"
          row-key="id" size="small"
          :pagination="{ pageSize: 20, showTotal: t => `${t} rubros`, simple: true }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'acciones'">
              <a-space>
                <a-tooltip title="Editar">
                  <a-button size="small" @click="editarRubro(record)"><template #icon><EditOutlined /></template></a-button>
                </a-tooltip>
                <a-tooltip title="Eliminar">
                  <a-button size="small" danger @click="eliminarRubro(record.id)"><template #icon><DeleteOutlined /></template></a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
          <template #emptyText><a-empty description="Sin rubros" :image="false" /></template>
        </a-table>
      </a-card>

    </div>
  </div>
</template>

<style scoped>
.mr-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { padding:20px 22px; border-radius:6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.two-cols { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.col-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.col-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:8px; }
.col-title  { font-size:15px; font-weight:700; color:var(--text-0); display:flex; align-items:center; }
.count-badge { font-size:11px; font-weight:700; background:var(--surface-1,#f1f5f9); color:var(--text-2); padding:2px 8px; border-radius:10px; margin-left:8px; }
.mini-form  { padding-top:8px; display:flex; flex-direction:column; gap:12px; }
.mini-field { display:flex; flex-direction:column; gap:4px; }
.mini-field label { font-size:11px; font-weight:600; color:var(--text-2); }
.mini-field label.req::after { content:' *'; color:#ef4444; }
.mini-footer { display:flex; justify-content:flex-end; gap:8px; padding-top:12px; border-top:1px solid var(--border); margin-top:4px; }
@media (max-width:900px) { .two-cols { grid-template-columns:1fr; } }
</style>
