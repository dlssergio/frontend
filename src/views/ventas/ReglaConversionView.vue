<script setup>
import { ref, onMounted } from 'vue'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import api from '@/services/api'

// ── Estado ────────────────────────────────────────────────────────────────────
const loading       = ref(false)
const reglas        = ref([])
const tipos         = ref([])
const modalOpen     = ref(false)
const guardando     = ref(false)
const editando      = ref(null)   // null = nueva, objeto = edición

const form = ref({
  tipo_origen:           null,
  tipo_destino:          null,
  etiqueta:              '',
  copia_items:           true,
  copia_cliente:         true,
  copia_condicion_venta: true,
  activo:                true,
  orden:                 0,
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetchReglas = async () => {
  loading.value = true
  try {
    const [rRes, tRes] = await Promise.all([
      api.get('/api/reglas-conversion/'),
      api.get('/api/tipos-comprobante/'),
    ])
    reglas.value = rRes.data.results ?? rRes.data
    tipos.value  = tRes.data.results ?? tRes.data
  } catch {
    message.error('No se pudieron cargar las reglas')
  } finally {
    loading.value = false
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
const abrirNueva = () => {
  editando.value = null
  form.value = {
    tipo_origen: null, tipo_destino: null,
    etiqueta: '', copia_items: true,
    copia_cliente: true, copia_condicion_venta: true,
    confirmar_automaticamente: false,
    activo: true, orden: 0,
  }
  modalOpen.value = true
}

const abrirEditar = (regla) => {
  editando.value = regla
  form.value = {
    tipo_origen:           regla.tipo_origen,
    tipo_destino:          regla.tipo_destino,
    etiqueta:              regla.etiqueta,
    copia_items:           regla.copia_items,
    copia_cliente:         regla.copia_cliente,
    copia_condicion_venta: regla.copia_condicion_venta,
    activo:                        regla.activo,
    orden:                         regla.orden,
    confirmar_automaticamente:     regla.confirmar_automaticamente,
  }
  modalOpen.value = true
}

const guardar = async () => {
  if (!form.value.tipo_origen || !form.value.tipo_destino) {
    message.warning('Seleccioná tipo origen y destino')
    return
  }
  if (form.value.tipo_origen === form.value.tipo_destino) {
    message.warning('El tipo origen y destino no pueden ser iguales')
    return
  }
  guardando.value = true
  try {
    if (editando.value) {
      await api.patch(`/api/reglas-conversion/${editando.value.id}/`, form.value)
      message.success('Regla actualizada')
    } else {
      await api.post('/api/reglas-conversion/', form.value)
      message.success('Regla creada')
    }
    modalOpen.value = false
    fetchReglas()
  } catch (e) {
    const err = e?.response?.data
    const msg = typeof err === 'object'
      ? Object.values(err).flat().join(' · ')
      : 'Error al guardar'
    message.error(msg)
  } finally {
    guardando.value = false
  }
}

const eliminar = (regla) => {
  Modal.confirm({
    title:   `¿Eliminar la regla "${regla.etiqueta}"?`,
    content: 'Esta acción no se puede deshacer.',
    okText:  'Eliminar',
    okType:  'danger',
    cancelText: 'Cancelar',
    onOk: async () => {
      await api.delete(`/api/reglas-conversion/${regla.id}/`)
      message.success('Regla eliminada')
      fetchReglas()
    },
  })
}

const toggleActivo = async (regla) => {
  try {
    await api.patch(`/api/reglas-conversion/${regla.id}/`, {
      activo: !regla.activo,
    })
    regla.activo = !regla.activo
  } catch {
    message.error('No se pudo actualizar')
  }
}

const tipoNombre = (id) => tipos.value.find(t => t.id === id)?.nombre || `#${id}`

onMounted(fetchReglas)
</script>

<template>
  <div class="rcv-root">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="rcv-header">
      <div>
        <h1 class="rcv-title">Reglas de Conversión de Comprobantes</h1>
        <p class="rcv-subtitle">
          Configurá qué comprobantes pueden convertirse en otros
          (Ej: Presupuesto → Factura, Remito → Factura).
        </p>
      </div>
      <a-button type="primary" @click="abrirNueva">
        <PlusOutlined /> Nueva regla
      </a-button>
    </div>

    <!-- ── Info box ────────────────────────────────────────────────────────── -->
    <a-alert
      type="info"
      show-icon
      style="margin-bottom:16px"
      message="¿Cómo funciona?"
      description="Cada regla habilita el botón 'Convertir' en los comprobantes del tipo origen. Al convertir, se crea un nuevo comprobante del tipo destino en estado Borrador, copiando los datos según la configuración de cada regla."
    />

    <!-- ── Tabla ───────────────────────────────────────────────────────────── -->
    <a-spin :spinning="loading">
      <div class="rcv-table-wrap">
        <table class="rcv-table">
          <thead>
            <tr>
              <th>Origen</th>
              <th class="th-arrow"></th>
              <th>Destino</th>
              <th>Etiqueta</th>
              <th class="th-center">Copia ítems</th>
              <th class="th-center">Copia cliente</th>
              <th class="th-center">Copia condición</th>
              <th class="th-center">Confirmar auto.</th>
              <th class="th-center">Orden</th>
              <th class="th-center">Activo</th>
              <th class="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in reglas" :key="r.id" :class="{ 'row-inactive': !r.activo }">
              <td>
                <span class="tipo-badge tipo-badge--origen">{{ r.tipo_origen_nombre }}</span>
              </td>
              <td class="td-arrow"><SwapOutlined /></td>
              <td>
                <span class="tipo-badge tipo-badge--destino">{{ r.tipo_destino_nombre }}</span>
              </td>
              <td class="td-etiqueta">{{ r.etiqueta }}</td>
              <td class="td-center">
                <span class="bool-badge" :class="r.copia_items ? 'bool-si' : 'bool-no'">
                  {{ r.copia_items ? 'Sí' : 'No' }}
                </span>
              </td>
              <td class="td-center">
                <span class="bool-badge" :class="r.copia_cliente ? 'bool-si' : 'bool-no'">
                  {{ r.copia_cliente ? 'Sí' : 'No' }}
                </span>
              </td>
              <td class="td-center">
                <span class="bool-badge" :class="r.copia_condicion_venta ? 'bool-si' : 'bool-no'">
                  {{ r.copia_condicion_venta ? 'Sí' : 'No' }}
                </span>
              </td>
              <td class="td-center">
                <span class="bool-badge" :class="r.confirmar_automaticamente ? 'bool-si' : 'bool-no'">
                  {{ r.confirmar_automaticamente ? 'Sí' : 'No' }}
                </span>
              </td>
              <td class="td-center">{{ r.orden }}</td>
              <td class="td-center">
                <a-switch :checked="r.activo" size="small" @change="toggleActivo(r)" />
              </td>
              <td class="td-actions">
                <a-tooltip title="Editar">
                  <a-button type="text" size="small" @click="abrirEditar(r)">
                    <EditOutlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Eliminar">
                  <a-button type="text" size="small" danger @click="eliminar(r)">
                    <DeleteOutlined />
                  </a-button>
                </a-tooltip>
              </td>
            </tr>
            <tr v-if="!reglas.length && !loading">
              <td colspan="11" class="td-empty">
                No hay reglas configuradas. Hacé clic en "Nueva regla" para agregar la primera.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </a-spin>

    <!-- ── Modal ──────────────────────────────────────────────────────────── -->
    <a-modal
      v-model:open="modalOpen"
      :title="editando ? 'Editar regla de conversión' : 'Nueva regla de conversión'"
      :confirm-loading="guardando"
      ok-text="Guardar"
      cancel-text="Cancelar"
      width="560px"
      @ok="guardar"
    >
      <div class="form-grid">

        <div class="form-row">
          <div class="form-col">
            <label class="form-label">Tipo origen *</label>
            <a-select
              v-model:value="form.tipo_origen"
              placeholder="Seleccioná el tipo origen"
              style="width:100%"
              show-search
              option-filter-prop="label"
            >
              <a-select-option
                v-for="t in tipos"
                :key="t.id"
                :value="t.id"
                :label="t.nombre"
              >
                {{ t.nombre }}
              </a-select-option>
            </a-select>
          </div>
          <div class="form-arrow"><SwapOutlined /></div>
          <div class="form-col">
            <label class="form-label">Tipo destino *</label>
            <a-select
              v-model:value="form.tipo_destino"
              placeholder="Seleccioná el tipo destino"
              style="width:100%"
              show-search
              option-filter-prop="label"
            >
              <a-select-option
                v-for="t in tipos"
                :key="t.id"
                :value="t.id"
                :label="t.nombre"
              >
                {{ t.nombre }}
              </a-select-option>
            </a-select>
          </div>
        </div>

        <div class="form-field">
          <label class="form-label">Etiqueta del botón</label>
          <a-input
            v-model:value="form.etiqueta"
            placeholder="Ej: Convertir a Factura (se genera automáticamente si se deja vacío)"
          />
        </div>

        <div class="form-field">
          <label class="form-label">Orden de aparición</label>
          <a-input-number v-model:value="form.orden" :min="0" style="width:120px" />
        </div>

        <div class="form-checks">
          <div class="check-row">
            <a-switch v-model:checked="form.copia_items" size="small" />
            <div class="check-info">
              <span class="check-label">Copiar ítems</span>
              <span class="check-desc">Los artículos y cantidades se copian al nuevo comprobante</span>
            </div>
          </div>
          <div class="check-row">
            <a-switch v-model:checked="form.copia_cliente" size="small" />
            <div class="check-info">
              <span class="check-label">Copiar cliente</span>
              <span class="check-desc">El cliente del comprobante origen se asigna al nuevo</span>
            </div>
          </div>
          <div class="check-row">
            <a-switch v-model:checked="form.copia_condicion_venta" size="small" />
            <div class="check-info">
              <span class="check-label">Copiar condición de venta</span>
              <span class="check-desc">Contado / Cuenta corriente se mantiene del origen</span>
            </div>
          </div>
          <div class="check-row">
            <a-switch v-model:checked="form.confirmar_automaticamente" size="small" />
            <div class="check-info">
              <span class="check-label">Confirmar automáticamente</span>
              <span class="check-desc">
                Si está activo, el comprobante destino se confirma al crear.
                Si no, queda en Borrador para revisión.
              </span>
            </div>
          </div>
          <div class="check-row">
            <a-switch v-model:checked="form.activo" size="small" />
            <div class="check-info">
              <span class="check-label">Activo</span>
              <span class="check-desc">Las reglas inactivas no aparecen en el flujo de conversión</span>
            </div>
          </div>
        </div>

      </div>
    </a-modal>

  </div>
</template>

<style scoped>
.rcv-root {
  padding: 20px 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.rcv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.rcv-title {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: var(--text-0, #0f172a);
}
.rcv-subtitle {
  font-size: 12px;
  color: var(--text-2, #64748b);
  margin: 2px 0 0;
}

/* ── Table ───────────────────────────────────────────────────────────────── */
.rcv-table-wrap {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, rgba(148,163,184,0.2));
  border-radius: 10px;
  overflow: hidden;
}
.rcv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.rcv-table thead tr {
  background: var(--surface-2, #f8fafc);
}
.rcv-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-2, #64748b);
  border-bottom: 1px solid var(--border, rgba(148,163,184,0.2));
  white-space: nowrap;
}
.th-center, .td-center { text-align: center; }
.th-arrow, .td-arrow   { text-align: center; width: 32px; color: var(--text-2, #94a3b8); }
.th-actions            { width: 80px; }

.rcv-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border, rgba(148,163,184,0.08));
  vertical-align: middle;
}
.rcv-table tr:last-child td { border-bottom: none; }
.row-inactive td { opacity: 0.45; }

.tipo-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.tipo-badge--origen  { background: #dbeafe; color: #1e40af; }
.tipo-badge--destino { background: #dcfce7; color: #166534; }

.td-etiqueta { font-weight: 600; color: var(--text-0, #0f172a); }

.bool-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
}
.bool-si { background: #dcfce7; color: #166534; }
.bool-no { background: #f1f5f9; color: #64748b; }

.td-actions { white-space: nowrap; }
.td-empty {
  text-align: center;
  padding: 32px;
  color: var(--text-2, #94a3b8);
  font-size: 13px;
}

/* ── Form modal ──────────────────────────────────────────────────────────── */
.form-grid    { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.form-row     { display: flex; align-items: flex-end; gap: 8px; }
.form-col     { flex: 1; }
.form-arrow   { font-size: 16px; color: var(--text-2, #94a3b8); padding-bottom: 4px; flex-shrink: 0; }
.form-field   { display: flex; flex-direction: column; gap: 6px; }
.form-label   { font-size: 12px; font-weight: 600; color: var(--text-1, #475569); }

.form-checks  { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border, rgba(148,163,184,0.2)); padding-top: 14px; }
.check-row    { display: flex; align-items: flex-start; gap: 12px; }
.check-info   { display: flex; flex-direction: column; gap: 2px; }
.check-label  { font-size: 13px; font-weight: 600; color: var(--text-0, #0f172a); }
.check-desc   { font-size: 11.5px; color: var(--text-2, #64748b); }
</style>
