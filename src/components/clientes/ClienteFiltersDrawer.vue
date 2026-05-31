
<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: Object, required: true },
})
const emit = defineEmits(['update:open', 'apply', 'reset'])

const localFilters = reactive({
  estado: undefined,
  categoria: undefined,
  permite_cta_cte: undefined,
  activo: undefined,
})

watch(
  () => props.modelValue,
  (val) => Object.assign(localFilters, val || {}),
  { immediate: true, deep: true },
)

const close = () => emit('update:open', false)
const apply = () => emit('apply', { ...localFilters })
const reset = () => {
  Object.assign(localFilters, { estado: undefined, categoria: undefined, permite_cta_cte: undefined, activo: undefined })
  emit('reset')
}
</script>

<template>
  <a-drawer title="Filtros avanzados" placement="right" :open="open" width="380" @close="close">
    <a-form layout="vertical">
      <a-form-item label="Estado">
        <a-select v-model:value="localFilters.estado" allow-clear>
          <a-select-option value="ACT">Activo</a-select-option>
          <a-select-option value="BLQ">Bloqueado</a-select-option>
          <a-select-option value="INA">Inactivo</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Categoría">
        <a-select v-model:value="localFilters.categoria" allow-clear>
          <a-select-option value="MIN">Minorista</a-select-option>
          <a-select-option value="MAY">Mayorista</a-select-option>
          <a-select-option value="VIP">VIP / Premium</a-select-option>
          <a-select-option value="GOB">Gobierno / Institución</a-select-option>
          <a-select-option value="EXP">Exportación</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Cuenta corriente">
        <a-select v-model:value="localFilters.permite_cta_cte" allow-clear>
          <a-select-option :value="true">Habilitada</a-select-option>
          <a-select-option :value="false">No habilitada</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="Activo">
        <a-select v-model:value="localFilters.activo" allow-clear>
          <a-select-option :value="true">Sí</a-select-option>
          <a-select-option :value="false">No</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>

    <template #footer>
      <div class="drawer-footer">
        <a-space>
          <a-button @click="reset">Limpiar</a-button>
          <a-button type="primary" @click="apply">Aplicar</a-button>
        </a-space>
      </div>
    </template>
  </a-drawer>
</template>

<style scoped>
.drawer-footer { display:flex; justify-content:flex-end; }
</style>
