<script setup>
/**
 * RemitoCreate.vue — Remito de Ingreso de Proveedor
 * Layout fijo tipo POS. Sin axios hardcodeado.
 * Soporta comprobante_origen para vincular con Orden de Compra previa.
 */
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined, SaveOutlined, PlusOutlined,
  DeleteOutlined, SearchOutlined, AppstoreOutlined,
  BarcodeOutlined, InboxOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { proveedoresService, comprobantesCompraService } from '@/services/compras'
import ProveedorSearchModal from '@/components/compras/ProveedorSearchModal.vue'
import ArticuloComprasModal from '@/components/compras/ArticuloComprasModal.vue'

const router = useRouter()
const route  = useRoute()

// Soporte para "comprobante a partir de otro" via query ?origen=id
const origenId = route.query.origen ?? null

const posRootEl    = ref(null)
const gridTableWrapEl = ref(null)
const tableScrollY = ref(300)
let layoutRaf = 0, layoutObs = null

const measureLayout = () => {
  if (!posRootEl.value) return
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0
    try {
      const rect = posRootEl.value.getBoundingClientRect()
      posRootEl.value.style.setProperty('--remito-h',
        `${Math.max(500, Math.floor(window.innerHeight - rect.top - 8))}px`)
      const w = gridTableWrapEl.value?.getBoundingClientRect()
      if (w) tableScrollY.value = Math.max(200, Math.floor(w.height - 48 - 6))
    } catch { /* ignore */ }
  })
}
onMounted(() => {
  measureLayout()
  layoutObs = new ResizeObserver(measureLayout)
  if (posRootEl.value) layoutObs.observe(posRootEl.value)
  window.addEventListener('resize', measureLayout)
  cargarAuxiliares()
  if (origenId) cargarOrigenComprobante()
})
onUnmounted(() => {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  layoutObs?.disconnect()
  window.removeEventListener('resize', measureLayout)
})

// ─── Modales ─────────────────────────────────────────────────
const modalProv = ref(false)
const modalArt  = ref(false)

// ─── Proveedor ────────────────────────────────────────────────
const proveedorId     = ref(null)
const proveedorNombre = ref('')
const proveedorCuit   = ref('')
const provBuscando    = ref(false)
const provOpts        = ref([])
let provTimer = null
const onBuscarProv = (txt) => {
  if (!txt || txt.length < 3) { provOpts.value = []; return }
  clearTimeout(provTimer)
  provTimer = setTimeout(async () => {
    provBuscando.value = true
    try {
      const res = await proveedoresService.listar({ search: txt, page_size: 20 })
      provOpts.value = (res.data.results ?? res.data).map(p => ({
        value: p.id, label: p.razon_social, cuit: p.cuit ?? '',
      }))
    } finally { provBuscando.value = false }
  }, 300)
}
const onSelectProv = (val, opt) => {
  proveedorId.value = val; proveedorNombre.value = opt.label ?? ''
  proveedorCuit.value = opt.cuit ?? ''; items.value = [crearFila()]
}
const onProvModal = (r) => {
  proveedorId.value = r.id; proveedorNombre.value = r.razon_social
  proveedorCuit.value = r.cuit ?? ''; items.value = [crearFila()]
}

// ─── Comprobante origen (ej: Orden de Compra) ────────────────
const origenInfo = ref(null)
const cargarOrigenComprobante = async () => {
  try {
    const res = await comprobantesCompraService.obtener(origenId)
    origenInfo.value = res.data
    // Pre-cargar proveedor
    const p = res.data.proveedor
    if (p) {
      proveedorId.value = p.id
      proveedorNombre.value = p.razon_social
      proveedorCuit.value = p.cuit ?? ''
    }
    // Pre-cargar ítems de la OC
    if (res.data.items?.length) {
      items.value = res.data.items.map(i => ({
        key: Date.now() + Math.random(),
        articuloId:  i.articulo.id,
        busqueda:    i.articulo.cod_articulo,
        descripcion: i.articulo.descripcion,
        cantidad:    parseFloat(i.cantidad),
        costo:       parseFloat(i.costo_unitario || 0),
      }))
    }
  } catch { message.warning('No se pudo cargar el comprobante origen.') }
}

// ─── Formulario ───────────────────────────────────────────────
const form = reactive({
  tipo_comprobante: null,
  deposito:         null,
  condicion_compra: 'CC',
  punto_venta:      1,
  numero:           '',
  fecha:            new Date().toISOString().slice(0, 10),
})
const tiposComp  = ref([])
const depositos  = ref([])
const loading    = ref(false)
const submitting = ref(false)

// ─── Ítems ────────────────────────────────────────────────────
const items = ref([crearFila()])
const activeSearchRowKey = ref(null)
const productOptions     = ref([])

const columns = [
  { title: '#',          key: 'idx',         width: 44,  align: 'center' },
  { title: 'Cód/Búsqueda', dataIndex: 'search', width: 240 },
  { title: 'Descripción',  dataIndex: 'descripcion', ellipsis: true },
  { title: 'Cant.',        dataIndex: 'cantidad',    width: 95,  align: 'right' },
  { title: 'Costo',        dataIndex: 'costo',       width: 140, align: 'right' },
  { title: 'Subtotal',     dataIndex: 'subtotal',    width: 130, align: 'right' },
  { title: '',             key: 'del',               width: 46,  align: 'center' },
]

function crearFila() {
  return { key: Date.now() + Math.random(), articuloId: null, busqueda: '', descripcion: '', cantidad: 1, costo: 0 }
}

const subtotal = computed(() =>
  items.value.reduce((a, i) => a + Number(i.cantidad) * Number(i.costo), 0))
const fmtM = (v) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)

let artTimer = null
const onSearchProduct = async (txt) => {
  if (!txt || txt.length < 2) { productOptions.value = []; return }
  clearTimeout(artTimer)
  artTimer = setTimeout(async () => {
    try {
      const params = { search: txt, page_size: 15 }
      if (proveedorId.value) params.proveedor = proveedorId.value
      const res = await api.get('/api/articulos/', { params })
      productOptions.value = (res.data.results ?? res.data).map(a => ({
        value: a.cod_articulo, label: `${a.cod_articulo} — ${a.descripcion}`, fullData: a,
      }))
    } catch { productOptions.value = [] }
  }, 250)
}

const onSelectProduct = (val, opt, idx) => {
  const fila = items.value[idx]
  if (!fila || !opt?.fullData) return
  const a = opt.fullData
  fila.articuloId = a.id; fila.busqueda = a.cod_articulo
  fila.descripcion = a.descripcion; fila.costo = parseFloat(a.precio_costo_monto) || 0
  productOptions.value = []; activeSearchRowKey.value = null
  if (idx === items.value.length - 1) nextTick(() => items.value.push(crearFila()))
}

const onAddItems = ({ items: nuevos, close }) => {
  items.value = items.value.filter(f => f.articuloId)
  for (const n of nuevos) {
    const existe = items.value.find(f => f.articuloId === n.articuloId)
    if (existe) { existe.cantidad += n.cantidad }
    else items.value.push({ key: Date.now() + Math.random(), articuloId: n.articuloId,
      busqueda: n.codigo, descripcion: n.descripcion, cantidad: n.cantidad, costo: n.costo })
  }
  if (!items.value.length) items.value = [crearFila()]
  if (close) modalArt.value = false
}

const agregarFila  = () => items.value.push(crearFila())
const eliminarFila = (i) => {
  if (items.value.length === 1) { message.warning('Debe haber al menos una línea'); return }
  items.value.splice(i, 1)
}

// ─── Auxiliares ───────────────────────────────────────────────
const cargarAuxiliares = async () => {
  loading.value = true
  try {
    const [tR, dR] = await Promise.allSettled([
      api.get('/api/tipos-comprobante/'),
      api.get('/api/inventario/depositos/'),
    ])
    if (tR.status === 'fulfilled') {
      tiposComp.value = (tR.value.data.results ?? tR.value.data)
        .filter(t => t.clase === 'C' && (t.mueve_stock || t.nombre.toLowerCase().includes('remito')))
        .map(t => ({ value: t.id, label: t.nombre }))
      if (tiposComp.value.length) form.tipo_comprobante = tiposComp.value[0].value
    }
    if (dR.status === 'fulfilled') depositos.value = dR.value.data.results ?? dR.value.data
  } finally { loading.value = false }
}

// ─── Guardar ──────────────────────────────────────────────────
const guardar = async (confirmar = false) => {
  if (!proveedorId.value)       { message.error('Seleccioná un proveedor.'); return }
  if (!form.tipo_comprobante)   { message.error('Seleccioná el tipo de comprobante.'); return }
  const validas = items.value.filter(i => i.articuloId && i.cantidad > 0)
  if (!validas.length)          { message.error('Agregá al menos un artículo.'); return }

  submitting.value = true
  try {
    const payload = {
      proveedor:          proveedorId.value,
      tipo_comprobante:   form.tipo_comprobante,
      deposito:           form.deposito || null,
      condicion_compra:   form.condicion_compra,
      punto_venta:        Number(form.punto_venta) || 1,
      numero:             parseInt(form.numero) || 0,
      fecha:              form.fecha,
      estado:             'BR',
      comprobante_origen: origenId ? parseInt(origenId) : null,
      items:              validas.map(i => ({ articulo: i.articuloId, cantidad: i.cantidad, costo_unitario: i.costo })),
    }
    const res = await comprobantesCompraService.crear(payload)
    if (confirmar && res.data.id) {
      await comprobantesCompraService.confirmar(res.data.id)
      message.success('Remito confirmado — stock actualizado.')
    } else {
      message.success('Remito guardado como borrador.')
    }
    router.push({ name: 'compras-lista' })
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
      : 'No se pudo guardar.')
  } finally { submitting.value = false }
}
</script>

<template>
  <div ref="posRootEl" class="remito-root">
    <ProveedorSearchModal v-model:open="modalProv" @select="onProvModal" />
    <ArticuloComprasModal v-model:open="modalArt" :proveedor-id="proveedorId" @add-items="onAddItems" />

    <div class="remito-body">
      <!-- Panel izquierdo fijo -->
      <section class="left-panel">
        <div class="panel-header">
          <a-button type="text" size="small" @click="router.push({ name: 'compras-lista' })">
            <ArrowLeftOutlined /> Volver
          </a-button>
          <span class="panel-title"><InboxOutlined style="margin-right:6px" />Nuevo Remito Ingreso</span>
        </div>

        <!-- Origen (si viene de OC) -->
        <div v-if="origenInfo" class="panel-block origen-badge">
          <div class="section-label">Generado desde</div>
          <div class="origen-info">
            <span class="origen-tipo">{{ origenInfo.tipo_comprobante?.nombre }}</span>
            <span class="origen-num">{{ origenInfo.numero_completo }}</span>
          </div>
        </div>

        <!-- Proveedor -->
        <div class="panel-block">
          <div class="section-label">Proveedor</div>
          <div class="prov-row">
            <a-select v-model:value="proveedorId" show-search :filter-option="false"
              placeholder="Buscar (mín. 3 letras)…" :loading="provBuscando" style="flex:1"
              @search="onBuscarProv" @select="onSelectProv">
              <a-select-option v-for="p in provOpts" :key="p.value" :value="p.value" :label="p.label" :cuit="p.cuit">
                <div class="prov-opt-name">{{ p.label }}</div>
                <div class="prov-opt-cuit">{{ p.cuit }}</div>
              </a-select-option>
            </a-select>
            <a-tooltip title="Búsqueda avanzada"><a-button @click="modalProv = true"><SearchOutlined /></a-button></a-tooltip>
          </div>
          <div v-if="proveedorId" class="prov-badge">
            <span class="prov-badge-name">{{ proveedorNombre }}</span>
            <span v-if="proveedorCuit" class="prov-badge-cuit">{{ proveedorCuit }}</span>
          </div>
        </div>

        <!-- Datos comprobante -->
        <div class="panel-block">
          <div class="section-label">Datos del Remito</div>
          <div class="form-stack">
            <div class="form-field">
              <label>Tipo</label>
              <a-select v-model:value="form.tipo_comprobante" style="width:100%">
                <a-select-option v-for="t in tiposComp" :key="t.value" :value="t.value">{{ t.label }}</a-select-option>
              </a-select>
            </div>
            <div class="form-row">
              <div class="form-field"><label>Pto. Venta</label><a-input-number v-model:value="form.punto_venta" :min="1" style="width:100%" /></div>
              <div class="form-field"><label>Número</label><a-input v-model:value="form.numero" placeholder="00000001" /></div>
            </div>
            <div class="form-field"><label>Fecha</label><a-input type="date" v-model:value="form.fecha" style="width:100%" /></div>
            <div class="form-field">
              <label>Depósito Destino</label>
              <a-select v-model:value="form.deposito" allow-clear style="width:100%" placeholder="Principal">
                <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
              </a-select>
            </div>
          </div>
        </div>

        <div class="panel-total"><span class="total-lbl">TOTAL</span><span class="total-val">$ {{ fmtM(subtotal) }}</span></div>
        <div class="panel-actions">
          <a-button block @click="router.push({ name: 'compras-lista' })">Cancelar</a-button>
          <a-button block :loading="submitting" @click="guardar(false)"><SaveOutlined /> Guardar borrador</a-button>
          <a-button block type="primary" :loading="submitting" @click="guardar(true)"><SaveOutlined /> Confirmar</a-button>
        </div>
      </section>

      <!-- Panel derecho — tabla ítems -->
      <section class="right-panel">
        <div class="grid-topbar">
          <a-button class="search-articles-btn" @click="modalArt = true"><AppstoreOutlined /> Búsqueda avanzada</a-button>
          <a-button size="small" @click="agregarFila"><PlusOutlined /> Fila</a-button>
          <span class="grid-hint">{{ items.filter(i => i.articuloId).length }} artículo(s)</span>
        </div>
        <div ref="gridTableWrapEl" class="grid-table-wrap">
          <a-table :columns="columns" :data-source="items" :pagination="false"
            row-key="key" size="middle" :scroll="{ y: tableScrollY }">
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'idx'"><span class="row-idx">{{ index + 1 }}</span></template>
              <template v-if="column.dataIndex === 'search'">
                <a-auto-complete v-model:value="record.busqueda"
                  :options="activeSearchRowKey === record.key ? productOptions : []"
                  :disabled="!proveedorId" style="width:100%" :bordered="false"
                  :default-active-first-option="false"
                  :get-popup-container="() => posRootEl || document.body"
                  @search="(v) => { activeSearchRowKey = record.key; onSearchProduct(v) }"
                  @focus="() => { activeSearchRowKey = record.key }"
                  @select="(val, opt) => onSelectProduct(val, opt, index)">
                  <a-input :placeholder="proveedorId ? 'Código o nombre…' : 'Seleccioná proveedor primero'">
                    <template #prefix><BarcodeOutlined /></template>
                  </a-input>
                  <template #option="{ fullData }">
                    <div class="prod-opt"><span class="prod-desc">{{ fullData.descripcion }}</span><span class="prod-cod">{{ fullData.cod_articulo }}</span></div>
                  </template>
                </a-auto-complete>
              </template>
              <template v-if="column.dataIndex === 'descripcion'"><span class="desc-cell">{{ record.descripcion || '—' }}</span></template>
              <template v-if="column.dataIndex === 'cantidad'">
                <a-input-number v-model:value="record.cantidad" :min="0.001" :precision="3" :bordered="false" style="width:85px" />
              </template>
              <template v-if="column.dataIndex === 'costo'">
                <a-input-number v-model:value="record.costo" :min="0" :precision="4" :bordered="false" addon-before="$" style="width:120px" />
              </template>
              <template v-if="column.dataIndex === 'subtotal'">
                <span class="subtotal-cell">$ {{ fmtM(record.cantidad * record.costo) }}</span>
              </template>
              <template v-if="column.key === 'del'">
                <a-button type="text" danger size="small" @click="eliminarFila(index)"><DeleteOutlined /></a-button>
              </template>
            </template>
            <template #summary>
              <a-table-summary fixed>
                <a-table-summary-row>
                  <a-table-summary-cell :index="0" :col-span="5" align="right">
                    <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-2)">TOTAL</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="5" align="right">
                    <strong style="font-size:15px;color:rgba(var(--accent-rgb,99,102,241),1);font-variant-numeric:tabular-nums">$ {{ fmtM(subtotal) }}</strong>
                  </a-table-summary-cell>
                  <a-table-summary-cell :index="6" />
                </a-table-summary-row>
              </a-table-summary>
            </template>
          </a-table>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.remito-root { --remito-h:100vh; height:var(--remito-h); min-height:var(--remito-h); overflow:hidden; background:var(--surface-0,transparent); }
.remito-body { display:flex; gap:14px; padding:14px; height:100%; overflow:hidden; min-height:0; }
.left-panel  { width:300px; flex-shrink:0; display:flex; flex-direction:column; overflow-y:auto; background:var(--surface-0,#fff); border-radius:8px; border:1px solid color-mix(in srgb,var(--text-2,#94a3b8) 20%,transparent); box-shadow:0 2px 12px rgba(0,0,0,.07); }
.right-panel { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden; background:var(--surface-0,#fff); border-radius:8px; border:1px solid color-mix(in srgb,var(--text-2,#94a3b8) 20%,transparent); box-shadow:0 2px 12px rgba(0,0,0,.07); }
.panel-header { display:flex; flex-direction:column; gap:4px; padding:12px 16px 10px; border-bottom:1px solid var(--border,#f0f0f0); flex-shrink:0; }
.panel-title { font-size:14px; font-weight:700; color:var(--text-0); }
.panel-block { padding:12px 16px; border-bottom:1px solid var(--border,#f0f0f0); }
.section-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-2); margin-bottom:8px; display:block; }
.origen-badge { background:color-mix(in srgb,rgba(var(--accent-rgb,99,102,241),1) 8%,var(--surface-0,#fff)); }
.origen-info  { display:flex; gap:8px; align-items:center; }
.origen-tipo  { font-size:11px; color:var(--text-2); }
.origen-num   { font-family:monospace; font-size:13px; font-weight:700; color:rgba(var(--accent-rgb,99,102,241),1); }
.prov-row { display:flex; gap:6px; }
.prov-opt-name { font-size:13px; font-weight:600; color:var(--text-0); }
.prov-opt-cuit { font-size:11px; color:var(--text-2); }
.prov-badge { margin-top:8px; padding:8px 10px; background:var(--surface-1,#f8fafc); border-radius:7px; border:1px solid var(--border); }
.prov-badge-name { display:block; font-size:13px; font-weight:700; color:var(--text-0); }
.prov-badge-cuit { font-size:11px; color:var(--text-2); }
.form-stack { display:flex; flex-direction:column; gap:10px; }
.form-field { display:flex; flex-direction:column; gap:3px; }
.form-field label { font-size:11px; font-weight:600; color:var(--text-2); }
.form-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.panel-total { display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border,#f0f0f0); flex-shrink:0; }
.total-lbl { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2); }
.total-val { font-size:22px; font-weight:800; color:rgba(var(--accent-rgb,99,102,241),1); font-variant-numeric:tabular-nums; }
.panel-actions { padding:12px 16px; display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
.grid-topbar { display:flex; align-items:center; gap:10px; padding:10px 14px; flex-shrink:0; border-bottom:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); }
.search-articles-btn { font-weight:600; border-color:rgba(var(--accent-rgb,99,102,241),.4); color:rgba(var(--accent-rgb,99,102,241),1); }
.grid-hint { font-size:12px; color:var(--text-2); margin-left:auto; }
.grid-table-wrap { flex:1; overflow:hidden; min-height:0; }
:deep(.ant-table-thead > tr > th) { background:var(--surface-1,#f8fafc)!important; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--text-2); }
:deep(.ant-table-summary tr td) { background:var(--surface-1,#f1f5f9)!important; }
.row-idx { font-size:11px; color:var(--text-2); font-weight:600; }
.desc-cell { font-size:12px; color:var(--text-1); }
.subtotal-cell { font-variant-numeric:tabular-nums; font-weight:700; font-size:13px; }
.prod-opt { display:flex; flex-direction:column; gap:2px; }
.prod-desc { font-size:13px; font-weight:600; color:var(--text-0); }
.prod-cod  { font-family:monospace; font-size:11px; color:var(--text-2); }
</style>
