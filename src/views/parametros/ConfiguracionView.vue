<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  SaveOutlined, ReloadOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined, SettingOutlined,
  FileTextOutlined, ShopOutlined, CheckCircleOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'

const activeTab   = ref('empresa')
const loading     = ref(false)
const submitting  = ref(false)

// ─── Tab 1: Configuración de Empresa ─────────────────────────
const empresa   = ref(null)   // datos cargados de la API
const monedas   = ref([])

const formEmpresa = reactive({
  nombre_fantasia:        '',
  ingresos_brutos:        '',
  inicio_actividades:     '',
  usar_factura_electronica: true,
  modo_facturacion:       'MANUAL',
  moneda_principal:       null,
})

async function loadEmpresa() {
  loading.value = true
  try {
    const res = await api.get('/api/parametros/configuracion/')
    empresa.value = res.data
    Object.assign(formEmpresa, {
      nombre_fantasia:        res.data.nombre_fantasia ?? '',
      ingresos_brutos:        res.data.ingresos_brutos ?? '',
      inicio_actividades:     res.data.inicio_actividades ?? '',
      usar_factura_electronica: res.data.usar_factura_electronica ?? true,
      modo_facturacion:       res.data.modo_facturacion ?? 'MANUAL',
      moneda_principal:       res.data.moneda_principal ?? null,
    })
  } catch (e) {
    if (e.response?.status === 404) {
      empresa.value = null
      message.info('La empresa aún no tiene configuración. Completá los datos.')
    } else {
      message.error('Error al cargar la configuración.')
    }
  } finally { loading.value = false }
}

async function guardarEmpresa() {
  if (!formEmpresa.nombre_fantasia) { message.error('El nombre comercial es obligatorio.'); return }
  submitting.value = true
  try {
    await api.patch('/api/parametros/configuracion/', formEmpresa)
    message.success('Configuración guardada.')
    loadEmpresa()
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ')
      : 'No se pudo guardar.')
  } finally { submitting.value = false }
}

// ─── Tab 2: Tipos de Comprobante ──────────────────────────────
const tiposComp       = ref([])
const loadingTipos    = ref(false)
const modalTipo       = ref(false)
const submittingTipo  = ref(false)

const formTipo = reactive({
  id: null, nombre: '', codigo_afip: '', letra: '', clase: 'V',
  mueve_stock: false, signo_stock: 0, mueve_cta_cte: false,
  mueve_caja: true, es_fiscal: false, numeracion_automatica: false,
})

const CLASE_LABELS = { V: 'Ventas', C: 'Compras', F: 'Fondos', S: 'Stock' }
const CLASE_COLORS = { V: 'blue', C: 'green', F: 'gold', S: 'purple' }

const colsTipos = [
  { key: 'nombre',    title: 'Nombre',   dataIndex: 'nombre',    ellipsis: true },
  { key: 'letra',     title: 'Letra',    dataIndex: 'letra',     width: 65, align: 'center' },
  { key: 'clase',     title: 'Clase',    dataIndex: 'clase',     width: 90, align: 'center' },
  { key: 'flags',     title: 'Comportamiento', width: 260 },
  { key: 'acciones',  title: 'Acciones', width: 100, align: 'center', fixed: 'right' },
]

async function loadTipos() {
  loadingTipos.value = true
  try {
    const res = await api.get('/api/tipos-comprobante/')
    tiposComp.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar tipos.') }
  finally   { loadingTipos.value = false }
}

function abrirNuevoTipo() {
  Object.assign(formTipo, {
    id: null, nombre: '', codigo_afip: '', letra: '', clase: 'V',
    mueve_stock: false, signo_stock: 0, mueve_cta_cte: false,
    mueve_caja: true, es_fiscal: false, numeracion_automatica: false,
  })
  modalTipo.value = true
}

function editarTipo(r) {
  Object.assign(formTipo, { ...r }); modalTipo.value = true
}

async function guardarTipo() {
  if (!formTipo.nombre.trim()) { message.error('El nombre es obligatorio.'); return }
  submittingTipo.value = true
  try {
    const payload = { ...formTipo }
    if (formTipo.id) {
      await api.patch(`/api/tipos-comprobante/${formTipo.id}/`, payload)
      message.success('Tipo actualizado.')
    } else {
      await api.post('/api/tipos-comprobante/', payload)
      message.success('Tipo creado.')
    }
    modalTipo.value = false; loadTipos()
  } catch (e) {
    message.error(e.response?.data?.nombre?.[0] ?? 'No se pudo guardar.')
  } finally { submittingTipo.value = false }
}

async function eliminarTipo(id) {
  Modal.confirm({
    title: '¿Eliminar este tipo de comprobante?',
    content: 'Si tiene comprobantes emitidos, no podrá eliminarse.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await api.delete(`/api/tipos-comprobante/${id}/`); message.success('Eliminado.'); loadTipos() }
      catch { message.error('No se pudo eliminar. Puede estar en uso.') }
    },
  })
}

// ─── Tab 3: Series de Documentos ──────────────────────────────
const series          = ref([])
const loadingSeries   = ref(false)
const modalSerie      = ref(false)
const submittingSerie = ref(false)
const depositos       = ref([])

const formSerie = reactive({
  id: null, nombre: '', tipo_comprobante: null,
  punto_venta: 1, es_manual: false, activo: true, deposito_defecto: null,
})

const colsSeries = [
  { key: 'nombre',        title: 'Nombre',      dataIndex: 'nombre',     ellipsis: true },
  { key: 'tipo',          title: 'Tipo Comp.',  width: 180, ellipsis: true },
  { key: 'punto_venta',   title: 'Pto. Venta',  dataIndex: 'punto_venta', width: 100, align: 'center' },
  { key: 'ultimo_numero', title: 'Últ. Nro.',   dataIndex: 'ultimo_numero', width: 100, align: 'right' },
  { key: 'flags_serie',   title: 'Opciones',    width: 140 },
  { key: 'acciones_s',    title: 'Acciones',    width: 100, align: 'center', fixed: 'right' },
]

async function loadSeries() {
  loadingSeries.value = true
  try {
    const res = await api.get('/api/series/')
    series.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar series.') }
  finally   { loadingSeries.value = false }
}

function abrirNuevaSerie() {
  Object.assign(formSerie, {
    id: null, nombre: '', tipo_comprobante: null,
    punto_venta: 1, es_manual: false, activo: true, deposito_defecto: null,
  })
  modalSerie.value = true
}

function editarSerie(r) {
  Object.assign(formSerie, {
    id: r.id, nombre: r.nombre, tipo_comprobante: r.tipo_comprobante,
    punto_venta: r.punto_venta, es_manual: r.es_manual, activo: r.activo,
    deposito_defecto: r.deposito_defecto,
  })
  modalSerie.value = true
}

async function guardarSerie() {
  if (!formSerie.nombre || !formSerie.tipo_comprobante) {
    message.error('Nombre y tipo de comprobante son obligatorios.'); return
  }
  submittingSerie.value = true
  try {
    const payload = { ...formSerie }
    if (!payload.deposito_defecto) payload.deposito_defecto = null
    if (formSerie.id) {
      await api.patch(`/api/series/${formSerie.id}/`, payload)
      message.success('Serie actualizada.')
    } else {
      await api.post('/api/series/', payload)
      message.success('Serie creada.')
    }
    modalSerie.value = false; loadSeries()
  } catch (e) {
    const err = e.response?.data
    message.error(err?.non_field_errors?.[0] ?? err?.nombre?.[0] ?? 'No se pudo guardar.')
  } finally { submittingSerie.value = false }
}

async function eliminarSerie(id) {
  Modal.confirm({
    title: '¿Eliminar esta serie de documentos?',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await api.delete(`/api/series/${id}/`); message.success('Eliminada.'); loadSeries() }
      catch { message.error('No se pudo eliminar.') }
    },
  })
}

// ─── onMounted ────────────────────────────────────────────────
onMounted(async () => {
  loadEmpresa()
  loadTipos()
  loadSeries()
  const [mR, dR] = await Promise.allSettled([
    api.get('/api/monedas/'),
    api.get('/api/inventario/depositos/'),
  ])
  if (mR.status === 'fulfilled') monedas.value   = mR.value.data.results ?? mR.value.data
  if (dR.status === 'fulfilled') depositos.value = dR.value.data.results ?? dR.value.data
})
</script>

<template>
  <div class="config-page">

    <!-- Hero -->
    <section class="hero">
      <div class="hero__left">
        <div class="hero__eyebrow">Sistema · Administración</div>
        <h1 class="hero__title">Configuración</h1>
        <p class="hero__subtitle">Datos de la empresa, tipos de comprobante y series de numeración.</p>
      </div>
    </section>

    <!-- Modales -->

    <!-- Modal Tipo Comprobante -->
    <a-modal v-model:open="modalTipo"
      :title="formTipo.id ? 'Editar Tipo de Comprobante' : 'Nuevo Tipo de Comprobante'"
      :footer="null" width="620px">
      <div class="modal-form">
        <div class="form-grid-2">
          <div class="mf field-full">
            <label class="req">Nombre</label>
            <a-input v-model:value="formTipo.nombre" allow-clear />
          </div>
          <div class="mf">
            <label>Clase</label>
            <a-select v-model:value="formTipo.clase" style="width:100%">
              <a-select-option value="V">Ventas</a-select-option>
              <a-select-option value="C">Compras</a-select-option>
              <a-select-option value="F">Fondos / Caja</a-select-option>
              <a-select-option value="S">Stock Interno</a-select-option>
            </a-select>
          </div>
          <div class="mf">
            <label>Letra AFIP</label>
            <a-input v-model:value="formTipo.letra" maxlength="1" allow-clear placeholder="A, B, C, X…" />
          </div>
          <div class="mf">
            <label>Código AFIP</label>
            <a-input v-model:value="formTipo.codigo_afip" allow-clear placeholder="001, 006…" />
          </div>
        </div>
        <a-divider style="margin:12px 0">Comportamiento</a-divider>
        <div class="flags-grid">
          <a-checkbox v-model:checked="formTipo.mueve_cta_cte">Mueve Cta. Cte.</a-checkbox>
          <a-checkbox v-model:checked="formTipo.mueve_caja">Mueve Caja</a-checkbox>
          <a-checkbox v-model:checked="formTipo.es_fiscal">Es Fiscal (AFIP)</a-checkbox>
          <a-checkbox v-model:checked="formTipo.numeracion_automatica">Numeración Automática</a-checkbox>
          <a-checkbox v-model:checked="formTipo.mueve_stock">Mueve Stock</a-checkbox>
          <div v-if="formTipo.mueve_stock" class="mf">
            <label>Sentido de Stock</label>
            <a-select v-model:value="formTipo.signo_stock" style="width:100%">
              <a-select-option :value="1">Suma (+1)</a-select-option>
              <a-select-option :value="-1">Resta (−1)</a-select-option>
              <a-select-option :value="0">No mueve (0)</a-select-option>
            </a-select>
          </div>
        </div>
        <div class="modal-footer">
          <a-button @click="modalTipo = false">Cancelar</a-button>
          <a-button type="primary" :loading="submittingTipo" @click="guardarTipo">
            {{ formTipo.id ? 'Guardar' : 'Crear' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Modal Serie -->
    <a-modal v-model:open="modalSerie"
      :title="formSerie.id ? 'Editar Serie de Documentos' : 'Nueva Serie de Documentos'"
      :footer="null" width="540px">
      <div class="modal-form">
        <div class="form-grid-2">
          <div class="mf field-full">
            <label class="req">Nombre</label>
            <a-input v-model:value="formSerie.nombre" allow-clear placeholder="Ej: Facturación Electrónica" />
          </div>
          <div class="mf field-full">
            <label class="req">Tipo de Comprobante</label>
            <a-select v-model:value="formSerie.tipo_comprobante" show-search option-filter-prop="label"
              style="width:100%" placeholder="Seleccioná">
              <a-select-option v-for="t in tiposComp" :key="t.id" :value="t.id" :label="t.nombre">
                {{ t.nombre }} <span v-if="t.letra" style="color:#94a3b8">({{ t.letra }})</span>
              </a-select-option>
            </a-select>
          </div>
          <div class="mf">
            <label class="req">Punto de Venta</label>
            <a-input-number v-model:value="formSerie.punto_venta" :min="1" style="width:100%" />
          </div>
          <div class="mf">
            <label>Depósito por Defecto</label>
            <a-select v-model:value="formSerie.deposito_defecto" allow-clear style="width:100%"
              placeholder="Sin depósito fijo">
              <a-select-option v-for="d in depositos" :key="d.id" :value="d.id">{{ d.nombre }}</a-select-option>
            </a-select>
          </div>
          <div class="mf field-full">
            <a-space>
              <a-checkbox v-model:checked="formSerie.es_manual">Numeración Manual (Papel)</a-checkbox>
              <a-checkbox v-model:checked="formSerie.activo">Activa</a-checkbox>
            </a-space>
          </div>
        </div>
        <div class="modal-footer">
          <a-button @click="modalSerie = false">Cancelar</a-button>
          <a-button type="primary" :loading="submittingSerie" @click="guardarSerie">
            {{ formSerie.id ? 'Guardar' : 'Crear' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Tabs -->
    <a-card class="tabs-card" :bordered="false">
      <a-tabs v-model:activeKey="activeTab">

        <!-- ── Empresa ── -->
        <a-tab-pane key="empresa">
          <template #tab><ShopOutlined /> Empresa</template>

          <a-skeleton v-if="loading" active :paragraph="{ rows: 6 }" />
          <div v-else class="tab-content">

            <a-alert v-if="!empresa" type="warning" show-icon
              message="Empresa no configurada"
              description="Completá los datos para comenzar a operar. El CUIT y razón social se configuran en la sección de Entidades."
              style="margin-bottom:20px"
            />

            <div class="form-grid">
              <div class="field field--span2">
                <label class="field-label req">Nombre Comercial</label>
                <a-input v-model:value="formEmpresa.nombre_fantasia"
                  placeholder="Nombre que aparece en tickets y facturas" allow-clear />
              </div>
              <div class="field">
                <label class="field-label">N° Ingresos Brutos</label>
                <a-input v-model:value="formEmpresa.ingresos_brutos" allow-clear />
              </div>
              <div class="field">
                <label class="field-label">Inicio de Actividades</label>
                <a-input type="date" v-model:value="formEmpresa.inicio_actividades" style="width:100%" />
              </div>
              <div class="field">
                <label class="field-label">Moneda Principal</label>
                <a-select v-model:value="formEmpresa.moneda_principal" style="width:100%">
                  <a-select-option v-for="m in monedas" :key="m.id" :value="m.id">
                    {{ m.nombre }} ({{ m.simbolo }})
                  </a-select-option>
                </a-select>
              </div>
              <div class="field">
                <label class="field-label">Modo Facturación</label>
                <a-select v-model:value="formEmpresa.modo_facturacion" style="width:100%">
                  <a-select-option value="MANUAL">Manual (a pedido)</a-select-option>
                  <a-select-option value="AUTO">Automático (al confirmar)</a-select-option>
                </a-select>
              </div>
              <div class="field">
                <a-checkbox v-model:checked="formEmpresa.usar_factura_electronica">
                  Habilitar Factura Electrónica (AFIP)
                </a-checkbox>
              </div>
            </div>

            <div class="form-actions">
              <a-button type="primary" :loading="submitting" @click="guardarEmpresa">
                <SaveOutlined /> Guardar Configuración
              </a-button>
            </div>
          </div>
        </a-tab-pane>

        <!-- ── Tipos de Comprobante ── -->
        <a-tab-pane key="tipos">
          <template #tab><FileTextOutlined /> Tipos de Comprobante</template>
          <div class="tab-toolbar">
            <a-button :loading="loadingTipos" @click="loadTipos"><ReloadOutlined /></a-button>
            <a-button type="primary" @click="abrirNuevoTipo">
              <PlusOutlined /> Nuevo Tipo
            </a-button>
          </div>
          <a-table :columns="colsTipos" :data-source="tiposComp" :loading="loadingTipos"
            row-key="id" size="small"
            :pagination="{ pageSize: 20, showTotal: t => `${t} tipos` }"
            :scroll="{ x: 800 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'letra'">
                <strong>{{ record.letra || '—' }}</strong>
              </template>
              <template v-if="column.key === 'clase'">
                <a-tag :color="CLASE_COLORS[record.clase]">{{ CLASE_LABELS[record.clase] ?? record.clase }}</a-tag>
              </template>
              <template v-if="column.key === 'flags'">
                <a-space wrap>
                  <a-tag v-if="record.mueve_cta_cte"  color="blue"    style="font-size:10px">Cta. Cte.</a-tag>
                  <a-tag v-if="record.mueve_caja"     color="green"   style="font-size:10px">Caja</a-tag>
                  <a-tag v-if="record.es_fiscal"      color="gold"    style="font-size:10px">AFIP</a-tag>
                  <a-tag v-if="record.mueve_stock"    color="purple"  style="font-size:10px">Stock</a-tag>
                </a-space>
              </template>
              <template v-if="column.key === 'acciones'">
                <a-space>
                  <a-tooltip title="Editar">
                    <a-button size="small" @click="editarTipo(record)"><template #icon><EditOutlined /></template></a-button>
                  </a-tooltip>
                  <a-tooltip title="Eliminar">
                    <a-button size="small" danger @click="eliminarTipo(record.id)"><template #icon><DeleteOutlined /></template></a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- ── Series de Documentos ── -->
        <a-tab-pane key="series">
          <template #tab><SettingOutlined /> Series de Documentos</template>
          <a-alert type="info" show-icon
            message="Una Serie define un Talonario: tipo de comprobante + punto de venta + numeración."
            style="margin-bottom:14px;font-size:12px"
          />
          <div class="tab-toolbar">
            <a-button :loading="loadingSeries" @click="loadSeries"><ReloadOutlined /></a-button>
            <a-button type="primary" @click="abrirNuevaSerie">
              <PlusOutlined /> Nueva Serie
            </a-button>
          </div>
          <a-table :columns="colsSeries" :data-source="series" :loading="loadingSeries"
            row-key="id" size="small"
            :pagination="{ pageSize: 20, showTotal: t => `${t} series` }"
            :scroll="{ x: 800 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'tipo'">
                <span>{{ tiposComp.find(t => t.id === record.tipo_comprobante)?.nombre ?? record.tipo_comprobante }}</span>
              </template>
              <template v-if="column.key === 'flags_serie'">
                <a-space>
                  <a-tag v-if="record.es_manual" color="orange" style="font-size:10px">Manual</a-tag>
                  <a-tag v-if="!record.activo" color="default" style="font-size:10px">Inactiva</a-tag>
                  <a-tag v-if="record.activo && !record.es_manual" color="success" style="font-size:10px">Activa</a-tag>
                </a-space>
              </template>
              <template v-if="column.key === 'acciones_s'">
                <a-space>
                  <a-tooltip title="Editar">
                    <a-button size="small" @click="editarSerie(record)"><template #icon><EditOutlined /></template></a-button>
                  </a-tooltip>
                  <a-tooltip title="Eliminar">
                    <a-button size="small" danger @click="eliminarSerie(record.id)"><template #icon><DeleteOutlined /></template></a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

      </a-tabs>
    </a-card>

  </div>
</template>

<style scoped>
.config-page { display: flex; flex-direction: column; gap: 16px; color: var(--text-0); }
.hero { padding: 20px 22px; border-radius: 6px; background: radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%), linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border: 1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow: 0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--text-2); margin-bottom: 8px; }
.hero__title   { margin: 0; font-size: 28px; font-weight: 800; color: var(--text-0); }
.hero__subtitle{ margin: 10px 0 0; color: var(--text-1); }

.tabs-card { border-radius: 6px; box-shadow: 0 6px 18px rgba(0,0,0,.08); background: var(--surface-0); }
.tab-content { padding: 4px 0; }
.tab-toolbar { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 14px; }

/* Formulario empresa */
.form-grid    { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.field        { display: flex; flex-direction: column; gap: 5px; }
.field--span2 { grid-column: span 2; }
.field-label  { font-size: 12px; font-weight: 600; color: var(--text-1); }
.field-label.req::after { content: ' *'; color: #ef4444; }
.form-actions { display: flex; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border, #f0f0f0); }

/* Modales */
.modal-form   { padding-top: 8px; }
.form-grid-2  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mf           { display: flex; flex-direction: column; gap: 4px; }
.mf label     { font-size: 11px; font-weight: 600; color: var(--text-2); }
.mf label.req::after { content: ' *'; color: #ef4444; }
.field-full   { grid-column: 1 / -1; }
.flags-grid   { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 4px 0; }
.modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid var(--border); margin-top: 12px; }
</style>
