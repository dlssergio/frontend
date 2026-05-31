<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined, SaveOutlined, CheckOutlined,
  PlusOutlined, DeleteOutlined, SearchOutlined,
  DollarOutlined, BankOutlined, WalletOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'
import { proveedoresService, ordenesPagoService } from '@/services/compras'
import ProveedorSearchModal from '@/components/compras/ProveedorSearchModal.vue'

const router = useRouter()

// ─── Layout fijo (patrón VentaPOSView) ───────────────────────
const posRootEl = ref(null)
let layoutRaf = 0, layoutObs = null

const measureLayout = () => {
  if (!posRootEl.value) return
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0
    try {
      const rect = posRootEl.value.getBoundingClientRect()
      const viewH = window.innerHeight || 800
      posRootEl.value.style.setProperty('--op-available-h',
        `${Math.max(500, Math.floor(viewH - rect.top - 8))}px`)
    } catch { /* ignore */ }
  })
}

onMounted(() => {
  measureLayout()
  layoutObs = new ResizeObserver(measureLayout)
  if (posRootEl.value) layoutObs.observe(posRootEl.value)
  window.addEventListener('resize', measureLayout)
  cargarAuxiliares()
})
onUnmounted(() => {
  if (layoutRaf) cancelAnimationFrame(layoutRaf)
  layoutObs?.disconnect()
  window.removeEventListener('resize', measureLayout)
})

// ─── Modal proveedor ──────────────────────────────────────────
const modalProv = ref(false)

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
  proveedorId.value     = val
  proveedorNombre.value = opt.label ?? ''
  proveedorCuit.value   = opt.cuit  ?? ''
}

const onProvModal = (r) => {
  proveedorId.value     = r.id
  proveedorNombre.value = r.razon_social
  proveedorCuit.value   = r.cuit ?? ''
}

// ─── Facturas pendientes ──────────────────────────────────────
const facturasPend    = ref([])
const loadingFacturas = ref(false)
const imputaciones    = ref([])

watch(proveedorId, async (id) => {
  imputaciones.value = []
  facturasPend.value = []
  if (!id) return
  loadingFacturas.value = true
  try {
    const res = await proveedoresService.cuentaCorriente(id)
    facturasPend.value = (res.data.movimientos ?? []).filter(
      m => parseFloat(m.saldo_pendiente) > 0
    )
  } catch { message.error('Error al cargar facturas pendientes.') }
  finally   { loadingFacturas.value = false }
})

const agregarImp = (f) => {
  if (imputaciones.value.find(i => i.comprobante === f.id)) return
  imputaciones.value.push({
    comprobante: f.id,
    monto_imputado: parseFloat(f.saldo_pendiente),
    _numero: f.numero, _tipo: f.tipo, _letra: f.letra ?? '',
    _saldo: parseFloat(f.saldo_pendiente),
  })
}
const imputarTodas = () => facturasPend.value.forEach(f => agregarImp(f))
const quitarImp    = (i) => imputaciones.value.splice(i, 1)

// ─── Medios de pago ───────────────────────────────────────────
const valores      = ref([])
const tiposValor   = ref([])
const cuentasFondo = ref([])
const loadingAux   = ref(false)

const form = reactive({
  fecha:         new Date().toISOString().slice(0, 10),
  observaciones: '',
})

const crearValor = () => ({
  key:        Date.now() + Math.random(),
  tipo:       tiposValor.value[0]?.id    ?? null,
  monto:      0,
  origen:     cuentasFondo.value[0]?.id ?? null,
  referencia: '',
})

const agregarValor = () => {
  if (!tiposValor.value.length) {
    message.warning('No hay tipos de valor configurados en Finanzas.')
    return
  }
  if (!cuentasFondo.value.length) {
    message.warning('No hay cajas/cuentas configuradas en Finanzas.')
    return
  }
  valores.value.push(crearValor())
}
const quitarValor = (i) => { if (valores.value.length > 1) valores.value.splice(i, 1) }

const totalImputado = computed(() =>
  imputaciones.value.reduce((s, i) => s + Number(i.monto_imputado || 0), 0)
)
const totalValores = computed(() =>
  valores.value.reduce((s, v) => s + Number(v.monto || 0), 0)
)
const diferencia = computed(() => totalValores.value - totalImputado.value)

watch(totalImputado, (v) => {
  if (valores.value.length === 1 && !valores.value[0].monto) {
    valores.value[0].monto = parseFloat(v.toFixed(2))
  }
})

const money = (v) =>
  `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(parseFloat(v) || 0)}`

// ─── Auxiliares ───────────────────────────────────────────────
const cargarAuxiliares = async () => {
  loadingAux.value = true
  try {
    const [tR, cR] = await Promise.allSettled([
      api.get('/api/finanzas/tipos-valores/'),
      api.get('/api/finanzas/cuentas-fondo/'),
    ])
    if (tR.status === 'fulfilled') {
      tiposValor.value = tR.value.data.results ?? tR.value.data
    }
    if (cR.status === 'fulfilled') {
      cuentasFondo.value = (cR.value.data.results ?? cR.value.data)
        .filter(c => c.activa !== false)
    }
    // Crear el primer valor una vez que tengamos datos
    if (tiposValor.value.length && cuentasFondo.value.length) {
      valores.value = [crearValor()]
    }
  } finally { loadingAux.value = false }
}

// ─── Guardar ──────────────────────────────────────────────────
const submitting = ref(false)

const guardar = async (confirmar = false) => {
  if (!proveedorId.value)    { message.error('Seleccioná un proveedor.'); return }
  if (!valores.value.length) { message.error('Agregá al menos un medio de pago.'); return }
  if (valores.value.some(v => !v.tipo || !v.origen || !Number(v.monto))) {
    message.error('Completá tipo, cuenta y monto en todos los medios de pago.'); return
  }
  submitting.value = true
  try {
    const payload = {
      proveedor:     proveedorId.value,
      fecha:         form.fecha,
      observaciones: form.observaciones,
      estado:        'BR',
      imputaciones:  imputaciones.value.map(i => ({
        comprobante: i.comprobante, monto_imputado: i.monto_imputado,
      })),
      valores: valores.value.map(v => ({
        tipo: v.tipo, monto: v.monto, origen: v.origen, referencia: v.referencia || '',
      })),
    }
    const res = await ordenesPagoService.crear(payload)
    if (confirmar && res.data.id) {
      await ordenesPagoService.confirmar(res.data.id)
      message.success('Orden de pago confirmada y movimientos financieros aplicados.')
    } else {
      message.success('Orden de pago guardada como borrador.')
    }
    router.push({ name: 'ordenes-pago-lista' })
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
      : 'No se pudo guardar.')
  } finally { submitting.value = false }
}
</script>

<template>
  <div ref="posRootEl" class="op-root">
    <ProveedorSearchModal v-model:open="modalProv" @select="onProvModal" />

    <div class="op-body">

      <!-- ══ PANEL IZQUIERDO FIJO ══ -->
      <section class="left-panel">

        <div class="panel-header">
          <a-button type="text" size="small" @click="router.push({ name: 'ordenes-pago-lista' })">
            <ArrowLeftOutlined /> Volver
          </a-button>
          <span class="panel-title"><DollarOutlined style="margin-right:6px" />Nueva Orden de Pago</span>
        </div>

        <!-- Proveedor -->
        <div class="panel-block">
          <div class="block-label">Proveedor</div>
          <div class="prov-row">
            <a-select
              v-model:value="proveedorId"
              show-search :filter-option="false"
              placeholder="Buscar (mín. 3 letras)…"
              :loading="provBuscando"
              style="flex:1"
              @search="onBuscarProv"
              @select="onSelectProv"
            >
              <a-select-option
                v-for="p in provOpts" :key="p.value" :value="p.value"
                :label="p.label" :cuit="p.cuit"
              >
                <div class="prov-opt-name">{{ p.label }}</div>
                <div class="prov-opt-cuit">{{ p.cuit }}</div>
              </a-select-option>
            </a-select>
            <a-tooltip title="Búsqueda avanzada">
              <a-button @click="modalProv = true"><SearchOutlined /></a-button>
            </a-tooltip>
          </div>
          <div v-if="proveedorId" class="prov-badge">
            <span class="prov-badge-name">{{ proveedorNombre }}</span>
            <span v-if="proveedorCuit" class="prov-badge-cuit">{{ proveedorCuit }}</span>
          </div>
        </div>

        <!-- Fecha y observaciones -->
        <div class="panel-block">
          <div class="block-label">Datos del Pago</div>
          <div class="form-stack">
            <div class="form-field">
              <label>Fecha</label>
              <a-input type="date" v-model:value="form.fecha" style="width:100%" />
            </div>
            <div class="form-field">
              <label>Observaciones</label>
              <a-textarea v-model:value="form.observaciones" :rows="2" allow-clear
                placeholder="Ej: pago factura julio…" />
            </div>
          </div>
        </div>

        <!-- Resumen de totales -->
        <div class="panel-block">
          <div class="block-label">Resumen</div>
          <div class="resumen-row">
            <span class="resumen-lbl">Total a pagar</span>
            <span class="resumen-val">{{ money(totalValores) }}</span>
          </div>
          <div class="resumen-row">
            <span class="resumen-lbl">Total imputado</span>
            <span class="resumen-val">{{ money(totalImputado) }}</span>
          </div>
          <div class="resumen-sep" />
          <div class="resumen-row" :class="Math.abs(diferencia) > 0.01 ? 'diff-warn' : 'diff-ok'">
            <span class="resumen-lbl">Diferencia</span>
            <span class="resumen-val-diff">{{ money(diferencia) }}</span>
          </div>
          <a-alert v-if="Math.abs(diferencia) > 0.01"
            :message="`Diferencia: ${money(Math.abs(diferencia))}`"
            type="warning" show-icon style="margin-top:8px;font-size:11px" />
        </div>

        <!-- Acciones -->
        <div class="panel-actions">
          <a-button block @click="router.push({ name: 'ordenes-pago-lista' })">Cancelar</a-button>
          <a-button block :loading="submitting" @click="guardar(false)">
            <SaveOutlined /> Guardar borrador
          </a-button>
          <a-button block type="primary" :loading="submitting" @click="guardar(true)"
            :disabled="!proveedorId || !valores.length">
            <CheckOutlined /> Confirmar pago
          </a-button>
        </div>

      </section>

      <!-- ══ PANEL DERECHO SCROLLEABLE ══ -->
      <section class="right-panel">

        <!-- Facturas a imputar -->
        <div class="right-section">
          <div class="right-section-header">
            <span class="block-label" style="margin:0">Facturas Pendientes</span>
            <a-button v-if="facturasPend.length" size="small" @click="imputarTodas">
              Seleccionar todas
            </a-button>
          </div>

          <a-spin :spinning="loadingFacturas">
            <a-empty v-if="!proveedorId"
              description="Seleccioná un proveedor" :image="false"
              style="padding:16px 0" />
            <a-empty v-else-if="!facturasPend.length && !loadingFacturas"
              description="Sin facturas pendientes" :image="false"
              style="padding:16px 0" />
            <template v-else>
              <!-- Chips de facturas -->
              <div class="facturas-chips">
                <div v-for="f in facturasPend" :key="f.id"
                  class="factura-chip"
                  :class="{ 'chip--sel': imputaciones.find(i => i.comprobante === f.id) }"
                  @click="agregarImp(f)"
                >
                  <div class="chip-top">
                    <span class="chip-num">{{ f.numero }}</span>
                    <span class="chip-tipo">{{ f.tipo }} {{ f.letra }}</span>
                  </div>
                  <div class="chip-bot">
                    <span class="chip-saldo">{{ money(f.saldo_pendiente) }}</span>
                  </div>
                </div>
              </div>

              <!-- Tabla de imputadas -->
              <div v-if="imputaciones.length" class="imputaciones-table">
                <div class="imp-thead">
                  <span class="imp-col col-num">Nro.</span>
                  <span class="imp-col col-tipo">Tipo</span>
                  <span class="imp-col col-saldo">Saldo</span>
                  <span class="imp-col col-monto">Imputar</span>
                  <span class="imp-col col-del"></span>
                </div>
                <div v-for="(imp, idx) in imputaciones" :key="imp.comprobante" class="imp-row">
                  <span class="imp-col col-num mono">{{ imp._numero }}</span>
                  <span class="imp-col col-tipo">{{ imp._tipo }} {{ imp._letra }}</span>
                  <span class="imp-col col-saldo num-right">{{ money(imp._saldo) }}</span>
                  <span class="imp-col col-monto">
                    <a-input-number v-model:value="imp.monto_imputado"
                      :min="0" :max="imp._saldo" :precision="2"
                      addon-before="$" style="width:140px" />
                  </span>
                  <span class="imp-col col-del">
                    <a-button type="text" danger size="small" @click="quitarImp(idx)">
                      <DeleteOutlined />
                    </a-button>
                  </span>
                </div>
                <div class="imp-total">
                  <span>Total imputado:</span>
                  <strong>{{ money(totalImputado) }}</strong>
                </div>
              </div>
            </template>
          </a-spin>
        </div>

        <!-- Medios de pago -->
        <div class="right-section">
          <div class="right-section-header">
            <span class="block-label" style="margin:0">
              <WalletOutlined style="margin-right:6px" />Medios de Pago
            </span>
            <a-button size="small" type="dashed" :loading="loadingAux" @click="agregarValor">
              <PlusOutlined /> Agregar
            </a-button>
          </div>

          <a-spin :spinning="loadingAux">
            <a-alert
              v-if="!loadingAux && (!tiposValor.length || !cuentasFondo.value)"
              message="Sin cajas/tipos de valor. Configurar en Finanzas → Cajas y Bancos."
              type="warning" show-icon style="margin-bottom:12px"
            />

            <div v-for="(v, idx) in valores" :key="v.key" class="valor-card">
              <div class="valor-num">{{ idx + 1 }}</div>
              <div class="valor-fields">
                <div class="form-field">
                  <label>Tipo de Valor</label>
                  <a-select v-model:value="v.tipo" style="width:100%" placeholder="Seleccionar…">
                    <a-select-option v-for="t in tiposValor" :key="t.id" :value="t.id">
                      {{ t.nombre }}
                    </a-select-option>
                  </a-select>
                </div>
                <div class="form-field">
                  <label>Caja / Cuenta</label>
                  <a-select v-model:value="v.origen" style="width:100%" placeholder="Seleccionar…">
                    <a-select-option v-for="c in cuentasFondo" :key="c.id" :value="c.id">
                      <BankOutlined v-if="c.tipo === 'BA'" style="margin-right:4px;color:#6366f1" />
                      <WalletOutlined v-else style="margin-right:4px;color:#15803d" />
                      {{ c.nombre }}
                      <span class="cuenta-saldo">{{ money(c.saldo_monto) }}</span>
                    </a-select-option>
                  </a-select>
                </div>
                <div class="form-field">
                  <label>Monto</label>
                  <a-input-number v-model:value="v.monto"
                    :min="0" :precision="2" addon-before="$" style="width:100%" />
                </div>
                <div class="form-field">
                  <label>Referencia (opcional)</label>
                  <a-input v-model:value="v.referencia" allow-clear
                    placeholder="N° transferencia…" />
                </div>
              </div>
              <a-button type="text" danger :disabled="valores.length === 1"
                @click="quitarValor(idx)" style="margin-top:22px">
                <DeleteOutlined />
              </a-button>
            </div>

            <div v-if="valores.length" class="valores-total">
              <span>Total medios de pago:</span>
              <strong>{{ money(totalValores) }}</strong>
            </div>
          </a-spin>
        </div>

      </section>
    </div>
  </div>
</template>

<style scoped>
/* Layout fijo */
.op-root {
  --op-available-h: 100vh;
  height: var(--op-available-h);
  min-height: var(--op-available-h);
  overflow: hidden;
  background: var(--surface-0, transparent);
}
.op-body {
  display: flex; gap: 14px; padding: 14px;
  height: 100%; overflow: hidden; min-height: 0;
}
.left-panel {
  width: 300px; flex-shrink: 0;
  display: flex; flex-direction: column; overflow-y: auto;
  background: var(--surface-0, #fff); border-radius: 8px;
  border: 1px solid color-mix(in srgb,var(--text-2,#94a3b8) 20%,transparent);
  box-shadow: 0 2px 12px rgba(0,0,0,.07);
}
.right-panel {
  flex: 1; display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto; min-width: 0;
}

/* Panel izquierdo */
.panel-header {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 16px 10px; border-bottom: 1px solid var(--border,#f0f0f0); flex-shrink: 0;
}
.panel-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.panel-block { padding: 12px 16px; border-bottom: 1px solid var(--border,#f0f0f0); }
.block-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--text-2); margin-bottom: 8px; display: block;
}
.prov-row { display: flex; gap: 6px; }
.prov-opt-name { font-size: 13px; font-weight: 600; color: var(--text-0); }
.prov-opt-cuit { font-size: 11px; color: var(--text-2); }
.prov-badge {
  margin-top: 8px; padding: 8px 10px;
  background: var(--surface-1,#f8fafc); border-radius: 7px; border: 1px solid var(--border);
}
.prov-badge-name { display: block; font-size: 13px; font-weight: 700; color: var(--text-0); }
.prov-badge-cuit { font-size: 11px; color: var(--text-2); }
.form-stack { display: flex; flex-direction: column; gap: 10px; }
.form-field { display: flex; flex-direction: column; gap: 3px; }
.form-field label { font-size: 11px; font-weight: 600; color: var(--text-2); }
.resumen-row { display: flex; justify-content: space-between; padding: 4px 0; }
.resumen-lbl { font-size: 12px; color: var(--text-2); }
.resumen-val { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
.resumen-sep { height: 1px; background: var(--border,#e2e8f0); margin: 6px 0; }
.diff-warn .resumen-val-diff { font-size: 15px; font-weight: 800; color: #b91c1c; font-variant-numeric: tabular-nums; }
.diff-ok   .resumen-val-diff { font-size: 15px; font-weight: 800; color: #15803d; font-variant-numeric: tabular-nums; }
.panel-actions { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }

/* Secciones derechas */
.right-section {
  background: var(--surface-0,#fff); border-radius: 8px;
  border: 1px solid color-mix(in srgb,var(--text-2,#94a3b8) 20%,transparent);
  padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,.04);
}
.right-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }

/* Chips */
.facturas-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.factura-chip {
  padding: 8px 12px; border-radius: 10px;
  border: 1.5px solid var(--border,#e2e8f0);
  cursor: pointer; transition: all .15s; min-width: 100px;
  background: var(--surface-0,#fff);
}
.factura-chip:hover { border-color: rgba(var(--accent-rgb,99,102,241),1); }
.chip--sel { border-color: #22c55e; background: #f0fdf4; }
.chip-top { display: flex; gap: 6px; align-items: center; margin-bottom: 3px; }
.chip-num  { font-family: monospace; font-size: 12px; font-weight: 700; }
.chip-tipo { font-size: 11px; color: var(--text-2); }
.chip-saldo{ font-size: 12px; font-weight: 700; color: #b91c1c; font-variant-numeric: tabular-nums; }

/* Imputaciones */
.imputaciones-table { background: var(--surface-1,#f8fafc); border-radius: 8px; border: 1px solid var(--border); overflow: hidden; }
.imp-thead { display: flex; padding: 7px 12px; background: var(--surface-0,#fff); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .04em; }
.imp-row   { display: flex; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border,#f0f0f0); font-size: 12px; }
.imp-col { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-num  { width: 110px; flex-shrink: 0; }
.col-tipo { flex: 1; }
.col-saldo{ width: 110px; flex-shrink: 0; }
.col-monto{ width: 160px; flex-shrink: 0; padding: 0 6px; }
.col-del  { width: 36px; flex-shrink: 0; }
.num-right{ text-align: right; font-variant-numeric: tabular-nums; }
.mono     { font-family: monospace; }
.imp-total{ display: flex; justify-content: flex-end; gap: 12px; padding: 10px 12px; font-size: 13px; font-weight: 700; border-top: 1px solid var(--border); }

/* Valores */
.valor-card { display: flex; align-items: flex-start; gap: 10px; padding: 14px; background: var(--surface-1,#f8fafc); border-radius: 10px; border: 1px solid var(--border); margin-bottom: 10px; }
.valor-num  { width: 24px; height: 24px; border-radius: 50%; background: rgba(var(--accent-rgb,99,102,241),1); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 22px; }
.valor-fields { display: grid; grid-template-columns: 1fr 1fr 130px 1fr; gap: 10px; flex: 1; }
@media (max-width: 900px) { .valor-fields { grid-template-columns: 1fr 1fr; } }
.cuenta-saldo { font-size: 11px; color: #94a3b8; margin-left: 6px; }
.valores-total { display: flex; justify-content: flex-end; gap: 12px; font-size: 14px; font-weight: 700; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 4px; }
</style>
