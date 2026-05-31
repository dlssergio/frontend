<script setup>
/**
 * ComprobanteDetailView.vue — Vista completa de un comprobante de compra.
 *
 * Incluye:
 *  - Header con estado, tipo, número y acciones (Confirmar / Anular)
 *  - KPI strip: totales, saldo, stock, depósito
 *  - Trazabilidad: comprobante origen + comprobantes derivados
 *  - Tabla de ítems con cantidades y costos
 *  - Botones de acción para generar comprobante derivado:
 *      · Si es Orden de Compra → "Generar Remito de Ingreso"
 *      · Si es Remito → "Generar Factura"
 *      · (extensible según tipos configurados)
 */
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined, CheckOutlined, StopOutlined,
  FileTextOutlined, InboxOutlined, LinkOutlined,
  BranchesOutlined, PlusOutlined, CopyOutlined,
} from '@ant-design/icons-vue'
import { comprobantesCompraService } from '@/services/compras'

const router = useRouter()
const route  = useRoute()
const id     = route.params.id

const loading     = ref(false)
const comprobante = ref(null)
const actuando    = ref(false)

// ─── Carga ────────────────────────────────────────────────────
const cargar = async () => {
  loading.value = true
  try {
    const res = await comprobantesCompraService.obtener(id)
    comprobante.value = res.data
  } catch {
    message.error('No se pudo cargar el comprobante.')
    router.push({ name: 'compras-lista' })
  } finally {
    loading.value = false
  }
}

// ─── Acciones de estado ───────────────────────────────────────
const confirmar = () => {
  Modal.confirm({
    title:   '¿Confirmar este comprobante?',
    content: 'Una vez confirmado impacta en stock y cuenta corriente del proveedor.',
    okText: 'Confirmar', okType: 'primary', cancelText: 'Cancelar',
    async onOk() {
      actuando.value = true
      try {
        await comprobantesCompraService.confirmar(id)
        message.success('Comprobante confirmado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.error ?? 'No se pudo confirmar.')
      } finally { actuando.value = false }
    },
  })
}

const anular = () => {
  Modal.confirm({
    title:   '¿Anular este comprobante?',
    content: 'Esta acción revierte los movimientos de stock y cuenta corriente.',
    okText: 'Anular', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      actuando.value = true
      try {
        await comprobantesCompraService.anular(id)
        message.success('Comprobante anulado.')
        cargar()
      } catch (e) {
        message.error(e.response?.data?.error ?? 'No se pudo anular.')
      } finally { actuando.value = false }
    },
  })
}

// ─── Generar comprobante derivado ─────────────────────────────
/**
 * Navega al formulario del tipo de comprobante correspondiente
 * pasando ?origen=id para que se pre-cargue con los datos de este.
 */
const generarRemito = () => {
  router.push({ name: 'compra-remito-nuevo', query: { origen: id } })
}

const generarOrdenCompra = () => {
  router.push({ name: 'compra-orden-nueva', query: { origen: id } })
}

const generarFactura = () => {
  router.push({ name: 'compra-factura-nueva', query: { origen: id } })
}

// ─── Lógica de qué acciones de derivado mostrar ───────────────
const tipoComp = computed(() => comprobante.value?.tipo_comprobante)

// Orden de Compra: mueve_stock=true, afecta_stock_fisico=false → genera Remito
const esOrdenCompra = computed(() =>
  tipoComp.value?.mueve_stock && !tipoComp.value?.afecta_stock_fisico
)

// Remito de ingreso: mueve_stock=true, afecta_stock_fisico=true → puede generar Factura
const esRemito = computed(() =>
  tipoComp.value?.mueve_stock && tipoComp.value?.afecta_stock_fisico
)

// Comprobante que mueve cta cte (factura real)
const esFactura = computed(() => tipoComp.value?.mueve_cta_cte)

// Solo puede derivar si está confirmado y no tiene derivados del mismo tipo
const yaTieneRemito = computed(() =>
  (comprobante.value?.comprobantes_derivados ?? []).some(d =>
    d.tipo_nombre?.toLowerCase().includes('remito')
  )
)
const yaTieneFactura = computed(() =>
  (comprobante.value?.comprobantes_derivados ?? []).some(d =>
    d.tipo_nombre?.toLowerCase().includes('factura')
  )
)

// ─── Tabla de ítems ───────────────────────────────────────────
const colsItems = [
  { title: 'Código',      key: 'cod',         width: 110 },
  { title: 'Descripción', key: 'desc',         ellipsis: true },
  { title: 'Cantidad',    dataIndex: 'cantidad',     width: 100, align: 'right' },
  { title: 'Costo Unit.', dataIndex: 'costo_unitario', width: 130, align: 'right' },
  { title: 'Subtotal',    dataIndex: 'subtotal',     width: 140, align: 'right' },
]

// ─── Helpers ──────────────────────────────────────────────────
const fmtM     = (v) =>
  `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)}`
const fmtFecha  = (v) => v ? new Date(v).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const fmtFechaS = (v) => v ? new Date(v).toLocaleDateString('es-AR') : '—'

const ESTADO_COLOR = { BR: 'default', CN: 'success', AN: 'error' }
const ESTADO_LABEL = { BR: 'Borrador', CN: 'Confirmado', AN: 'Anulado' }

onMounted(cargar)
</script>

<template>
  <div class="detail-root">

    <a-skeleton v-if="loading" active :paragraph="{ rows: 10 }" style="padding:24px" />

    <template v-else-if="comprobante">

      <!-- ── Header ── -->
      <div class="detail-header">
        <div class="header-left">
          <a-button type="text" size="small" @click="router.push({ name: 'compras-lista' })">
            <ArrowLeftOutlined /> Comprobantes
          </a-button>
          <div class="title-block">
            <div class="title-row">
              <FileTextOutlined class="title-icon" />
              <h1 class="detail-title">
                {{ comprobante.tipo_comprobante?.nombre }}
                <span v-if="comprobante.letra"> {{ comprobante.letra }}</span>
                {{ comprobante.numero_completo }}
              </h1>
              <a-tag :color="ESTADO_COLOR[comprobante.estado]" style="font-size:12px">
                {{ ESTADO_LABEL[comprobante.estado] ?? comprobante.estado_display }}
              </a-tag>
            </div>
            <div class="title-meta">
              <a class="meta-link"
                @click="router.push({ name: 'proveedor-detalle', params: { id: comprobante.proveedor?.id } })">
                {{ comprobante.proveedor?.razon_social }}
              </a>
              <span class="sep">·</span>
              <span>{{ fmtFecha(comprobante.fecha) }}</span>
              <span class="sep">·</span>
              <span>{{ comprobante.condicion_display }}</span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <!-- Acciones de estado -->
          <a-button v-if="comprobante.estado === 'BR'" type="primary"
            :loading="actuando" @click="confirmar">
            <CheckOutlined /> Confirmar
          </a-button>
          <a-button v-if="comprobante.estado !== 'AN'" danger
            :loading="actuando" @click="anular">
            <StopOutlined /> Anular
          </a-button>

          <!-- Acciones de derivar — solo si está confirmado -->
          <template v-if="comprobante.estado === 'CN'">
            <a-tooltip v-if="esOrdenCompra && !yaTieneRemito"
              title="Generar Remito de Ingreso a partir de esta Orden de Compra">
              <a-button @click="generarRemito">
                <InboxOutlined /> Generar Remito
              </a-button>
            </a-tooltip>
            <a-tooltip v-if="esRemito && !yaTieneFactura"
              title="Generar Factura a partir de este Remito">
              <a-button @click="generarFactura">
                <FileTextOutlined /> Generar Factura
              </a-button>
            </a-tooltip>
            <a-tooltip v-if="esFactura"
              title="Crear una nueva Orden de Compra basada en este comprobante">
              <a-button @click="generarOrdenCompra">
                <CopyOutlined /> Nueva OC basada en esta
              </a-button>
            </a-tooltip>
          </template>
        </div>
      </div>

      <!-- ── KPI Strip ── -->
      <div class="kpi-strip">
        <div class="kpi">
          <span class="kpi-label">Subtotal</span>
          <span class="kpi-value">{{ fmtM(comprobante.subtotal) }}</span>
        </div>
        <div class="kpi kpi--featured">
          <span class="kpi-label">Total</span>
          <span class="kpi-value kpi-value--blue">{{ fmtM(comprobante.total) }}</span>
        </div>
        <div class="kpi" :class="parseFloat(comprobante.saldo_pendiente) > 0 ? 'kpi--debt' : ''">
          <span class="kpi-label">Saldo Pendiente</span>
          <span class="kpi-value" :class="parseFloat(comprobante.saldo_pendiente) > 0 ? 'kpi-value--red' : 'kpi-value--ok'">
            {{ fmtM(comprobante.saldo_pendiente) }}
          </span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Stock Aplicado</span>
          <span class="kpi-value kpi-value--sm">
            <a-badge
              :status="comprobante.stock_aplicado ? 'success' : 'default'"
              :text="comprobante.stock_aplicado ? 'Sí' : 'No'"
            />
          </span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Depósito</span>
          <span class="kpi-value kpi-value--sm">{{ comprobante.deposito_nombre || 'Principal' }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Artículos</span>
          <span class="kpi-value">{{ comprobante.items?.length ?? 0 }}</span>
        </div>
      </div>

      <!-- ── Trazabilidad ── -->
      <div v-if="comprobante.comprobante_origen || comprobante.comprobantes_derivados?.length"
        class="trazabilidad-section">
        <div class="traza-title"><BranchesOutlined style="margin-right:6px" />Trazabilidad</div>

        <!-- Origen -->
        <div v-if="comprobante.comprobante_origen" class="traza-row">
          <span class="traza-label">Generado desde:</span>
          <a class="traza-link"
            @click="router.push({ name: 'compra-detalle', params: { id: comprobante.comprobante_origen.id } })">
            <LinkOutlined style="margin-right:4px" />
            {{ comprobante.comprobante_origen.tipo_nombre }}
            {{ comprobante.comprobante_origen.numero_completo }}
            <a-tag :color="ESTADO_COLOR[comprobante.comprobante_origen.estado]" style="font-size:10px;margin-left:6px">
              {{ ESTADO_LABEL[comprobante.comprobante_origen.estado] }}
            </a-tag>
          </a>
        </div>

        <!-- Derivados -->
        <div v-if="comprobante.comprobantes_derivados?.length" class="traza-row">
          <span class="traza-label">Generó:</span>
          <div class="traza-chips">
            <a v-for="d in comprobante.comprobantes_derivados" :key="d.id"
              class="traza-chip"
              @click="router.push({ name: 'compra-detalle', params: { id: d.id } })">
              {{ d.tipo_nombre }} {{ d.numero_completo }}
              <a-tag :color="ESTADO_COLOR[d.estado]" style="font-size:10px;margin-left:4px">
                {{ ESTADO_LABEL[d.estado] }}
              </a-tag>
            </a>
          </div>
        </div>
      </div>

      <!-- ── Ítems ── -->
      <div class="items-section">
        <div class="items-header">
          <span class="items-title">
            <InboxOutlined style="margin-right:6px" />
            Artículos ({{ comprobante.items?.length ?? 0 }})
          </span>
        </div>

        <a-table
          :columns="colsItems"
          :data-source="comprobante.items"
          :pagination="false"
          row-key="id"
          size="small"
          class="items-table"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'cod'">
              <a class="art-link"
                @click="router.push({ name: 'articulo-detalle', params: { id: record.articulo?.id } })">
                {{ record.articulo?.cod_articulo }}
              </a>
            </template>
            <template v-if="column.key === 'desc'">
              <span>{{ record.articulo?.descripcion }}</span>
            </template>
            <template v-if="column.dataIndex === 'cantidad'">
              <span class="num-cell">{{ parseFloat(record.cantidad || 0).toFixed(3) }}</span>
            </template>
            <template v-if="column.dataIndex === 'costo_unitario'">
              <span class="num-cell">{{ fmtM(record.costo_unitario) }}</span>
            </template>
            <template v-if="column.dataIndex === 'subtotal'">
              <span class="num-cell num-cell--strong">{{ fmtM(record.subtotal) }}</span>
            </template>
          </template>

          <template #summary>
            <a-table-summary fixed>
              <a-table-summary-row class="summary-row">
                <a-table-summary-cell :index="0" :col-span="4" align="right">
                  <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-2)">
                    TOTAL
                  </strong>
                </a-table-summary-cell>
                <a-table-summary-cell :index="4" align="right">
                  <strong class="total-cell">{{ fmtM(comprobante.total) }}</strong>
                </a-table-summary-cell>
              </a-table-summary-row>
            </a-table-summary>
          </template>
        </a-table>
      </div>

    </template>

    <!-- Empty state si falla la carga -->
    <template v-else-if="!loading">
      <div style="padding:48px;text-align:center">
        <a-empty description="No se pudo cargar el comprobante" />
        <a-button type="primary" style="margin-top:16px"
          @click="router.push({ name: 'compras-lista' })">
          Volver a comprobantes
        </a-button>
      </div>
    </template>

  </div>
</template>

<style scoped>
.detail-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }

/* Header */
.detail-header { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); gap:12px; flex-wrap:wrap; }
.header-left   { display:flex; flex-direction:column; gap:8px; }
.header-actions{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.title-block   { display:flex; flex-direction:column; gap:4px; }
.title-row     { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.title-icon    { font-size:20px; color:rgba(var(--accent-rgb,99,102,241),1); }
.detail-title  { margin:0; font-size:20px; font-weight:800; color:var(--text-0); }
.title-meta    { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-2); flex-wrap:wrap; }
.meta-link     { color:rgba(var(--accent-rgb,99,102,241),1); cursor:pointer; font-weight:600; }
.meta-link:hover { text-decoration:underline; }
.sep           { color:var(--border,#cbd5e1); }

/* KPI Strip */
.kpi-strip { display:flex; border-bottom:1px solid var(--border,#f0f0f0); overflow-x:auto; flex-shrink:0; }
.kpi       { display:flex; flex-direction:column; gap:3px; padding:14px 20px; border-right:1px solid var(--border); min-width:120px; }
.kpi--featured { background:color-mix(in srgb,rgba(var(--accent-rgb,99,102,241),1) 4%,var(--surface-0,#fff)); }
.kpi--debt     { background:#fff5f5; }
.kpi-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-2); }
.kpi-value { font-size:18px; font-weight:800; color:var(--text-0); font-variant-numeric:tabular-nums; }
.kpi-value--blue { color:rgba(var(--accent-rgb,99,102,241),1); }
.kpi-value--red  { color:#b91c1c; }
.kpi-value--ok   { color:#15803d; }
.kpi-value--sm   { font-size:13px; }

/* Trazabilidad */
.trazabilidad-section { padding:12px 20px; border-bottom:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); display:flex; flex-direction:column; gap:8px; }
.traza-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2); }
.traza-row   { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.traza-label { font-size:12px; font-weight:600; color:var(--text-2); white-space:nowrap; }
.traza-link  { font-size:13px; font-weight:600; color:rgba(var(--accent-rgb,99,102,241),1); cursor:pointer; display:flex; align-items:center; }
.traza-link:hover { text-decoration:underline; }
.traza-chips { display:flex; gap:8px; flex-wrap:wrap; }
.traza-chip  { font-size:12px; font-weight:600; color:rgba(var(--accent-rgb,99,102,241),1); cursor:pointer; display:flex; align-items:center; padding:4px 10px; border:1px solid color-mix(in srgb,rgba(var(--accent-rgb,99,102,241),1) 30%,transparent); border-radius:6px; background:color-mix(in srgb,rgba(var(--accent-rgb,99,102,241),1) 6%,transparent); }
.traza-chip:hover { background:color-mix(in srgb,rgba(var(--accent-rgb,99,102,241),1) 12%,transparent); }

/* Ítems */
.items-section { display:flex; flex-direction:column; flex:1; }
.items-header  { display:flex; align-items:center; padding:12px 20px; border-bottom:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); }
.items-title   { font-size:13px; font-weight:700; color:var(--text-0); }
.items-table :deep(.ant-table-thead > tr > th) { background:var(--surface-1,#f8fafc); font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-2); }
.art-link      { color:rgba(var(--accent-rgb,99,102,241),1); cursor:pointer; font-family:monospace; font-size:12px; font-weight:700; }
.art-link:hover { text-decoration:underline; }
.num-cell      { font-variant-numeric:tabular-nums; font-size:13px; color:var(--text-0); }
.num-cell--strong { font-weight:700; }
.summary-row :deep(td) { background:var(--surface-1,#f1f5f9)!important; }
.total-cell    { color:rgba(var(--accent-rgb,99,102,241),1); font-variant-numeric:tabular-nums; font-size:15px; font-weight:800; }
</style>
