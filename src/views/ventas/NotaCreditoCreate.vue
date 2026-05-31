<script setup>
/**
 * NotaCreditoCreate.vue — Nota de Crédito / Débito
 * Diseño profesional. Vincula con comprobante origen, selector de concepto.
 */
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  FileTextOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  FilePdfOutlined,
  LinkOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'

const router = useRouter()
const route  = useRoute()

const loading          = ref(false)
const cargandoClientes = ref(false)
const cargandoTipos    = ref(false)
const cargandoOrigen   = ref(false)
const guardadoId       = ref(null)
const guardadoNumero   = ref('')
const showSuccess      = ref(false)

const CONCEPTOS = [
  {
    value: 'DEV',
    label: 'Devolución de mercadería',
    icon: '↩',
    color: '#f59e0b',
    desc: 'El cliente devuelve artículos. Revierte el stock.',
  },
  {
    value: 'FIN',
    label: 'Ajuste financiero',
    icon: '%',
    color: '#1677ff',
    desc: 'Descuento, bonificación o corrección de precio. No mueve stock.',
  },
  {
    value: 'ANU',
    label: 'Anulación de operación',
    icon: '✕',
    color: '#ef4444',
    desc: 'Anula completamente la factura original. Revierte el stock.',
  },
]

const formState = reactive({
  clienteId:         null,
  tipoComprobanteId: null,
  fecha:             dayjs(),
  condicionPago:     'CO',
  observaciones:     '',
  descuentoGlobal:   0,
  puntoVenta:        1,
  conceptoNC:        'FIN',
  origenNumero:      '',
  origenId:          null,
})

const items         = ref([newRow()])
const clientes      = ref([])
const tipos         = ref([])
const origenDetalle = ref(null)

const origenIdParam = computed(() => route.query.origen_id ? Number(route.query.origen_id) : null)

function newRow() {
  return {
    key:         Date.now() + Math.random(),
    articuloPk:  null,
    codigo:      '',
    descripcion: '',
    cantidad:    1,
    precio:      0,
    descuento:   0,
    opciones:    [],
    buscando:    false,
  }
}

const clienteInfo = computed(() => clientes.value.find(c => c.value === formState.clienteId) ?? null)
const validItems  = computed(() => items.value.filter(r => r.articuloPk))
const conceptoActual = computed(() => CONCEPTOS.find(c => c.value === formState.conceptoNC))

const totales = computed(() => {
  let subtotal = 0
  for (const r of validItems.value)
    subtotal += Number(r.precio || 0) * Number(r.cantidad || 0) * (1 - Number(r.descuento || 0) / 100)
  const descGlobal = subtotal * (Number(formState.descuentoGlobal || 0) / 100)
  return { subtotal, descGlobal, total: subtotal - descGlobal }
})

const canSave = computed(() =>
  formState.clienteId && formState.tipoComprobanteId &&
  validItems.value.length > 0 && formState.conceptoNC
)

const money = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ── Data loading ──────────────────────────────────────────────────────────
const searchClientes = async (txt) => {
  if ((txt || '').trim().length < 2) return
  cargandoClientes.value = true
  try {
    const { data } = await api.get('/api/clientes/', { params: { search: txt.trim() } })
    clientes.value = (data?.results ?? data ?? []).map(c => ({
      value:           c.id,
      label:           c.entidad?.razon_social ?? `Cliente #${c.id}`,
      cuit:            c.entidad?.cuit ?? '',
      permite_cta_cte: c.permite_cta_cte ?? false,
    }))
  } catch { message.error('No se pudieron buscar clientes') }
  finally { cargandoClientes.value = false }
}

const fetchTipos = async () => {
  cargandoTipos.value = true
  try {
    const { data } = await api.get('/api/tipos-comprobante/')
    const lista = data?.results ?? data ?? []
    tipos.value = lista
      .filter(t => t.clase === 'V' && (
        t.nombre.toLowerCase().includes('nota de cr') ||
        t.nombre.toLowerCase().includes('nota de d') ||
        t.nombre.toLowerCase().includes('n/c') ||
        t.nombre.toLowerCase().includes('n/d')
      ))
      .map(t => ({ value: t.id, label: t.nombre }))
    if (tipos.value.length && !formState.tipoComprobanteId)
      formState.tipoComprobanteId = tipos.value[0].value
  } catch { message.error('No se pudieron cargar los tipos') }
  finally { cargandoTipos.value = false }
}

// ── Comprobante origen ────────────────────────────────────────────────────
const buscarOrigen = async () => {
  const q = (formState.origenNumero || '').trim()
  if (!q) return
  cargandoOrigen.value = true
  try {
    const { data } = await api.get('/api/comprobantes-venta/', {
      params: { search: q, estado: 'CN', limit: 5 }
    })
    const lista = data?.results ?? data ?? []
    if (lista.length >= 1) await aplicarOrigen(lista[0])
    else message.warning('No se encontró el comprobante')
  } catch { message.error('Error buscando comprobante') }
  finally { cargandoOrigen.value = false }
}

const aplicarOrigen = async (comp) => {
  origenDetalle.value   = comp
  formState.origenId    = comp.id
  formState.origenNumero = comp.numero_completo || ''

  if (comp.cliente?.id) {
    const ent = comp.cliente.entidad ?? {}
    formState.clienteId = comp.cliente.id
    clientes.value = [{
      value:           comp.cliente.id,
      label:           ent.razon_social ?? `Cliente #${comp.cliente.id}`,
      cuit:            ent.cuit ?? '',
      permite_cta_cte: comp.cliente.permite_cta_cte ?? false,
    }]
  }

  if (comp.items?.length) {
    items.value = [
      ...comp.items
        .filter(i => i.articulo?.id)
        .map(i => ({
          key:         Date.now() + Math.random(),
          articuloPk:  i.articulo.id,
          codigo:      i.articulo.cod_articulo || '',
          descripcion: i.articulo.descripcion  || '',
          cantidad:    Number(i.cantidad || 1),
          precio:      Number(i.precio_unitario_original || 0),
          descuento:   Number(i.descuento_pct || 0),
          opciones:    [], buscando: false,
        })),
      newRow(),
    ]
  }
  message.success('Comprobante origen cargado')
}

const cargarOrigenPorId = async (id) => {
  cargandoOrigen.value = true
  try {
    const { data } = await api.get(`/api/comprobantes-venta/${id}/`)
    await aplicarOrigen(data)
  } catch {} finally { cargandoOrigen.value = false }
}

// ── Artículos ─────────────────────────────────────────────────────────────
const searchArticulos = async (row, txt) => {
  if ((txt || '').trim().length < 2) return
  row.buscando = true
  try {
    const { data } = await api.get('/api/articulos/', { params: { search: txt.trim(), limit: 15 } })
    row.opciones = (data?.results ?? data ?? []).map(a => ({
      value: a.cod_articulo, label: `${a.cod_articulo} — ${a.descripcion}`,
      pk: a.id, descripcion: a.descripcion, precio: Number(a.precio_venta_monto || 0),
    }))
  } catch {} finally { row.buscando = false }
}

const selectArticulo = (row, value) => {
  const opt = row.opciones.find(o => o.value === value)
  if (!opt) return
  Object.assign(row, { articuloPk: opt.pk, codigo: opt.value, descripcion: opt.descripcion, precio: opt.precio })
  if (items.value[items.value.length - 1] === row) items.value.push(newRow())
}

const removeRow = (row) => {
  if (items.value.length === 1) { items.value = [newRow()]; return }
  items.value = items.value.filter(r => r.key !== row.key)
}

// ── Guardar ───────────────────────────────────────────────────────────────
const guardar = async (confirmar = false) => {
  if (!canSave.value) return
  loading.value = true
  try {
    const payload = {
      cliente:               formState.clienteId,
      tipo_comprobante:      formState.tipoComprobanteId,
      fecha:                 dayjs(formState.fecha).format('YYYY-MM-DD'),
      estado:                confirmar ? 'CN' : 'BR',
      punto_venta:           formState.puntoVenta,
      condicion_venta:       formState.condicionPago === 'CTA_CTE' ? 'CC' : 'CO',
      descuento_global_pct:  Number(formState.descuentoGlobal || 0),
      observaciones:         formState.observaciones || '',
      concepto_nota_credito: formState.conceptoNC,
      items: validItems.value.map(r => ({
        articulo:                 r.articuloPk,
        cantidad:                 Number(r.cantidad),
        precio_unitario_original: Number(r.precio),
        descuento_pct:            Number(r.descuento || 0),
      })),
      pagos: [],
    }
    const { data } = await api.post('/api/comprobantes-venta/', payload)

    if (formState.origenId && data.id) {
      try {
        await api.patch(`/api/comprobantes-venta/${data.id}/`, {
          comprobantes_asociados_ids: [formState.origenId],
        })
      } catch {}
    }

    guardadoId.value     = data.id
    guardadoNumero.value = data.numero_completo || ''
    showSuccess.value    = true
    message.success(`Nota guardada: ${guardadoNumero.value}`)
  } catch (e) {
    message.error(e?.response?.data?.error || e?.response?.data?.detail || 'Error al guardar')
  } finally {
    loading.value = false
  }
}

const verPdf = async () => {
  if (!guardadoId.value) return
  try {
    const res = await api.get(`/api/comprobantes-venta/${guardadoId.value}/pdf/`, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch { message.error('No se pudo generar el PDF') }
}

onMounted(async () => {
  await fetchTipos()
  if (origenIdParam.value) await cargarOrigenPorId(origenIdParam.value)
})
</script>

<template>
  <div class="nc-root">

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <div class="nc-header">
      <button class="back-btn" @click="router.back()">
        <ArrowLeftOutlined /> Volver
      </button>
      <div class="nc-header-center">
        <div class="nc-doc-badge">
          <FileTextOutlined />
          <span>NOTA DE CRÉDITO / DÉBITO</span>
        </div>
        <div v-if="conceptoActual" class="concepto-chip" :style="{ background: conceptoActual.color + '18', color: conceptoActual.color, borderColor: conceptoActual.color + '40' }">
          {{ conceptoActual.icon }} {{ conceptoActual.label }}
        </div>
      </div>
      <div class="nc-header-right">
        <a-button :loading="loading" :disabled="!canSave" @click="guardar(false)">
          <SaveOutlined /> Borrador
        </a-button>
        <a-button type="primary" danger :loading="loading" :disabled="!canSave" @click="guardar(true)">
          <CheckCircleOutlined /> Confirmar
        </a-button>
      </div>
    </div>

    <div class="nc-body">
      <div class="nc-main">

        <!-- Comprobante origen -->
        <div class="card">
          <div class="card-title"><LinkOutlined /> Comprobante origen</div>
          <div class="origen-search">
            <a-input
              v-model:value="formState.origenNumero"
              placeholder="Número del comprobante original (ej: B 00001-00000123)…"
              size="large"
              style="flex:1"
              @press-enter="buscarOrigen"
            />
            <a-button size="large" :loading="cargandoOrigen" @click="buscarOrigen">
              <SearchOutlined /> Buscar y cargar
            </a-button>
          </div>
          <div v-if="origenDetalle" class="origen-loaded">
            <div class="origen-loaded-icon"><CheckCircleOutlined /></div>
            <div class="origen-loaded-info">
              <span class="origen-numero">{{ origenDetalle.numero_completo }}</span>
              <span class="origen-sub">
                {{ origenDetalle.fecha ? dayjs(origenDetalle.fecha).format('DD/MM/YYYY') : '' }}
                · Total: $ {{ money(origenDetalle.total) }}
              </span>
            </div>
            <a-tag color="success">Vinculado</a-tag>
          </div>
          <p class="card-hint">
            Al cargar el comprobante origen, el cliente y los artículos se pre-completan automáticamente.
            La nota quedará vinculada al comprobante original.
          </p>
        </div>

        <!-- Concepto -->
        <div class="card">
          <div class="card-title"><WarningOutlined /> Concepto de la nota *</div>
          <div class="concepto-grid">
            <div
              v-for="c in CONCEPTOS"
              :key="c.value"
              class="concepto-card"
              :class="{ 'concepto-card--active': formState.conceptoNC === c.value }"
              :style="formState.conceptoNC === c.value
                ? { borderColor: c.color, background: c.color + '0d' }
                : {}"
              @click="formState.conceptoNC = c.value"
            >
              <div class="concepto-icon" :style="{ color: c.color }">{{ c.icon }}</div>
              <div class="concepto-info">
                <div class="concepto-name">{{ c.label }}</div>
                <div class="concepto-desc">{{ c.desc }}</div>
              </div>
              <div v-if="formState.conceptoNC === c.value" class="concepto-check" :style="{ color: c.color }">✓</div>
            </div>
          </div>
        </div>

        <!-- Datos -->
        <div class="card">
          <div class="card-title"><UserOutlined /> Datos del comprobante</div>
          <div class="fields-2">
            <div class="field">
              <label>Cliente *</label>
              <a-select
                v-model:value="formState.clienteId"
                show-search :filter-option="false"
                :loading="cargandoClientes"
                placeholder="Escribí nombre o CUIT…"
                size="large" style="width:100%"
                @search="searchClientes"
              >
                <a-select-option v-for="c in clientes" :key="c.value" :value="c.value">
                  <div class="cli-opt-name">{{ c.label }}</div>
                  <div class="cli-opt-cuit">{{ c.cuit }}</div>
                </a-select-option>
              </a-select>
            </div>
            <div class="field">
              <label>Tipo *</label>
              <a-select v-model:value="formState.tipoComprobanteId" :loading="cargandoTipos" :options="tipos" size="large" style="width:100%" placeholder="Nota de Crédito / Débito…" />
            </div>
            <div class="field">
              <label>Fecha</label>
              <a-date-picker v-model:value="formState.fecha" format="DD/MM/YYYY" size="large" style="width:100%" />
            </div>
            <div class="field">
              <label>Condición</label>
              <a-radio-group v-model:value="formState.condicionPago" button-style="solid" size="large">
                <a-radio-button value="CO">Contado</a-radio-button>
                <a-radio-button value="CTA_CTE" :disabled="!clienteInfo?.permite_cta_cte">Cta. Cte.</a-radio-button>
              </a-radio-group>
            </div>
            <div class="field field--full">
              <label>Motivo / observaciones</label>
              <a-textarea v-model:value="formState.observaciones" :rows="2" size="large" placeholder="Describe el motivo de la nota…" />
            </div>
          </div>
        </div>

        <!-- Artículos -->
        <div class="card">
          <div class="card-title"><ShoppingCartOutlined /> Artículos</div>

          <div v-if="conceptoActual?.value === 'FIN'" class="fin-hint">
            <DollarOutlined /> Ajuste financiero: podés usar un artículo genérico de descuento o el artículo específico.
            Este concepto <strong>no mueve stock</strong>.
          </div>

          <div class="items-grid">
            <div class="items-header">
              <span class="col-art">Artículo</span>
              <span class="col-qty">Cant.</span>
              <span class="col-price">Precio unit.</span>
              <span class="col-disc">Desc. %</span>
              <span class="col-sub">Subtotal</span>
              <span class="col-del"></span>
            </div>
            <div v-for="row in items" :key="row.key" class="item-row">
              <div class="col-art">
                <a-auto-complete
                  v-model:value="row.codigo" :options="row.opciones"
                  style="width:100%" size="large" placeholder="Código o descripción…"
                  @search="(v) => searchArticulos(row, v)"
                  @select="(v) => selectArticulo(row, v)"
                />
                <div v-if="row.descripcion" class="item-desc-hint">{{ row.descripcion }}</div>
              </div>
              <div class="col-qty">
                <a-input-number v-model:value="row.cantidad" :min="0.001" size="large" style="width:100%" :disabled="!row.articuloPk" />
              </div>
              <div class="col-price">
                <a-input-number v-model:value="row.precio" :min="0" :formatter="v => `$ ${Number(v).toLocaleString('es-AR')}`" :parser="v => v.replace(/[^0-9.,]/g,'').replace(',','.')" size="large" style="width:100%" :disabled="!row.articuloPk" />
              </div>
              <div class="col-disc">
                <a-input-number v-model:value="row.descuento" :min="0" :max="100" :formatter="v=>`${v}%`" :parser="v=>v.replace('%','')" size="large" style="width:100%" :disabled="!row.articuloPk" />
              </div>
              <div class="col-sub">
                <span v-if="row.articuloPk" class="subtotal-val">$ {{ money(row.precio * row.cantidad * (1 - row.descuento/100)) }}</span>
              </div>
              <div class="col-del">
                <button class="del-btn" @click="removeRow(row)">×</button>
              </div>
            </div>
          </div>
          <button class="add-row-btn" @click="items.push(newRow())">
            <PlusOutlined /> Agregar artículo
          </button>
        </div>

      </div>

      <!-- ── Panel lateral ─────────────────────────────────────────────── -->
      <div class="nc-side">

        <div v-if="clienteInfo" class="card card--client">
          <div class="card-title"><UserOutlined /> {{ clienteInfo.label }}</div>
          <div class="kv"><span>CUIT</span><span class="mono">{{ clienteInfo.cuit }}</span></div>
        </div>

        <!-- Totales -->
        <div class="card">
          <div class="card-title"><DollarOutlined /> Totales de la nota</div>
          <div class="total-line"><span>Subtotal</span><span>$ {{ money(totales.subtotal) }}</span></div>
          <div class="total-disc-row">
            <span>Descuento global</span>
            <a-input-number v-model:value="formState.descuentoGlobal" :min="0" :max="100" :formatter="v=>`${v}%`" :parser="v=>v.replace('%','')" size="small" style="width:80px" />
          </div>
          <div v-if="formState.descuentoGlobal > 0" class="total-line total-line--disc">
            <span>Descuento</span><span>- $ {{ money(totales.descGlobal) }}</span>
          </div>
          <div class="total-final total-final--nc">
            <span>TOTAL N/C</span>
            <span class="total-amount-nc">$ {{ money(totales.total) }}</span>
          </div>
        </div>

        <!-- Post-guardado -->
        <div v-if="showSuccess" class="card card--success">
          <div class="success-icon"><CheckCircleOutlined /></div>
          <div class="success-num">{{ guardadoNumero }}</div>
          <div class="success-label">Nota guardada correctamente</div>
          <div class="success-actions">
            <a-button block @click="verPdf"><FilePdfOutlined /> Ver PDF</a-button>
            <a-button block @click="router.push({ name: 'consulta-comprobantes' })">Ver comprobantes</a-button>
          </div>
        </div>

        <!-- Acciones pre-guardado -->
        <div v-else class="card">
          <div class="card-title">Acciones</div>
          <div class="side-actions">
            <a-button :loading="loading" :disabled="!canSave" block size="large" @click="guardar(false)">
              <SaveOutlined /> Guardar borrador
            </a-button>
            <a-button type="primary" danger :loading="loading" :disabled="!canSave" block size="large" @click="guardar(true)">
              <CheckCircleOutlined /> Confirmar nota
            </a-button>
          </div>
          <a-alert v-if="!formState.conceptoNC" type="warning" show-icon message="Seleccioná el concepto de la nota antes de continuar." style="margin-top:10px" />
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.nc-root { min-height:100vh; background:var(--app-bg,#f1f5f9); padding:0 0 40px; }

.nc-header {
  display:flex; align-items:center; gap:16px; padding:16px 24px;
  background:var(--surface-1,#fff); border-bottom:1px solid var(--border,rgba(148,163,184,.2));
  position:sticky; top:0; z-index:10; flex-wrap:wrap;
}
.back-btn {
  display:inline-flex; align-items:center; gap:6px; padding:6px 14px; border-radius:6px;
  border:1px solid var(--border,rgba(148,163,184,.3)); background:transparent; cursor:pointer;
  font-size:13px; font-weight:600; color:var(--text-1,#475569); font-family:inherit; transition:all .15s;
}
.back-btn:hover { background:var(--surface-2,#f8fafc); }
.nc-header-center { flex:1; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.nc-doc-badge {
  display:inline-flex; align-items:center; gap:7px; padding:6px 14px; border-radius:6px;
  background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2);
  color:#ef4444; font-size:13px; font-weight:800; letter-spacing:.04em;
}
.concepto-chip {
  display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:20px;
  font-size:12px; font-weight:700; border:1px solid;
}
.nc-header-right { display:flex; gap:8px; }

.nc-body { display:grid; grid-template-columns:1fr 300px; gap:20px; padding:20px 24px; max-width:1300px; margin:0 auto; align-items:start; }
@media(max-width:1000px){.nc-body{grid-template-columns:1fr;}}

.card { background:var(--surface-1,#fff); border:1px solid var(--border,rgba(148,163,184,.2)); border-radius:12px; padding:18px 20px; margin-bottom:16px; }
.card--client { border-left:3px solid #1677ff; background:linear-gradient(to right,rgba(22,119,255,.03),transparent); }
.card--success { border-color:#10b981; background:linear-gradient(to bottom,rgba(16,185,129,.04),transparent); text-align:center; }
.card-title { font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:var(--text-2,#64748b); margin-bottom:14px; display:flex; align-items:center; gap:6px; }
.card-hint { font-size:11.5px; color:var(--text-2,#94a3b8); margin:8px 0 0; line-height:1.5; }

/* Origen */
.origen-search { display:flex; gap:8px; margin-bottom:12px; }
.origen-loaded { display:flex; align-items:center; gap:10px; padding:10px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; margin-bottom:10px; }
.origen-loaded-icon { font-size:20px; color:#10b981; flex-shrink:0; }
.origen-loaded-info { flex:1; display:flex; flex-direction:column; gap:2px; }
.origen-numero { font-weight:800; font-family:monospace; font-size:13px; }
.origen-sub { font-size:11.5px; color:#64748b; }

/* Concepto */
.concepto-grid { display:flex; flex-direction:column; gap:10px; }
.concepto-card {
  display:flex; align-items:flex-start; gap:12px; padding:12px 14px;
  border:1.5px solid var(--border,rgba(148,163,184,.2)); border-radius:10px;
  cursor:pointer; transition:all .15s;
}
.concepto-card:hover { border-color: #94a3b8; }
.concepto-card--active { box-shadow:0 2px 8px rgba(0,0,0,.08); }
.concepto-icon { font-size:20px; font-weight:900; width:28px; text-align:center; flex-shrink:0; }
.concepto-info { flex:1; }
.concepto-name { font-size:13px; font-weight:700; color:var(--text-0,#0f172a); }
.concepto-desc { font-size:12px; color:var(--text-2,#64748b); margin-top:2px; }
.concepto-check { font-size:16px; font-weight:900; flex-shrink:0; }

/* Fields */
.fields-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.field { display:flex; flex-direction:column; gap:5px; }
.field--full { grid-column:1/-1; }
.field label { font-size:12px; font-weight:600; color:var(--text-1,#475569); }
.cli-opt-name { font-weight:600; font-size:13px; }
.cli-opt-cuit { font-size:11px; color:#94a3b8; font-family:monospace; }

/* FIN hint */
.fin-hint {
  display:flex; align-items:center; gap:8px; padding:10px 14px; margin-bottom:12px;
  background:rgba(22,119,255,.06); border:1px solid rgba(22,119,255,.2); border-radius:8px;
  font-size:13px; color:#1677ff;
}

/* Items */
.items-grid { width:100%; }
.items-header { display:grid; grid-template-columns:1fr 80px 130px 80px 120px 36px; gap:8px; padding:6px 8px; background:var(--surface-2,#f8fafc); border-radius:6px; margin-bottom:4px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2,#64748b); }
.item-row { display:grid; grid-template-columns:1fr 80px 130px 80px 120px 36px; gap:8px; padding:6px 0; border-bottom:1px solid var(--border,rgba(148,163,184,.1)); align-items:start; }
.item-row:last-child { border-bottom:none; }
.col-sub { display:flex; align-items:center; justify-content:flex-end; padding-top:8px; }
.col-del { display:flex; align-items:center; justify-content:center; padding-top:8px; }
.item-desc-hint { font-size:11px; color:var(--text-2,#94a3b8); margin-top:3px; padding-left:2px; }
.subtotal-val { font-weight:700; font-variant-numeric:tabular-nums; font-size:13px; color:#ef4444; }
.del-btn { width:28px; height:28px; border-radius:6px; border:1px solid rgba(239,68,68,.2); background:rgba(239,68,68,.06); color:#ef4444; cursor:pointer; font-size:16px; line-height:1; display:grid; place-items:center; font-family:inherit; transition:all .15s; }
.del-btn:hover { background:rgba(239,68,68,.12); }
.add-row-btn { margin-top:12px; width:100%; padding:10px; border:1.5px dashed var(--border,rgba(148,163,184,.3)); border-radius:8px; background:transparent; cursor:pointer; font-size:13px; font-weight:600; color:var(--text-2,#64748b); font-family:inherit; display:flex; align-items:center; justify-content:center; gap:6px; transition:all .15s; }
.add-row-btn:hover { border-color:#ef4444; color:#ef4444; background:rgba(239,68,68,.04); }

/* KV / totales */
.kv { display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:4px 0; }
.kv span:first-child { color:var(--text-2,#64748b); }
.mono { font-family:monospace; font-size:12px; }
.total-line { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; }
.total-line--disc { color:#10b981; }
.total-disc-row { display:flex; justify-content:space-between; align-items:center; font-size:13px; padding:6px 0; }
.total-final { display:flex; justify-content:space-between; align-items:baseline; padding:12px 0 4px; margin-top:8px; border-top:2px solid var(--border,rgba(148,163,184,.2)); font-size:15px; font-weight:800; }
.total-final--nc {}
.total-amount-nc { font-size:22px; font-weight:900; color:#ef4444; font-variant-numeric:tabular-nums; }

/* Side */
.side-actions { display:flex; flex-direction:column; gap:8px; }
.success-icon { font-size:40px; color:#10b981; margin-bottom:8px; }
.success-num { font-family:monospace; font-weight:800; font-size:16px; color:#ef4444; margin-bottom:4px; }
.success-label { font-size:13px; color:var(--text-2,#64748b); margin-bottom:16px; }
.success-actions { display:flex; flex-direction:column; gap:8px; }
</style>
