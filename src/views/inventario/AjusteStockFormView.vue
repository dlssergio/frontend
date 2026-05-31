<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined, SaveOutlined, CheckOutlined,
  StopOutlined, PlusOutlined, DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { ajustesService, depositosService, motivosAjusteService, articulosService } from '@/services/inventario'

const router = useRouter()
const route  = useRoute()

const isEdit     = computed(() => !!route.params.id)
const isReadOnly = computed(() => ajuste.estado && ajuste.estado !== 'BR')
const pageTitle  = computed(() => {
  if (!isEdit.value) return 'Nuevo Ajuste de Stock'
  const labels = { BR: 'Ajuste (Borrador)', CN: 'Ajuste Confirmado', AN: 'Ajuste Anulado' }
  return labels[ajuste.estado] ?? 'Ajuste de Stock'
})

const loading    = ref(false)
const submitting = ref(false)
const searching  = ref(false)

const depositos = ref([])
const motivos   = ref([])

// ─── Cabecera del ajuste ────────────────────────────────────
const ajuste = reactive({
  id:           null,
  deposito:     null,
  motivo:       null,
  observaciones:'',
  estado:       'BR',
  fecha:        null,
  stock_aplicado: false,
})

// ─── Ítems ──────────────────────────────────────────────────
const items = ref([])

const itemVacio = () => ({
  _key:           Date.now() + Math.random(),
  articulo:       null,
  articulo_codigo:'',
  articulo_desc:  '',
  tipo_movimiento:'E',
  cantidad:       1,
  _searching:     false,
  _options:       [],
})

const agregarItem = () => {
  if (isReadOnly.value) return
  items.value.push(itemVacio())
}

const quitarItem = (idx) => {
  items.value.splice(idx, 1)
}

// Búsqueda de artículo en cada fila
const buscarArticulo = async (idx, query) => {
  if (!query || query.length < 2) return
  items.value[idx]._searching = true
  try {
    const res = await articulosService.buscar(query)
    const lista = res.data.results ?? res.data
    items.value[idx]._options = lista.map(a => ({
      value: a.id,
      label: `${a.cod_articulo} — ${a.descripcion}`,
      cod:   a.cod_articulo,
      desc:  a.descripcion,
    }))
  } finally {
    items.value[idx]._searching = false
  }
}

const onSelectArticulo = (idx, val, option) => {
  items.value[idx].articulo       = val
  items.value[idx].articulo_codigo = option.cod
  items.value[idx].articulo_desc  = option.desc
}

// ─── Carga de datos ─────────────────────────────────────────
const cargarAuxiliares = async () => {
  const [dR, mR] = await Promise.allSettled([
    depositosService.listar(),
    motivosAjusteService.listar(),
  ])
  if (dR.status === 'fulfilled') depositos.value = dR.value.data.results ?? dR.value.data
  if (mR.status === 'fulfilled') motivos.value   = mR.value.data.results ?? mR.value.data
}

const cargarAjuste = async () => {
  loading.value = true
  try {
    const res = await ajustesService.obtener(route.params.id)
    const d   = res.data
    Object.assign(ajuste, {
      id:            d.id,
      deposito:      d.deposito,
      motivo:        d.motivo,
      observaciones: d.observaciones ?? '',
      estado:        d.estado,
      fecha:         d.fecha,
      stock_aplicado: d.stock_aplicado,
    })
    items.value = (d.items ?? []).map(i => ({
      _key:            i.id,
      articulo:        i.articulo,
      articulo_codigo: i.articulo_codigo,
      articulo_desc:   i.articulo_descripcion,
      tipo_movimiento: i.tipo_movimiento,
      cantidad:        parseFloat(i.cantidad),
      _searching:      false,
      _options:        [{ value: i.articulo, label: `${i.articulo_codigo} — ${i.articulo_descripcion}`, cod: i.articulo_codigo, desc: i.articulo_descripcion }],
    }))
  } catch {
    message.error('No se pudo cargar el ajuste.')
    router.push({ name: 'ajustes-lista' })
  } finally {
    loading.value = false
  }
}

// ─── Validación ─────────────────────────────────────────────
const validar = () => {
  if (!ajuste.deposito) { message.error('Seleccioná un depósito.'); return false }
  if (!ajuste.motivo)   { message.error('Seleccioná un motivo.'); return false }
  if (items.value.length === 0) { message.error('Agregá al menos un ítem.'); return false }
  for (const [i, item] of items.value.entries()) {
    if (!item.articulo) { message.error(`Fila ${i + 1}: seleccioná un artículo.`); return false }
    if (!item.cantidad || item.cantidad <= 0) { message.error(`Fila ${i + 1}: la cantidad debe ser mayor a 0.`); return false }
  }
  return true
}

// ─── Guardar (Borrador) ─────────────────────────────────────
const guardar = async () => {
  if (!validar()) return
  submitting.value = true
  try {
    const payload = {
      deposito:      ajuste.deposito,
      motivo:        ajuste.motivo,
      observaciones: ajuste.observaciones,
      items: items.value.map(i => ({
        articulo:        i.articulo,
        tipo_movimiento: i.tipo_movimiento,
        cantidad:        i.cantidad,
      })),
    }
    if (isEdit.value) {
      await ajustesService.actualizar(ajuste.id, payload)
      message.success('Ajuste actualizado.')
    } else {
      const res = await ajustesService.crear(payload)
      message.success('Ajuste creado en Borrador.')
      router.replace({ name: 'ajuste-detalle', params: { id: res.data.id } })
      return
    }
    await cargarAjuste()
  } catch (e) {
    const err = e.response?.data
    if (err && typeof err === 'object') {
      message.error(Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | '))
    } else {
      message.error('No se pudo guardar.')
    }
  } finally {
    submitting.value = false
  }
}

// ─── Confirmar ──────────────────────────────────────────────
const confirmar = () => {
  Modal.confirm({
    title:   '¿Confirmar este ajuste?',
    content: 'Se aplicarán los cambios de stock indicados. Esta acción no se puede deshacer directamente.',
    okText:  'Confirmar y aplicar stock',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await ajustesService.confirmar(ajuste.id)
        message.success('Ajuste confirmado. Stock actualizado correctamente.')
        await cargarAjuste()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo confirmar.')
      }
    },
  })
}

// ─── Anular ─────────────────────────────────────────────────
const anular = () => {
  Modal.confirm({
    title:   '¿Anular este ajuste?',
    okText:  'Anular',
    okType:  'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await ajustesService.anular(ajuste.id)
        message.success('Ajuste anulado.')
        await cargarAjuste()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo anular.')
      }
    },
  })
}

const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'

const ESTADO_CONFIG = { BR: { label:'Borrador', color:'default' }, CN: { label:'Confirmado', color:'success' }, AN: { label:'Anulado', color:'error' } }

onMounted(async () => {
  await cargarAuxiliares()
  if (isEdit.value) await cargarAjuste()
  else agregarItem()
})
</script>

<template>
  <div class="form-root">

    <!-- Header -->
    <div class="form-header">
      <a-button type="text" class="btn-back" @click="router.push({ name: 'ajustes-lista' })">
        <ArrowLeftOutlined /> Ajustes
      </a-button>
      <h1 class="form-title">{{ pageTitle }}</h1>
      <div class="header-badges" v-if="isEdit">
        <a-tag :color="ESTADO_CONFIG[ajuste.estado]?.color">
          {{ ESTADO_CONFIG[ajuste.estado]?.label }}
        </a-tag>
        <span class="fecha-label">{{ fmtFecha(ajuste.fecha) }}</span>
      </div>
      <div class="header-actions">
        <template v-if="!isReadOnly">
          <a-button @click="router.push({ name: 'ajustes-lista' })">Cancelar</a-button>
          <a-button type="default" :loading="submitting" @click="guardar">
            <SaveOutlined /> Guardar borrador
          </a-button>
          <a-button
            v-if="isEdit && ajuste.estado === 'BR'"
            type="primary"
            :loading="submitting"
            @click="confirmar"
          >
            <CheckOutlined /> Confirmar y aplicar stock
          </a-button>
        </template>
        <template v-else>
          <a-button
            v-if="ajuste.estado !== 'AN'"
            danger
            @click="anular"
          >
            <StopOutlined /> Anular
          </a-button>
        </template>
      </div>
    </div>

    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" style="padding:24px" />

    <div v-else class="form-body">

      <!-- Alerta de solo lectura -->
      <a-alert
        v-if="isReadOnly"
        :message="ajuste.estado === 'CN' ? 'Este ajuste está confirmado y el stock ya fue aplicado. Solo lectura.' : 'Este ajuste está anulado.'"
        :type="ajuste.estado === 'CN' ? 'success' : 'error'"
        show-icon
        style="margin-bottom:20px"
      />

      <!-- Cabecera del documento -->
      <div class="doc-header">
        <div class="field">
          <label class="field-label req">Depósito</label>
          <a-select
            v-model:value="ajuste.deposito"
            placeholder="Seleccioná depósito"
            style="width:100%"
            :disabled="isReadOnly"
          >
            <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">
              {{ d.nombre }}
            </a-select-option>
          </a-select>
        </div>
        <div class="field">
          <label class="field-label req">Motivo</label>
          <a-select
            v-model:value="ajuste.motivo"
            placeholder="Seleccioná motivo"
            style="width:100%"
            :disabled="isReadOnly"
          >
            <a-select-option v-for="m in motivos" :key="m.id" :value="m.id">
              {{ m.nombre }}
            </a-select-option>
          </a-select>
        </div>
        <div class="field field--full">
          <label class="field-label">Observaciones</label>
          <a-textarea
            v-model:value="ajuste.observaciones"
            placeholder="Motivo o referencia del ajuste…"
            :rows="2"
            :disabled="isReadOnly"
          />
        </div>
      </div>

      <!-- Tabla de ítems -->
      <div class="items-section">
        <div class="items-header">
          <h3 class="items-title">Ítems del ajuste</h3>
          <a-button
            v-if="!isReadOnly"
            type="dashed"
            size="small"
            @click="agregarItem"
          >
            <PlusOutlined /> Agregar artículo
          </a-button>
        </div>

        <a-empty v-if="items.length === 0" description="Sin ítems" :image="false" style="padding:24px" />

        <div v-else class="items-table">
          <!-- Encabezado -->
          <div class="items-thead">
            <div class="col-art">Artículo</div>
            <div class="col-tipo">Tipo</div>
            <div class="col-qty">Cantidad</div>
            <div v-if="!isReadOnly" class="col-del"></div>
          </div>

          <!-- Filas -->
          <div
            v-for="(item, idx) in items"
            :key="item._key"
            class="items-row"
            :class="{ 'items-row--entry': item.tipo_movimiento === 'E', 'items-row--exit': item.tipo_movimiento === 'S' }"
          >
            <!-- Artículo -->
            <div class="col-art">
              <a-select
                v-if="!isReadOnly"
                :value="item.articulo"
                show-search
                placeholder="Buscar artículo…"
                :filter-option="false"
                :not-found-content="item._searching ? undefined : 'Sin resultados'"
                style="width:100%"
                @search="(q) => buscarArticulo(idx, q)"
                @select="(val, opt) => onSelectArticulo(idx, val, opt)"
              >
                <template #suffixIcon>
                  <a-spin v-if="item._searching" size="small" />
                  <SearchOutlined v-else />
                </template>
                <a-select-option
                  v-for="opt in item._options"
                  :key="opt.value"
                  :value="opt.value"
                  :cod="opt.cod"
                  :desc="opt.desc"
                >
                  <span class="opt-cod">{{ opt.cod }}</span>
                  <span class="opt-desc">{{ opt.desc }}</span>
                </a-select-option>
              </a-select>
              <div v-else class="readonly-art">
                <span class="opt-cod">{{ item.articulo_codigo }}</span>
                <span class="opt-desc">{{ item.articulo_desc }}</span>
              </div>
            </div>

            <!-- Tipo -->
            <div class="col-tipo">
              <a-select
                v-model:value="item.tipo_movimiento"
                style="width:100%"
                :disabled="isReadOnly"
              >
                <a-select-option value="E">
                  <span class="tipo-entry">▲ Entrada (+)</span>
                </a-select-option>
                <a-select-option value="S">
                  <span class="tipo-exit">▼ Salida (−)</span>
                </a-select-option>
              </a-select>
            </div>

            <!-- Cantidad -->
            <div class="col-qty">
              <a-input-number
                v-model:value="item.cantidad"
                :min="0.001"
                :precision="3"
                style="width:100%"
                :disabled="isReadOnly"
              />
            </div>

            <!-- Eliminar -->
            <div v-if="!isReadOnly" class="col-del">
              <a-button type="text" danger size="small" @click="quitarItem(idx)">
                <DeleteOutlined />
              </a-button>
            </div>
          </div>

          <!-- Total -->
          <div class="items-footer">
            <span>{{ items.length }} ítem{{ items.length !== 1 ? 's' : '' }}</span>
          </div>
        </div>
      </div>

      <!-- Footer de acciones (bottom) -->
      <div class="form-footer" v-if="!isReadOnly">
        <a-button @click="router.push({ name: 'ajustes-lista' })">Cancelar</a-button>
        <a-button :loading="submitting" @click="guardar">
          <SaveOutlined /> Guardar borrador
        </a-button>
        <a-button
          v-if="isEdit && ajuste.estado === 'BR'"
          type="primary"
          :loading="submitting"
          @click="confirmar"
        >
          <CheckOutlined /> Confirmar y aplicar stock
        </a-button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.form-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }

.form-header { display:flex; align-items:center; gap:12px; padding:16px 24px; border-bottom:1px solid var(--border,#f0f0f0); flex-wrap:wrap; }
.btn-back { color:var(--text-2,#64748b); padding:0 8px; }
.form-title { margin:0; font-size:18px; font-weight:700; color:var(--text-0,#0f172a); flex:1; }
.header-badges { display:flex; align-items:center; gap:8px; }
.fecha-label { font-size:12px; color:var(--text-2,#64748b); }
.header-actions { display:flex; gap:8px; align-items:center; }

.form-body { padding:24px; display:flex; flex-direction:column; gap:24px; }

.doc-header { display:grid; grid-template-columns:1fr 1fr; gap:16px; background:var(--surface-1,#f8fafc); border-radius:var(--radius-md,8px); padding:20px; }
.field { display:flex; flex-direction:column; gap:5px; }
.field--full { grid-column:1/-1; }
.field-label { font-size:12px; font-weight:600; color:var(--text-1,#334155); }
.field-label.req::after { content:' *'; color:#ef4444; }

/* Items table */
.items-section { display:flex; flex-direction:column; gap:0; border:1px solid var(--border,#e2e8f0); border-radius:var(--radius-md,8px); overflow:hidden; }
.items-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border,#e2e8f0); }
.items-title { margin:0; font-size:13px; font-weight:700; color:var(--text-0); }

.items-table { display:flex; flex-direction:column; }
.items-thead { display:grid; grid-template-columns:1fr 140px 120px 40px; gap:8px; padding:8px 16px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border,#e2e8f0); font-size:11px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em; }
.items-row { display:grid; grid-template-columns:1fr 140px 120px 40px; gap:8px; padding:10px 16px; border-bottom:1px solid var(--border,#f0f0f0); align-items:center; transition:background .1s; }
.items-row:last-child { border-bottom:none; }
.items-row:hover { background:var(--surface-1,#f8fafc); }
.items-row--entry { border-left:3px solid #22c55e; }
.items-row--exit  { border-left:3px solid #ef4444; }

.col-art  { min-width:0; }
.col-tipo { min-width:0; }
.col-qty  { min-width:0; }
.col-del  { display:flex; justify-content:center; }

.opt-cod { font-family:monospace; font-size:11px; color:var(--text-2); margin-right:6px; }
.opt-desc { font-size:12px; color:var(--text-0); }
.readonly-art { display:flex; align-items:center; gap:6px; padding:4px 0; }
.tipo-entry { color:#15803d; font-weight:600; }
.tipo-exit  { color:#b91c1c; font-weight:600; }

.items-footer { padding:10px 16px; background:var(--surface-1,#f8fafc); font-size:12px; color:var(--text-2); border-top:1px solid var(--border,#e2e8f0); }

.form-footer { display:flex; justify-content:flex-end; gap:10px; padding:14px 24px; border-top:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); }
</style>
