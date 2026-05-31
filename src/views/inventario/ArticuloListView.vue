<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, EyeOutlined, PoweroffOutlined,
  SettingOutlined, WarningOutlined,
  CheckCircleFilled, CloseCircleFilled, MinusCircleFilled,
  InboxOutlined, DollarOutlined, AlertOutlined, CheckCircleOutlined,
} from '@ant-design/icons-vue'
import { articulosService, rubrosService, marcasService } from '@/services/inventario'

const router = useRouter()
const STORAGE_KEY = 'articulos-lista-columnas-v1'

const loading   = ref(false)
const articulos = ref([])
const total     = ref(0)
const rubros    = ref([])
const marcas    = ref([])

const pagination = reactive({ current: 1, pageSize: 20 })
const filters    = reactive({
  search:      '',
  rubro:       null,
  marca:       null,
  activo:      '',
  perfil:      '',
  bajo_minimo: false,
})

// ─── Columnas configurables ───────────────────────────────────
const allColumns = [
  { key: 'cod_articulo',       title: 'Código',       dataIndex: 'cod_articulo',       width: 115, defaultVisible: true,  fixed: 'left' },
  { key: 'descripcion',        title: 'Descripción',  dataIndex: 'descripcion',        ellipsis: true, defaultVisible: true },
  { key: 'rubro_nombre',       title: 'Rubro',        dataIndex: 'rubro_nombre',       width: 140, defaultVisible: true,  ellipsis: true },
  { key: 'marca_nombre',       title: 'Marca',        dataIndex: 'marca_nombre',       width: 130, defaultVisible: true,  ellipsis: true },
  { key: 'stock_disponible',   title: 'Stock',        dataIndex: 'stock_disponible',   width: 100, defaultVisible: true,  align: 'center' },
  { key: 'precio_costo_monto', title: 'Costo',        dataIndex: 'precio_costo_monto', width: 120, defaultVisible: true,  align: 'right' },
  { key: 'precio_venta_monto', title: 'Precio Venta', dataIndex: 'precio_venta_monto', width: 130, defaultVisible: true,  align: 'right' },
  { key: 'utilidad',           title: 'Utilidad',     dataIndex: 'utilidad',           width: 90,  defaultVisible: true,  align: 'right' },
  { key: 'esta_activo',        title: 'Estado',       dataIndex: 'esta_activo',        width: 100, defaultVisible: true,  align: 'center' },
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
  ...allColumns.filter(c => visibleColumnKeys.value.includes(c.key)).map(c => ({
    key:       c.key,
    title:     c.title,
    dataIndex: c.key,
    width:     c.width,
    align:     c.align,
    ellipsis:  c.ellipsis,
    fixed:     c.fixed,
  })),
  { key: 'actions', title: 'Acciones', width: 110, align: 'center', fixed: 'right' },
])
const columnOptions = computed(() => allColumns.map(c => ({ label: c.title, value: c.key })))

// ─── KPIs de la lista actual ──────────────────────────────────
const summary = computed(() => {
  const list = articulos.value
  return {
    activos:      list.filter(x => x.esta_activo).length,
    sinStock:     list.filter(x => x.administra_stock && parseFloat(x.stock_disponible ?? 0) <= 0).length,
    bajoMinimo:   list.filter(x => x.necesita_reposicion).length,
    valorCosto:   list.reduce((s, x) =>
      s + parseFloat(x.precio_costo_monto || 0) * parseFloat(x.stock_disponible || 0), 0),
  }
})

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(v || 0))

const PERFIL_LABELS = { CV: 'Compra/Venta', CO: 'Solo Compra', VE: 'Solo Venta' }

const estadoStock = (record) => {
  if (!record.administra_stock) return 'nostock'
  const disp = parseFloat(record.stock_disponible ?? 0)
  if (disp <= 0) return 'empty'
  if (record.necesita_reposicion) return 'warn'
  return 'ok'
}

// ─── Carga ────────────────────────────────────────────────────
async function cargar() {
  loading.value = true
  try {
    const params = { page: pagination.current, page_size: pagination.pageSize }
    if (filters.search)        params.search      = filters.search
    if (filters.rubro)         params.rubro       = filters.rubro
    if (filters.marca)         params.marca       = filters.marca
    if (filters.activo !== '') params.activo      = filters.activo
    if (filters.perfil)        params.perfil      = filters.perfil
    if (filters.bajo_minimo)   params.bajo_minimo = true

    const res  = await articulosService.listar(params)
    const data = res.data
    articulos.value = data.results ?? data
    total.value     = data.count   ?? articulos.value.length
    pagination.total = total.value
  } catch { message.error('Error al cargar artículos.') }
  finally   { loading.value = false }
}

let searchTimer = null
watch(() => filters.search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { pagination.current = 1; cargar() }, 350)
})

function onTableChange(p) { pagination.current = p.current; pagination.pageSize = p.pageSize; cargar() }
function onBuscar()       { pagination.current = 1; cargar() }
function onReset()        {
  Object.assign(filters, { search: '', rubro: null, marca: null, activo: '', perfil: '', bajo_minimo: false })
  pagination.current = 1; cargar()
}

// ─── Acciones ─────────────────────────────────────────────────
const toggleActivo = (record) => {
  Modal.confirm({
    title:   `¿${record.esta_activo ? 'Desactivar' : 'Activar'} "${record.descripcion}"?`,
    content: record.esta_activo
      ? 'El artículo dejará de aparecer en ventas y compras.'
      : 'El artículo volverá a estar disponible.',
    okText:  record.esta_activo ? 'Desactivar' : 'Activar',
    okType:  record.esta_activo ? 'danger' : 'primary',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        if (record.esta_activo) await articulosService.desactivar(record.id)
        else                    await articulosService.activar(record.id)
        message.success(`Artículo ${record.esta_activo ? 'desactivado' : 'activado'}.`)
        cargar()
      } catch { message.error('No se pudo completar la operación.') }
    },
  })
}

const formatMoneda  = (v) => v != null ? `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(v)}` : '—'
const formatUtilidad = (v) => v != null ? `${parseFloat(v).toFixed(1)}%` : '—'

onMounted(async () => {
  const [rR, mR] = await Promise.allSettled([rubrosService.listar(), marcasService.listar()])
  if (rR.status === 'fulfilled') rubros.value = rR.value.data.results ?? rR.value.data
  if (mR.status === 'fulfilled') marcas.value = mR.value.data.results ?? mR.value.data
  cargar()
})
</script>

<template>
  <div class="articulos-page">

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Inventario · Catálogo de Productos</div>
        <h1 class="hero__title">Artículos</h1>
        <p class="hero__subtitle">
          Catálogo de productos con control de stock, precios y trazabilidad completa.
        </p>
      </div>
      <div class="hero__right">
        <a-space>
          <a-dropdown trigger="click">
            <a-button size="large">
              <template #icon><SettingOutlined /></template>
              Columnas
            </a-button>
            <template #overlay>
              <a-menu class="columns-menu">
                <div class="columns-menu__title">Columnas visibles</div>
                <div class="columns-menu__content">
                  <a-checkbox-group v-model:value="visibleColumnKeys" :options="columnOptions" />
                </div>
              </a-menu>
            </template>
          </a-dropdown>

          <a-button size="large" :loading="loading" @click="cargar">
            <template #icon><ReloadOutlined /></template>
            Actualizar
          </a-button>

          <a-button type="primary" size="large" @click="router.push({ name: 'articulo-crear' })">
            <template #icon><PlusOutlined /></template>
            Nuevo Artículo
          </a-button>
        </a-space>
      </div>
    </section>

    <!-- KPI cards -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><InboxOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Activos (página)</div>
          <div class="kpi-card__value">{{ summary.activos }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red"><CloseCircleFilled /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Sin stock</div>
          <div class="kpi-card__value">{{ summary.sinStock }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><AlertOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Bajo mínimo</div>
          <div class="kpi-card__value">{{ summary.bajoMinimo }}</div>
        </div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><DollarOutlined /></div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Valor en stock (costo)</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.valorCosto) }}</div>
        </div>
      </a-card>
    </section>

    <!-- Filtros -->
    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-input-search
            v-model:value="filters.search"
            size="large" allow-clear
            placeholder="Buscar por código, descripción, EAN, marca…"
            @search="onBuscar"
          >
            <template #prefix><SearchOutlined /></template>
          </a-input-search>
        </div>
        <div class="filters-toolbar__right">
          <a-select v-model:value="filters.rubro" size="large" allow-clear
            placeholder="Rubro" style="width:160px"
            show-search option-filter-prop="label" @change="onBuscar">
            <a-select-option v-for="r in rubros" :key="r.id" :value="r.id" :label="r.nombre">
              {{ r.nombre }}
            </a-select-option>
          </a-select>

          <a-select v-model:value="filters.marca" size="large" allow-clear
            placeholder="Marca" style="width:150px"
            show-search option-filter-prop="label" @change="onBuscar">
            <a-select-option v-for="m in marcas" :key="m.id" :value="m.id" :label="m.nombre">
              {{ m.nombre }}
            </a-select-option>
          </a-select>

          <a-select v-model:value="filters.perfil" size="large" allow-clear
            placeholder="Perfil" style="width:150px" @change="onBuscar">
            <a-select-option value="CV">Compra/Venta</a-select-option>
            <a-select-option value="CO">Solo Compra</a-select-option>
            <a-select-option value="VE">Solo Venta</a-select-option>
          </a-select>

          <a-select v-model:value="filters.activo" size="large"
            style="width:140px" @change="onBuscar">
            <a-select-option value="">Todos</a-select-option>
            <a-select-option value="true">Solo activos</a-select-option>
            <a-select-option value="false">Solo inactivos</a-select-option>
          </a-select>

          <a-checkbox v-model:checked="filters.bajo_minimo" @change="onBuscar">
            <WarningOutlined style="color:#f59e0b;margin-right:4px" />
            Bajo mínimo
          </a-checkbox>

          <a-button size="large" @click="onReset">Limpiar</a-button>
        </div>
      </div>
    </a-card>

    <!-- Tabla -->
    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="tableColumns"
        :data-source="articulos"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `${t} artículos`,
          pageSizeOptions: ['10', '20', '50', '100'],
        }"
        :scroll="{ x: 1200 }"
        size="middle"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">

          <template v-if="column.key === 'cod_articulo'">
            <span class="cod-cell">{{ record.cod_articulo }}</span>
          </template>

          <template v-if="column.key === 'descripcion'">
            <div class="desc-cell">
              <a class="desc-link"
                @click="router.push({ name: 'articulo-detalle', params: { id: record.id } })">
                {{ record.descripcion }}
              </a>
              <span v-if="record.es_servicio" class="tag tag--service">Servicio</span>
              <span v-if="record.perfil && record.perfil !== 'CV'" class="tag tag--perfil">
                {{ PERFIL_LABELS[record.perfil] }}
              </span>
            </div>
          </template>

          <template v-if="column.key === 'stock_disponible'">
            <div class="stock-cell" :class="`stock-cell--${estadoStock(record)}`">
              <template v-if="record.administra_stock">
                <CheckCircleFilled  v-if="estadoStock(record) === 'ok'"    class="stock-icon" />
                <WarningOutlined    v-else-if="estadoStock(record) === 'warn'" class="stock-icon" />
                <MinusCircleFilled  v-else                                 class="stock-icon" />
                <span class="stock-qty">{{ parseFloat(record.stock_disponible ?? 0).toFixed(1) }}</span>
              </template>
              <span v-else class="tag tag--nostock">S/ctrl</span>
            </div>
          </template>

          <template v-if="column.key === 'precio_costo_monto'">
            <span class="price-cost">{{ formatMoneda(record.precio_costo_monto) }}</span>
          </template>

          <template v-if="column.key === 'precio_venta_monto'">
            <span class="price-sale">{{ formatMoneda(record.precio_venta_monto) }}</span>
          </template>

          <template v-if="column.key === 'utilidad'">
            <span class="util" :class="parseFloat(record.utilidad) > 30 ? 'util--high' : ''">
              {{ formatUtilidad(record.utilidad) }}
            </span>
          </template>

          <template v-if="column.key === 'esta_activo'">
            <a-badge
              :status="record.esta_activo ? 'success' : 'default'"
              :text="record.esta_activo ? 'Activo' : 'Inactivo'"
            />
          </template>

          <template v-if="column.key === 'actions'">
            <a-space>
              <a-tooltip title="Ver ficha">
                <a-button size="small"
                  @click="router.push({ name: 'articulo-detalle', params: { id: record.id } })">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="Editar">
                <a-button size="small"
                  @click="router.push({ name: 'articulo-editar', params: { id: record.id } })">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip :title="record.esta_activo ? 'Desactivar' : 'Activar'">
                <a-button size="small"
                  :danger="record.esta_activo"
                  @click="toggleActivo(record)">
                  <template #icon><PoweroffOutlined /></template>
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
.articulos-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }

.hero {
  display: flex; justify-content: space-between; gap: 16px; align-items: flex-start;
  padding: 20px 22px; border-radius: 6px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%),
    linear-gradient(135deg,
      color-mix(in srgb, var(--surface-1) 92%, transparent),
      color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0,0,0,.08);
}
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; line-height: 1.08; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); max-width: 820px; }

.kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.kpi-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display: flex; align-items: center; gap: 14px; }
.kpi-card__icon { width: 46px; height: 46px; border-radius: 6px; display: grid; place-items: center; font-size: 20px; }
.kpi-card__icon--blue  { background: color-mix(in srgb, rgba(var(--accent-rgb),1) 14%, transparent); color: rgba(var(--accent-rgb),1); }
.kpi-card__icon--green { background: color-mix(in srgb, #16a34a 14%, transparent); color: #16a34a; }
.kpi-card__icon--red   { background: color-mix(in srgb, #ef4444 14%, transparent); color: #dc2626; }
.kpi-card__icon--gold  { background: color-mix(in srgb, #f59e0b 14%, transparent); color: #d97706; }
.kpi-card__label { font-size: 12px; color: var(--text-2); }
.kpi-card__value { font-size: 24px; font-weight: 800; color: var(--text-0); }
.kpi-card__value--money { font-size: 18px; }

.filters-card, .table-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.filters-toolbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
.filters-toolbar__left  { flex: 1; min-width: 280px; }
.filters-toolbar__right { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* Tabla */
.cod-cell  { font-family: 'SFMono-Regular', monospace; font-size: 12px; color: var(--text-2); background: var(--surface-1,#f1f5f9); padding: 2px 6px; border-radius: 4px; }
.desc-cell { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.desc-link { font-weight: 600; color: rgba(var(--accent-rgb),1); cursor: pointer; }
.desc-link:hover { text-decoration: underline; }

.tag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: .04em; }
.tag--service { background: #e0f2fe; color: #0369a1; }
.tag--perfil  { background: #f3e8ff; color: #7c3aed; }
.tag--nostock { background: #f1f5f9; color: #94a3b8; }

.stock-cell { display: flex; align-items: center; justify-content: center; gap: 5px; font-weight: 600; font-size: 13px; }
.stock-cell--ok    .stock-icon { color: #22c55e; }
.stock-cell--ok    .stock-qty  { color: #15803d; }
.stock-cell--warn  .stock-icon { color: #f59e0b; }
.stock-cell--warn  .stock-qty  { color: #b45309; }
.stock-cell--empty .stock-icon { color: #ef4444; }
.stock-cell--empty .stock-qty  { color: #b91c1c; }

.price-cost { font-variant-numeric: tabular-nums; color: var(--text-2); }
.price-sale { font-variant-numeric: tabular-nums; font-weight: 600; color: var(--text-0); }
.util       { font-size: 12px; color: var(--text-2); }
.util--high { color: #15803d; font-weight: 700; }

.columns-menu { padding: 10px 0; min-width: 250px; background: var(--surface-0); }
.columns-menu__title { padding: 0 14px 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--text-2); }
.columns-menu__content { padding: 0 14px 8px; }
.columns-menu__content :deep(.ant-checkbox-group) { display: grid; gap: 10px; }

@media (max-width: 1200px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filters-toolbar { flex-direction: column; align-items: stretch; }
  .hero { flex-direction: column; }
}
@media (max-width: 768px) {
  .kpis { grid-template-columns: 1fr; }
  .hero { padding: 16px; }
  .hero__title { font-size: 24px; }
}
</style>
