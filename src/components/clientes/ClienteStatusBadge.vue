
<script setup>
import { computed } from 'vue'

const props = defineProps({
  estado: { type: String, default: 'ACT' },
  activo: { type: Boolean, default: true },
})

const badge = computed(() => {
  if (!props.activo || props.estado === 'INA') return { text: 'Inactivo', status: 'default' }
  if (props.estado === 'BLQ') return { text: 'Bloqueado', status: 'error' }
  return { text: 'Activo', status: 'success' }
})
</script>

<template>
  <a-badge :status="badge.status" :text="badge.text" />
</template>
