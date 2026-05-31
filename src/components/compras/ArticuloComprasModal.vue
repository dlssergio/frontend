<script setup>
import { ref, watch, computed } from 'vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import api from '@/services/api'

const props = defineProps({
  open:       { type: Boolean, default: false },
  proveedorId:{ type: Number,  default: null  },
})
const emit = defineEmits(['update:open', 'add-items'])

const internalOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const loading    = ref(false)
const rows       = ref([])
const total      = ref(0)
const hasSearched = ref(false)
const search     = ref('')
const page       = ref(1)
const PAGE_SIZE  = 15

// Selección con cantidades
const selected   = ref({})   // { [id]: { item, qty } }

const columns = [
  { title: 'Código',    dataIndex: 'cod_articulo', width: 110 },
  { title: 'Descripción', dataIndex: 'descripcion', ellipsis: true },
  { title: 'Stock',     dataIndex: 'stock_disponible', width: 80, align: 'right' },
  { title: 'Costo',     dataIndex: 'precio_costo_monto', width: 110, align: 'right' },
  { title: 'Cant.',     key: 'qty', width: 100, align: 'center' },
]

const fmtM = (v) =>
  `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)}`

const buscar = async () => {
  if (!search.value.trim()) return
  loading.value = true
  hasSearched.value = true
  try {
    const params = { search: search.value.trim(), page: page.value, page_size: PAGE_SIZE }
    if (props.proveedorId) params.proveedor = props.proveedorId
    const res  = await api.get('/api/articulos/', { params })
    rows.value  = res.data.results ?? res.data
    total.value = res.data.count   ?? rows.value.length
  } finally {
    loading.value = false
  }
}

const getQty = (id) => selected.value[id]?.qty ?? 0
const setQty = (record, qty) => {
  const n = Math.max(0, qty)
  if (n === 0) {
    delete selected.value[record.id]
  } else {
    selected.value[record.id] = { item: record, qty: n }
  }
}

const totalItems = computed(() => Object.keys(selected.value).length)

const agregar = (close) => {
  const items = Object.values(selected.value).map(({ item, qty }) => ({
    articuloId:    item.id,
    codigo:        item.cod_articulo,
    descripcion:   item.descripcion,
    cantidad:      qty,
    costo:         parseFloat(item.precio_costo_monto) || 0,
  }))
  emit('add-items', { items, close })
  if (close) {
    internalOpen.value = false
    reset()
  }
}

const reset = () => {
  search.value = ''; rows.value = []; total.value = 0
  page.value = 1; hasSearched.value = false; selected.value = {}
}

const onTableChange = (p) => { page.value = p.current; buscar() }
watch(internalOpen, (v) => { if (!v) reset() })
</script>

<template>
  <a-modal
    v-model:open="internalOpen"
    title="Búsqueda Avanzada de Artículos"
    width="900px"
    :footer="null"
    destroy-on-close
  >
    <div class="search-bar">
      <a-input-search
        v-model:value="search"
        :placeholder="proveedorId ? 'Buscar artículos del proveedor…' : 'Buscar artículos…'"
        :loading="loading"
        enter-button
        allow-clear
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
      style="margin-top:12px"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'precio_costo_monto'">
          <span class="mono-sm">{{ fmtM(record.precio_costo_monto) }}</span>
        </template>
        <template v-if="column.key === 'qty'">
          <a-input-number
            :value="getQty(record.id)"
            :min="0" :precision="3"
            size="small"
            style="width:80px"
            @change="(v) => setQty(record, v)"
            @click.stop
          />
        </template>
      </template>
      <template #emptyText>
        <a-empty
          :description="hasSearched ? 'Sin resultados' : 'Escribí para buscar'"
          :image="false"
        />
      </template>
    </a-table>

    <!-- Footer -->
    <div class="modal-footer">
      <span class="selection-count">
        {{ totalItems }} artículo{{ totalItems !== 1 ? 's' : '' }} seleccionado{{ totalItems !== 1 ? 's' : '' }}
      </span>
      <div class="footer-actions">
        <a-button @click="internalOpen = false">Cancelar</a-button>
        <a-button
          :disabled="!totalItems"
          @click="agregar(false)"
        >Agregar y seguir</a-button>
        <a-button
          type="primary"
          :disabled="!totalItems"
          @click="agregar(true)"
        >Agregar y cerrar</a-button>
      </div>
    </div>
  </a-modal>
</template>

<style scoped>
.search-bar    { display:flex; gap:8px; }
.mono-sm       { font-family:monospace; font-size:12px; }
.modal-footer  { display:flex; align-items:center; justify-content:space-between; margin-top:14px; padding-top:12px; border-top:1px solid var(--border,#f0f0f0); flex-wrap:wrap; gap:8px; }
.footer-actions { display:flex; gap:8px; }
.selection-count { font-size:13px; font-weight:600; color:var(--primary,#1e40af); }
</style>
