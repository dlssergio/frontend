<template>
  <div class="import-container">

    <!-- STEPPER COMPACTO -->
    <div class="panel-card mb-4">
      <a-steps :current="pasoActual" size="small" class="custom-steps">
        <a-step title="Origen" description="Módulo a afectar" />
        <a-step title="Parámetros" description="Subida de archivo" />
        <a-step title="Auditoría" description="Validación e impacto" />
      </a-steps>
    </div>

    <!-- =======================================================
         PASO 0: SELECCIÓN DE MÓDULO (Grid 3 columnas)
         ======================================================= -->
    <transition name="fade" mode="out-in">
      <div v-if="pasoActual === 0" class="step-content">

        <p class="text-hint mb-4">Selecciona el módulo destino para inicializar el asistente de carga.</p>

        <div class="modules-grid">
          <!-- Inventario -->
          <div @click="seleccionarEntidad('ARTICULOS')" :class="['module-card', entidad === 'ARTICULOS' ? 'active' : '']">
            <div class="icon-box bg-blue"><InboxOutlined /></div>
            <div class="card-info">
              <h3>Catálogo de Artículos</h3>
              <p>Altas y modificación de maestros.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'ARTICULOS'" class="check-icon" />
          </div>

          <div @click="seleccionarEntidad('STOCK_INICIAL')" :class="['module-card', entidad === 'STOCK_INICIAL' ? 'active' : '']">
            <div class="icon-box bg-cyan"><DatabaseOutlined /></div>
            <div class="card-info">
              <h3>Saldos de Stock</h3>
              <p>Apertura física por depósitos.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'STOCK_INICIAL'" class="check-icon" />
          </div>

          <!-- Ventas -->
          <div @click="seleccionarEntidad('CLIENTES')" :class="['module-card', entidad === 'CLIENTES' ? 'active' : '']">
            <div class="icon-box bg-orange"><TeamOutlined /></div>
            <div class="card-info">
              <h3>Base de Clientes</h3>
              <p>Directorio y datos fiscales.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'CLIENTES'" class="check-icon" />
          </div>

          <div @click="seleccionarEntidad('PRECIOS_VENTA')" :class="['module-card', entidad === 'PRECIOS_VENTA' ? 'active' : '']">
            <div class="icon-box bg-violet"><TagOutlined /></div>
            <div class="card-info">
              <h3>Precios de Venta</h3>
              <p>Listas B2B/B2C y multimoneda.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'PRECIOS_VENTA'" class="check-icon" />
          </div>

          <!-- Compras -->
          <div @click="seleccionarEntidad('PROVEEDORES')" :class="['module-card', entidad === 'PROVEEDORES' ? 'active' : '']">
            <div class="icon-box bg-teal"><ShopOutlined /></div>
            <div class="card-info">
              <h3>Proveedores</h3>
              <p>Acreedores e información impositiva.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'PROVEEDORES'" class="check-icon" />
          </div>

          <div @click="seleccionarEntidad('PRECIOS_COMPRA')" :class="['module-card', entidad === 'PRECIOS_COMPRA' ? 'active' : '']">
            <div class="icon-box bg-emerald"><PercentageOutlined /></div>
            <div class="card-info">
              <h3>Costos de Compra</h3>
              <p>Actualización de listas y escalas.</p>
            </div>
            <CheckCircleFilled v-if="entidad === 'PRECIOS_COMPRA'" class="check-icon" />
          </div>
        </div>

        <div class="flex-end mt-4">
          <a-button type="primary" :disabled="!entidad" @click="pasoActual = 1">
            Continuar <ArrowRightOutlined />
          </a-button>
        </div>
      </div>

      <!-- =======================================================
           PASO 1: PARÁMETROS Y CARGA (Compacto)
           ======================================================= -->
      <div v-else-if="pasoActual === 1" class="step-content">
        <div class="panel-card grid-2-cols">

          <div class="col-settings">
            <div class="flex-between mb-2">
              <h3 class="title-h3">Módulo: {{ entidad.replace('_', ' ') }}</h3>
              <a-button type="link" size="small" @click="pasoActual = 0">Cambiar</a-button>
            </div>
            <p class="text-hint mb-4">Descarga la estructura base para evitar errores de validación.</p>

            <div class="flex-gap mb-4">
              <a-select v-model:value="formatoPlantilla" style="width: 90px;" size="middle">
                <a-select-option value="xlsx">.XLSX</a-select-option>
                <a-select-option value="csv">.CSV</a-select-option>
              </a-select>
              <a-button @click="descargarPlantilla" :loading="isDownloadingTemplate">
                <DownloadOutlined /> Plantilla Base
              </a-button>
            </div>

            <div v-if="mostrarSelectorModo" class="box-light">
              <h4 class="title-h4 mb-2">Regla de Inserción</h4>
              <a-radio-group v-model:value="modo" class="flex-col-gap">
                <a-radio value="AMBOS"><span class="text-primary">Upsert Inteligente (Crear y actualizar)</span></a-radio>
                <a-radio value="CREAR"><span class="text-primary">Estricto: Solo crear nuevos</span></a-radio>
                <a-radio value="ACTUALIZAR"><span class="text-primary">Estricto: Solo actualizar existentes</span></a-radio>
              </a-radio-group>
            </div>
            <div v-else class="box-success">
              <InfoCircleOutlined /> El sistema aplicará creación y actualización de forma automática.
            </div>
          </div>

          <div class="col-upload">
            <h4 class="title-h4 mb-2">Archivo a Procesar</h4>
            <a-upload-dragger
              v-model:fileList="fileList"
              name="archivo"
              :multiple="false"
              :before-upload="beforeUpload"
              @remove="handleRemove"
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              class="dragger-compact"
              :class="{'has-file': fileList.length > 0}"
            >
              <div class="dragger-inner">
                <FileExcelOutlined v-if="fileList.length > 0" class="icon-success text-4xl mb-2" />
                <CloudUploadOutlined v-else class="icon-muted text-4xl mb-2" />
                <p class="text-primary font-semibold m-0">{{ fileList.length > 0 ? fileList[0].name : 'Arrastra tu archivo aquí' }}</p>
                <p class="text-hint text-xs m-0 mt-1" v-if="fileList.length === 0">Soporta .xlsx y .csv</p>
              </div>
            </a-upload-dragger>
          </div>

        </div>

        <div class="flex-between mt-4">
          <a-button @click="pasoActual = 0">Atrás</a-button>
          <a-button type="primary" :disabled="fileList.length === 0" @click="pasoActual = 2">
            Verificar Datos <ArrowRightOutlined />
          </a-button>
        </div>
      </div>

      <!-- =======================================================
           PASO 2: AUDITORÍA Y SIMULACIÓN (Integrado al Tema)
           ======================================================= -->
      <div v-else-if="pasoActual === 2" class="step-content">

        <!-- Pre-vuelo -->
        <div v-if="!isProcessing && !cargaId" class="panel-card text-center p-8">
          <SafetyCertificateOutlined class="icon-muted text-5xl mb-3" />
          <h2 class="title-h3 mb-2">Listo para Validar</h2>
          <p class="text-hint max-w-lg mx-auto mb-6">Se recomienda ejecutar una validación previa (Dry-Run) para detectar errores sin afectar la base de datos real.</p>
          <div class="flex-center gap-4">
            <a-button @click="iniciarProceso(true)" class="btn-outline-primary">
              <ExperimentOutlined /> Validar Archivo
            </a-button>
            <a-button type="primary" danger @click="iniciarProceso(false)">
              Ignorar y Guardar
            </a-button>
          </div>
        </div>

        <!-- Telemetría -->
        <div v-if="cargaId" class="panel-card telemtry-box" :class="borderStatusClass">
          <div class="flex-between mb-4 pb-2 border-b border-muted">
            <h3 class="title-h4 m-0 flex-gap">
              <LoadingOutlined v-if="isProcessing" class="text-accent" />
              {{ modoSimulacionActivo ? 'Resultados de Validación' : 'Monitor de Importación' }}
            </h3>
            <span class="badge" :class="badgeStatusClass">{{ estadoCarga }}</span>
          </div>

          <a-progress :percent="porcentaje" :show-info="false" :status="progressStatus" :stroke-width="8" class="mb-4" />

          <div class="box-light text-center mb-4">
            <p class="text-primary font-bold m-0 flex-center gap-2 mb-4">
              <CheckCircleFilled v-if="estadoCarga === 'COMPLETADO' && errores.length === 0" class="text-success" />
              <WarningFilled v-else-if="estadoCarga === 'COMPLETADO' && errores.length > 0" class="text-warning" />
              <CloseCircleFilled v-else-if="estadoCarga === 'ERROR'" class="text-danger" />
              {{ mensajeProgreso }}
            </p>
            <div class="grid-2-cols gap-4 max-w-sm mx-auto">
              <div class="stat-card">
                <span class="stat-label">PROCESADAS</span>
                <span class="stat-val font-mono">{{ filasProcesadas }}</span>
              </div>
              <div class="stat-card">
                <span class="stat-label">TOTAL ARCHIVO</span>
                <span class="stat-val font-mono">{{ totalFilas }}</span>
              </div>
            </div>
          </div>

          <div v-if="estadoCarga === 'COMPLETADO' || estadoCarga === 'ERROR'" class="flex-center gap-4">
            <a-button @click="reiniciarAsistente">Nueva Tarea</a-button>
            <a-button v-if="modoSimulacionActivo && errores.length === 0 && estadoCarga === 'COMPLETADO'" class="btn-success" @click="ejecutarImportacionDirectaPosterior">
              Todo Correcto. Procesar Archivo
            </a-button>
          </div>
        </div>

        <!-- Tabla Errores Boomerang -->
        <transition name="slide-up">
          <div v-if="errores.length > 0" class="panel-card box-danger mt-4">
            <div class="flex-between mb-3">
              <h4 class="text-danger font-bold m-0 flex-gap"><WarningFilled /> {{ errores.length }} Filas Omitidas</h4>
              <a-button danger size="small" @click="descargarReporteErrores" :loading="isDownloading">
                <DownloadOutlined /> Descargar Reporte
              </a-button>
            </div>
            <p class="text-danger text-sm mb-3">Descarga el reporte, corrige la columna "MOTIVO_ERROR" y resúbelo.</p>

            <div class="table-wrapper">
              <table class="simple-table">
                <thead><tr><th class="w-20 text-center">Fila</th><th>Diagnóstico</th></tr></thead>
                <tbody>
                  <tr v-for="(err, idx) in errores.slice(0, 8)" :key="idx">
                    <td class="text-center font-mono">{{ err.fila }}</td>
                    <td class="font-medium">{{ err.error }}</td>
                  </tr>
                  <tr v-if="errores.length > 8">
                    <td colspan="2" class="text-center text-hint text-xs">... + {{ errores.length - 8 }} errores adicionales.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </transition>

      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloudUploadOutlined, ArrowRightOutlined,
  InboxOutlined, DatabaseOutlined, TagOutlined, PercentageOutlined,
  TeamOutlined, ShopOutlined, CheckCircleFilled,
  InfoCircleOutlined, FileExcelOutlined, DownloadOutlined,
  SafetyCertificateOutlined, ExperimentOutlined, ThunderboltOutlined,
  LoadingOutlined, WarningFilled, CloseCircleFilled
} from '@ant-design/icons-vue'
import axios from 'axios'

// Variables de Estado
const pasoActual = ref(0)
const entidad = ref(null)
const modo = ref('AMBOS')
const fileList = ref([])
const modoSimulacionActivo = ref(false)
const formatoPlantilla = ref('xlsx')

// Controladores de UI
const isStartingUpload = ref(false)
const isDownloadingTemplate = ref(false)
const isDownloading = ref(false)

// Telemetría
const cargaId = ref(null)
const isProcessing = ref(false)
const porcentaje = ref(0)
const estadoCarga = ref('')
const filasProcesadas = ref(0)
const totalFilas = ref(0)
const errores = ref([])
let pollingInterval = null

// Métodos UI
const seleccionarEntidad = (valor) => { entidad.value = valor }
const reiniciarAsistente = () => {
  pasoActual.value = 0; entidad.value = null; fileList.value = [];
  cargaId.value = null; errores.value = []; modoSimulacionActivo.value = false;
  if (pollingInterval) clearInterval(pollingInterval)
}

const mostrarSelectorModo = computed(() => !['PRECIOS_COMPRA', 'PRECIOS_VENTA', 'STOCK_INICIAL'].includes(entidad.value))

const mensajeProgreso = computed(() => {
  if (estadoCarga.value === 'PENDIENTE') return 'Iniciando conexión segura...'
  if (estadoCarga.value === 'PROCESANDO') return modoSimulacionActivo.value ? 'Simulando validaciones...' : 'Guardando en Base de Datos...'
  if (estadoCarga.value === 'COMPLETADO') return modoSimulacionActivo.value ? 'Simulación Finalizada.' : 'Importación Exitosa.'
  if (estadoCarga.value === 'ERROR') return 'Proceso abortado. Se aplicó Rollback.'
  return ''
})

const badgeStatusClass = computed(() => {
  if (estadoCarga.value === 'COMPLETADO') return errores.value.length > 0 ? 'bg-warning' : 'bg-success'
  if (estadoCarga.value === 'PROCESANDO') return 'bg-info'
  if (estadoCarga.value === 'ERROR') return 'bg-danger'
  return 'bg-muted'
})

const borderStatusClass = computed(() => {
  if (estadoCarga.value === 'ERROR') return 'border-danger'
  if (estadoCarga.value === 'COMPLETADO' && errores.value.length > 0) return 'border-warning'
  if (estadoCarga.value === 'COMPLETADO') return 'border-success'
  return 'border-info'
})

const progressStatus = computed(() => estadoCarga.value === 'ERROR' ? 'exception' : 'active')

// Archivos
const beforeUpload = (file) => { fileList.value = [file]; return false }
const handleRemove = () => { fileList.value = [] }

const descargarPlantilla = async () => {
  if (!entidad.value) return
  isDownloadingTemplate.value = true
  try {
    const response = await axios.get(`http://tenant1.localhost:8000/api/cargas-masivas/descargar_plantilla/?entidad=${entidad.value}&formato=${formatoPlantilla.value}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }, responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Plantilla_${entidad.value}.${formatoPlantilla.value}`)
    document.body.appendChild(link)
    link.click()
  } catch (error) { message.error('Error al generar plantilla.') }
  finally { isDownloadingTemplate.value = false }
}

const descargarReporteErrores = async () => {
  isDownloading.value = true
  try {
    const response = await axios.get(`http://tenant1.localhost:8000/api/cargas-masivas/${cargaId.value}/descargar_errores/?formato=xlsx`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }, responseType: 'blob'
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Reporte_Errores_${cargaId.value}.xlsx`)
    document.body.appendChild(link)
    link.click()
  } catch (error) { message.error('Error al generar reporte.') }
  finally { isDownloading.value = false }
}

// API
const iniciarProceso = async (simular) => {
  modoSimulacionActivo.value = simular
  isStartingUpload.value = true
  errores.value = []
  porcentaje.value = 0
  cargaId.value = null
  estadoCarga.value = 'PENDIENTE'

  const formData = new FormData()
  formData.append('archivo', fileList.value[0].originFileObj || fileList.value[0])
  formData.append('entidad', entidad.value)
  formData.append('modo', modo.value)

  try {
    const token = localStorage.getItem('accessToken')
    const response = await axios.post('http://tenant1.localhost:8000/api/cargas-masivas/', formData, {
      headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${token}` }
    })
    cargaId.value = response.data.id
    iniciarPolling()
  } catch (error) {
    message.error('Falla de conexión al motor de importación.')
    estadoCarga.value = ''
  } finally {
    isStartingUpload.value = false
  }
}

const ejecutarImportacionDirectaPosterior = () => {
  cargaId.value = null
  iniciarProceso(false)
}

const iniciarPolling = () => {
  isProcessing.value = true
  pollingInterval = setInterval(async () => {
    try {
      const { data } = await axios.get(`http://tenant1.localhost:8000/api/cargas-masivas/${cargaId.value}/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      })
      porcentaje.value = data.porcentaje_progreso
      estadoCarga.value = data.estado
      filasProcesadas.value = data.filas_procesadas
      totalFilas.value = data.total_filas

      if (['OK', 'Completado', 'Error General'].includes(data.estado) || ['OK', 'Completado', 'Error General'].includes(data.estado_display)) {
        clearInterval(pollingInterval)
        isProcessing.value = false
        estadoCarga.value = data.estado === 'Error General' ? 'ERROR' : 'COMPLETADO'
        errores.value = data.detalle_errores || []
      }
    } catch (error) {
      clearInterval(pollingInterval)
      isProcessing.value = false
    }
  }, 1000)
}

onUnmounted(() => { if (pollingInterval) clearInterval(pollingInterval) })
</script>

<style scoped>
/* =========================================================
   VARIABLES Y TEMA DINÁMICO (Compatible con MainLayout)
   ========================================================= */
.import-container {
  max-width: 900px; /* Más estrecho y elegante */
  margin: 0 auto;
  font-family: var(--font-sans, inherit);
  color: var(--text-0, #0f172a);
}

/* Tipografías e info */
.title-h3 { font-size: 16px; font-weight: 700; margin: 0; color: var(--text-0); }
.title-h4 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-2); margin: 0; }
.text-hint { font-size: 13px; color: var(--text-2); margin: 0; }
.text-primary { color: var(--text-0); font-weight: 500;}
.font-mono { font-family: 'JetBrains Mono', monospace, ui-monospace; }

/* Utilidades Flex */
.flex-between { display: flex; justify-content: space-between; align-items: center; }
.flex-end { display: flex; justify-content: flex-end; }
.flex-center { display: flex; justify-content: center; align-items: center; }
.flex-gap { display: flex; gap: 8px; align-items: center; }
.flex-col-gap { display: flex; flex-direction: column; gap: 8px; }
.grid-2-cols { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media(min-width: 640px) { .grid-2-cols { grid-template-columns: 1.2fr 1fr; } }

/* Componentes Base (Se adaptan a oscuro/claro por var) */
.panel-card {
  background: var(--surface-1, #ffffff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}

.box-light { background: var(--app-bg, #f8fafc); border: 1px solid var(--border); padding: 12px; border-radius: 8px; }
.box-success { background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 8px; color: #10b981; font-size: 13px; font-weight: 600;}
.box-danger { background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 16px; border-radius: 12px; }

/* Colores Semánticos puros */
.text-accent { color: var(--primary, #4f46e5); }
.text-success { color: #10b981; } .text-warning { color: #f59e0b; } .text-danger { color: #ef4444; }
.icon-muted { color: var(--text-2); opacity: 0.5;}

.bg-success { background: #10b981; color: white; }
.bg-warning { background: #f59e0b; color: white; }
.bg-danger { background: #ef4444; color: white; }
.bg-info { background: var(--primary, #4f46e5); color: white; }
.bg-muted { background: var(--border); color: var(--text-1); }

/* GRID DE MÓDULOS (Tarjetas) */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.module-card {
  background: var(--surface-1, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}
.module-card:hover { border-color: var(--primary, #4f46e5); }
.module-card.active { border-color: var(--primary, #4f46e5); background: rgba(var(--accent-rgb, 79, 70, 229), 0.04); }

.icon-box {
  width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
}
.bg-blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.bg-cyan { background: rgba(6, 182, 212, 0.15); color: #06b6d4; }
.bg-orange { background: rgba(249, 115, 22, 0.15); color: #f97316; }
.bg-violet { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.bg-teal { background: rgba(20, 184, 166, 0.15); color: #14b8a6; }
.bg-emerald { background: rgba(16, 185, 129, 0.15); color: #10b981; }

.card-info h3 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text-0); }
.card-info p { margin: 0; font-size: 12px; color: var(--text-2); }
.check-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--primary, #4f46e5); font-size: 16px; }

/* DROPZONE COMPACTO */
.dragger-compact :deep(.ant-upload-drag) {
  background: var(--surface-0) !important; border: 2px dashed var(--border) !important; border-radius: 10px !important;
}
.dragger-compact :deep(.ant-upload-drag:hover) { border-color: var(--primary, #4f46e5) !important; }
.dragger-compact.has-file :deep(.ant-upload-drag) { border-color: #10b981 !important; border-style: solid !important; background: rgba(16,185,129,0.05) !important; }
.dragger-inner { padding: 24px 10px; }

/* BOTONES */
.btn-outline-primary { border: 1px solid var(--primary, #4f46e5); color: var(--primary, #4f46e5); background: transparent; font-weight: 600; }
.btn-success { background: #10b981; border: none; color: white; font-weight: 600; } .btn-success:hover { background: #059669; }

/* TELEMETRÍA */
.border-info { border-left: 4px solid var(--primary, #4f46e5); }
.border-success { border-left: 4px solid #10b981; }
.border-warning { border-left: 4px solid #f59e0b; }
.border-danger { border-left: 4px solid #ef4444; }
.badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; }

.stat-card { background: var(--surface-1); border: 1px solid var(--border); padding: 12px; border-radius: 8px; display: flex; flex-direction: column; }
.stat-label { font-size: 10px; font-weight: 700; color: var(--text-2); }
.stat-val { font-size: 24px; font-weight: 800; color: var(--text-0); }

/* TABLA ERRORES */
.table-wrapper { background: var(--surface-1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; overflow: hidden; max-height: 250px; overflow-y: auto;}
.simple-table { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--text-0);}
.simple-table th { background: var(--surface-0); padding: 8px 12px; font-weight: 700; color: var(--text-1); border-bottom: 1px solid var(--border); position: sticky; top:0; }
.simple-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }

/* ANIMACIONES */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(15px); opacity: 0; }
</style>
