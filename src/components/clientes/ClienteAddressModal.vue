
<script setup>
import { reactive, watch, computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  value: { type: Object, default: null },
})
const emit = defineEmits(['update:open', 'save'])

const form = reactive({
  tipo_direccion: 'COMERCIAL',
  es_principal: false,
  es_fiscal: false,
  es_entrega: false,
  calle: '',
  numero: '',
  piso: '',
  dpto: '',
  localidad: null,
  referencia: '',
})

watch(() => props.value, (val) => {
  Object.assign(form, {
    tipo_direccion: 'COMERCIAL',
    es_principal: false,
    es_fiscal: false,
    es_entrega: false,
    calle: '',
    numero: '',
    piso: '',
    dpto: '',
    localidad: null,
    referencia: '',
    ...(val || {}),
  })
}, { immediate: true })

const title = computed(() => props.value?.id ? 'Editar dirección' : 'Nueva dirección')
const close = () => emit('update:open', false)
const save = () => emit('save', { ...form })
</script>

<template>
  <a-modal :open="open" :title="title" width="760" @cancel="close" @ok="save">
    <a-form layout="vertical">
      <a-row :gutter="16">
        <a-col :span="8"><a-form-item label="Tipo"><a-select v-model:value="form.tipo_direccion"><a-select-option value="FISCAL">Fiscal</a-select-option><a-select-option value="ENTREGA">Entrega</a-select-option><a-select-option value="COMERCIAL">Comercial</a-select-option><a-select-option value="OTRA">Otra</a-select-option></a-select></a-form-item></a-col>
        <a-col :span="10"><a-form-item label="Calle"><a-input v-model:value="form.calle" /></a-form-item></a-col>
        <a-col :span="6"><a-form-item label="Número"><a-input v-model:value="form.numero" /></a-form-item></a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="6"><a-form-item label="Piso"><a-input v-model:value="form.piso" /></a-form-item></a-col>
        <a-col :span="6"><a-form-item label="Depto"><a-input v-model:value="form.dpto" /></a-form-item></a-col>
        <a-col :span="12"><a-form-item label="ID Localidad"><a-input-number v-model:value="form.localidad" style="width:100%" /></a-form-item></a-col>
      </a-row>
      <a-form-item label="Referencia"><a-input v-model:value="form.referencia" /></a-form-item>
      <a-space>
        <a-checkbox v-model:checked="form.es_principal">Principal</a-checkbox>
        <a-checkbox v-model:checked="form.es_fiscal">Fiscal</a-checkbox>
        <a-checkbox v-model:checked="form.es_entrega">Entrega</a-checkbox>
      </a-space>
    </a-form>
  </a-modal>
</template>
