<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  SaveOutlined, ArrowLeftOutlined, UploadOutlined,
  InfoCircleOutlined, DollarOutlined, InboxOutlined,
  ColumnHeightOutlined, PlusOutlined, DeleteOutlined,
  TeamOutlined, EditOutlined, StarOutlined, StarFilled,
  SearchOutlined,
} from '@ant-design/icons-vue'
import {
  articulosService, rubrosService, marcasService,
  depositosService, proveedorArticuloService,
} from '@/services/inventario'
import api from '@/services/api'

const router = useRouter()
const route  = useRoute()

const isEdit    = computed(() => !!route.params.id)
const pageTitle = computed(() => isEdit.value ? 'Editar Artículo' : 'Nuevo Artículo')

const loading    = ref(false)
const submitting = ref(false)
const activeTab  = ref('general')

// ─── Formulario ───────────────────────────────────────────────
const form = reactive({
  // Identificación
  cod_articulo:     '',
  descripcion:      '',
  descripcion_larga:'',
  ean:              '',
  qr:               '',
  cod_fabricante:   '',
  // Clasificación
  perfil:           'CV',
  rubro:            null,
  marca:            null,
  es_servicio:      false,
  es_bien_de_uso:   false,
  // Unidades
  unidad_medida_stock: null,
  unidad_medida_venta: null,
  // Precios
  precio_costo_monto:  0,
  precio_costo_moneda: null,
  precio_venta_monto:  0,
  precio_venta_moneda: null,
  utilidad:            0,
  // Impositivo
  categoria_impositiva: null,
  impuestos:            [],
  // Stock
  administra_stock:      true,
  permite_stock_negativo: false,
  stock_minimo:          0,
  stock_maximo:          0,
  stock_seguridad:       0,
  lead_time_dias:        0,
  // Logística
  peso_kg:       null,
  alto_cm:       null,
  ancho_cm:      null,
  profundidad_cm:null,
  garantia_meses:0,
  ubicacion:     '',
  // General
  esta_activo:   true,
  observaciones: '',
  nota:          '',
  foto:          null,
})

// Watch: si es servicio, deshabilitar stock
watch(() => form.es_servicio, (val) => {
  if (val) form.administra_stock = false
})

// Watch: recalcular precio venta cuando cambia costo o utilidad
watch([() => form.precio_costo_monto, () => form.utilidad], () => {
  if (form.precio_costo_monto > 0 && form.utilidad >= 0) {
    const costo = parseFloat(form.precio_costo_monto) || 0
    const util  = parseFloat(form.utilidad) || 0
    form.precio_venta_monto = +(costo * (1 + util / 100)).toFixed(2)
  }
})

// ─── Opciones para selects ────────────────────────────────────
const rubros            = ref([])
const marcas            = ref([])
const unidades          = ref([])
const monedas           = ref([])
const categoriasImp     = ref([])
const impuestos         = ref([])
const perfiles          = ref([
  { value: 'CV', label: 'Compra / Venta' },
  { value: 'CO', label: 'Solo Compra' },
  { value: 'VE', label: 'Solo Venta' },
])

// Foto
const fotoFile    = ref(null)
const fotoPreview = ref('')

/**
 * before-upload retorna false → previene el upload automático de Ant Design.
 * Capturamos el File aquí mismo, que es el momento más confiable.
 * El @change puede dispararse múltiples veces con estados distintos,
 * pero before-upload se llama exactamente una vez con el File real.
 */
const onBeforeUpload = (file) => {
  fotoFile.value    = file
  fotoPreview.value = URL.createObjectURL(file)
  return false  // previene el upload automático
}

// ─── Carga de auxiliares ──────────────────────────────────────
const cargarAuxiliares = async () => {
  const calls = await Promise.allSettled([
    rubrosService.listar(),
    marcasService.listar(),
    api.get('/api/unidades-medida/'),
    api.get('/api/monedas/'),
    api.get('/api/categorias-impositivas/'),
    api.get('/api/impuestos/'),
  ])

  const [rR, mR, uR, moR, cR, iR] = calls
  if (rR.status  === 'fulfilled') rubros.value        = rR.value.data.results  ?? rR.value.data
  if (mR.status  === 'fulfilled') marcas.value        = mR.value.data.results  ?? mR.value.data
  if (uR.status  === 'fulfilled') unidades.value      = uR.value.data.results  ?? uR.value.data
  if (moR.status === 'fulfilled') monedas.value       = moR.value.data.results ?? moR.value.data
  if (cR.status  === 'fulfilled') categoriasImp.value = cR.value.data.results  ?? cR.value.data
  if (iR.status  === 'fulfilled') impuestos.value     = iR.value.data.results  ?? iR.value.data

  // Default: primera moneda base
  if (!form.precio_costo_moneda && monedas.value.length) {
    const base = monedas.value.find(m => m.es_base) ?? monedas.value[0]
    form.precio_costo_moneda = base.id
    form.precio_venta_moneda = base.id
  }
  if (!form.unidad_medida_stock && unidades.value.length) {
    form.unidad_medida_stock = unidades.value[0].id
    form.unidad_medida_venta = unidades.value[0].id
  }
}

// ─── Carga del artículo en modo edición ───────────────────────
const cargarArticulo = async () => {
  loading.value = true
  try {
    const res = await articulosService.obtener(route.params.id)
    const a   = res.data
    // Mapear todos los campos del modelo al formulario
    Object.assign(form, {
      cod_articulo:         a.cod_articulo,
      descripcion:          a.descripcion,
      descripcion_larga:    a.descripcion_larga ?? '',
      ean:                  a.ean ?? '',
      qr:                   a.qr  ?? '',
      cod_fabricante:       a.cod_fabricante ?? '',
      perfil:               a.perfil,
      rubro:                a.rubro?.id        ?? null,
      marca:                a.marca?.id        ?? null,
      es_servicio:          a.es_servicio,
      es_bien_de_uso:       a.es_bien_de_uso,
      unidad_medida_stock:  a.unidad_medida_stock?.id ?? null,
      unidad_medida_venta:  a.unidad_medida_venta?.id ?? null,
      precio_costo_monto:   parseFloat(a.precio_costo_monto)  || 0,
      precio_costo_moneda:  a.precio_costo_moneda?.id ?? null,
      precio_venta_monto:   parseFloat(a.precio_venta_monto)  || 0,
      precio_venta_moneda:  a.precio_venta_moneda?.id ?? null,
      utilidad:             parseFloat(a.utilidad) || 0,
      categoria_impositiva: a.categoria_impositiva?.id ?? null,
      impuestos:            a.impuestos?.map(i => i.id) ?? [],
      administra_stock:     a.administra_stock,
      permite_stock_negativo: a.permite_stock_negativo,
      stock_minimo:         parseFloat(a.stock_minimo)   || 0,
      stock_maximo:         parseFloat(a.stock_maximo)   || 0,
      stock_seguridad:      parseFloat(a.stock_seguridad) || 0,
      lead_time_dias:       a.lead_time_dias ?? 0,
      peso_kg:              a.peso_kg ?? null,
      alto_cm:              a.alto_cm ?? null,
      ancho_cm:             a.ancho_cm ?? null,
      profundidad_cm:       a.profundidad_cm ?? null,
      garantia_meses:       a.garantia_meses ?? 0,
      ubicacion:            a.ubicacion ?? '',
      esta_activo:          a.esta_activo,
      observaciones:        a.observaciones ?? '',
      nota:                 a.nota ?? '',
    })
    if (a.foto) fotoPreview.value = a.foto
  } catch {
    message.error('No se pudo cargar el artículo.')
    router.push({ name: 'articulo-lista' })
  } finally {
    loading.value = false
  }
}

// ─── Envío ────────────────────────────────────────────────────
const validar = () => {
  if (!form.descripcion?.trim()) {
    message.error('La descripción es obligatoria.')
    activeTab.value = 'general'
    return false
  }
  if (!form.rubro) {
    message.error('El rubro es obligatorio.')
    activeTab.value = 'general'
    return false
  }
  return true
}

const guardar = async () => {
  if (!validar()) return
  submitting.value = true
  try {
    if (fotoFile.value) {
      // ── Envío con foto: multipart/form-data ──────────────────
      // Construimos el FormData de forma explícita para tener control
      // total sobre tipos. NO usamos buildFormData genérico.
      const fd = new FormData()

      // Campos escalares (string, number, bool → string en FormData)
      const SCALAR_FIELDS = [
        'cod_articulo', 'descripcion', 'descripcion_larga',
        'ean', 'qr', 'cod_fabricante', 'perfil',
        'precio_costo_monto', 'precio_venta_monto', 'utilidad',
        'administra_stock', 'permite_stock_negativo',
        'stock_minimo', 'stock_maximo', 'stock_seguridad', 'lead_time_dias',
        'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm',
        'garantia_meses', 'ubicacion', 'esta_activo',
        'es_servicio', 'es_bien_de_uso',
        'observaciones', 'nota',
      ]
      for (const key of SCALAR_FIELDS) {
        const v = form[key]
        if (v !== null && v !== undefined && v !== '') {
          fd.append(key, v)
        }
      }

      // FK simples (IDs numéricos o null)
      const FK_FIELDS = [
        'rubro', 'marca', 'categoria_impositiva',
        'unidad_medida_stock', 'unidad_medida_venta',
        'precio_costo_moneda', 'precio_venta_moneda',
      ]
      for (const key of FK_FIELDS) {
        const v = form[key]
        if (v !== null && v !== undefined) fd.append(key, v)
      }

      // impuestos: DRF many=True en multipart necesita JSON string,
      // no campos repetidos. Es la única forma confiable.
      if (form.impuestos && form.impuestos.length > 0) {
        fd.append('impuestos', JSON.stringify(form.impuestos))
      }

      // DEBUG TEMPORAL — eliminar después de confirmar

      // Foto: el File object nativo — debe ser el último append
      fd.append('foto', fotoFile.value, fotoFile.value.name)

      if (isEdit.value) {
        await articulosService.actualizarConFoto(route.params.id, fd)
      } else {
        await articulosService.crearConFoto(fd)
      }
    } else {
      // ── Envío sin foto: JSON puro ─────────────────────────────
      const payload = {}
      const ALL_FIELDS = [
        'cod_articulo', 'descripcion', 'descripcion_larga',
        'ean', 'qr', 'cod_fabricante', 'perfil',
        'rubro', 'marca', 'es_servicio', 'es_bien_de_uso',
        'unidad_medida_stock', 'unidad_medida_venta',
        'precio_costo_monto', 'precio_costo_moneda',
        'precio_venta_monto', 'precio_venta_moneda', 'utilidad',
        'categoria_impositiva', 'impuestos',
        'administra_stock', 'permite_stock_negativo',
        'stock_minimo', 'stock_maximo', 'stock_seguridad', 'lead_time_dias',
        'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm',
        'garantia_meses', 'ubicacion',
        'esta_activo', 'observaciones', 'nota',
      ]
      for (const key of ALL_FIELDS) {
        const v = form[key]
        // Incluir explícitamente booleans (false es válido) y 0
        if (v !== undefined) payload[key] = v === '' ? null : v
      }

      if (isEdit.value) {
        await articulosService.actualizar(route.params.id, payload)
      } else {
        await articulosService.crear(payload)
      }
    }

    message.success(isEdit.value ? 'Artículo actualizado correctamente.' : 'Artículo creado correctamente.')
    router.push({ name: 'articulo-lista' })
  } catch (err) {
    const errData = err.response?.data
    if (errData && typeof errData === 'object') {
      const msgs = Object.entries(errData)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('\n')
      message.error(`Errores: ${msgs}`)
    } else {
      message.error('No se pudo guardar el artículo.')
    }
  } finally {
    submitting.value = false
  }
}

// ─── Gestión de Proveedores (pestaña) ────────────────────────
const proveedores        = ref([])
const loadingProveedores = ref(false)
const drawerProvOpen     = ref(false)
const submittingProv     = ref(false)

const formProv = ref({
  _id:                    null,
  proveedor:              null,
  es_fuente_de_verdad:    false,
  cod_articulo_proveedor: '',
  descripcion_proveedor:  '',
})

const provBuscando = ref(false)
const provOptions  = ref([])

const buscarProveedor = async (query) => {
  if (!query || query.length < 2) return
  provBuscando.value = true
  try {
    const res = await api.get('/api/proveedores/', { params: { search: query } })
    const lista = res.data.results ?? res.data
    provOptions.value = lista.map(p => ({
      value: p.id,
      label: p.entidad_data?.razon_social ?? p.entidad?.razon_social ?? `Proveedor #${p.id}`,
    }))
  } finally {
    provBuscando.value = false
  }
}

const cargarProveedores = async () => {
  if (!isEdit.value || !route.params.id) return
  loadingProveedores.value = true
  try {
    const res = await proveedorArticuloService.listar(route.params.id)
    proveedores.value = res.data.results ?? res.data
  } catch {
    message.error('No se pudieron cargar los proveedores.')
  } finally {
    loadingProveedores.value = false
  }
}

const abrirAgregarProv = () => {
  formProv.value = { _id: null, proveedor: null, es_fuente_de_verdad: false, cod_articulo_proveedor: '', descripcion_proveedor: '' }
  provOptions.value = []
  drawerProvOpen.value = true
}

const abrirEditarProv = (pa) => {
  formProv.value = {
    _id:                    pa.id,
    proveedor:              pa.proveedor_id,
    es_fuente_de_verdad:    pa.es_fuente_de_verdad,
    cod_articulo_proveedor: pa.cod_articulo_proveedor ?? '',
    descripcion_proveedor:  pa.descripcion_proveedor  ?? '',
  }
  provOptions.value = [{ value: pa.proveedor_id, label: pa.razon_social }]
  drawerProvOpen.value = true
}

const guardarProv = async () => {
  if (!formProv.value.proveedor) { message.error('Seleccioná un proveedor.'); return }
  submittingProv.value = true
  try {
    const payload = {
      proveedor:              formProv.value.proveedor,
      es_fuente_de_verdad:    formProv.value.es_fuente_de_verdad,
      cod_articulo_proveedor: formProv.value.cod_articulo_proveedor || null,
      descripcion_proveedor:  formProv.value.descripcion_proveedor  || null,
    }
    if (formProv.value._id) {
      await proveedorArticuloService.actualizar(route.params.id, formProv.value._id, payload)
      message.success('Relación actualizada.')
    } else {
      await proveedorArticuloService.crear(route.params.id, payload)
      message.success('Proveedor agregado.')
    }
    drawerProvOpen.value = false
    await cargarProveedores()
  } catch (e) {
    const err = e.response?.data
    if (err && typeof err === 'object') {
      message.error(Object.entries(err).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | '))
    } else {
      message.error('No se pudo guardar.')
    }
  } finally {
    submittingProv.value = false
  }
}

const eliminarProv = (pa) => {
  Modal.confirm({
    title:      `¿Quitar a "${pa.razon_social}" como proveedor?`,
    content:    'Se eliminará la relación. El proveedor no se borra del sistema.',
    okText:     'Quitar',
    okType:     'danger',
    cancelText: 'Cancelar',
    async onOk() {
      try {
        await proveedorArticuloService.eliminar(route.params.id, pa.id)
        message.success('Proveedor quitado.')
        await cargarProveedores()
      } catch (e) {
        message.error(e.response?.data?.detail ?? 'No se pudo eliminar.')
      }
    },
  })
}

const setFuenteDeVerdadProv = async (pa) => {
  try {
    await proveedorArticuloService.setFuenteDeVerdad(route.params.id, pa.id)
    message.success(`${pa.razon_social} marcado como fuente de precio.`)
    await cargarProveedores()
  } catch (e) {
    message.error(e.response?.data?.detail ?? 'No se pudo actualizar.')
  }
}

const onTabChangeForm = (key) => {
  activeTab.value = key
  if (key === 'proveedores') cargarProveedores()
}

onMounted(async () => {
  await cargarAuxiliares()
  if (isEdit.value) await cargarArticulo()
})
</script>

<template>
  <div class="form-root">
    <!-- ── Header ─────────────────────────────────────────── -->
    <div class="form-header">
      <a-button type="text" class="btn-back" @click="router.push({ name: 'articulo-lista' })">
        <ArrowLeftOutlined /> Volver a la lista
      </a-button>
      <h1 class="form-title">{{ pageTitle }}</h1>
      <div class="header-actions">
        <a-switch
          v-model:checked="form.esta_activo"
          checked-children="Activo"
          un-checked-children="Inactivo"
        />
        <a-button
          type="primary"
          :loading="submitting"
          :disabled="loading"
          @click="guardar"
          class="btn-save"
        >
          <SaveOutlined /> {{ isEdit ? 'Guardar cambios' : 'Crear artículo' }}
        </a-button>
      </div>
    </div>

    <!-- ── Skeleton loading ───────────────────────────────── -->
    <a-skeleton v-if="loading" active :paragraph="{ rows: 10 }" style="padding: 24px" />

    <!-- ── Formulario con pestañas ────────────────────────── -->
    <a-tabs v-else v-model:activeKey="activeTab" class="form-tabs" @change="onTabChangeForm">

      <!-- ═══ PESTAÑA: GENERAL ════════════════════════════ -->
      <a-tab-pane key="general">
        <template #tab><span><InfoCircleOutlined /> General</span></template>
        <div class="tab-body">
          <div class="form-grid">

            <!-- Bloque: Identificación -->
            <div class="form-section">
              <h3 class="section-title">Identificación</h3>
              <div class="field-group">

                <div class="field">
                  <label class="field-label">Código Artículo
                    <span class="field-hint">(vacío = autogenerado)</span>
                  </label>
                  <a-input
                    v-model:value="form.cod_articulo"
                    placeholder="Ej: A00042"
                    :disabled="isEdit"
                    allow-clear
                  />
                </div>

                <div class="field field--full">
                  <label class="field-label req">Descripción</label>
                  <a-input
                    v-model:value="form.descripcion"
                    placeholder="Nombre del artículo o servicio"
                    allow-clear
                    :maxlength="255"
                    show-count
                  />
                </div>

                <div class="field field--full">
                  <label class="field-label">Descripción extendida / Ficha técnica</label>
                  <a-textarea
                    v-model:value="form.descripcion_larga"
                    placeholder="Texto largo para catálogos, e-commerce, PDF…"
                    :rows="3"
                    :maxlength="2000"
                    show-count
                  />
                </div>

                <div class="field">
                  <label class="field-label">Código de Barras EAN</label>
                  <a-input
                    v-model:value="form.ean"
                    placeholder="EAN-13"
                    allow-clear
                  >
                    <template #prefix>🔖</template>
                  </a-input>
                </div>

                <div class="field">
                  <label class="field-label">Código del Fabricante / OEM</label>
                  <a-input v-model:value="form.cod_fabricante" placeholder="Ej: PHI-X123" allow-clear />
                </div>

                <div class="field">
                  <label class="field-label">Código QR</label>
                  <a-input v-model:value="form.qr" placeholder="Contenido del QR" allow-clear />
                </div>

              </div>
            </div>

            <!-- Bloque: Clasificación -->
            <div class="form-section">
              <h3 class="section-title">Clasificación</h3>
              <div class="field-group">

                <div class="field field--full">
                  <label class="field-label req">Rubro</label>
                  <a-select
                    v-model:value="form.rubro"
                    placeholder="Seleccioná un rubro"
                    show-search
                    option-filter-prop="label"
                    allow-clear
                    style="width:100%"
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
                    v-model:value="form.marca"
                    placeholder="Sin marca"
                    show-search
                    option-filter-prop="label"
                    allow-clear
                    style="width:100%"
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
                  <label class="field-label">Perfil</label>
                  <a-select
                    v-model:value="form.perfil"
                    style="width:100%"
                  >
                    <a-select-option v-for="p in perfiles" :key="p.value" :value="p.value">
                      {{ p.label }}
                    </a-select-option>
                  </a-select>
                </div>

                <div class="field field--checks">
                  <label class="field-label">Tipo de artículo</label>
                  <div class="checks-row">
                    <a-checkbox v-model:checked="form.es_servicio">
                      Es un Servicio
                    </a-checkbox>
                    <a-checkbox v-model:checked="form.es_bien_de_uso">
                      Es Bien de Uso / Activo Fijo
                    </a-checkbox>
                    <a-checkbox v-model:checked="form.esta_activo">
                      Activo
                    </a-checkbox>
                  </div>
                </div>

              </div>
            </div>

            <!-- Bloque: Foto -->
            <div class="form-section">
              <h3 class="section-title">Imagen</h3>
              <div class="foto-wrap">
                <div class="foto-preview" v-if="fotoPreview">
                  <img :src="fotoPreview" alt="Foto artículo" />
                </div>
                <a-upload
                  :show-upload-list="false"
                  :before-upload="onBeforeUpload"
                  accept="image/*"
                >
                  <a-button><UploadOutlined /> {{ fotoPreview ? 'Cambiar foto' : 'Subir foto' }}</a-button>
                </a-upload>
              </div>
            </div>

          </div>
        </div>
      </a-tab-pane>

      <!-- ═══ PESTAÑA: PRECIOS ═════════════════════════════ -->
      <a-tab-pane key="precios">
        <template #tab><span><DollarOutlined /> Precios e Impuestos</span></template>
        <div class="tab-body">
          <div class="form-grid">

            <div class="form-section">
              <h3 class="section-title">Precios</h3>
              <div class="field-group">

                <div class="field">
                  <label class="field-label">Precio de Costo</label>
                  <a-input-group compact>
                    <a-select v-model:value="form.precio_costo_moneda" style="width:90px">
                      <a-select-option v-for="m in monedas" :key="m.id" :value="m.id">
                        {{ m.simbolo }}
                      </a-select-option>
                    </a-select>
                    <a-input-number
                      v-model:value="form.precio_costo_monto"
                      :min="0"
                      :precision="4"
                      style="width: calc(100% - 90px)"
                      placeholder="0.0000"
                    />
                  </a-input-group>
                </div>

                <div class="field">
                  <label class="field-label">Utilidad (%)</label>
                  <a-input-number
                    v-model:value="form.utilidad"
                    :min="0"
                    :max="9999"
                    :precision="2"
                    style="width:100%"
                    addon-after="%"
                    placeholder="0.00"
                  />
                </div>

                <div class="field">
                  <label class="field-label">
                    Precio de Venta
                    <span class="field-hint">(se calcula automáticamente)</span>
                  </label>
                  <a-input-group compact>
                    <a-select v-model:value="form.precio_venta_moneda" style="width:90px">
                      <a-select-option v-for="m in monedas" :key="m.id" :value="m.id">
                        {{ m.simbolo }}
                      </a-select-option>
                    </a-select>
                    <a-input-number
                      v-model:value="form.precio_venta_monto"
                      :min="0"
                      :precision="2"
                      style="width: calc(100% - 90px)"
                      placeholder="0.00"
                    />
                  </a-input-group>
                </div>

              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Impositivo</h3>
              <div class="field-group">

                <div class="field field--full">
                  <label class="field-label">Categoría Impositiva</label>
                  <a-select
                    v-model:value="form.categoria_impositiva"
                    placeholder="Seleccioná"
                    allow-clear
                    style="width:100%"
                  >
                    <a-select-option
                      v-for="c in categoriasImp"
                      :key="c.id"
                      :value="c.id"
                    >{{ c.nombre }}</a-select-option>
                  </a-select>
                </div>

                <div class="field field--full">
                  <label class="field-label">Impuestos aplicables</label>
                  <a-select
                    v-model:value="form.impuestos"
                    mode="multiple"
                    placeholder="Seleccioná impuestos (IVA, Internos…)"
                    allow-clear
                    style="width:100%"
                    option-filter-prop="label"
                  >
                    <a-select-option
                      v-for="i in impuestos"
                      :key="i.id"
                      :value="i.id"
                      :label="i.nombre"
                    >{{ i.nombre }} — {{ i.tasa }}{{ i.es_porcentaje ? '%' : ' $' }}</a-select-option>
                  </a-select>
                </div>

              </div>
            </div>

          </div>
        </div>
      </a-tab-pane>

      <!-- ═══ PESTAÑA: STOCK ═══════════════════════════════ -->
      <a-tab-pane key="stock">
        <template #tab><span><InboxOutlined /> Stock</span></template>
        <div class="tab-body">
          <div class="form-grid">

            <div class="form-section">
              <h3 class="section-title">Control de Stock</h3>
              <div class="field-group">

                <div class="field field--checks">
                  <div class="checks-row">
                    <a-checkbox
                      v-model:checked="form.administra_stock"
                      :disabled="form.es_servicio"
                    >
                      Administra stock
                    </a-checkbox>
                    <a-checkbox v-model:checked="form.permite_stock_negativo">
                      Permite stock negativo
                    </a-checkbox>
                  </div>
                </div>

                <template v-if="form.administra_stock">
                  <div class="field">
                    <label class="field-label">Stock Mínimo (Punto de Reposición)</label>
                    <a-input-number
                      v-model:value="form.stock_minimo"
                      :min="0"
                      :precision="3"
                      style="width:100%"
                      placeholder="0"
                    />
                  </div>

                  <div class="field">
                    <label class="field-label">Stock Máximo</label>
                    <a-input-number
                      v-model:value="form.stock_maximo"
                      :min="0"
                      :precision="3"
                      style="width:100%"
                      placeholder="0 = sin límite"
                    />
                  </div>

                  <div class="field">
                    <label class="field-label">Stock de Seguridad</label>
                    <a-input-number
                      v-model:value="form.stock_seguridad"
                      :min="0"
                      :precision="3"
                      style="width:100%"
                      placeholder="0"
                    />
                  </div>

                  <div class="field">
                    <label class="field-label">Lead Time (días)</label>
                    <a-input-number
                      v-model:value="form.lead_time_dias"
                      :min="0"
                      style="width:100%"
                      placeholder="Días de demora"
                      addon-after="días"
                    />
                  </div>
                </template>

                <div class="field field--full" v-if="form.es_servicio">
                  <a-alert
                    message="Los servicios no administran stock. El control de stock está deshabilitado."
                    type="info"
                    show-icon
                  />
                </div>

              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Unidades de Medida</h3>
              <div class="field-group">

                <div class="field">
                  <label class="field-label">U.M. de Stock</label>
                  <a-select
                    v-model:value="form.unidad_medida_stock"
                    placeholder="Unidad de stock"
                    show-search
                    option-filter-prop="label"
                    style="width:100%"
                  >
                    <a-select-option
                      v-for="u in unidades"
                      :key="u.id"
                      :value="u.id"
                      :label="u.nombre"
                    >{{ u.nombre }} ({{ u.simbolo }})</a-select-option>
                  </a-select>
                </div>

                <div class="field">
                  <label class="field-label">U.M. de Venta</label>
                  <a-select
                    v-model:value="form.unidad_medida_venta"
                    placeholder="Unidad de venta"
                    show-search
                    option-filter-prop="label"
                    style="width:100%"
                  >
                    <a-select-option
                      v-for="u in unidades"
                      :key="u.id"
                      :value="u.id"
                      :label="u.nombre"
                    >{{ u.nombre }} ({{ u.simbolo }})</a-select-option>
                  </a-select>
                </div>

              </div>
            </div>

          </div>
        </div>
      </a-tab-pane>

      <!-- ═══ PESTAÑA: LOGÍSTICA ═══════════════════════════ -->
      <a-tab-pane key="logistica">
        <template #tab><span><ColumnHeightOutlined /> Logística</span></template>
        <div class="tab-body">
          <div class="form-grid">

            <div class="form-section">
              <h3 class="section-title">Dimensiones y Peso</h3>
              <div class="field-group">
                <div class="field">
                  <label class="field-label">Peso</label>
                  <a-input-number
                    v-model:value="form.peso_kg"
                    :min="0"
                    :precision="4"
                    style="width:100%"
                    placeholder="0.0000"
                    addon-after="kg"
                  />
                </div>
                <div class="field">
                  <label class="field-label">Alto</label>
                  <a-input-number
                    v-model:value="form.alto_cm"
                    :min="0"
                    :precision="2"
                    style="width:100%"
                    placeholder="0.00"
                    addon-after="cm"
                  />
                </div>
                <div class="field">
                  <label class="field-label">Ancho</label>
                  <a-input-number
                    v-model:value="form.ancho_cm"
                    :min="0"
                    :precision="2"
                    style="width:100%"
                    placeholder="0.00"
                    addon-after="cm"
                  />
                </div>
                <div class="field">
                  <label class="field-label">Profundidad</label>
                  <a-input-number
                    v-model:value="form.profundidad_cm"
                    :min="0"
                    :precision="2"
                    style="width:100%"
                    placeholder="0.00"
                    addon-after="cm"
                  />
                </div>
              </div>
            </div>

            <div class="form-section">
              <h3 class="section-title">Almacenamiento y Garantía</h3>
              <div class="field-group">
                <div class="field field--full">
                  <label class="field-label">Ubicación Física</label>
                  <a-input
                    v-model:value="form.ubicacion"
                    placeholder="Ej: Pasillo 4, Estantería B"
                    allow-clear
                  />
                </div>
                <div class="field">
                  <label class="field-label">Garantía</label>
                  <a-input-number
                    v-model:value="form.garantia_meses"
                    :min="0"
                    style="width:100%"
                    placeholder="0"
                    addon-after="meses"
                  />
                </div>
                <div class="field field--full">
                  <label class="field-label">Observaciones internas</label>
                  <a-textarea
                    v-model:value="form.observaciones"
                    placeholder="Notas internas del artículo…"
                    :rows="3"
                    :maxlength="1000"
                    show-count
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </a-tab-pane>

      <!-- ═══ PESTAÑA: PROVEEDORES ══════════════════════════ -->
      <a-tab-pane key="proveedores" :disabled="!isEdit">
        <template #tab>
          <span>
            <TeamOutlined /> Proveedores
            <span v-if="!isEdit" style="font-size:10px;color:#94a3b8"> (guardar primero)</span>
          </span>
        </template>
        <div class="tab-body">

          <a-alert
            v-if="!isEdit"
            message="Guardá el artículo primero para poder gestionar los proveedores vinculados."
            type="info" show-icon style="margin-bottom:20px"
          />

          <template v-else>
            <div class="prov-toolbar">
              <span class="prov-count">
                {{ proveedores.length }} proveedor{{ proveedores.length !== 1 ? 'es' : '' }} vinculado{{ proveedores.length !== 1 ? 's' : '' }}
              </span>
              <a-button type="primary" size="small" @click="abrirAgregarProv">
                <PlusOutlined /> Agregar proveedor
              </a-button>
            </div>

            <a-spin :spinning="loadingProveedores">
              <a-empty
                v-if="!loadingProveedores && proveedores.length === 0"
                description="Sin proveedores vinculados."
                :image="false" style="padding: 32px 0"
              />

              <div v-else class="prov-list">
                <div
                  v-for="pa in proveedores"
                  :key="pa.id"
                  class="prov-card"
                  :class="{ 'prov-card--fuente': pa.es_fuente_de_verdad }"
                >
                  <div class="prov-card-header">
                    <div class="prov-identity">
                      <span class="prov-name">{{ pa.razon_social }}</span>
                      <span v-if="pa.codigo_proveedor" class="prov-cod-sys">{{ pa.codigo_proveedor }}</span>
                    </div>
                    <a-tag v-if="pa.es_fuente_de_verdad" color="gold">
                      <StarFilled style="margin-right:3px" /> Fuente de precio
                    </a-tag>
                  </div>

                  <div class="prov-card-body">
                    <div class="prov-field" v-if="pa.cod_articulo_proveedor">
                      <span class="prov-field-label">Cód. en proveedor</span>
                      <span class="prov-field-value mono">{{ pa.cod_articulo_proveedor }}</span>
                    </div>
                    <div class="prov-field" v-if="pa.descripcion_proveedor">
                      <span class="prov-field-label">Descripción en proveedor</span>
                      <span class="prov-field-value">{{ pa.descripcion_proveedor }}</span>
                    </div>
                  </div>

                  <div class="prov-card-actions">
                    <a-tooltip v-if="!pa.es_fuente_de_verdad" title="Marcar como fuente de precio">
                      <a-button type="text" size="small" class="btn-star" @click="setFuenteDeVerdadProv(pa)">
                        <StarOutlined /> Fuente de precio
                      </a-button>
                    </a-tooltip>
                    <a-button type="text" size="small" class="btn-edit-prov" @click="abrirEditarProv(pa)">
                      <EditOutlined /> Editar
                    </a-button>
                    <a-button type="text" size="small" danger @click="eliminarProv(pa)">
                      <DeleteOutlined /> Quitar
                    </a-button>
                  </div>
                </div>
              </div>
            </a-spin>

            <!-- Drawer -->
            <a-drawer
              v-model:open="drawerProvOpen"
              :title="formProv._id ? 'Editar relación' : 'Agregar proveedor'"
              width="420"
              :body-style="{ padding: '24px' }"
            >
              <div class="drawer-fields">
                <div class="field">
                  <label class="field-label req">Proveedor</label>
                  <a-select
                    :value="formProv.proveedor"
                    show-search placeholder="Buscar proveedor…"
                    :filter-option="false"
                    :not-found-content="provBuscando ? undefined : 'Escribí para buscar'"
                    style="width:100%"
                    :disabled="!!formProv._id"
                    @search="buscarProveedor"
                    @select="(v) => { formProv.proveedor = v }"
                  >
                    <template #suffixIcon>
                      <a-spin v-if="provBuscando" size="small" />
                      <SearchOutlined v-else />
                    </template>
                    <a-select-option v-for="opt in provOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </a-select-option>
                  </a-select>
                </div>
                <div class="field">
                  <label class="field-label">Código en el proveedor</label>
                  <a-input v-model:value="formProv.cod_articulo_proveedor"
                    placeholder="Cómo lo identifica el proveedor en sus facturas" allow-clear />
                </div>
                <div class="field">
                  <label class="field-label">Descripción en el proveedor</label>
                  <a-input v-model:value="formProv.descripcion_proveedor"
                    placeholder="Nombre que usa el proveedor para este artículo" allow-clear />
                </div>
                <div class="field">
                  <a-checkbox v-model:checked="formProv.es_fuente_de_verdad">
                    <strong>Fuente de precio de costo</strong>
                    <span class="field-hint" style="display:block;margin-top:3px">
                      Las facturas de este proveedor actualizarán el precio de costo del artículo.
                    </span>
                  </a-checkbox>
                </div>
              </div>
              <template #footer>
                <div class="drawer-footer">
                  <a-button @click="drawerProvOpen = false">Cancelar</a-button>
                  <a-button type="primary" :loading="submittingProv" @click="guardarProv">
                    {{ formProv._id ? 'Guardar' : 'Agregar' }}
                  </a-button>
                </div>
              </template>
            </a-drawer>
          </template>

        </div>
      </a-tab-pane>

    </a-tabs>

    <!-- ── Footer fijo con botones ─────────────────────────── -->
    <div class="form-footer">
      <a-button @click="router.push({ name: 'articulo-lista' })">Cancelar</a-button>
      <a-button
        type="primary"
        :loading="submitting"
        @click="guardar"
        class="btn-save"
      >
        <SaveOutlined /> {{ isEdit ? 'Guardar cambios' : 'Crear artículo' }}
      </a-button>
    </div>

  </div>
</template>

<style scoped>
.form-root {
  background: var(--surface-0, #fff);
  border-radius: var(--radius-lg, 10px);
  overflow: hidden;
  box-shadow: var(--card-shadow, 0 1px 6px rgba(0,0,0,.07));
  display: flex;
  flex-direction: column;
}

/* ── Header ──────────────────────────────────────────────── */
.form-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border, #f0f0f0);
  flex-wrap: wrap;
}
.btn-back { color: var(--text-2, #64748b); padding: 0 8px; }
.form-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-0, #0f172a);
  flex: 1;
}
.header-actions { display: flex; align-items: center; gap: 12px; }
.btn-save { height: 36px; font-weight: 600; }

/* ── Tabs ────────────────────────────────────────────────── */
.form-tabs :deep(.ant-tabs-nav) { padding: 0 24px; margin: 0; }

/* ── Tab body ────────────────────────────────────────────── */
.tab-body { padding: 24px; }

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

/* ── Secciones ───────────────────────────────────────────── */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: var(--text-2, #64748b);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border, #e2e8f0);
}

/* ── Campos ──────────────────────────────────────────────── */
.field-group { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field--full { grid-column: 1 / -1; }
.field--checks { }

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1, #334155);
}
.field-label.req::after {
  content: ' *';
  color: #ef4444;
}
.field-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-2, #94a3b8);
  margin-left: 4px;
}

.checks-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 0;
}

/* Foto */
.foto-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.foto-preview {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  border: 1px solid var(--border, #e2e8f0);
  background: var(--surface-1, #f8fafc);
}
.foto-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ── Footer ──────────────────────────────────────────────── */
.form-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid var(--border, #f0f0f0);
  background: var(--surface-1, #f8fafc);
}

/* ── Pestaña Proveedores ─────────────────────────────────── */
.prov-toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
.prov-count   { font-size:13px; color:var(--text-2,#64748b); }
.prov-list    { display:flex; flex-direction:column; gap:10px; }
.prov-card {
  border:1px solid var(--border,#e2e8f0);
  border-radius:var(--radius-md,8px);
  overflow:hidden;
}
.prov-card--fuente { border-color:#f59e0b; border-left:4px solid #f59e0b; }
.prov-card-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px;
  background:var(--surface-1,#f8fafc);
  border-bottom:1px solid var(--border,#f0f0f0);
  flex-wrap:wrap; gap:6px;
}
.prov-identity { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.prov-name     { font-size:14px; font-weight:700; color:var(--text-0); }
.prov-cod-sys  {
  font-family:monospace; font-size:11px;
  background:var(--surface-0,#fff); border:1px solid var(--border);
  padding:1px 6px; border-radius:4px; color:var(--text-2);
}
.prov-card-body  { padding:10px 14px; display:flex; flex-direction:column; gap:5px; }
.prov-field      { display:flex; align-items:baseline; gap:10px; }
.prov-field-label {
  font-size:11px; font-weight:600; color:var(--text-2);
  text-transform:uppercase; letter-spacing:.04em; min-width:160px; flex-shrink:0;
}
.prov-field-value { font-size:13px; color:var(--text-0); }
.prov-card-actions {
  display:flex; gap:4px; padding:6px 10px;
  border-top:1px solid var(--border,#f0f0f0);
  background:var(--surface-1,#f8fafc);
}
.btn-star      { color:#b45309; }
.btn-star:hover      { background:#fef3c7!important; }
.btn-edit-prov { color:#6366f1; }
.btn-edit-prov:hover { background:#f5f3ff!important; }

/* Drawer */
.drawer-fields { display:flex; flex-direction:column; gap:16px; }
.field         { display:flex; flex-direction:column; gap:5px; }
.field-label   { font-size:12px; font-weight:600; color:var(--text-1); }
.field-label.req::after { content:' *'; color:#ef4444; }
.field-hint    { font-size:11px; color:var(--text-2); }
.drawer-footer { display:flex; justify-content:flex-end; gap:8px; }
</style>
