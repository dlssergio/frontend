<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { ThunderboltOutlined, ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons-vue'
import api from '@/services/api'
import dayjs from 'dayjs'

const loading = ref(false)
const processing = ref(false)
const comprobantes = ref([])
const selectedRowKeys = ref([])

const money = (n) => (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })
const fmtFecha = (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—')

const fetchData = async () => {
  loading.value = true
  try {
    // Traemos comprobantes confirmados.
    // Como el backend no tiene un filtro "sin_cae", filtramos localmente para el monitor.
    const { data } = await api.get('/api/comprobantes-venta/', { params: { estado: 'CN', limit: 200 } })
    const rows = data?.results ?? data ?? []

    // Filtramos solo los que NO tienen CAE
    comprobantes.value = rows.filter(r => !r.cae)
    selectedRowKeys.value = []
  } catch (e) {
    message.error('Error al cargar comprobantes pendientes de ARCA')
  } finally {
    loading.value = false
  }
}

const solicitarMasivo = async () => {
  if (selectedRowKeys.value.length === 0) return

  processing.value = true
  let successCount = 0

  // Guardamos qué IDs específicos estamos mandando a procesar
  const idsToTrack = [...selectedRowKeys.value]

  for (const id of idsToTrack) {
    try {
      await api.post(`/api/comprobantes-venta/${id}/reintentar-cae/`)
      successCount++
    } catch (e) {
      console.error(`Error enviando comprobante ${id} a Celery`)
    }
  }

  message.success(`${successCount} comprobantes enviados a la cola de ARCA. Procesando...`)

  // Polling inteligente: Refrescamos silenciosamente cada 2.5 segundos
  let intentos = 0
  const interval = setInterval(async () => {
    intentos++

    try {
      // Descargamos la grilla en silencio (sin activar el loading principal)
      const { data } = await api.get('/api/comprobantes-venta/', { params: { estado: 'CN', limit: 200 } })
      const rows = data?.results ?? data ?? []
      comprobantes.value = rows.filter(r => !r.cae)

      // Verificamos cuántos de los que enviamos siguen en la lista (sin CAE)
      const stillPending = comprobantes.value.filter(c => idsToTrack.includes(c.id))

      if (stillPending.length === 0) {
        // Todos los que pedimos ya desaparecieron de la lista (¡Éxito total!)
        clearInterval(interval)
        processing.value = false
        selectedRowKeys.value = []
        message.success('¡Todos los comprobantes solicitados obtuvieron su CAE!')
      } else if (intentos >= 6) {
        // Timeout: Pasaron 15 segundos y ARCA sigue sin responder a algunos
        clearInterval(interval)
        processing.value = false
        // Dejamos seleccionados solo los que quedaron pendientes
        selectedRowKeys.value = stillPending.map(c => c.id)
        message.warning('ARCA está demorando. Algunos comprobantes siguen pendientes, reintente en un momento.')
      }
    } catch (e) {
      clearInterval(interval)
      processing.value = false
    }
  }, 2500)
}

const columns = [
  { title: 'Comprobante', dataIndex: 'numero_completo', width: 150 },
  { title: 'Fecha', dataIndex: 'fecha', width: 120 },
  { title: 'Cliente', key: 'cliente' },
  { title: 'Total', dataIndex: 'total', align: 'right', width: 150 },
  { title: 'Estado ARCA', key: 'arca_status' },
]

onMounted(fetchData)
</script>

<template>
  <div class="page-root">
    <div class="header">
      <div class="header-title">
        <ThunderboltOutlined class="title-icon" />
        <div>
          <h1>Monitor ARCA</h1>
          <p>Comprobantes confirmados pendientes de autorización (Sin CAE)</p>
        </div>
      </div>
      <a-button @click="fetchData" :loading="loading">
        <ReloadOutlined /> Actualizar
      </a-button>
    </div>

    <div class="card">
      <div class="toolbar" v-if="comprobantes.length > 0">
        <a-alert type="warning" show-icon>
          <template #message>
            Tienes <strong>{{ comprobantes.length }}</strong> comprobantes esperando CAE.
          </template>
        </a-alert>

        <a-button type="primary" :disabled="selectedRowKeys.length === 0" :loading="processing" @click="solicitarMasivo" style="margin-left: auto;">
          <ThunderboltOutlined /> Solicitar CAE a seleccionados ({{ selectedRowKeys.length }})
        </a-button>
      </div>

      <div v-if="comprobantes.length === 0 && !loading" class="empty-state">
        <CheckCircleOutlined class="empty-icon" />
        <h3>¡Todo al día!</h3>
        <p>No hay comprobantes pendientes de enviar a ARCA.</p>
      </div>

      <a-table
        v-else
        :columns="columns"
        :data-source="comprobantes"
        :loading="loading"
        rowKey="id"
        size="middle"
        :row-selection="{ selectedRowKeys, onChange: keys => selectedRowKeys = keys }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'fecha'">{{ fmtFecha(record.fecha) }}</template>
          <template v-if="column.key === 'cliente'">{{ record.cliente?.entidad?.razon_social || '—' }}</template>
          <template v-if="column.dataIndex === 'total'">$ {{ money(record.total) }}</template>
          <template v-if="column.key === 'arca_status'">
            <span class="error-badge" v-if="record.afip_error">
              <ExclamationCircleOutlined /> {{ record.afip_error }}
            </span>
            <span class="pending-badge" v-else>
              En cola / Pendiente
            </span>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<style scoped>
.page-root { padding: 24px; max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.header { display: flex; justify-content: space-between; align-items: center; }
.header-title { display: flex; align-items: center; gap: 16px; }
.title-icon { font-size: 32px; color: #f59e0b; padding: 12px; background: #fef3c7; border-radius: 12px; }
h1 { margin: 0; font-size: 24px; font-weight: 800; color: #0f172a; }
p { margin: 0; color: #64748b; font-size: 14px; }
.card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
.toolbar { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; }
.empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
.empty-icon { font-size: 64px; color: #10b981; margin-bottom: 16px; opacity: 0.8; }
.error-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #fef2f2; color: #dc2626; border-radius: 6px; font-size: 12px; font-weight: 600; }
.pending-badge { display: inline-flex; padding: 4px 10px; background: #f1f5f9; color: #64748b; border-radius: 6px; font-size: 12px; font-weight: 600; }
</style>
