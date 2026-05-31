<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  ArrowLeftOutlined, SaveOutlined, SendOutlined,
  InboxOutlined, StopOutlined, PlusOutlined,
  DeleteOutlined, SearchOutlined, ArrowRightOutlined,
} from '@ant-design/icons-vue'
import { transferenciasService, depositosService, articulosService } from '@/services/inventario'

const router = useRouter()
const route  = useRoute()

const isEdit     = computed(() => !!route.params.id)
const isReadOnly = computed(() => trf.estado && !['BR'].includes(trf.estado))

const loading    = ref(false)
const submitting = ref(false)

const depositos = ref([])

const ESTADO_CONFIG = {
  BR: { label:'Borrador',    color:'default',    desc:'Podés editar y agregar ítems.' },
  TR: { label:'En Tránsito', color:'processing', desc:'Mercadería enviada. Esperando recepción en destino.' },
  CP: { label:'Completada',  color:'success',    desc:'Stock actualizado en ambos depósitos.' },
  AN: { label:'Anulada',     color:'error',      desc:'Esta transferencia fue cancelada.' },
}

// ─── Cabecera ────────────────────────────────────────────────
const trf = reactive({
  id:            null,
  origen:        null,
  destino:       null,
  observaciones: '',
  estado:        'BR',
  fecha:         null,
})

// ─── Ítems ──────────────────────────────────────────────────
const items = ref([])

const itemVacio = () => ({
  _key:           Date.now() + Math.random(),
  articulo:       null,
  articulo_codigo:'',
  articulo_desc:  '',
  cantidad:       1,
  _searching:     false,
  _options:       [],
})

const agregarItem = () => { if (!isReadOnly.value) items.value.push(itemVacio()) }
const quitarItem  = (idx) => { items.value.splice(idx, 1) }

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
  items.value[idx].articulo        = val
  items.value[idx].articulo_codigo = option.cod
  items.value[idx].articulo_desc   = option.desc
}

// ─── Carga ──────────────────────────────────────────────────
const cargarDepositos = async () => {
  const res = await depositosService.listar().catch(() => null)
  if (res) depositos.value = res.data.results ?? res.data
}

const cargarTransferencia = async () => {
  loading.value = true
  try {
    const res = await transferenciasService.obtener(route.params.id)
    const d   = res.data
    Object.assign(trf, {
      id:            d.id,
      origen:        d.origen,
      destino:       d.destino,
      observaciones: d.observaciones ?? '',
      estado:        d.estado,
      fecha:         d.fecha,
    })
    items.value = (d.items ?? []).map(i => ({
      _key:            i.id,
      articulo:        i.articulo,
      articulo_codigo: i.articulo_codigo,
      articulo_desc:   i.articulo_descripcion,
      cantidad:        parseFloat(i.cantidad),
      _searching:      false,
      _options:        [{ value: i.articulo, label: `${i.articulo_codigo} — ${i.articulo_descripcion}`, cod: i.articulo_codigo, desc: i.articulo_descripcion }],
    }))
  } catch {
    message.error('No se pudo cargar la transferencia.')
    router.push({ name: 'transferencias-lista' })
  } finally {
    loading.value = false
  }
}

// ─── Validar ────────────────────────────────────────────────
const validar = () => {
  if (!trf.origen)  { message.error('Seleccioná el depósito de origen.'); return false }
  if (!trf.destino) { message.error('Seleccioná el depósito de destino.'); return false }
  if (trf.origen === trf.destino) { message.error('Origen y destino no pueden ser el mismo depósito.'); return false }
  if (items.value.length === 0) { message.error('Agregá al menos un ítem.'); return false }
  for (const [i, item] of items.value.entries()) {
    if (!item.articulo) { message.error(`Fila ${i + 1}: seleccioná un artículo.`); return false }
    if (!item.cantidad || item.cantidad <= 0) { message.error(`Fila ${i + 1}: cantidad inválida.`); return false }
  }
  return true
}

// ─── Guardar borrador ───────────────────────────────────────
const guardar = async () => {
  if (!validar()) return
  submitting.value = true
  try {
    const payload = {
      origen:        trf.origen,
      destino:       trf.destino,
      observaciones: trf.observaciones,
      items: items.value.map(i => ({ articulo: i.articulo, cantidad: i.cantidad })),
    }
    if (isEdit.value) {
      await transferenciasService.actualizar(trf.id, payload)
      message.success('Transferencia actualizada.')
      await cargarTransferencia()
    } else {
      const res = await transferenciasService.crear(payload)
      message.success('Transferencia creada.')
      router.replace({ name: 'transferencia-detalle', params: { id: res.data.id } })
    }
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

// ─── Enviar ─────────────────────────────────────────────────
const enviar = () => {
  const origenNombre  = depositos.value.find(d => d.id === trf.origen)?.nombre  ?? 'origen'
  const destinoNombre = depositos.value.find(d => d.id === trf.destino)?.nombre ?? 'destino'
  Modal.confirm({
    title:   '¿Enviar esta transferencia?',
    content: `Se registrará la salida de "${origenNombre}". La mercadería quedará en tránsito hacia "${destinoNombre}".`,
    okText:  'Enviar mercadería',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.enviar(trf.id)
        message.success('Mercadería enviada. Estado: En Tránsito.')
        await cargarTransferencia()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo enviar.')
      }
    },
  })
}

// ─── Recibir ────────────────────────────────────────────────
const recibir = () => {
  const destinoNombre = depositos.value.find(d => d.id === trf.destino)?.nombre ?? 'destino'
  Modal.confirm({
    title:   '¿Confirmar recepción?',
    content: `Se registrará la entrada en "${destinoNombre}". Stock actualizado. La transferencia quedará Completada.`,
    okText:  'Confirmar recepción',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.recibir(trf.id)
        message.success('Recepción confirmada. Stock actualizado.')
        await cargarTransferencia()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo recibir.')
      }
    },
  })
}

// ─── Anular ─────────────────────────────────────────────────
const anular = () => {
  Modal.confirm({
    title:   '¿Anular esta transferencia?',
    okText:  'Anular', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try {
        await transferenciasService.anular(trf.id)
        message.success('Transferencia anulada.')
        await cargarTransferencia()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo anular.')
      }
    },
  })
}

const fmtFecha = (v) => v ? new Date(v).toLocaleString('es-AR') : '—'
const origenNombre  = computed(() => depositos.value.find(d => d.id === trf.origen)?.nombre  ?? '—')
const destinoNombre = computed(() => depositos.value.find(d => d.id === trf.destino)?.nombre ?? '—')

onMounted(async () => {
  await cargarDepositos()
  if (isEdit.value) await cargarTransferencia()
  else agregarItem()
})
</script>

<template>
  <div class="form-root">

    <!-- Header -->
    <div class="form-header">
      <a-button type="text" class="btn-back" @click="router.push({ name: 'transferencias-lista' })">
        <ArrowLeftOutlined /> Transferencias
      </a-button>
      <h1 class="form-title">
        {{ isEdit ? `Transferencia #${trf.id}` : 'Nueva Transferencia' }}
      </h1>
      <div v-if="isEdit" class="header-meta">
        <a-tag :color="ESTADO_CONFIG[trf.estado]?.color">
          {{ ESTADO_CONFIG[trf.estado]?.label }}
        </a-tag>
        <span class="fecha-label">{{ fmtFecha(trf.fecha) }}</span>
      </div>
      <div class="header-actions">
        <!-- Borrador: guardar + enviar -->
        <template v-if="trf.estado === 'BR' || !isEdit">
          <a-button @click="router.push({ name: 'transferencias-lista' })">Cancelar</a-button>
          <a-button :loading="submitting" @click="guardar">
            <SaveOutlined /> Guardar borrador
          </a-button>
          <a-button v-if="isEdit" type="primary" @click="enviar">
            <SendOutlined /> Enviar mercadería
          </a-button>
        </template>
        <!-- En tránsito: recibir -->
        <template v-else-if="trf.estado === 'TR'">
          <a-button type="primary" @click="recibir">
            <InboxOutlined /> Confirmar recepción
          </a-button>
        </template>
        <!-- Completada/Anulada: solo lectura -->
      </div>
    </div>

    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" style="padding:24px" />

    <div v-else class="form-body">

      <!-- Banner de estado (solo cuando no es borrador) -->
      <a-alert
        v-if="trf.estado && trf.estado !== 'BR'"
        :message="ESTADO_CONFIG[trf.estado]?.label"
        :description="ESTADO_CONFIG[trf.estado]?.desc"
        :type="trf.estado === 'CP' ? 'success' : trf.estado === 'TR' ? 'info' : 'error'"
        show-icon
        style="margin-bottom:20px"
      >
        <template v-if="trf.estado === 'TR'" #action>
          <a-button type="primary" size="small" @click="recibir">
            <InboxOutlined /> Confirmar recepción
          </a-button>
        </template>
      </a-alert>

      <!-- Ruta visual (cuando tiene origen y destino) -->
      <div v-if="trf.origen && trf.destino" class="ruta-banner">
        <div class="ruta-dep ruta-dep--origin">
          <span class="ruta-label">Sale de</span>
          <span class="ruta-name">{{ origenNombre }}</span>
        </div>
        <div class="ruta-arrow-wrap">
          <ArrowRightOutlined />
          <span v-if="trf.estado === 'TR'" class="ruta-transito">En tránsito</span>
        </div>
        <div class="ruta-dep ruta-dep--dest">
          <span class="ruta-label">Llega a</span>
          <span class="ruta-name">{{ destinoNombre }}</span>
        </div>
      </div>

      <!-- Datos del documento -->
      <div class="doc-header">
        <div class="field">
          <label class="field-label req">Depósito Origen</label>
          <a-select
            v-model:value="trf.origen"
            placeholder="Desde dónde sale"
            style="width:100%"
            :disabled="isReadOnly"
          >
            <a-select-option
              v-for="d in depositos"
              :key="d.id"
              :value="d.id"
              :disabled="d.id === trf.destino"
            >{{ d.nombre }}</a-select-option>
          </a-select>
        </div>
        <div class="field">
          <label class="field-label req">Depósito Destino</label>
          <a-select
            v-model:value="trf.destino"
            placeholder="A dónde llega"
            style="width:100%"
            :disabled="isReadOnly"
          >
            <a-select-option
              v-for="d in depositos"
              :key="d.id"
              :value="d.id"
              :disabled="d.id === trf.origen"
            >{{ d.nombre }}</a-select-option>
          </a-select>
        </div>
        <div class="field field--full">
          <label class="field-label">Observaciones</label>
          <a-textarea
            v-model:value="trf.observaciones"
            placeholder="Motivo de la transferencia, referencia, etc."
            :rows="2"
            :disabled="isReadOnly"
          />
        </div>
      </div>

      <!-- Ítems -->
      <div class="items-section">
        <div class="items-header">
          <h3 class="items-title">Artículos a transferir</h3>
          <a-button v-if="!isReadOnly" type="dashed" size="small" @click="agregarItem">
            <PlusOutlined /> Agregar artículo
          </a-button>
        </div>

        <a-empty v-if="items.length === 0" description="Sin ítems" :image="false" style="padding:24px" />

        <div v-else class="items-table">
          <div class="items-thead">
            <div class="col-art">Artículo</div>
            <div class="col-qty">Cantidad</div>
            <div v-if="!isReadOnly" class="col-del"></div>
          </div>

          <div
            v-for="(item, idx) in items"
            :key="item._key"
            class="items-row"
          >
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

            <div class="col-qty">
              <a-input-number
                v-model:value="item.cantidad"
                :min="0.001"
                :precision="3"
                style="width:100%"
                :disabled="isReadOnly"
              />
            </div>

            <div v-if="!isReadOnly" class="col-del">
              <a-button type="text" danger size="small" @click="quitarItem(idx)">
                <DeleteOutlined />
              </a-button>
            </div>
          </div>

          <div class="items-footer">
            {{ items.length }} artículo{{ items.length !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="form-footer" v-if="!isReadOnly">
        <a-button @click="router.push({ name: 'transferencias-lista' })">Cancelar</a-button>
        <a-button :loading="submitting" @click="guardar">
          <SaveOutlined /> Guardar borrador
        </a-button>
        <a-button v-if="isEdit && trf.estado === 'BR'" type="primary" @click="enviar">
          <SendOutlined /> Enviar mercadería
        </a-button>
      </div>

    </div>
  </div>
</template>

<style scoped>
.form-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }
.form-header { display:flex; align-items:center; gap:12px; padding:16px 24px; border-bottom:1px solid var(--border,#f0f0f0); flex-wrap:wrap; }
.btn-back { color:var(--text-2,#64748b); padding:0 8px; }
.form-title { margin:0; font-size:18px; font-weight:700; color:var(--text-0); flex:1; }
.header-meta { display:flex; align-items:center; gap:8px; }
.fecha-label { font-size:12px; color:var(--text-2); }
.header-actions { display:flex; gap:8px; align-items:center; }
.form-body { padding:24px; display:flex; flex-direction:column; gap:20px; }

/* Ruta visual */
.ruta-banner { display:flex; align-items:center; gap:16px; background:var(--surface-1,#f8fafc); border:1px solid var(--border,#e2e8f0); border-radius:var(--radius-md,8px); padding:14px 20px; }
.ruta-dep { display:flex; flex-direction:column; gap:2px; flex:1; }
.ruta-dep--origin { align-items:flex-start; }
.ruta-dep--dest   { align-items:flex-end; }
.ruta-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2); }
.ruta-name  { font-size:15px; font-weight:700; color:var(--text-0); }
.ruta-arrow-wrap { display:flex; flex-direction:column; align-items:center; gap:4px; color:var(--text-2); font-size:20px; }
.ruta-transito { font-size:10px; font-weight:600; color:#2563eb; background:#eff6ff; padding:2px 8px; border-radius:20px; white-space:nowrap; }

.doc-header { display:grid; grid-template-columns:1fr 1fr; gap:16px; background:var(--surface-1,#f8fafc); border-radius:var(--radius-md,8px); padding:20px; }
.field { display:flex; flex-direction:column; gap:5px; }
.field--full { grid-column:1/-1; }
.field-label { font-size:12px; font-weight:600; color:var(--text-1); }
.field-label.req::after { content:' *'; color:#ef4444; }

.items-section { border:1px solid var(--border,#e2e8f0); border-radius:var(--radius-md,8px); overflow:hidden; }
.items-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border,#e2e8f0); }
.items-title { margin:0; font-size:13px; font-weight:700; color:var(--text-0); }
.items-table { display:flex; flex-direction:column; }
.items-thead { display:grid; grid-template-columns:1fr 130px 40px; gap:8px; padding:8px 16px; background:var(--surface-1,#f8fafc); border-bottom:1px solid var(--border); font-size:11px; font-weight:700; color:var(--text-2); text-transform:uppercase; letter-spacing:.04em; }
.items-row { display:grid; grid-template-columns:1fr 130px 40px; gap:8px; padding:10px 16px; border-bottom:1px solid var(--border,#f0f0f0); align-items:center; }
.items-row:last-child { border-bottom:none; }
.items-row:hover { background:var(--surface-1,#f8fafc); }
.col-art { min-width:0; }
.col-qty { min-width:0; }
.col-del { display:flex; justify-content:center; }
.opt-cod { font-family:monospace; font-size:11px; color:var(--text-2); margin-right:6px; }
.opt-desc { font-size:12px; color:var(--text-0); }
.readonly-art { display:flex; align-items:center; gap:6px; padding:4px 0; }
.items-footer { padding:10px 16px; background:var(--surface-1,#f8fafc); font-size:12px; color:var(--text-2); border-top:1px solid var(--border); }
.form-footer { display:flex; justify-content:flex-end; gap:10px; padding:14px 24px; border-top:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); }
</style>
