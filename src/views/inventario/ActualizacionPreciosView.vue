<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  ThunderboltOutlined, EyeOutlined, CheckOutlined,
  WarningOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { rubrosService, marcasService } from '@/services/inventario'

const loading    = ref(false)
const applying   = ref(false)
const previewed  = ref(false)
const resultado  = ref([])
const totalAfect = ref(0)

const rubros  = ref([])
const marcas  = ref([])

// ─── Configuración del ajuste ──────────────────────────────
const config = reactive({
  tipo_ajuste:      'porcentaje',   // 'porcentaje' | 'monto_fijo'
  valor:            10,
  campo:            'venta',        // 'costo' | 'venta' | 'ambos'
  recalcular_venta: true,
  filtros: {
    rubro_id:     null,
    marca_id:     null,
    articulo_ids: [],
    solo_activos: true,
  },
})

// ─── Columnas de preview ───────────────────────────────────
const columns = [
  { title: 'Código',        dataIndex: 'cod_articulo',   width: 110, fixed: 'left' },
  { title: 'Descripción',   dataIndex: 'descripcion',    ellipsis: true },
  { title: 'Rubro',         dataIndex: 'rubro',          width: 130, ellipsis: true },
  { title: 'Costo antes',   dataIndex: 'costo_antes',    width: 120, align: 'right' },
  { title: 'Costo nuevo',   dataIndex: 'costo_nuevo',    width: 120, align: 'right' },
  { title: 'Venta antes',   dataIndex: 'venta_antes',    width: 120, align: 'right' },
  { title: 'Venta nueva',   dataIndex: 'venta_nuevo',    width: 120, align: 'right' },
  { title: 'Diferencia',    dataIndex: 'diferencia_venta',width: 110, align: 'right' },
]

// ─── Estadísticas del preview ──────────────────────────────
const statsPreview = computed(() => {
  if (!resultado.value.length) return null
  let subas = 0, bajas = 0, sinCambio = 0
  for (const r of resultado.value) {
    const d = parseFloat(r.diferencia_venta) || 0
    if (d > 0) subas++
    else if (d < 0) bajas++
    else sinCambio++
  }
  return { subas, bajas, sinCambio }
})

// ─── Preview ───────────────────────────────────────────────
const hacerPreview = async () => {
  if (!config.valor) { message.error('Ingresá un valor de ajuste.'); return }
  loading.value   = true
  previewed.value = false
  try {
    const res = await api.post('/api/inventario/actualizar-precios/preview/', {
      tipo_ajuste:      config.tipo_ajuste,
      valor:            config.valor,
      campo:            config.campo,
      recalcular_venta: config.recalcular_venta,
      filtros:          config.filtros,
    })
    resultado.value  = res.data.articulos ?? []
    totalAfect.value = res.data.total_afectados ?? 0
    previewed.value  = true
    if (totalAfect.value === 0) {
      message.warning('No hay artículos que coincidan con los filtros seleccionados.')
    }
  } catch (e) {
    message.error(e.response?.data?.error ?? 'Error al calcular preview.')
  } finally {
    loading.value = false
  }
}

// ─── Aplicar ───────────────────────────────────────────────
const aplicar = () => {
  Modal.confirm({
    title:   `¿Aplicar el ajuste a ${totalAfect.value} artículos?`,
    content: 'Esta acción modificará los precios de forma permanente. No se puede deshacer automáticamente.',
    okText:  'Aplicar precios',
    okType:  'primary',
    cancelText: 'Cancelar',
    async onOk() {
      applying.value = true
      try {
        const idsDelPreview = resultado.value.map(r => r.id)
        await api.post('/api/inventario/actualizar-precios/aplicar/', {
          tipo_ajuste:      config.tipo_ajuste,
          valor:            config.valor,
          campo:            config.campo,
          recalcular_venta: config.recalcular_venta,
          filtros: {
            ...config.filtros,
            articulo_ids: idsDelPreview,
            solo_activos: false,
          },
        })
        message.success(`Precios actualizados. ${totalAfect.value} artículos modificados.`)

        // Recargar los precios reales desde la base de datos usando el
        // endpoint dedicado que devuelve los valores actuales sin simular nada.
        const resReal = await api.post('/api/inventario/actualizar-precios/precios_actuales/', {
          articulo_ids: idsDelPreview,
        })
        resultado.value  = resReal.data.articulos ?? []
        totalAfect.value = resReal.data.total ?? 0
        previewed.value  = true

      } catch (e) {
        message.error(e.response?.data?.error ?? 'Error al aplicar los precios.')
      } finally {
        applying.value = false
      }
    },
  })
}

const fmtMoneda = (v) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)

const diffColor = (v) => {
  const n = parseFloat(v) || 0
  return n > 0 ? '#15803d' : n < 0 ? '#b91c1c' : '#94a3b8'
}

const diffPrefix = (v) => {
  const n = parseFloat(v) || 0
  return n > 0 ? '+' : ''
}

onMounted(async () => {
  const [rR, mR] = await Promise.allSettled([rubrosService.listar(), marcasService.listar()])
  if (rR.status === 'fulfilled') rubros.value = rR.value.data.results ?? rR.value.data
  if (mR.status === 'fulfilled') marcas.value = mR.value.data.results ?? mR.value.data
})
</script>

<template>
  <div class="page-root">

    <div class="page-header">
      <h1 class="page-title">Actualización Masiva de Precios</h1>
    </div>

    <!-- Configuración del ajuste -->
    <div class="config-panel">
      <div class="config-grid">

        <div class="config-section">
          <h3 class="section-title">Tipo de Ajuste</h3>
          <div class="field-group">
            <div class="field">
              <label class="field-label">Método</label>
              <a-radio-group v-model:value="config.tipo_ajuste" button-style="solid">
                <a-radio-button value="porcentaje">% Porcentaje</a-radio-button>
                <a-radio-button value="monto_fijo">$ Monto fijo</a-radio-button>
              </a-radio-group>
            </div>
            <div class="field">
              <label class="field-label">
                Valor
                <span class="field-hint">(negativo = reducción)</span>
              </label>
              <a-input-number
                v-model:value="config.valor"
                style="width:160px"
                :precision="2"
                :addon-after="config.tipo_ajuste === 'porcentaje' ? '%' : '$'"
              />
            </div>
            <div class="field">
              <label class="field-label">Afecta</label>
              <a-radio-group v-model:value="config.campo" button-style="solid">
                <a-radio-button value="venta">Precio Venta</a-radio-button>
                <a-radio-button value="costo">Precio Costo</a-radio-button>
                <a-radio-button value="ambos">Ambos</a-radio-button>
              </a-radio-group>
            </div>
            <div class="field" v-if="config.campo === 'costo'">
              <a-checkbox v-model:checked="config.recalcular_venta">
                Recalcular precio de venta desde utilidad existente
              </a-checkbox>
            </div>
          </div>
        </div>

        <div class="config-section">
          <h3 class="section-title">Filtros de Artículos</h3>
          <div class="field-group">
            <div class="field">
              <label class="field-label">Rubro</label>
              <a-select
                v-model:value="config.filtros.rubro_id"
                allow-clear
                placeholder="Todos los rubros"
                style="width:100%"
                show-search
                option-filter-prop="label"
              >
                <a-select-option
                  v-for="r in rubros"
                  :key="r.id"
                  :value="r.id"
                  :label="r.nombre"
                >{{ r.nombre }}</a-select-option>
              </a-select>
            </div>
            <div class="field">
              <label class="field-label">Marca</label>
              <a-select
                v-model:value="config.filtros.marca_id"
                allow-clear
                placeholder="Todas las marcas"
                style="width:100%"
                show-search
                option-filter-prop="label"
              >
                <a-select-option
                  v-for="m in marcas"
                  :key="m.id"
                  :value="m.id"
                  :label="m.nombre"
                >{{ m.nombre }}</a-select-option>
              </a-select>
            </div>
            <div class="field">
              <a-checkbox v-model:checked="config.filtros.solo_activos">
                Solo artículos activos
              </a-checkbox>
            </div>
          </div>
        </div>

      </div>

      <!-- Acciones -->
      <div class="config-actions">
        <a-alert
          v-if="!config.valor"
          message="Ingresá un valor de ajuste para continuar."
          type="warning"
          show-icon
          :banner="false"
          style="flex:1"
        />
        <a-button
          size="large"
          :loading="loading"
          :disabled="!config.valor"
          @click="hacerPreview"
        >
          <EyeOutlined /> Ver Preview
        </a-button>
        <a-button
          type="primary"
          size="large"
          :loading="applying"
          :disabled="!previewed || totalAfect === 0"
          @click="aplicar"
        >
          <ThunderboltOutlined /> Aplicar a {{ totalAfect }} artículos
        </a-button>
      </div>
    </div>

    <!-- Preview results -->
    <template v-if="previewed && resultado.length > 0">

      <!-- Stats del preview -->
      <div class="preview-stats" v-if="statsPreview">
        <div class="pstat pstat--up">
          <ArrowUpOutlined />
          <span class="pstat-num">{{ statsPreview.subas }}</span>
          <span class="pstat-label">suben</span>
        </div>
        <div class="pstat pstat--down" v-if="statsPreview.bajas > 0">
          <ArrowDownOutlined />
          <span class="pstat-num">{{ statsPreview.bajas }}</span>
          <span class="pstat-label">bajan</span>
        </div>
        <div class="pstat pstat--neutral" v-if="statsPreview.sinCambio > 0">
          <span class="pstat-num">{{ statsPreview.sinCambio }}</span>
          <span class="pstat-label">sin cambio</span>
        </div>
        <a-alert
          message="Revisá los cambios antes de aplicar. Una vez aplicados, los precios se modifican en el sistema."
          type="warning"
          show-icon
          style="flex:1"
        />
      </div>

      <!-- Tabla de preview -->
      <a-table
        :columns="columns"
        :data-source="resultado"
        row-key="id"
        :pagination="{ pageSize: 50, showSizeChanger: true, showTotal: t => `${t} artículos` }"
        size="small"
        class="preview-table"
        bordered
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">

          <template v-if="column.dataIndex === 'costo_antes'">
            <span class="price-cell price-cell--muted">$ {{ fmtMoneda(record.costo_antes) }}</span>
          </template>
          <template v-if="column.dataIndex === 'costo_nuevo'">
            <span
              class="price-cell"
              :class="parseFloat(record.costo_nuevo) !== parseFloat(record.costo_antes) ? 'price-cell--changed' : ''"
            >
              $ {{ fmtMoneda(record.costo_nuevo) }}
            </span>
          </template>

          <template v-if="column.dataIndex === 'venta_antes'">
            <span class="price-cell price-cell--muted">$ {{ fmtMoneda(record.venta_antes) }}</span>
          </template>
          <template v-if="column.dataIndex === 'venta_nuevo'">
            <span
              class="price-cell"
              :class="parseFloat(record.venta_nuevo) !== parseFloat(record.venta_antes) ? 'price-cell--changed' : ''"
            >
              $ {{ fmtMoneda(record.venta_nuevo) }}
            </span>
          </template>

          <template v-if="column.dataIndex === 'diferencia_venta'">
            <span
              class="diff-cell"
              :style="{ color: diffColor(record.diferencia_venta) }"
            >
              {{ diffPrefix(record.diferencia_venta) }}$ {{ fmtMoneda(Math.abs(parseFloat(record.diferencia_venta))) }}
            </span>
          </template>

        </template>
      </a-table>

    </template>

    <a-empty
      v-else-if="previewed && resultado.length === 0"
      description="No hay artículos que coincidan con los filtros seleccionados."
      style="padding: 40px"
    />

  </div>
</template>

<style scoped>
.page-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }

.page-header { padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); }
.page-title  { margin:0; font-size:18px; font-weight:700; color:var(--text-0); }

/* Config panel */
.config-panel { padding:24px; border-bottom:1px solid var(--border,#f0f0f0); display:flex; flex-direction:column; gap:20px; }
.config-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:24px; }
.config-section { display:flex; flex-direction:column; gap:16px; background:var(--surface-1,#f8fafc); border-radius:var(--radius-md,8px); padding:18px; }
.section-title { margin:0; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-2); padding-bottom:10px; border-bottom:1px solid var(--border,#e2e8f0); }
.field-group { display:flex; flex-direction:column; gap:14px; }
.field { display:flex; flex-direction:column; gap:5px; }
.field-label { font-size:12px; font-weight:600; color:var(--text-1); }
.field-hint  { font-size:11px; font-weight:400; color:var(--text-2); margin-left:4px; }

.config-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }

/* Preview stats */
.preview-stats { display:flex; align-items:center; gap:12px; padding:14px 20px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border,#f0f0f0); flex-wrap:wrap; }
.pstat { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; }
.pstat--up      { background:#dcfce7; color:#15803d; }
.pstat--down    { background:#fee2e2; color:#b91c1c; }
.pstat--neutral { background:#f1f5f9; color:#64748b; }
.pstat-num   { font-size:16px; font-weight:800; }
.pstat-label { font-size:11px; }

/* Table */
.preview-table :deep(.ant-table-thead > tr > th) { background:var(--surface-1,#f8fafc); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-1); }
.price-cell         { font-variant-numeric:tabular-nums; font-size:12px; color:var(--text-1); }
.price-cell--muted  { color:var(--text-2); }
.price-cell--changed{ font-weight:700; color:var(--primary,#1e40af); }
.diff-cell { font-weight:700; font-variant-numeric:tabular-nums; font-size:12px; }
</style>
