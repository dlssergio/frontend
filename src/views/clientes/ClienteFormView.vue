<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UserOutlined,
  DollarOutlined,
  PhoneOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TagsOutlined,
  TeamOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons-vue'

import {
  createCliente,
  fetchCategoriasCliente,
  fetchCliente,
  fetchPriceLists,
  fetchSituacionesIVA,
  fetchVendedores,
  updateCliente,
} from '@/services/clientes'

const route = useRoute()
const router = useRouter()

const isEdit = computed(() => !!route.params.id)
const loading = ref(false)
const saving = ref(false)
const activeTab = ref('general')
const formErrors = ref({})

const situacionesIva = ref([])
const categorias = ref([])
const vendedores = ref([])
const priceLists = ref([])

const cuitTouchedManually = ref(false)

const form = reactive({
  razon_social: '',
  sexo: null,
  dni: '',
  cuit: '',
  situacion_iva: null,
  email: '',

  codigo_cliente: '',
  nombre_fantasia: '',
  categoria: 'MIN',
  price_list: null,
  vendedor: null,
  descuento_base: 0,
  zona: '',
  permite_cta_cte: false,
  limite_credito: 0,
  dias_vencimiento: 0,
  contacto_nombre: '',
  contacto_email: '',
  contacto_telefono: '',
  esta_activo: true,
  observaciones: '',

  domicilios: [],
  telefonos: [],
  emails_secundarios: [],
})

const tabs = [
  { key: 'general', label: 'General', icon: UserOutlined },
  { key: 'fiscal', label: 'Fiscal', icon: SafetyCertificateOutlined },
  { key: 'comercial', label: 'Comercial', icon: DollarOutlined },
  { key: 'contacto', label: 'Contacto', icon: PhoneOutlined },
  { key: 'direcciones', label: 'Direcciones', icon: EnvironmentOutlined },
  { key: 'canales', label: 'Canales', icon: MailOutlined },
  { key: 'interno', label: 'Interno', icon: FileTextOutlined },
]

const hasMainErrors = computed(() => Object.keys(formErrors.value || {}).length > 0)

const statusLabel = computed(() => {
  if (!isEdit.value) return 'Alta nueva'
  return form.esta_activo ? 'Activo' : 'Inactivo'
})

const statusTone = computed(() => {
  if (!isEdit.value) return 'draft'
  return form.esta_activo ? 'success' : 'muted'
})

const selectedCategoriaLabel = computed(() => {
  return categorias.value.find((x) => x.value === form.categoria)?.label || form.categoria || '—'
})

const selectedVendedorLabel = computed(() => {
  return vendedores.value.find((x) => x.id === form.vendedor)?.label || 'Sin asignar'
})

const selectedPriceListLabel = computed(() => {
  return priceLists.value.find((x) => x.id === form.price_list)?.label || 'Sin lista'
})

const domicilioPrincipal = computed(() => {
  return form.domicilios.find((d) => d.es_principal) || form.domicilios[0] || null
})

const summaryItems = computed(() => [
  {
    label: 'Código',
    value: form.codigo_cliente || 'Autogenerado',
    icon: TagsOutlined,
  },
  {
    label: 'Categoría',
    value: selectedCategoriaLabel.value,
    icon: UserOutlined,
  },
  {
    label: 'Lista de precios',
    value: selectedPriceListLabel.value,
    icon: ApartmentOutlined,
  },
  {
    label: 'Vendedor',
    value: selectedVendedorLabel.value,
    icon: TeamOutlined,
  },
  {
    label: 'Crédito',
    value: money(form.limite_credito || 0),
    icon: DollarOutlined,
  },
  {
    label: 'Domicilio principal',
    value: domicilioPrincipal.value
      ? `${domicilioPrincipal.value.calle || ''} ${domicilioPrincipal.value.numero || ''}`.trim()
      : 'Sin domicilio',
    icon: EnvironmentOutlined,
  },
])

function money(value) {
  const n = Number(value || 0)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(n)
}

function normalizeNullable(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') {
    const trimmed = v.trim()
    return trimmed === '' ? null : trimmed
  }
  return v
}

function cleanDigits(value) {
  return String(value || '').replace(/\D/g, '')
}

function formatCuit(value) {
  const digits = cleanDigits(value)
  if (digits.length !== 11) return value || ''
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

function calcularCuilDesdeDni(dni, sexo) {
  const dniDigits = cleanDigits(dni)
  if (dniDigits.length !== 8) return ''

  let prefijo = null
  if (sexo === 'M') prefijo = '20'
  else if (sexo === 'F') prefijo = '27'
  else return ''

  const baseMultiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let numero = prefijo + dniDigits
  let suma = 0

  for (let i = 0; i < 10; i += 1) suma += Number(numero[i]) * baseMultiplicadores[i]

  let resto = suma % 11
  let verificador = 11 - resto

  if (verificador === 11) {
    verificador = 0
  } else if (verificador === 10) {
    prefijo = '23'
    numero = prefijo + dniDigits
    suma = 0
    for (let i = 0; i < 10; i += 1) suma += Number(numero[i]) * baseMultiplicadores[i]
    resto = suma % 11
    verificador = 11 - resto
    if (verificador === 11) verificador = 0
    if (verificador === 10) return ''
  }

  return formatCuit(`${prefijo}${dniDigits}${verificador}`)
}

function tryAutofillCuit() {
  const dniDigits = cleanDigits(form.dni)
  if (!['M', 'F'].includes(form.sexo)) return
  if (dniDigits.length !== 8) return
  if (cuitTouchedManually.value) return

  const generado = calcularCuilDesdeDni(dniDigits, form.sexo)
  if (generado) form.cuit = generado
}

function onCuitInput(value) {
  form.cuit = value
  cuitTouchedManually.value = true
}

function resetManualCuitControlIfEmpty() {
  if (!normalizeNullable(form.cuit)) {
    cuitTouchedManually.value = false
    tryAutofillCuit()
  }
}

function newDomicilio() {
  return {
    calle: '',
    numero: '',
    piso: '',
    dpto: '',
    localidad: '',
    tipo_direccion: 'COMERCIAL',
    es_principal: form.domicilios.length === 0,
    referencia: '',
    latitud: null,
    longitud: null,
  }
}

function newTelefono() {
  return {
    numero: '',
    tipo: 'CEL',
  }
}

function newEmailSecundario() {
  return {
    email: '',
    tipo: 'Secundario',
  }
}

function addDomicilio() {
  form.domicilios.push(newDomicilio())
}

function removeDomicilio(index) {
  form.domicilios.splice(index, 1)
  if (form.domicilios.length && !form.domicilios.some((d) => d.es_principal)) {
    form.domicilios[0].es_principal = true
  }
}

function setDomicilioPrincipal(index) {
  form.domicilios.forEach((d, i) => {
    d.es_principal = i === index
  })
}

function addTelefono() {
  form.telefonos.push(newTelefono())
}

function removeTelefono(index) {
  form.telefonos.splice(index, 1)
}

function addEmailSecundario() {
  form.emails_secundarios.push(newEmailSecundario())
}

function removeEmailSecundario(index) {
  form.emails_secundarios.splice(index, 1)
}

function normalizePayload() {
  return {
    razon_social: normalizeNullable(form.razon_social),
    sexo: normalizeNullable(form.sexo),
    dni: normalizeNullable(cleanDigits(form.dni)),
    cuit: normalizeNullable(cleanDigits(form.cuit)),
    situacion_iva: normalizeNullable(form.situacion_iva),
    email: normalizeNullable(form.email),

    codigo_cliente: normalizeNullable(form.codigo_cliente),
    nombre_fantasia: normalizeNullable(form.nombre_fantasia),
    categoria: normalizeNullable(form.categoria) || 'MIN',
    price_list: normalizeNullable(form.price_list),
    vendedor: normalizeNullable(form.vendedor),
    descuento_base: Number(form.descuento_base || 0),
    zona: normalizeNullable(form.zona),
    permite_cta_cte: !!form.permite_cta_cte,
    limite_credito: Number(form.limite_credito || 0),
    dias_vencimiento: Number(form.dias_vencimiento || 0),
    contacto_nombre: normalizeNullable(form.contacto_nombre),
    contacto_email: normalizeNullable(form.contacto_email),
    contacto_telefono: normalizeNullable(form.contacto_telefono),
    esta_activo: !!form.esta_activo,
    observaciones: normalizeNullable(form.observaciones),

    domicilios: form.domicilios
      .map((d) => ({
        calle: normalizeNullable(d.calle),
        numero: normalizeNullable(d.numero),
        piso: normalizeNullable(d.piso),
        dpto: normalizeNullable(d.dpto),
        localidad: normalizeNullable(d.localidad),
        tipo_direccion: normalizeNullable(d.tipo_direccion) || 'COMERCIAL',
        es_principal: !!d.es_principal,
        referencia: normalizeNullable(d.referencia),
        latitud: d.latitud === '' ? null : d.latitud,
        longitud: d.longitud === '' ? null : d.longitud,
      }))
      .filter((d) => d.calle || d.localidad),

    telefonos: form.telefonos
      .map((t) => ({
        numero: normalizeNullable(t.numero),
        tipo: normalizeNullable(t.tipo) || 'CEL',
      }))
      .filter((t) => t.numero),

    emails_secundarios: form.emails_secundarios
      .map((e) => ({
        email: normalizeNullable(e.email),
        tipo: normalizeNullable(e.tipo) || 'Secundario',
      }))
      .filter((e) => e.email),
  }
}

function validateClientSide() {
  const errors = {}

  if (!normalizeNullable(form.razon_social)) {
    errors.razon_social = ['La razón social es obligatoria.']
  }

  if (normalizeNullable(form.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = ['El email fiscal no es válido.']
  }

  if (normalizeNullable(form.contacto_email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contacto_email)) {
    errors.contacto_email = ['El email del contacto no es válido.']
  }

  for (const extra of form.emails_secundarios) {
    if (normalizeNullable(extra.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extra.email)) {
      errors.emails_secundarios = ['Hay emails secundarios con formato inválido.']
      break
    }
  }

  if (Number(form.descuento_base || 0) < 0 || Number(form.descuento_base || 0) > 100) {
    errors.descuento_base = ['El descuento debe estar entre 0 y 100.']
  }

  if (Number(form.limite_credito || 0) < 0) {
    errors.limite_credito = ['El límite de crédito no puede ser negativo.']
  }

  if (Number(form.dias_vencimiento || 0) < 0) {
    errors.dias_vencimiento = ['Los días de vencimiento no pueden ser negativos.']
  }

  if (normalizeNullable(form.dni) && cleanDigits(form.dni).length !== 8) {
    errors.dni = ['El DNI debe tener 8 dígitos.']
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

function extractErrorMessage(err) {
  const data = err?.response?.data
  if (!data) return 'No se pudo guardar el cliente.'
  if (typeof data === 'string') return data

  const lines = []
  Object.entries(data).forEach(([field, value]) => {
    if (Array.isArray(value)) {
      lines.push(`${field}: ${value.join(', ')}`)
    } else if (typeof value === 'string') {
      lines.push(`${field}: ${value}`)
    } else if (value && typeof value === 'object') {
      lines.push(`${field}: ${JSON.stringify(value)}`)
    }
  })

  return lines.length ? lines.join(' | ') : 'No se pudo guardar el cliente.'
}

async function loadMetadata() {
  try {
    const [ivaRes, categoriasRes, vendedoresRes, priceListsRes] = await Promise.all([
      fetchSituacionesIVA(),
      fetchCategoriasCliente(),
      fetchVendedores(),
      fetchPriceLists(),
    ])

    situacionesIva.value = Array.isArray(ivaRes.data) ? ivaRes.data : []
    categorias.value = Array.isArray(categoriasRes.data) ? categoriasRes.data : []
    vendedores.value = Array.isArray(vendedoresRes.data) ? vendedoresRes.data : []
    priceLists.value = Array.isArray(priceListsRes.data) ? priceListsRes.data : []
  } catch (e) {
    console.error(e)
    message.error('No se pudieron cargar los catálogos del formulario')
  }
}

async function loadCliente() {
  if (!isEdit.value) return

  loading.value = true
  try {
    const { data } = await fetchCliente(route.params.id)
    Object.assign(form, {
      razon_social: data?.entidad?.razon_social || '',
      sexo: data?.entidad?.sexo || null,
      dni: data?.entidad?.dni || '',
      cuit: formatCuit(data?.entidad?.cuit || ''),
      situacion_iva: data?.entidad?.situacion_iva?.id || null,
      email: data?.entidad?.email || '',

      codigo_cliente: data?.codigo_cliente || '',
      nombre_fantasia: data?.nombre_fantasia || '',
      categoria: data?.categoria || 'MIN',
      price_list: data?.price_list?.id || null,
      vendedor: data?.vendedor?.id || null,
      descuento_base: Number(data?.descuento_base || 0),
      zona: data?.zona || '',
      permite_cta_cte: !!data?.permite_cta_cte,
      limite_credito: Number(data?.limite_credito || 0),
      dias_vencimiento: Number(data?.dias_vencimiento || 0),
      contacto_nombre: data?.contacto_nombre || '',
      contacto_email: data?.contacto_email || '',
      contacto_telefono: data?.contacto_telefono || '',
      esta_activo: !!data?.esta_activo,
      observaciones: data?.observaciones || '',

      domicilios: Array.isArray(data?.domicilios) ? data.domicilios : [],
      telefonos: Array.isArray(data?.telefonos) ? data.telefonos : [],
      emails_secundarios: Array.isArray(data?.emails_secundarios) ? data.emails_secundarios : [],
    })

    cuitTouchedManually.value = false
  } catch (e) {
    console.error(e)
    message.error('No se pudo cargar el cliente')
    router.push({ name: 'clientes-lista' })
  } finally {
    loading.value = false
  }
}

async function onSubmit() {
  formErrors.value = {}

  if (!validateClientSide()) {
    message.warning('Revisá los campos marcados antes de guardar.')
    return
  }

  saving.value = true
  try {
    const payload = normalizePayload()

    if (isEdit.value) {
      await updateCliente(route.params.id, payload)
      message.success('Cliente actualizado correctamente')
    } else {
      await createCliente(payload)
      message.success('Cliente creado correctamente')
    }

    router.push({ name: 'clientes-lista' })
  } catch (e) {
    console.error(e)
    if (e?.response?.data && typeof e.response.data === 'object') {
      formErrors.value = e.response.data
    }
    message.error(extractErrorMessage(e))
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push({ name: 'clientes-lista' })
}

watch(
  () => form.permite_cta_cte,
  (enabled) => {
    if (!enabled) {
      form.limite_credito = 0
      form.dias_vencimiento = 0
    }
  }
)

watch(
  () => [form.dni, form.sexo],
  () => {
    tryAutofillCuit()
  }
)

watch(
  () => form.cuit,
  () => {
    resetManualCuitControlIfEmpty()
  }
)

onMounted(async () => {
  await loadMetadata()
  await loadCliente()

  if (!form.domicilios.length) addDomicilio()
  if (!form.telefonos.length) addTelefono()
  if (!form.emails_secundarios.length) addEmailSecundario()

  tryAutofillCuit()
})
</script>

<template>
  <div class="cliente-page">
    <div class="hero">
      <div class="hero__left">
        <a-button class="back-btn" @click="goBack">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>

        <div class="hero__title-wrap">
          <div class="hero__eyebrow">Customer Master · ERP Enterprise</div>
          <h1 class="hero__title">
            {{ isEdit ? 'Editar cliente' : 'Alta de cliente' }}
          </h1>
          <div class="hero__subtitle">
            Maestro comercial y fiscal 360°, con estructura preparada para operación real: pricing, crédito, direcciones y canales múltiples.
          </div>

          <div class="hero__chips">
            <span class="status-pill" :class="`status-pill--${statusTone}`">
              {{ statusLabel }}
            </span>

            <span class="info-pill">
              <SafetyCertificateOutlined />
              Fiscal y comercial
            </span>

            <span class="info-pill">
              <EnvironmentOutlined />
              Múltiples direcciones
            </span>

            <span class="info-pill">
              <MailOutlined />
              Canales múltiples
            </span>
          </div>
        </div>
      </div>

      <div class="hero__right">
        <div class="metric-card">
          <div class="metric-card__label">Límite de crédito</div>
          <div class="metric-card__value">{{ money(form.limite_credito) }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-card__label">Lista de precios</div>
          <div class="metric-card__value metric-card__value--small">
            {{ selectedPriceListLabel }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="hasMainErrors" class="error-banner">
      <WarningOutlined />
      <span>Hay errores de validación. Revisá los campos marcados abajo.</span>
    </div>

    <div class="content-grid">
      <section class="main-panel">
        <a-spin :spinning="loading">
          <a-card class="form-card" :bordered="false">
            <div class="tabs-bar">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="tab-btn"
                :class="{ 'tab-btn--active': activeTab === tab.key }"
                @click="activeTab = tab.key"
              >
                <component :is="tab.icon" />
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <div v-show="activeTab === 'general'" class="panel">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Identidad comercial</div>
                  <h3 class="section-head__title">Datos generales</h3>
                </div>
              </div>

              <a-row :gutter="[16, 8]">
                <a-col :xs="24" :lg="16">
                  <a-form-item
                    label="Razón social"
                    :validate-status="formErrors.razon_social ? 'error' : ''"
                    :help="formErrors.razon_social?.[0]"
                    required
                  >
                    <a-input v-model:value="form.razon_social" size="large" placeholder="Ej. DEMO SA" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Código cliente">
                    <a-input v-model:value="form.codigo_cliente" size="large" placeholder="Autogenerado" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Nombre fantasía">
                    <a-input v-model:value="form.nombre_fantasia" size="large" placeholder="Nombre comercial" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Categoría">
                    <a-select
                      v-model:value="form.categoria"
                      size="large"
                      :options="categorias"
                      :field-names="{ value: 'value', label: 'label' }"
                      placeholder="Seleccionar categoría"
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>

            <div v-show="activeTab === 'fiscal'" class="panel">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Compliance</div>
                  <h3 class="section-head__title">Datos fiscales</h3>
                </div>
              </div>

              <a-row :gutter="[16, 8]">
                <a-col :xs="24" :lg="8">
                  <a-form-item label="DNI" :validate-status="formErrors.dni ? 'error' : ''" :help="formErrors.dni?.[0]">
                    <a-input v-model:value="form.dni" size="large" placeholder="Documento" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Sexo / género">
                    <a-select v-model:value="form.sexo" size="large" allow-clear placeholder="Opcional">
                      <a-select-option value="M">Masculino</a-select-option>
                      <a-select-option value="F">Femenino</a-select-option>
                      <a-select-option value="J">Persona Jurídica</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item
                    label="CUIT / CUIL"
                    :validate-status="formErrors.cuit ? 'error' : ''"
                    :help="formErrors.cuit?.[0] || 'Se autocompleta desde DNI + sexo cuando aplica.'"
                  >
                    <a-input :value="form.cuit" size="large" placeholder="20-12345678-9" @update:value="onCuitInput" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Situación IVA">
                    <a-select
                      v-model:value="form.situacion_iva"
                      size="large"
                      allow-clear
                      :options="situacionesIva.map((s) => ({ value: s.id, label: `${s.codigo} - ${s.nombre}` }))"
                      placeholder="Seleccionar situación IVA"
                    />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Email fiscal" :validate-status="formErrors.email ? 'error' : ''" :help="formErrors.email?.[0]">
                    <a-input v-model:value="form.email" size="large" placeholder="facturacion@cliente.com" />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>

            <div v-show="activeTab === 'comercial'" class="panel">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Pricing & Risk</div>
                  <h3 class="section-head__title">Condiciones comerciales</h3>
                </div>
              </div>

              <a-row :gutter="[16, 8]">
                <a-col :xs="24" :lg="12">
                  <a-form-item label="Vendedor asignado">
                    <a-select
                      v-model:value="form.vendedor"
                      size="large"
                      allow-clear
                      :options="vendedores.map((v) => ({ value: v.id, label: v.label }))"
                      placeholder="Seleccionar vendedor"
                    />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Lista de precios">
                    <a-select
                      v-model:value="form.price_list"
                      size="large"
                      allow-clear
                      :options="priceLists.map((p) => ({ value: p.id, label: p.label }))"
                      placeholder="Seleccionar lista"
                    />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Zona">
                    <a-input v-model:value="form.zona" size="large" placeholder="Ej. Litoral" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Descuento base (%)" :validate-status="formErrors.descuento_base ? 'error' : ''" :help="formErrors.descuento_base?.[0]">
                    <a-input-number v-model:value="form.descuento_base" :min="0" :max="100" size="large" style="width: 100%" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Cuenta corriente">
                    <div class="switch-box">
                      <a-switch v-model:checked="form.permite_cta_cte" />
                      <span>{{ form.permite_cta_cte ? 'Habilitada' : 'Solo contado' }}</span>
                    </div>
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Límite de crédito" :validate-status="formErrors.limite_credito ? 'error' : ''" :help="formErrors.limite_credito?.[0]">
                    <a-input-number v-model:value="form.limite_credito" :min="0" size="large" style="width: 100%" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="12">
                  <a-form-item label="Días de vencimiento" :validate-status="formErrors.dias_vencimiento ? 'error' : ''" :help="formErrors.dias_vencimiento?.[0]">
                    <a-input-number v-model:value="form.dias_vencimiento" :min="0" size="large" style="width: 100%" />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>

            <div v-show="activeTab === 'contacto'" class="panel">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Relación comercial</div>
                  <h3 class="section-head__title">Contacto principal</h3>
                </div>
              </div>

              <a-row :gutter="[16, 8]">
                <a-col :xs="24" :lg="8">
                  <a-form-item label="Nombre de contacto">
                    <a-input v-model:value="form.contacto_nombre" size="large" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Email contacto" :validate-status="formErrors.contacto_email ? 'error' : ''" :help="formErrors.contacto_email?.[0]">
                    <a-input v-model:value="form.contacto_email" size="large" />
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="8">
                  <a-form-item label="Teléfono contacto">
                    <a-input v-model:value="form.contacto_telefono" size="large" />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>

            <div v-show="activeTab === 'direcciones'" class="panel">
              <div class="section-head section-head--with-action">
                <div>
                  <div class="section-head__eyebrow">Logística y facturación</div>
                  <h3 class="section-head__title">Direcciones</h3>
                </div>

                <a-button type="dashed" @click="addDomicilio">
                  <template #icon><PlusOutlined /></template>
                  Agregar dirección
                </a-button>
              </div>

              <div class="stack-list">
                <div v-for="(dom, index) in form.domicilios" :key="index" class="stack-card">
                  <div class="stack-card__head">
                    <div class="stack-card__title">
                      Dirección {{ index + 1 }}
                      <a-tag v-if="dom.es_principal" color="blue">Principal</a-tag>
                    </div>

                    <div class="stack-card__actions">
                      <a-button size="small" @click="setDomicilioPrincipal(index)">Marcar principal</a-button>
                      <a-button size="small" danger @click="removeDomicilio(index)">
                        <template #icon><DeleteOutlined /></template>
                      </a-button>
                    </div>
                  </div>

                  <a-row :gutter="[12, 8]">
                    <a-col :xs="24" :lg="8">
                      <a-form-item label="Tipo">
                        <a-select v-model:value="dom.tipo_direccion" size="large">
                          <a-select-option value="FISCAL">Fiscal</a-select-option>
                          <a-select-option value="ENTREGA">Entrega</a-select-option>
                          <a-select-option value="COMERCIAL">Comercial</a-select-option>
                          <a-select-option value="OTRA">Otra</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :lg="16">
                      <a-form-item label="Calle">
                        <a-input v-model:value="dom.calle" size="large" />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :lg="6">
                      <a-form-item label="Número">
                        <a-input v-model:value="dom.numero" size="large" />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :lg="6">
                      <a-form-item label="Piso">
                        <a-input v-model:value="dom.piso" size="large" />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :lg="6">
                      <a-form-item label="Depto">
                        <a-input v-model:value="dom.dpto" size="large" />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24" :lg="6">
                      <a-form-item label="Localidad">
                        <a-input v-model:value="dom.localidad" size="large" />
                      </a-form-item>
                    </a-col>

                    <a-col :xs="24">
                      <a-form-item label="Referencia">
                        <a-input v-model:value="dom.referencia" size="large" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'canales'" class="panel">
              <div class="section-head section-head--with-action">
                <div>
                  <div class="section-head__eyebrow">Comunicación</div>
                  <h3 class="section-head__title">Teléfonos y emails secundarios</h3>
                </div>
              </div>

              <div class="two-blocks">
                <div class="stack-block">
                  <div class="stack-block__head">
                    <h4>Teléfonos</h4>
                    <a-button type="dashed" size="small" @click="addTelefono">
                      <template #icon><PlusOutlined /></template>
                      Agregar
                    </a-button>
                  </div>

                  <div class="stack-list">
                    <div v-for="(tel, index) in form.telefonos" :key="index" class="stack-card">
                      <div class="stack-card__head">
                        <div class="stack-card__title">Teléfono {{ index + 1 }}</div>
                        <a-button size="small" danger @click="removeTelefono(index)">
                          <template #icon><DeleteOutlined /></template>
                        </a-button>
                      </div>

                      <a-row :gutter="[12, 8]">
                        <a-col :xs="24" :lg="8">
                          <a-form-item label="Tipo">
                            <a-select v-model:value="tel.tipo" size="large">
                              <a-select-option value="FIJO">Fijo</a-select-option>
                              <a-select-option value="CEL">Celular</a-select-option>
                              <a-select-option value="FAX">Fax</a-select-option>
                              <a-select-option value="COM">Comercial</a-select-option>
                            </a-select>
                          </a-form-item>
                        </a-col>

                        <a-col :xs="24" :lg="16">
                          <a-form-item label="Número">
                            <a-input v-model:value="tel.numero" size="large" />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </div>
                  </div>
                </div>

                <div class="stack-block">
                  <div class="stack-block__head">
                    <h4>Emails secundarios</h4>
                    <a-button type="dashed" size="small" @click="addEmailSecundario">
                      <template #icon><PlusOutlined /></template>
                      Agregar
                    </a-button>
                  </div>

                  <div class="stack-list">
                    <div v-for="(mail, index) in form.emails_secundarios" :key="index" class="stack-card">
                      <div class="stack-card__head">
                        <div class="stack-card__title">Email {{ index + 1 }}</div>
                        <a-button size="small" danger @click="removeEmailSecundario(index)">
                          <template #icon><DeleteOutlined /></template>
                        </a-button>
                      </div>

                      <a-row :gutter="[12, 8]">
                        <a-col :xs="24" :lg="8">
                          <a-form-item label="Tipo">
                            <a-input v-model:value="mail.tipo" size="large" placeholder="Ej. Compras / Cobranzas" />
                          </a-form-item>
                        </a-col>

                        <a-col :xs="24" :lg="16">
                          <a-form-item label="Email" :validate-status="formErrors.emails_secundarios ? 'error' : ''" :help="formErrors.emails_secundarios?.[0]">
                            <a-input v-model:value="mail.email" size="large" />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'interno'" class="panel">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Administración interna</div>
                  <h3 class="section-head__title">Estado y observaciones</h3>
                </div>
              </div>

              <a-row :gutter="[16, 8]">
                <a-col :xs="24" :lg="6">
                  <a-form-item label="Activo">
                    <div class="switch-box">
                      <a-switch v-model:checked="form.esta_activo" />
                      <span>{{ form.esta_activo ? 'Sí' : 'No' }}</span>
                    </div>
                  </a-form-item>
                </a-col>

                <a-col :xs="24" :lg="18">
                  <a-form-item label="Observaciones">
                    <a-textarea
                      v-model:value="form.observaciones"
                      :rows="5"
                      placeholder="Notas internas, acuerdos comerciales, alertas de gestión, etc."
                    />
                  </a-form-item>
                </a-col>
              </a-row>
            </div>
          </a-card>
        </a-spin>
      </section>

      <aside class="side-panel">
        <a-card class="side-card" :bordered="false">
          <div class="side-card__title">Resumen ejecutivo</div>

          <div class="summary-list">
            <div v-for="item in summaryItems" :key="item.label" class="summary-item">
              <div class="summary-item__icon">
                <component :is="item.icon" />
              </div>
              <div class="summary-item__content">
                <div class="summary-item__label">{{ item.label }}</div>
                <div class="summary-item__value">{{ item.value }}</div>
              </div>
            </div>
          </div>
        </a-card>

        <a-card class="side-card side-card--highlight" :bordered="false">
          <div class="side-card__title">Checklist comercial</div>

          <div class="check-row" :class="{ ok: !!form.razon_social }">
            <CheckCircleOutlined />
            <span>Razón social definida</span>
          </div>

          <div class="check-row" :class="{ ok: !!form.situacion_iva }">
            <CheckCircleOutlined />
            <span>Situación IVA seleccionada</span>
          </div>

          <div class="check-row" :class="{ ok: !!form.vendedor }">
            <CheckCircleOutlined />
            <span>Vendedor asignado</span>
          </div>

          <div class="check-row" :class="{ ok: !!form.price_list }">
            <CheckCircleOutlined />
            <span>Lista de precios asignada</span>
          </div>

          <div class="check-row" :class="{ ok: !!form.cuit }">
            <CheckCircleOutlined />
            <span>CUIT/CUIL disponible</span>
          </div>

          <div class="check-row" :class="{ ok: form.domicilios.some((d) => d.calle || d.localidad) }">
            <CheckCircleOutlined />
            <span>Al menos una dirección</span>
          </div>

          <div class="check-row" :class="{ ok: form.telefonos.some((t) => t.numero) || !!form.contacto_telefono }">
            <CheckCircleOutlined />
            <span>Canal telefónico disponible</span>
          </div>
        </a-card>
      </aside>
    </div>

    <div class="sticky-actions">
      <div class="sticky-actions__left">
        <span class="sticky-actions__meta">
          {{ isEdit ? 'Actualizando maestro de cliente' : 'Creando maestro de cliente' }}
        </span>
      </div>

      <div class="sticky-actions__right">
        <a-button size="large" @click="goBack">Cancelar</a-button>

        <a-button type="primary" size="large" :loading="saving" @click="onSubmit">
          <template #icon><SaveOutlined /></template>
          Guardar cliente
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cliente-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--text-0);
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px;
  border-radius: 6px;
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.10), transparent 32%),
    linear-gradient(135deg, color-mix(in srgb, var(--surface-1) 92%, transparent), color-mix(in srgb, var(--surface-0) 96%, transparent));
  border: 1px solid color-mix(in srgb, var(--text-2) 14%, transparent);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
}

.hero__left {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 6px;
}

.hero__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-2);
  margin-bottom: 6px;
}

.hero__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
  font-weight: 800;
  color: var(--text-0);
}

.hero__subtitle {
  margin-top: 8px;
  color: var(--text-1);
  max-width: 820px;
}

.hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.status-pill,
.info-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-pill--draft {
  background: rgba(var(--accent-rgb), 0.12);
  color: rgba(var(--accent-rgb), 1);
}

.status-pill--success {
  background: color-mix(in srgb, #16a34a 14%, transparent);
  color: color-mix(in srgb, #16a34a 88%, black 12%);
}

.status-pill--muted {
  background: color-mix(in srgb, var(--text-2) 12%, transparent);
  color: var(--text-1);
}

.info-pill {
  background: color-mix(in srgb, var(--surface-2) 72%, transparent);
  color: var(--text-1);
  border: 1px solid color-mix(in srgb, var(--text-2) 10%, transparent);
}

.hero__right {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
  min-width: 360px;
}

.metric-card {
  padding: 14px 16px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-0) 94%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 12%, transparent);
}

.metric-card__label {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 6px;
}

.metric-card__value {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-0);
}

.metric-card__value--small {
  font-size: 15px;
  line-height: 1.3;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 6px;
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: color-mix(in srgb, #f59e0b 86%, var(--text-0));
  border: 1px solid color-mix(in srgb, #f59e0b 24%, transparent);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.form-card,
.side-card {
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  background: var(--surface-0);
}

.tabs-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid color-mix(in srgb, var(--text-2) 12%, transparent);
}

.tab-btn {
  border: 1px solid color-mix(in srgb, var(--text-2) 10%, transparent);
  background: color-mix(in srgb, var(--surface-1) 76%, transparent);
  color: var(--text-1);
  padding: 10px 14px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-btn:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, rgba(var(--accent-rgb), 1) 24%, transparent);
}

.tab-btn--active {
  background: rgba(var(--accent-rgb), 0.14);
  color: rgba(var(--accent-rgb), 1);
  border-color: rgba(var(--accent-rgb), 0.24);
  box-shadow: inset 0 0 0 1px rgba(var(--accent-rgb), 0.08);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-head--with-action {
  align-items: center;
}

.section-head__eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  color: var(--text-2);
}

.section-head__title {
  margin: 4px 0 0;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-0);
}

.switch-box {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  color: var(--text-1);
}

.stack-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stack-card {
  padding: 14px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 10%, transparent);
}

.stack-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 12px;
}

.stack-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  color: var(--text-0);
}

.stack-card__actions {
  display: flex;
  gap: 8px;
}

.two-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.stack-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stack-block__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stack-block__head h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-0);
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.side-card__title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-0);
  margin-bottom: 14px;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 8%, transparent);
}

.summary-item__icon {
  width: 38px;
  height: 38px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: rgba(var(--accent-rgb), 0.14);
  color: rgba(var(--accent-rgb), 1);
  font-size: 16px;
}

.summary-item__label {
  font-size: 12px;
  color: var(--text-2);
}

.summary-item__value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-0);
}

.side-card--highlight {
  background:
    radial-gradient(circle at top right, rgba(var(--accent-rgb), 0.08), transparent 32%),
    var(--surface-0);
}

.check-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  color: var(--text-2);
  border-bottom: 1px solid color-mix(in srgb, var(--text-2) 10%, transparent);
}

.check-row:last-child {
  border-bottom: none;
}

.check-row.ok {
  color: color-mix(in srgb, #16a34a 84%, var(--text-0));
}

.sticky-actions {
  position: sticky;
  bottom: 0;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px 6px 0 0;
  backdrop-filter: blur(12px);
  background: color-mix(in srgb, var(--surface-0) 90%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 12%, transparent);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.08);
}

.sticky-actions__meta {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
}

.sticky-actions__right {
  display: flex;
  gap: 10px;
}

@media (max-width: 1280px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    flex-direction: column;
  }

  .hero__right {
    min-width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two-blocks {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .hero {
    padding: 16px;
  }

  .hero__title {
    font-size: 24px;
  }

  .hero__right {
    grid-template-columns: 1fr;
  }

  .stack-card__head,
  .stack-block__head,
  .section-head--with-action {
    flex-direction: column;
    align-items: stretch;
  }

  .sticky-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .sticky-actions__right {
    width: 100%;
    justify-content: stretch;
  }

  .sticky-actions__right :deep(.ant-btn) {
    flex: 1;
  }
}
</style>
