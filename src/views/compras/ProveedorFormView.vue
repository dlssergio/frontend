<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { SaveOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import { proveedoresService } from '@/services/compras'
import api from '@/services/api'

const router = useRouter()
const route  = useRoute()
const id     = route.params.id
const isEdit = computed(() => !!id)

const loading    = ref(false)
const submitting = ref(false)
const activeTab  = ref('datos')
const situaciones = ref([])
const monedas     = ref([])

// ─── Datos de la Entidad ─────────────────────────────────────
const entidad = reactive({
  razon_social:  '',
  cuit:          '',
  email:         '',
  situacion_iva: null,
})

// ─── Validación CUIT: formato XX-XXXXXXXX-X, solo dígitos + guiones ──
const cuitError = ref('')

const formatearCuit = (raw) => {
  // Eliminar todo lo que no sea dígito
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length <= 2)  return digits
  if (digits.length <= 10) return `${digits.slice(0,2)}-${digits.slice(2)}`
  return `${digits.slice(0,2)}-${digits.slice(2,10)}-${digits.slice(10,11)}`
}

const onCuitInput = (e) => {
  const raw    = e.target.value
  const digits = raw.replace(/\D/g, '').slice(0, 11)   // máx 11 dígitos
  entidad.cuit = formatearCuit(digits)
  cuitError.value = digits.length > 0 && digits.length < 11
    ? 'El CUIT debe tener 11 dígitos'
    : ''
}

const validarCuit = () => {
  const digits = (entidad.cuit || '').replace(/\D/g, '')
  if (digits.length > 0 && digits.length < 11) {
    cuitError.value = 'El CUIT debe tener 11 dígitos (formato XX-XXXXXXXX-X)'
    return false
  }
  cuitError.value = ''
  return true
}

// ─── Datos del Proveedor ─────────────────────────────────────
const form = reactive({
  nombre_fantasia:   '',
  limite_credito:    0,
  plazo_pago_dias:   30,
  descuento_compra:  0,
  moneda_compra:     null,
  situacion_iibb:    '',
  nro_iibb:          '',
  banco_nombre:      '',
  banco_cbu:         '',
  banco_alias:       '',
  banco_cuenta_nro:  '',
  banco_tipo_cuenta: '',
  contacto_nombre:   '',
  contacto_email:    '',
  contacto_telefono: '',
  fecha_alta:        null,
  esta_activo:       true,
  observaciones:     '',
})

const cargarAuxiliares = async () => {
  try {
    const [sR, mR] = await Promise.allSettled([
      api.get('/api/clientes-admin-meta/situaciones-iva/'),   // ← endpoint correcto
      api.get('/api/monedas/'),
    ])
    if (sR.status === 'fulfilled') situaciones.value = sR.value.data.results ?? sR.value.data
    if (mR.status === 'fulfilled') monedas.value     = mR.value.data.results ?? mR.value.data
  } catch { /* silencioso */ }
}

const cargarProveedor = async () => {
  loading.value = true
  try {
    const res = await proveedoresService.obtener(id)
    const p   = res.data
    Object.assign(entidad, {
      razon_social:  p.entidad?.razon_social  ?? '',
      cuit:          p.entidad?.cuit          ?? '',
      email:         p.entidad?.email         ?? '',
      situacion_iva: p.entidad?.situacion_iva?.id ?? null,
    })
    Object.assign(form, {
      nombre_fantasia:   p.nombre_fantasia   ?? '',
      limite_credito:    parseFloat(p.limite_credito) || 0,
      plazo_pago_dias:   p.plazo_pago_dias   ?? 30,
      descuento_compra:  parseFloat(p.descuento_compra) || 0,
      moneda_compra:     p.moneda_compra     ?? null,
      situacion_iibb:    p.situacion_iibb    ?? '',
      nro_iibb:          p.nro_iibb          ?? '',
      banco_nombre:      p.banco_nombre      ?? '',
      banco_cbu:         p.banco_cbu         ?? '',
      banco_alias:       p.banco_alias       ?? '',
      banco_cuenta_nro:  p.banco_cuenta_nro  ?? '',
      banco_tipo_cuenta: p.banco_tipo_cuenta ?? '',
      contacto_nombre:   p.contacto_nombre   ?? '',
      contacto_email:    p.contacto_email    ?? '',
      contacto_telefono: p.contacto_telefono ?? '',
      fecha_alta:        p.fecha_alta        ?? null,
      esta_activo:       p.esta_activo,
      observaciones:     p.observaciones     ?? '',
    })
  } catch {
    message.error('No se pudo cargar el proveedor.')
    router.push({ name: 'proveedores-lista' })
  } finally {
    loading.value = false
  }
}

const guardar = async () => {
  if (!entidad.razon_social?.trim()) {
    message.error('La razón social es obligatoria.')
    activeTab.value = 'datos'; return
  }
  if (!validarCuit()) {
    activeTab.value = 'datos'; return
  }

  submitting.value = true
  try {
    const payload = {
      ...form,
      razon_social:  entidad.razon_social,
      cuit:          entidad.cuit  || null,
      email:         entidad.email || null,
      situacion_iva: entidad.situacion_iva,
    }
    // Limpiar strings vacíos
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })

    if (isEdit.value) {
      await proveedoresService.actualizar(id, payload)
      message.success('Proveedor actualizado.')
    } else {
      await proveedoresService.crear(payload)
      message.success('Proveedor creado.')
    }
    router.push({ name: 'proveedores-lista' })
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

onMounted(async () => {
  await cargarAuxiliares()
  if (isEdit.value) await cargarProveedor()
})
</script>

<template>
  <div class="form-root">

    <div class="form-header">
      <a-button type="text" @click="router.push({ name: 'proveedores-lista' })">
        <ArrowLeftOutlined /> Proveedores
      </a-button>
      <h1 class="form-title">{{ isEdit ? 'Editar Proveedor' : 'Nuevo Proveedor' }}</h1>
    </div>

    <a-skeleton v-if="loading" active :paragraph="{ rows: 8 }" style="padding:24px" />

    <a-tabs v-else v-model:activeKey="activeTab" class="form-tabs">

      <!-- Datos generales -->
      <a-tab-pane key="datos" tab="Datos Generales">
        <div class="tab-body">
          <div class="form-grid">

            <div class="field field--span2">
              <label class="field-label req">Razón Social</label>
              <a-input v-model:value="entidad.razon_social"
                placeholder="Razón social legal" allow-clear />
            </div>

            <div class="field">
              <label class="field-label">CUIT</label>
              <a-input
                :value="entidad.cuit"
                placeholder="XX-XXXXXXXX-X"
                allow-clear
                :status="cuitError ? 'error' : ''"
                maxlength="13"
                @input="onCuitInput"
                @blur="validarCuit"
              />
              <span v-if="cuitError" class="field-error">{{ cuitError }}</span>
              <span v-else class="field-hint">Solo números, formato automático XX-XXXXXXXX-X</span>
            </div>

            <div class="field">
              <label class="field-label">Nombre de Fantasía</label>
              <a-input v-model:value="form.nombre_fantasia" allow-clear />
            </div>

            <div class="field">
              <label class="field-label">Email</label>
              <a-input v-model:value="entidad.email" type="email" allow-clear />
            </div>

            <div class="field">
              <label class="field-label">Situación IVA</label>
              <a-select v-model:value="entidad.situacion_iva" allow-clear style="width:100%"
                :loading="!situaciones.length"
                placeholder="Seleccioná la situación IVA">
                <a-select-option v-for="s in situaciones" :key="s.id" :value="s.id">
                  {{ s.nombre }}
                </a-select-option>
              </a-select>
              <span v-if="!situaciones.length" class="field-hint">Cargando situaciones IVA…</span>
            </div>

            <div class="field">
              <label class="field-label">Situación IIBB</label>
              <a-input v-model:value="form.situacion_iibb" allow-clear />
            </div>

            <div class="field">
              <label class="field-label">N° IIBB</label>
              <a-input v-model:value="form.nro_iibb" allow-clear />
            </div>

            <div class="field">
              <label class="field-label">Fecha de Alta</label>
              <a-input type="date" v-model:value="form.fecha_alta" style="width:100%" />
            </div>

            <div class="field">
              <a-checkbox v-model:checked="form.esta_activo">Proveedor Activo</a-checkbox>
              <span class="field-hint">Desactivar oculta el proveedor de las búsquedas</span>
            </div>

          </div>
        </div>
      </a-tab-pane>

      <!-- Comercial -->
      <a-tab-pane key="comercial" tab="Comercial">
        <div class="tab-body">
          <div class="form-grid">
            <div class="field">
              <label class="field-label">Límite de Crédito</label>
              <a-input-number v-model:value="form.limite_credito" :min="0" :precision="2"
                addon-before="$" style="width:100%" />
            </div>
            <div class="field">
              <label class="field-label">Plazo de Pago (días)</label>
              <a-input-number v-model:value="form.plazo_pago_dias" :min="0" style="width:100%" />
            </div>
            <div class="field">
              <label class="field-label">Descuento Base (%)</label>
              <a-input-number v-model:value="form.descuento_compra" :min="0" :max="100"
                :precision="2" addon-after="%" style="width:100%" />
            </div>
            <div class="field">
              <label class="field-label">Moneda de Compra</label>
              <a-select v-model:value="form.moneda_compra" allow-clear style="width:100%">
                <a-select-option v-for="m in monedas" :key="m.id" :value="m.id">
                  {{ m.nombre }} ({{ m.simbolo }})
                </a-select-option>
              </a-select>
            </div>
          </div>
        </div>
      </a-tab-pane>

      <!-- Bancario -->
      <a-tab-pane key="bancario" tab="Bancario">
        <div class="tab-body">
          <div class="form-grid">
            <div class="field">
              <label class="field-label">Banco</label>
              <a-input v-model:value="form.banco_nombre" allow-clear />
            </div>
            <div class="field">
              <label class="field-label">Tipo de Cuenta</label>
              <a-select v-model:value="form.banco_tipo_cuenta" allow-clear style="width:100%">
                <a-select-option value="Cta Cte">Cuenta Corriente</a-select-option>
                <a-select-option value="Caja de Ahorros">Caja de Ahorros</a-select-option>
              </a-select>
            </div>
            <div class="field field--span2">
              <label class="field-label">CBU</label>
              <a-input v-model:value="form.banco_cbu" placeholder="22 dígitos" allow-clear />
            </div>
            <div class="field">
              <label class="field-label">Alias CBU</label>
              <a-input v-model:value="form.banco_alias" allow-clear />
            </div>
            <div class="field">
              <label class="field-label">N° de Cuenta</label>
              <a-input v-model:value="form.banco_cuenta_nro" allow-clear />
            </div>
          </div>
        </div>
      </a-tab-pane>

      <!-- Contacto -->
      <a-tab-pane key="contacto" tab="Contacto">
        <div class="tab-body">
          <div class="form-grid">
            <div class="field field--span2">
              <label class="field-label">Nombre del Contacto</label>
              <a-input v-model:value="form.contacto_nombre" allow-clear />
            </div>
            <div class="field">
              <label class="field-label">Email Comercial</label>
              <a-input v-model:value="form.contacto_email" type="email" allow-clear />
            </div>
            <div class="field">
              <label class="field-label">Teléfono</label>
              <a-input v-model:value="form.contacto_telefono" allow-clear />
            </div>
            <div class="field field--span2">
              <label class="field-label">Observaciones</label>
              <a-textarea v-model:value="form.observaciones" :rows="4" allow-clear />
            </div>
          </div>
        </div>
      </a-tab-pane>

    </a-tabs>

    <div class="form-footer">
      <a-button @click="router.push({ name: 'proveedores-lista' })">Cancelar</a-button>
      <a-button type="primary" :loading="submitting" @click="guardar">
        <SaveOutlined /> {{ isEdit ? 'Guardar cambios' : 'Crear Proveedor' }}
      </a-button>
    </div>

  </div>
</template>

<style scoped>
.form-root    { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }
.form-header  { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); }
.form-title   { margin:0; font-size:18px; font-weight:700; color:var(--text-0); }
.form-tabs :deep(.ant-tabs-nav) { padding:0 20px; margin:0; }
.tab-body     { padding:24px; }
.form-grid    { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:18px; }
.field        { display:flex; flex-direction:column; gap:5px; }
.field--span2 { grid-column:span 2; }
.field-label  { font-size:12px; font-weight:600; color:var(--text-1); }
.field-label.req::after { content:' *'; color:#ef4444; }
.field-hint   { font-size:11px; color:var(--text-2); }
.field-error  { font-size:11px; color:#dc2626; font-weight:600; }
.form-footer  { display:flex; justify-content:flex-end; gap:8px; padding:14px 24px; border-top:1px solid var(--border,#f0f0f0); background:var(--surface-1,#f8fafc); }
</style>
