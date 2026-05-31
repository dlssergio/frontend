<script setup>
/**
 * ArticulosSelectorModal.vue
 * Modal de selección masiva de artículos para agregar a listas de precios.
 * Filtros: búsqueda libre, marca, rubro, solo activos.
 * Permite seleccionar múltiples artículos y confirmar de una vez.
 *
 * Emite: @confirm([{ id, cod_articulo, descripcion, marca, rubro, precio_costo_monto }])
 */
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { SearchOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons-vue'
import api from '@/services/api'

const props = defineProps({
  open:       { type: Boolean, default: false },
  // Artículos ya en la lista (para marcarlos como ya agregados)
  yaEnLista:  { type: Array,   default: () => [] },
})

const emit = defineEmits(['update:open', 'confirm'])

// ─── Estado ───────────────────────────────────────────────────
const loading   = ref(false)
const articulos = ref([])
const total     = ref(0)
const marcas    = ref([])
const rubros    = ref([])

const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({ search: '', marca: null, rubro: null, soloActivos: true })

const selectedRowKeys  = ref([])   // ids seleccionados
const selectedRows     = ref([])   // objetos completos

// IDs ya en la lista para mostrar badge
const idsEnLista = computed(() => new Set(props.yaEnLista.map(i => i.articulo ?? i.id)))

// ─── Columnas ─────────────────────────────────────────────────
const columns = [
  { key: 'selection', width: 48, align: 'center' },
  { key: 'cod',       title: 'Código',      dataIndex: 'cod_articulo', width: 110 },
  { key: 'desc',      title: 'Descripción', dataIndex: 'descripcion',  ellipsis: true },
  { key: 'marca',     title: 'Marca',       dataIndex: 'marca_nombre', width: 130, ellipsis: true },
  { key: 'rubro',     title: 'Rubro',       dataIndex: 'rubro_nombre', width: 130, ellipsis: true },
  { key: 'costo',     title: 'Costo',       dataIndex: 'precio_costo_monto', width: 120, align: 'right' },
  { key: 'estado',    title: '',            width: 80,  align: 'center' },
]

// ─── Carga ────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try {
    const params = {
      page:      pagination.current,
      page_size: pagination.pageSize,
    }
    if (filters.search)       params.search    = filters.search
    if (filters.marca)        params.marca      = filters.marca
    if (filters.rubro)        params.rubro      = filters.rubro
    if (filters.soloActivos)  params.activo     = true

    const res = await api.get('/api/articulos/', { params })
    articulos.value = res.data.results ?? res.data
    total.value     = res.data.count   ?? articulos.value.length
  } catch {
    /* silencioso — la tabla queda vacía */
  } finally {
    loading.value = false
  }
}

async function loadFiltros() {
  const [mR, rR] = await Promise.allSettled([
    api.get('/api/marcas/'),
    api.get('/api/rubros/'),
  ])
  if (mR.status === 'fulfilled') marcas.value = mR.value.data.results ?? mR.value.data
  if (rR.status === 'fulfilled') rubros.value = rR.value.data.results ?? rR.value.data
}

function onTableChange(p) {
  pagination.current  = p.current
  pagination.pageSize = p.pageSize
  load()
}

function onSearch() {
  pagination.current = 1
  load()
}

function onReset() {
  Object.assign(filters, { search: '', marca: null, rubro: null, soloActivos: true })
  pagination.current = 1
  load()
}

// ─── Selección ────────────────────────────────────────────────
const rowSelection = {
  selectedRowKeys,
  onChange(keys, rows) {
    selectedRowKeys.value = keys
    // Mantener filas de páginas anteriores
    const newIds = new Set(keys)
    // Eliminar las que ya no están seleccionadas en página actual
    const currentIds = new Set(articulos.value.map(a => a.id))
    selectedRows.value = [
      ...selectedRows.value.filter(r => !currentIds.has(r.id) && newIds.has(r.id)),
      ...rows,
    ]
  },
  getCheckboxProps(record) {
    return { disabled: idsEnLista.value.has(record.id) }
  },
}

const cantSeleccionados = computed(() => selectedRowKeys.value.length)

// ─── Confirmar ────────────────────────────────────────────────
function confirmar() {
  emit('confirm', selectedRows.value)
  cerrar()
}

function cerrar() {
  selectedRowKeys.value = []
  selectedRows.value    = []
  emit('update:open', false)
}

// ─── Helpers ──────────────────────────────────────────────────
const money = (v) =>
  v ? `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v))}` : '—'

// ─── Watch ────────────────────────────────────────────────────
watch(() => props.open, (val) => {
  if (val) {
    selectedRowKeys.value = []
    selectedRows.value    = []
    pagination.current    = 1
    load()
    if (!marcas.value.length) loadFiltros()
  }
})
</script>

<template>
  <a-modal
    :open="open"
    title="Seleccionar Artículos"
    :footer="null"
    width="900px"
    destroy-on-close
    @cancel="cerrar"
  >
    <!-- Filtros -->
    <div class="filtros-bar">
      <a-input-search
        v-model:value="filters.search"
        placeholder="Buscar por código o descripción…"
        allow-clear
        style="flex:1;min-width:200px"
        @search="onSearch"
      >
        <template #prefix><SearchOutlined /></template>
      </a-input-search>

      <a-select
        v-model:value="filters.marca"
        placeholder="Marca"
        allow-clear
        show-search
        option-filter-prop="label"
        style="width:160px"
        @change="onSearch"
      >
        <a-select-option
          v-for="m in marcas" :key="m.id" :value="m.id" :label="m.nombre"
        >{{ m.nombre }}</a-select-option>
      </a-select>

      <a-select
        v-model:value="filters.rubro"
        placeholder="Rubro"
        allow-clear
        show-search
        option-filter-prop="label"
        style="width:160px"
        @change="onSearch"
      >
        <a-select-option
          v-for="r in rubros" :key="r.id" :value="r.id" :label="r.nombre"
        >{{ r.nombre }}</a-select-option>
      </a-select>

      <a-checkbox v-model:checked="filters.soloActivos" @change="onSearch">
        Solo activos
      </a-checkbox>

      <a-button @click="onReset">Limpiar</a-button>
      <a-button :loading="loading" @click="load"><ReloadOutlined /></a-button>
    </div>

    <!-- Info selección -->
    <div class="sel-info">
      <span v-if="cantSeleccionados > 0" class="sel-badge">
        {{ cantSeleccionados }} artículo(s) seleccionado(s)
      </span>
      <span v-else class="sel-hint">
        Seleccioná uno o más artículos para agregar a la lista
      </span>
    </div>

    <!-- Tabla -->
    <a-table
      :columns="columns"
      :data-source="articulos"
      :loading="loading"
      :row-selection="rowSelection"
      row-key="id"
      size="small"
      :pagination="{
        current: pagination.current,
        pageSize: pagination.pageSize,
        total,
        showSizeChanger: true,
        showTotal: t => t + ' artículos',
        pageSizeOptions: ['10', '20', '50', '100'],
      }"
      :scroll="{ x: 800, y: 400 }"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'cod'">
          <span class="mono-sm">{{ record.cod_articulo }}</span>
        </template>
        <template v-if="column.key === 'costo'">
          <span class="num-cell">{{ money(record.precio_costo_monto) }}</span>
        </template>
        <template v-if="column.key === 'estado'">
          <a-tag v-if="idsEnLista.has(record.id)" color="success" style="font-size:10px">
            En lista
          </a-tag>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="Sin artículos para los filtros aplicados" :image="false" />
      </template>
    </a-table>

    <!-- Footer -->
    <div class="modal-footer">
      <a-button @click="cerrar">Cancelar</a-button>
      <a-button
        type="primary"
        :disabled="cantSeleccionados === 0"
        @click="confirmar"
      >
        <CheckOutlined />
        Agregar {{ cantSeleccionados > 0 ? cantSeleccionados + ' artículo(s)' : '' }}
      </a-button>
    </div>
  </a-modal>
</template>

<style scoped>
.filtros-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.sel-info {
  margin-bottom: 8px;
  min-height: 24px;
}

.sel-badge {
  font-size: 12px;
  font-weight: 700;
  color: rgba(var(--accent-rgb, 99, 102, 241), 1);
  background: color-mix(in srgb, rgba(var(--accent-rgb, 99, 102, 241), 1) 10%, transparent);
  padding: 3px 10px;
  border-radius: 6px;
}

.sel-hint {
  font-size: 12px;
  color: var(--text-2, #94a3b8);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border, #f0f0f0);
  margin-top: 12px;
}

.mono-sm { font-family: monospace; font-size: 12px; color: var(--text-2); }
.num-cell { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12px; }
</style>
