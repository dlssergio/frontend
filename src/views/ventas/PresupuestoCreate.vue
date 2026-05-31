<script setup>
/**
 * PresupuestoCreate.vue — Presupuesto de Venta
 * Diseño profesional, misma calidad que VentaPOSView.
 */
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { message, Modal } from 'ant-design-vue'
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
  PercentageOutlined,
  FilePdfOutlined,
  SwapOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'

const router = useRouter()
const route  = useRoute()

// ── Estado ────────────────────────────────────────────────────────────────
const loading          = ref(false)
const cargandoClientes = ref(false)
const cargandoTipos    = ref(false)
const guardadoId       = ref(null)
const guardadoNumero   = ref('')
const showSuccess      = ref(false)

const formState = reactive({
  clienteId:          null,
  tipoComprobanteId:  null,
  fecha:              dayjs(),
  condicionPago:      'CO',
  observaciones:      '',
  descuentoGlobal:    0,
  puntoVenta:         1,
  validezDias:        30,
})

const items    = ref([newRow()])
const clientes = ref([])
const tipos    = ref([])
const reglas   = ref([])

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

// ── Computed ──────────────────────────────────────────────────────────────
const clienteInfo = computed(() => clientes.value.find(c => c.value === formState.clienteId) ?? null)
const validItems  = computed(() => items.value.filter(r => r.articuloPk))

const totales = computed(() => {
  let subtotal = 0
  for (const r of validItems.value) {
    const base = Number(r.precio || 0) * Number(r.cantidad || 0)
    subtotal += base * (1 - Number(r.descuento || 0) / 100)
  }
  const descGlobal = subtotal * (Number(formState.descuentoGlobal || 0) / 100)
  const total = subtotal - descGlobal
  return { subtotal, descGlobal, total, cantItems: validItems.value.length }
})

const canSave = computed(() =>
  formState.clienteId && formState.tipoComprobanteId && validItems.value.length > 0
)

const estadoLabel = computed(() => {
  if (!formState.clienteId) return { text: 'Seleccioná un cliente', cls: 'status-warn' }
  if (!formState.tipoComprobanteId) return { text: 'Seleccioná el tipo', cls: 'status-warn' }
  if (!validItems.value.length) return { text: 'Sin artículos', cls: 'status-warn' }
  return { text: 'Listo para guardar', cls: 'status-ok' }
})

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
      saldo:           c.saldo ?? 0,
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
      .filter(t => t.clase === 'V' && t.nombre.toLowerCase().includes('presupuesto'))
      .map(t => ({ value: t.id, label: t.nombre }))
    if (!tipos.value.length) {
      tipos.value = lista
        .filter(t => t.clase === 'V' && !t.es_fiscal)
        .map(t => ({ value: t.id, label: t.nombre }))
    }
    if (tipos.value.length && !formState.tipoComprobanteId)
      formState.tipoComprobanteId = tipos.value[0].value
  } catch { message.error('No se pudieron cargar los tipos') }
  finally { cargandoTipos.value = false }
}

const cargarReglas = async (id) => {
  if (!id) return
  try {
    const { data } = await api.get(`/api/comprobantes-venta/${id}/reglas-conversion/`)
    reglas.value = data
  } catch {}
}

// ── Artículos ─────────────────────────────────────────────────────────────
const searchArticulos = async (row, txt) => {
  if ((txt || '').trim().length < 2) return
  row.buscando = true
  try {
    const { data } = await api.get('/api/articulos/', { params: { search: txt.trim(), limit: 15 } })
    row.opciones = (data?.results ?? data ?? []).map(a => ({
      value:       a.cod_articulo,
      label:       `${a.cod_articulo} — ${a.descripcion}`,
      pk:          a.id,
      descripcion: a.descripcion,
      precio:      Number(a.precio_venta_monto || 0),
    }))
  } catch {} finally { row.buscando = false }
}

const selectArticulo = (row, value) => {
  const opt = row.opciones.find(o => o.value === value)
  if (!opt) return
  row.articuloPk  = opt.pk
  row.codigo      = opt.value
  row.descripcion = opt.descripcion
  row.precio      = opt.precio
  if (items.value[items.value.length - 1] === row)
    items.value.push(newRow())
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
      cliente:              formState.clienteId,
      tipo_comprobante:     formState.tipoComprobanteId,
      fecha:                dayjs(formState.fecha).format('YYYY-MM-DD'),
      estado:               confirmar ? 'CN' : 'BR',
      punto_venta:          formState.puntoVenta,
      condicion_venta:      formState.condicionPago === 'CTA_CTE' ? 'CC' : 'CO',
      descuento_global_pct: Number(formState.descuentoGlobal || 0),
      observaciones:        formState.observaciones
        ? `${formState.observaciones}\nValidez: ${formState.validezDias} días`
        : `Validez: ${formState.validezDias} días`,
      items: validItems.value.map(r => ({
        articulo:                 r.articuloPk,
        cantidad:                 Number(r.cantidad),
        precio_unitario_original: Number(r.precio),
        descuento_pct:            Number(r.descuento || 0),
      })),
      pagos: [],
    }
    const { data } = await api.post('/api/comprobantes-venta/', payload)
    guardadoId.value     = data.id
    guardadoNumero.value = data.numero_completo || ''
    showSuccess.value    = true
    await cargarReglas(data.id)
    message.success(`Presupuesto ${guardadoNumero.value} guardado`)
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

const convertir = async (regla) => {
  loading.value = true
  try {
    const { data } = await api.post(`/api/comprobantes-venta/${guardadoId.value}/convertir/`, {
      regla_id: regla.id,
    })
    message.success(data.mensaje || 'Comprobante convertido correctamente')
    router.push({ name: 'consulta-comprobantes' })
  } catch (e) {
    message.error(e?.response?.data?.error || 'Error al convertir')
  } finally { loading.value = false }
}

const nuevo = () => {
  items.value = [newRow()]
  Object.assign(formState, {
    clienteId: null, tipoComprobanteId: tipos.value[0]?.value ?? null,
    fecha: dayjs(), condicionPago: 'CO', observaciones: '',
    descuentoGlobal: 0, validezDias: 30,
  })
  clientes.value  = []
  guardadoId.value = null
  guardadoNumero.value = ''
  showSuccess.value = false
  reglas.value = []
}

onMounted(fetchTipos)
</script>

<template>
  <div class="pres-root">

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <div class="pres-header">
      <button class="back-btn" @click="router.back()">
        <ArrowLeftOutlined /> Volver
      </button>
      <div class="pres-header-center">
        <div class="pres-doc-badge">
          <FileTextOutlined />
          <span>PRESUPUESTO</span>
        </div>
        <div :class="['pres-status', estadoLabel.cls]">
          <span class="status-dot" />
          {{ estadoLabel.text }}
        </div>
      </div>
      <div class="pres-header-right">
        <a-button :loading="loading" :disabled="!canSave" @click="guardar(false)">
          <SaveOutlined /> Borrador
        </a-button>
        <a-button type="primary" :loading="loading" :disabled="!canSave" @click="guardar(true)">
          <CheckCircleOutlined /> Confirmar
        </a-button>
      </div>
    </div>

    <!-- ── Body ────────────────────────────────────────────────────────── -->
    <div class="pres-body">

      <!-- ── Columna principal ─────────────────────────────────────────── -->
      <div class="pres-main">

        <!-- Cliente + tipo -->
        <div class="card">
          <div class="card-title"><UserOutlined /> Datos del comprobante</div>
          <div class="fields-2">
            <div class="field">
              <label>Cliente *</label>
              <a-select
                v-model:value="formState.clienteId"
                show-search :filter-option="false"
                :loading="cargandoClientes"
                placeholder="Escribí nombre o CUIT para buscar…"
                size="large"
                style="width:100%"
                @search="searchClientes"
              >
                <a-select-option v-for="c in clientes" :key="c.value" :value="c.value">
                  <div class="cli-opt-name">{{ c.label }}</div>
                  <div class="cli-opt-cuit">{{ c.cuit }}</div>
                </a-select-option>
              </a-select>
            </div>
            <div class="field">
              <label>Tipo de comprobante *</label>
              <a-select
                v-model:value="formState.tipoComprobanteId"
                :loading="cargandoTipos"
                :options="tipos"
                size="large"
                style="width:100%"
                placeholder="Tipo…"
              />
            </div>
            <div class="field">
              <label>Fecha</label>
              <a-date-picker v-model:value="formState.fecha" format="DD/MM/YYYY" size="large" style="width:100%" />
            </div>
            <div class="field">
              <label>Validez</label>
              <a-input-number
                v-model:value="formState.validezDias"
                :min="1" :max="365"
                size="large"
                style="width:100%"
                addon-after="días"
              />
            </div>
            <div class="field">
              <label>Condición de venta</label>
              <a-radio-group v-model:value="formState.condicionPago" button-style="solid" size="large">
                <a-radio-button value="CO">Contado</a-radio-button>
                <a-radio-button value="CTA_CTE" :disabled="!clienteInfo?.permite_cta_cte">
                  Cta. Cte.
                </a-radio-button>
              </a-radio-group>
            </div>
            <div class="field field--full">
              <label>Observaciones / condiciones especiales</label>
              <a-textarea
                v-model:value="formState.observaciones"
                :rows="2"
                placeholder="Ej: Precios sujetos a variación, sin IVA incluido, entrega en 5 días hábiles…"
                size="large"
              />
            </div>
          </div>
        </div>

        <!-- Artículos -->
        <div class="card">
          <div class="card-title"><ShoppingCartOutlined /> Artículos</div>

          <div class="items-grid">
            <!-- Header -->
            <div class="items-header">
              <span class="col-art">Artículo</span>
              <span class="col-qty">Cant.</span>
              <span class="col-price">Precio unit.</span>
              <span class="col-disc">Desc. %</span>
              <span class="col-sub">Subtotal</span>
              <span class="col-del"></span>
            </div>

            <!-- Filas -->
            <div v-for="row in items" :key="row.key" class="item-row">
              <div class="col-art">
                <a-auto-complete
                  v-model:value="row.codigo"
                  :options="row.opciones"
                  style="width:100%"
                  size="large"
                  placeholder="Código o descripción…"
                  @search="(v) => searchArticulos(row, v)"
                  @select="(v) => selectArticulo(row, v)"
                />
                <div v-if="row.descripcion" class="item-desc-hint">{{ row.descripcion }}</div>
              </div>
              <div class="col-qty">
                <a-input-number
                  v-model:value="row.cantidad"
                  :min="0.001" :step="1"
                  size="large"
                  style="width:100%"
                  :disabled="!row.articuloPk"
                />
              </div>
              <div class="col-price">
                <a-input-number
                  v-model:value="row.precio"
                  :min="0"
                  :formatter="v => `$ ${Number(v).toLocaleString('es-AR')}`"
                  :parser="v => v.replace(/[^0-9.,]/g, '').replace(',', '.')"
                  size="large"
                  style="width:100%"
                  :disabled="!row.articuloPk"
                />
              </div>
              <div class="col-disc">
                <a-input-number
                  v-model:value="row.descuento"
                  :min="0" :max="100"
                  :formatter="v => `${v}%`"
                  :parser="v => v.replace('%', '')"
                  size="large"
                  style="width:100%"
                  :disabled="!row.articuloPk"
                />
              </div>
              <div class="col-sub">
                <span v-if="row.articuloPk" class="subtotal-val">
                  $ {{ money(row.precio * row.cantidad * (1 - row.descuento / 100)) }}
                </span>
              </div>
              <div class="col-del">
                <button class="del-btn" @click="removeRow(row)" title="Eliminar fila">×</button>
              </div>
            </div>
          </div>

          <button class="add-row-btn" @click="items.push(newRow())">
            <PlusOutlined /> Agregar artículo
          </button>
        </div>

      </div>

      <!-- ── Panel lateral ─────────────────────────────────────────────── -->
      <div class="pres-side">

        <!-- Cliente info -->
        <div v-if="clienteInfo" class="card card--client">
          <div class="card-title"><UserOutlined /> {{ clienteInfo.label }}</div>
          <div class="kv"><span>CUIT</span><span class="mono">{{ clienteInfo.cuit }}</span></div>
          <div class="kv">
            <span>Cta. Cte.</span>
            <a-tag :color="clienteInfo.permite_cta_cte ? 'success' : 'default'" style="margin:0">
              {{ clienteInfo.permite_cta_cte ? 'Habilitada' : 'No habilitada' }}
            </a-tag>
          </div>
        </div>

        <!-- Totales -->
        <div class="card">
          <div class="card-title"><DollarOutlined /> Totales</div>

          <div class="total-line">
            <span>Subtotal ({{ totales.cantItems }} arts.)</span>
            <span>$ {{ money(totales.subtotal) }}</span>
          </div>

          <div class="total-disc-row">
            <span>Descuento global</span>
            <a-input-number
              v-model:value="formState.descuentoGlobal"
              :min="0" :max="100"
              :formatter="v => `${v}%`"
              :parser="v => v.replace('%', '')"
              size="small"
              style="width:80px"
            />
          </div>

          <div v-if="formState.descuentoGlobal > 0" class="total-line total-line--disc">
            <span>Descuento ({{ formState.descuentoGlobal }}%)</span>
            <span>- $ {{ money(totales.descGlobal) }}</span>
          </div>

          <div class="total-final">
            <span>TOTAL</span>
            <span class="total-amount">$ {{ money(totales.total) }}</span>
          </div>
        </div>

        <!-- Post-guardado: acciones -->
        <div v-if="showSuccess" class="card card--success">
          <div class="success-icon"><CheckCircleOutlined /></div>
          <div class="success-num">{{ guardadoNumero }}</div>
          <div class="success-label">Presupuesto guardado</div>

          <div class="success-actions">
            <a-button block @click="verPdf"><FilePdfOutlined /> Ver PDF</a-button>
            <a-button block @click="nuevo"><PlusOutlined /> Nuevo presupuesto</a-button>
            <a-button block @click="router.push({ name: 'consulta-comprobantes' })">
              Ver todos los comprobantes
            </a-button>
          </div>

          <!-- Conversiones disponibles -->
          <div v-if="reglas.length" class="conversiones">
            <div class="conv-title"><SwapOutlined /> Convertir en</div>
            <a-button
              v-for="r in reglas"
              :key="r.id"
              :disabled="!r.tiene_serie_activa"
              block
              type="primary"
              style="margin-top:6px"
              @click="convertir(r)"
            >
              <SwapOutlined /> {{ r.etiqueta }}
            </a-button>
          </div>
        </div>

        <!-- Acciones pre-guardado -->
        <div v-else class="card">
          <div class="card-title">Acciones</div>
          <div class="side-actions">
            <a-button
              :loading="loading"
              :disabled="!canSave"
              block
              size="large"
              @click="guardar(false)"
            >
              <SaveOutlined /> Guardar borrador
            </a-button>
            <a-button
              type="primary"
              :loading="loading"
              :disabled="!canSave"
              block
              size="large"
              @click="guardar(true)"
            >
              <CheckCircleOutlined /> Confirmar presupuesto
            </a-button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Root ──────────────────────────────────────────────────────────────── */
.pres-root {
  min-height: 100vh;
  background: var(--app-bg, #f1f5f9);
  padding: 0 0 40px;
}

/* ── Header ────────────────────────────────────────────────────────────── */
.pres-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--surface-1, #fff);
  border-bottom: 1px solid var(--border, rgba(148,163,184,.2));
  position: sticky;
  top: 0;
  z-index: 10;
  flex-wrap: wrap;
}
.back-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 6px;
  border: 1px solid var(--border, rgba(148,163,184,.3));
  background: transparent; cursor: pointer; font-size: 13px;
  font-weight: 600; color: var(--text-1, #475569);
  font-family: inherit; transition: all .15s;
}
.back-btn:hover { background: var(--surface-2, #f8fafc); }
.pres-header-center { flex: 1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pres-doc-badge {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 14px; border-radius: 6px;
  background: rgba(22,119,255,.08); border: 1px solid rgba(22,119,255,.2);
  color: #1677ff; font-size: 13px; font-weight: 800; letter-spacing: .04em;
}
.pres-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600;
}
.pres-status.status-ok   { color: #10b981; }
.pres-status.status-warn { color: #f59e0b; }
.status-dot {
  width: 7px; height: 7px; border-radius: 50%; background: currentColor;
}
.pres-header-right { display: flex; gap: 8px; }

/* ── Body ──────────────────────────────────────────────────────────────── */
.pres-body {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  padding: 20px 24px;
  max-width: 1300px;
  margin: 0 auto;
  align-items: start;
}
@media (max-width: 1000px) { .pres-body { grid-template-columns: 1fr; } }

/* ── Card ──────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,.2));
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 16px;
}
.card--client {
  border-left: 3px solid #1677ff;
  background: linear-gradient(to right, rgba(22,119,255,.03), transparent);
}
.card--success {
  border-color: #10b981;
  background: linear-gradient(to bottom, rgba(16,185,129,.04), transparent);
  text-align: center;
}
.card-title {
  font-size: 11.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .08em; color: var(--text-2, #64748b);
  margin-bottom: 14px; display: flex; align-items: center; gap: 6px;
}

/* ── Fields ────────────────────────────────────────────────────────────── */
.fields-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field--full { grid-column: 1 / -1; }
.field label { font-size: 12px; font-weight: 600; color: var(--text-1, #475569); }
.cli-opt-name { font-weight: 600; font-size: 13px; }
.cli-opt-cuit { font-size: 11px; color: #94a3b8; font-family: monospace; }

/* ── Items grid ────────────────────────────────────────────────────────── */
.items-grid { width: 100%; }
.items-header {
  display: grid;
  grid-template-columns: 1fr 80px 130px 80px 120px 36px;
  gap: 8px;
  padding: 6px 8px;
  background: var(--surface-2, #f8fafc);
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--text-2, #64748b);
}
.item-row {
  display: grid;
  grid-template-columns: 1fr 80px 130px 80px 120px 36px;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border, rgba(148,163,184,.1));
  align-items: start;
}
.item-row:last-child { border-bottom: none; }
.col-art  { min-width: 0; }
.col-qty, .col-price, .col-disc { }
.col-sub  { display: flex; align-items: center; justify-content: flex-end; padding-top: 8px; }
.col-del  { display: flex; align-items: center; justify-content: center; padding-top: 8px; }
.item-desc-hint { font-size: 11px; color: var(--text-2, #94a3b8); margin-top: 3px; padding-left: 2px; }
.subtotal-val { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 13px; }
.del-btn {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid rgba(239,68,68,.2);
  background: rgba(239,68,68,.06); color: #ef4444; cursor: pointer;
  font-size: 16px; line-height: 1; display: grid; place-items: center;
  font-family: inherit; transition: all .15s;
}
.del-btn:hover { background: rgba(239,68,68,.12); }
.add-row-btn {
  margin-top: 12px; width: 100%; padding: 10px;
  border: 1.5px dashed var(--border, rgba(148,163,184,.3));
  border-radius: 8px; background: transparent; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--text-2, #64748b);
  font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all .15s;
}
.add-row-btn:hover { border-color: #1677ff; color: #1677ff; background: rgba(22,119,255,.04); }

/* ── KV ────────────────────────────────────────────────────────────────── */
.kv {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; padding: 4px 0;
}
.kv span:first-child { color: var(--text-2, #64748b); }
.mono { font-family: monospace; font-size: 12px; }

/* ── Totales ───────────────────────────────────────────────────────────── */
.total-line {
  display: flex; justify-content: space-between;
  font-size: 13px; padding: 4px 0; color: var(--text-1, #475569);
}
.total-line--disc { color: #10b981; }
.total-disc-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; padding: 6px 0; color: var(--text-1, #475569);
}
.total-final {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 12px 0 4px; margin-top: 8px;
  border-top: 2px solid var(--border, rgba(148,163,184,.2));
  font-size: 15px; font-weight: 800;
}
.total-amount {
  font-size: 22px; font-weight: 900;
  color: var(--text-0, #0f172a);
  font-variant-numeric: tabular-nums;
}

/* ── Side actions ──────────────────────────────────────────────────────── */
.side-actions { display: flex; flex-direction: column; gap: 8px; }

/* ── Success ───────────────────────────────────────────────────────────── */
.success-icon { font-size: 40px; color: #10b981; margin-bottom: 8px; }
.success-num  { font-family: monospace; font-weight: 800; font-size: 16px; color: #1677ff; margin-bottom: 4px; }
.success-label { font-size: 13px; color: var(--text-2, #64748b); margin-bottom: 16px; }
.success-actions { display: flex; flex-direction: column; gap: 8px; }
.conversiones { margin-top: 16px; border-top: 1px solid var(--border,rgba(148,163,184,.2)); padding-top: 14px; }
.conv-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-2,#64748b); margin-bottom: 6px; display: flex; align-items: center; gap: 5px; }
</style>
