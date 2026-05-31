<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  StopOutlined,
  SettingOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  BankOutlined,
} from '@ant-design/icons-vue'
import { fetchClientes, deactivateCliente } from '@/services/clientes'

const router = useRouter()

const STORAGE_KEY = 'clientes-lista-columnas-v1'

const loading = ref(false)
const rows = ref([])
const total = ref(0)

const pagination = reactive({
  current: 1,
  pageSize: 20,
})

const filters = reactive({
  search: '',
  estado: '',
  categoria: '',
  permite_cta_cte: undefined,
})

const allColumns = [
  { key: 'codigo_cliente', title: 'Código', dataIndex: 'codigo_cliente', width: 120, defaultVisible: true },
  { key: 'razon_social', title: 'Razón Social', dataIndex: 'razon_social', width: 280, defaultVisible: true },
  { key: 'nombre_fantasia', title: 'Nombre Fantasía', dataIndex: 'nombre_fantasia', width: 220, defaultVisible: true },
  { key: 'cuit', title: 'CUIT', dataIndex: 'cuit', width: 150, defaultVisible: true },
  { key: 'categoria_label', title: 'Categoría', dataIndex: 'categoria_label', width: 140, defaultVisible: true },
  { key: 'zona', title: 'Zona', dataIndex: 'zona', width: 140, defaultVisible: true },
  { key: 'vendedor_label', title: 'Vendedor', dataIndex: 'vendedor_label', width: 180, defaultVisible: false },
  { key: 'price_list_label', title: 'Lista de Precios', dataIndex: 'price_list_label', width: 180, defaultVisible: false },
  { key: 'permite_cta_cte', title: 'Cta. Cte.', dataIndex: 'permite_cta_cte', width: 110, defaultVisible: true },
  { key: 'limite_credito', title: 'Límite Crédito', dataIndex: 'limite_credito', width: 150, defaultVisible: true },
  { key: 'saldo', title: 'Saldo', dataIndex: 'saldo', width: 150, defaultVisible: true },
  { key: 'esta_activo', title: 'Estado', dataIndex: 'esta_activo', width: 120, defaultVisible: true },
  { key: 'contacto_nombre', title: 'Contacto', dataIndex: 'contacto_nombre', width: 180, defaultVisible: false },
  { key: 'contacto_email', title: 'Email Comercial', dataIndex: 'contacto_email', width: 220, defaultVisible: false },
  { key: 'contacto_telefono', title: 'Teléfono', dataIndex: 'contacto_telefono', width: 160, defaultVisible: false },
]

const visibleColumnKeys = ref(loadVisibleColumns())

function loadVisibleColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch (_) {}
  return allColumns.filter((c) => c.defaultVisible).map((c) => c.key)
}

function persistVisibleColumns() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumnKeys.value))
}

watch(visibleColumnKeys, persistVisibleColumns, { deep: true })

const tableColumns = computed(() => {
  const selected = allColumns.filter((col) => visibleColumnKeys.value.includes(col.key))
  return [
    ...selected,
    {
      title: 'Acciones',
      key: 'acciones',
      width: 220,
      fixed: 'right',
    },
  ]
})

const columnOptions = computed(() =>
  allColumns.map((col) => ({
    label: col.title,
    value: col.key,
  }))
)

const summary = computed(() => {
  const list = rows.value || []
  const activos = list.filter((x) => x.esta_activo).length
  const inactivos = list.filter((x) => !x.esta_activo).length
  const conCtaCte = list.filter((x) => x.permite_cta_cte).length
  const saldoTotal = list.reduce((acc, item) => acc + Number(item.saldo || 0), 0)

  return { activos, inactivos, conCtaCte, saldoTotal }
})

function money(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

async function load() {
  loading.value = true
  try {
    const params = {
      limit: pagination.pageSize,
      offset: (pagination.current - 1) * pagination.pageSize,
    }

    if (filters.search) params.search = filters.search
    if (filters.estado) params.estado = filters.estado
    if (filters.categoria) params.categoria = filters.categoria
    if (filters.permite_cta_cte !== undefined) params.permite_cta_cte = filters.permite_cta_cte

    const { data } = await fetchClientes(params)
    rows.value = data?.results ?? data ?? []
    total.value = data?.count ?? rows.value.length
  } catch (e) {
    console.error(e)
    message.error('No se pudieron cargar los clientes')
  } finally {
    loading.value = false
  }
}

function onTableChange(pag) {
  pagination.current = pag.current || 1
  pagination.pageSize = pag.pageSize || 20
  load()
}

function onBuscar() {
  pagination.current = 1
  load()
}

function onResetFilters() {
  filters.search = ''
  filters.estado = ''
  filters.categoria = ''
  filters.permite_cta_cte = undefined
  pagination.current = 1
  load()
}

function onNuevo() {
  router.push({ name: 'cliente-crear' })
}

function onEditar(id) {
  router.push({ name: 'cliente-editar', params: { id } })
}

function onDetalle(id) {
  router.push({ name: 'cliente-detalle', params: { id } })
}

function onDesactivar(id) {
  Modal.confirm({
    title: 'Desactivar cliente',
    content: 'El cliente quedará inactivo y seguirá disponible para consulta histórica.',
    okText: 'Desactivar',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await deactivateCliente(id)
        message.success('Cliente desactivado')
        load()
      } catch (e) {
        console.error(e)
        message.error('No se pudo desactivar el cliente')
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="clientes-page">
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Customer Master · ERP Enterprise</div>
        <h1 class="hero__title">Clientes</h1>
        <p class="hero__subtitle">
          Administración comercial y fiscal de clientes, con foco en operación real, consulta rápida y escalabilidad.
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
                  <a-checkbox-group
                    v-model:value="visibleColumnKeys"
                    :options="columnOptions"
                  />
                </div>
              </a-menu>
            </template>
          </a-dropdown>

          <a-button size="large" @click="load">
            <template #icon><ReloadOutlined /></template>
            Actualizar
          </a-button>

          <a-button type="primary" size="large" @click="onNuevo">
            <template #icon><PlusOutlined /></template>
            Nuevo cliente
          </a-button>
        </a-space>
      </div>
    </section>

    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue">
          <TeamOutlined />
        </div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Clientes activos</div>
          <div class="kpi-card__value">{{ summary.activos }}</div>
        </div>
      </a-card>

      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green">
          <CheckCircleOutlined />
        </div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Con cuenta corriente</div>
          <div class="kpi-card__value">{{ summary.conCtaCte }}</div>
        </div>
      </a-card>

      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--red">
          <CloseCircleOutlined />
        </div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Inactivos</div>
          <div class="kpi-card__value">{{ summary.inactivos }}</div>
        </div>
      </a-card>

      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold">
          <DollarOutlined />
        </div>
        <div class="kpi-card__content">
          <div class="kpi-card__label">Saldo total visible</div>
          <div class="kpi-card__value kpi-card__value--money">{{ money(summary.saldoTotal) }}</div>
        </div>
      </a-card>
    </section>

    <a-card class="filters-card" :bordered="false">
      <div class="filters-toolbar">
        <div class="filters-toolbar__left">
          <a-input-search
            v-model:value="filters.search"
            size="large"
            allow-clear
            placeholder="Buscar por código, razón social, CUIT, nombre fantasía"
            @search="onBuscar"
          >
            <template #prefix>
              <SearchOutlined />
            </template>
          </a-input-search>
        </div>

        <div class="filters-toolbar__right">
          <a-select
            v-model:value="filters.estado"
            size="large"
            allow-clear
            placeholder="Estado"
            style="width: 160px"
            @change="onBuscar"
          >
            <a-select-option value="activos">Activos</a-select-option>
            <a-select-option value="inactivos">Inactivos</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.categoria"
            size="large"
            allow-clear
            placeholder="Categoría"
            style="width: 170px"
            @change="onBuscar"
          >
            <a-select-option value="MIN">Minorista</a-select-option>
            <a-select-option value="MAY">Mayorista</a-select-option>
            <a-select-option value="VIP">VIP / Premium</a-select-option>
            <a-select-option value="GOB">Gobierno</a-select-option>
            <a-select-option value="EXP">Exportación</a-select-option>
          </a-select>

          <a-select
            v-model:value="filters.permite_cta_cte"
            size="large"
            allow-clear
            placeholder="Cuenta corriente"
            style="width: 180px"
            @change="onBuscar"
          >
            <a-select-option :value="true">Con cuenta corriente</a-select-option>
            <a-select-option :value="false">Solo contado</a-select-option>
          </a-select>

          <a-button size="large" @click="onResetFilters">
            Limpiar
          </a-button>
        </div>
      </div>
    </a-card>

    <a-card class="table-card" :bordered="false">
      <a-table
        :columns="tableColumns"
        :data-source="rows"
        :loading="loading"
        :pagination="{ current: pagination.current, pageSize: pagination.pageSize, total }"
        row-key="id"
        :scroll="{ x: 1600 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'razon_social'">
            <div class="main-cell">
              <div class="main-cell__title">{{ record.razon_social || '-' }}</div>
              <div class="main-cell__subtitle" v-if="record.nombre_fantasia">
                {{ record.nombre_fantasia }}
              </div>
            </div>
          </template>

          <template v-else-if="column.dataIndex === 'categoria_label'">
            <a-tag color="blue">{{ record.categoria_label || record.categoria || '-' }}</a-tag>
          </template>

          <template v-else-if="column.dataIndex === 'permite_cta_cte'">
            <a-tag :color="record.permite_cta_cte ? 'blue' : 'default'">
              {{ record.permite_cta_cte ? 'Sí' : 'No' }}
            </a-tag>
          </template>

          <template v-else-if="column.dataIndex === 'limite_credito'">
            {{ money(record.limite_credito) }}
          </template>

          <template v-else-if="column.dataIndex === 'saldo'">
            <span class="saldo-cell">
              <BankOutlined />
              {{ money(record.saldo) }}
            </span>
          </template>

          <template v-else-if="column.dataIndex === 'esta_activo'">
            <a-badge
              :status="record.esta_activo ? 'success' : 'default'"
              :text="record.esta_activo ? 'Activo' : 'Inactivo'"
            />
          </template>

          <template v-else-if="column.key === 'acciones'">
            <a-space>
              <a-tooltip title="Ver detalle">
                <a-button size="small" @click="onDetalle(record.id)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="Editar">
                <a-button size="small" @click="onEditar(record.id)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="Desactivar">
                <a-button size="small" danger @click="onDesactivar(record.id)">
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
.clientes-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-0);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding: 20px 22px;
  border-radius: 6px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 30%),
    linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.hero__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-2);
  margin-bottom: 8px;
}

.hero__title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.08;
  color: var(--text-0);
}

.hero__subtitle {
  margin: 10px 0 0;
  color: var(--text-1);
  max-width: 820px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.kpi-card {
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  background: var(--surface-0);
}

.kpi-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  gap: 14px;
}

.kpi-card__icon {
  width: 46px;
  height: 46px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 20px;
}

.kpi-card__icon--blue {
  background: color-mix(in srgb, rgba(var(--accent-rgb), 1) 14%, transparent);
  color: rgba(var(--accent-rgb), 1);
}

.kpi-card__icon--green {
  background: color-mix(in srgb, #16a34a 14%, transparent);
  color: #16a34a;
}

.kpi-card__icon--red {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #dc2626;
}

.kpi-card__icon--gold {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: #d97706;
}

.kpi-card__label {
  font-size: 12px;
  color: var(--text-2);
}

.kpi-card__value {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-0);
}

.kpi-card__value--money {
  font-size: 18px;
}

.filters-card,
.table-card {
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  background: var(--surface-0);
}

.filters-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.filters-toolbar__left {
  flex: 1;
  min-width: 280px;
}

.filters-toolbar__right {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.main-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-cell__title {
  font-weight: 700;
  color: var(--text-0);
}

.main-cell__subtitle {
  font-size: 12px;
  color: var(--text-2);
}

.saldo-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.columns-menu {
  padding: 10px 0;
  min-width: 280px;
  background: var(--surface-0);
}

.columns-menu__title {
  padding: 0 14px 10px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-2);
}

.columns-menu__content {
  padding: 0 14px 8px;
}

.columns-menu__content :deep(.ant-checkbox-group) {
  display: grid;
  gap: 10px;
}

@media (max-width: 1200px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filters-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-toolbar__right {
    width: 100%;
  }

  .hero {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .kpis {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 16px;
  }

  .hero__title {
    font-size: 24px;
  }
}
</style>
