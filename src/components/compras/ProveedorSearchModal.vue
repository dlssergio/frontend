<script setup>
import { ref, watch, computed } from 'vue'
import { SearchOutlined, UserOutlined } from '@ant-design/icons-vue'
import { proveedoresService } from '@/services/compras'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit  = defineEmits(['update:open', 'select'])

const internalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const loading    = ref(false)
const rows       = ref([])
const total      = ref(0)
const hasSearched = ref(false)

const search = ref('')
const campo  = ref('all')
const page   = ref(1)
const PAGE_SIZE = 15

const campoOptions = [
  { value: 'all',            label: 'Todos los campos' },
  { value: 'razon_social',   label: 'Razón Social' },
  { value: 'nombre_fantasia',label: 'Nombre Fantasía' },
  { value: 'cuit',           label: 'CUIT' },
  { value: 'codigo',         label: 'Código' },
]

const columns = [
  { title: 'Código',         dataIndex: 'codigo_proveedor', width: 100 },
  { title: 'Razón Social',   dataIndex: 'razon_social',    ellipsis: true },
  { title: 'Nombre Fantasía',dataIndex: 'nombre_fantasia', ellipsis: true, width: 180 },
  { title: 'CUIT',           dataIndex: 'cuit',            width: 140 },
  { title: 'Estado',         dataIndex: 'esta_activo',     width: 90, align: 'center' },
]

const buscar = async () => {
  if (!search.value.trim()) return
  loading.value = true
  hasSearched.value = true
  try {
    const params = {
      search: search.value.trim(),
      page: page.value,
      page_size: PAGE_SIZE,
    }
    const res = await proveedoresService.listar(params)
    rows.value  = res.data.results ?? res.data
    total.value = res.data.count   ?? rows.value.length
  } finally {
    loading.value = false
  }
}

const onSelect = (record) => {
  emit('select', record)
  internalOpen.value = false
  reset()
}

const onTableChange = (p) => { page.value = p.current; buscar() }

const reset = () => {
  search.value  = ''
  rows.value    = []
  total.value   = 0
  page.value    = 1
  hasSearched.value = false
}

watch(internalOpen, (v) => { if (!v) reset() })
</script>

<template>
  <a-modal
    v-model:open="internalOpen"
    title="Buscar Proveedor"
    width="860px"
    :footer="null"
    destroy-on-close
  >
    <div class="search-bar">
      <a-select v-model:value="campo" style="width:180px">
        <a-select-option v-for="o in campoOptions" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select>
      <a-input-search
        v-model:value="search"
        placeholder="Escribí para buscar…"
        :loading="loading"
        enter-button
        allow-clear
        style="flex:1"
        @search="() => { page = 1; buscar() }"
      />
    </div>

    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      size="small"
      :pagination="{ current: page, pageSize: PAGE_SIZE, total, simple: true }"
      :custom-row="(record) => ({ onClick: () => onSelect(record) })"
      class="prov-table"
      style="margin-top:12px"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'razon_social'">
          <div class="rs-cell">
            <span class="rs-name">{{ record.razon_social }}</span>
          </div>
        </template>
        <template v-if="column.dataIndex === 'esta_activo'">
          <a-badge
            :status="record.esta_activo ? 'success' : 'default'"
            :text="record.esta_activo ? 'Activo' : 'Inactivo'"
          />
        </template>
      </template>
      <template #emptyText>
        <a-empty
          v-if="hasSearched"
          description="Sin resultados"
          :image="false"
        />
        <a-empty
          v-else
          description="Escribí para buscar proveedores"
          :image="false"
        />
      </template>
    </a-table>
  </a-modal>
</template>

<style scoped>
.search-bar { display:flex; gap:8px; }
.prov-table :deep(tr) { cursor:pointer; }
.prov-table :deep(tr:hover td) { background:color-mix(in srgb,var(--surface-1,#f8fafc) 80%,rgba(var(--accent-rgb,99,102,241),.1) 20%)!important; }
.rs-name    { font-weight:600; color:var(--text-0); }
</style>
