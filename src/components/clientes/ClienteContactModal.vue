
<script setup>
import { reactive, watch, computed } from 'vue'

const props = defineProps({ open: Boolean, value: { type: Object, default: null } })
const emit = defineEmits(['update:open', 'save'])

const form = reactive({
  nombre: '', apellido: '', cargo: '', email: '', telefono: '', celular: '',
  es_principal: false, recibe_facturacion: false, recibe_cobranzas: false,
  activo: true, observaciones: '',
})

watch(() => props.value, (val) => {
  Object.assign(form, {
    nombre: '', apellido: '', cargo: '', email: '', telefono: '', celular: '',
    es_principal: false, recibe_facturacion: false, recibe_cobranzas: false,
    activo: true, observaciones: '',
    ...(val || {}),
  })
}, { immediate: true })

const title = computed(() => props.value?.id ? 'Editar contacto' : 'Nuevo contacto')
const close = () => emit('update:open', false)
const save = () => emit('save', { ...form })
</script>

<template>
  <a-modal :open="open" :title="title" width="720" @cancel="close" @ok="save">
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col :span="12"><a-form-item label="Nombre"><a-input v-model:value="form.nombre" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="Apellido"><a-input v-model:value="form.apellido" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12"><a-form-item label="Cargo"><a-input v-model:value="form.cargo" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="Email"><a-input v-model:value="form.email" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="12"><a-form-item label="Teléfono"><a-input v-model:value="form.telefono" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="Celular"><a-input v-model:value="form.celular" /></a-form-item></a-col>
      </a-row>
      <a-space wrap>
        <a-checkbox v-model:checked="form.es_principal">Principal</a-checkbox>
        <a-checkbox v-model:checked="form.recibe_facturacion">Recibe facturación</a-checkbox>
        <a-checkbox v-model:checked="form.recibe_cobranzas">Recibe cobranzas</a-checkbox>
        <a-checkbox v-model:checked="form.activo">Activo</a-checkbox>
      </a-space>
      <a-form-item label="Observaciones" style="margin-top: 12px"><a-textarea v-model:value="form.observaciones" :rows="3" /></a-form-item>
    </a-form>
  </a-modal>
</template>
