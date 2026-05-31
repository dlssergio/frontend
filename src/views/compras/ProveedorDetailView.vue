<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined, EditOutlined,
  DollarOutlined, FileTextOutlined,
  BankOutlined, UserOutlined, PhoneOutlined, MailOutlined,
} from '@ant-design/icons-vue'
import { proveedoresService } from '@/services/compras'

const router  = useRouter()
const route   = useRoute()
const id      = route.params.id
const loading = ref(false)
const p       = ref(null)    // proveedor completo
const activeTab = ref('general')

// Historial y CC (carga lazy)
const comprobantes     = ref([])
const loadingComp      = ref(false)
const cuentaCorriente  = ref(null)
const loadingCC        = ref(false)

const cargar = async () => {
  loading.value = true
  try {
    const res = await proveedoresService.obtener(id)
    p.value = res.data
  } catch {
    message.error('No se pudo cargar el proveedor.')
    router.push({ name: 'proveedores-lista' })
  } finally {
    loading.value = false
  }
}

const cargarComprobantes = async () => {
  if (loadingComp.value) return
  loadingComp.value = true
  try {
    const res = await proveedoresService.comprobantes(id)
    comprobantes.value = res.data
  } catch { message.error('Error al cargar comprobantes.') }
  finally { loadingComp.value = false }
}

const cargarCC = async () => {
  if (loadingCC.value) return
  loadingCC.value = true
  try {
    const res = await proveedoresService.cuentaCorriente(id)
    cuentaCorriente.value = res.data
  } catch { message.error('Error al cargar cuenta corriente.') }
  finally { loadingCC.value = false }
}

const onTabChange = (key) => {
  activeTab.value = key
  if (key === 'comprobantes' && !comprobantes.value.length) cargarComprobantes()
  if (key === 'cuenta_corriente') cargarCC()
}

const colsComp = [
  { title: 'Número',  dataIndex: 'numero_completo', width: 140 },
  { title: 'Tipo',    dataIndex: 'tipo_nombre',     ellipsis: true },
  { title: 'Fecha',   dataIndex: 'fecha',           width: 110 },
  { title: 'Estado',  dataIndex: 'estado_display',  width: 110 },
  { title: 'Total',   dataIndex: 'total',           width: 130, align: 'right' },
  { title: 'Saldo',   dataIndex: 'saldo_pendiente', width: 130, align: 'right' },
]
const colsCC = [
  { title: 'Número', dataIndex: 'numero',          width: 140 },
  { title: 'Tipo',   dataIndex: 'tipo',            ellipsis: true },
  { title: 'Fecha',  dataIndex: 'fecha',           width: 110 },
  { title: 'Total',  dataIndex: 'total',           width: 130, align: 'right' },
  { title: 'Saldo',  dataIndex: 'saldo_pendiente', width: 130, align: 'right' },
]

const money = (v) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(parseFloat(v) || 0)
const fmtFecha  = (v) => v ? new Date(v).toLocaleDateString('es-AR') : '—'
const ECOLOR    = { BR: 'default', CN: 'success', AN: 'error' }

onMounted(cargar)
</script>

<template>
  <div class="detail-root">
    <a-skeleton v-if="loading" active :paragraph="{ rows: 10 }" />

    <template v-else-if="p">

      <!-- Header -->
      <div class="detail-header">
        <div class="header-left">
          <a-button type="text" @click="router.push({ name: 'proveedores-lista' })">
            <ArrowLeftOutlined /> Proveedores
          </a-button>
          <div class="title-block">
            <div class="title-row">
              <h1 class="detail-title">{{ p.entidad?.razon_social }}</h1>
              <a-tag :color="p.esta_activo ? 'success' : 'error'">
                {{ p.esta_activo ? 'Activo' : 'Inactivo' }}
              </a-tag>
            </div>
            <div class="title-meta">
              <span class="badge-cod">{{ p.codigo_proveedor }}</span>
              <span v-if="p.nombre_fantasia" class="fantasia">{{ p.nombre_fantasia }}</span>
            </div>
          </div>
        </div>
        <a-button @click="router.push({ name: 'proveedor-editar', params: { id } })">
          <EditOutlined /> Editar
        </a-button>
      </div>

      <!-- KPI strip — usa campos calculados del ProveedorDetailSerializer -->
      <div class="kpi-strip">
        <div class="kpi">
          <span class="kpi-label">Total Facturado</span>
          <span class="kpi-value">{{ money(p.total_comprado) }}</span>
        </div>
        <div class="kpi kpi--debt">
          <span class="kpi-label">Saldo Deuda (cta. cte.)</span>
          <span class="kpi-value" :class="parseFloat(p.saldo_deuda) > 0 ? 'kv-red' : ''">
            {{ money(p.saldo_deuda) }}
          </span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Facturas Confirmadas</span>
          <span class="kpi-value">{{ p.cant_facturas }}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Plazo de Pago</span>
          <span class="kpi-value">{{ p.plazo_pago_dias || 0 }} días</span>
        </div>
      </div>

      <!-- Pestañas -->
      <a-tabs v-model:activeKey="activeTab" class="detail-tabs" @change="onTabChange">

        <!-- General -->
        <a-tab-pane key="general" tab="General">
          <div class="tab-body two-col">

            <div class="info-card">
              <h3 class="info-card-title">Datos Fiscales</h3>
              <div class="info-rows">
                <div class="info-row"><span class="info-lbl">CUIT</span><span class="info-val mono">{{ p.entidad?.cuit || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">Email</span><span class="info-val">{{ p.entidad?.email || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">Situación IVA</span><span class="info-val">{{ p.entidad?.situacion_iva?.nombre || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">Situa. IIBB</span><span class="info-val">{{ p.situacion_iibb || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">N° IIBB</span><span class="info-val mono">{{ p.nro_iibb || '—' }}</span></div>
              </div>
            </div>

            <div class="info-card">
              <h3 class="info-card-title">Condiciones Comerciales</h3>
              <div class="info-rows">
                <div class="info-row"><span class="info-lbl">Límite Crédito</span><span class="info-val">{{ money(p.limite_credito) }}</span></div>
                <div class="info-row"><span class="info-lbl">Plazo de Pago</span><span class="info-val">{{ p.plazo_pago_dias || 0 }} días</span></div>
                <div class="info-row"><span class="info-lbl">Descuento Base</span><span class="info-val">{{ p.descuento_compra || 0 }}%</span></div>
                <div class="info-row"><span class="info-lbl">Moneda Compra</span><span class="info-val">{{ p.moneda_compra_data?.simbolo || 'ARS' }}</span></div>
                <div class="info-row"><span class="info-lbl">Alta</span><span class="info-val">{{ fmtFecha(p.fecha_alta) }}</span></div>
              </div>
            </div>

            <div class="info-card">
              <h3 class="info-card-title"><BankOutlined style="margin-right:6px" />Datos Bancarios</h3>
              <div class="info-rows">
                <div class="info-row"><span class="info-lbl">Banco</span><span class="info-val">{{ p.banco_nombre || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">CBU</span><span class="info-val mono">{{ p.banco_cbu || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">Alias</span><span class="info-val mono">{{ p.banco_alias || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">N° Cuenta</span><span class="info-val mono">{{ p.banco_cuenta_nro || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl">Tipo</span><span class="info-val">{{ p.banco_tipo_cuenta || '—' }}</span></div>
              </div>
            </div>

            <div class="info-card">
              <h3 class="info-card-title"><UserOutlined style="margin-right:6px" />Contacto Comercial</h3>
              <div class="info-rows">
                <div class="info-row"><span class="info-lbl">Nombre</span><span class="info-val">{{ p.contacto_nombre || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl"><MailOutlined /> Email</span><span class="info-val">{{ p.contacto_email || '—' }}</span></div>
                <div class="info-row"><span class="info-lbl"><PhoneOutlined /> Tel.</span><span class="info-val">{{ p.contacto_telefono || '—' }}</span></div>
              </div>
            </div>

            <div v-if="p.observaciones" class="info-card info-card--full">
              <h3 class="info-card-title">Observaciones</h3>
              <p class="obs-text">{{ p.observaciones }}</p>
            </div>

          </div>
        </a-tab-pane>

        <!-- Comprobantes -->
        <a-tab-pane key="comprobantes">
          <template #tab><FileTextOutlined /> Comprobantes</template>
          <div class="tab-body">
            <a-table :columns="colsComp" :data-source="comprobantes" :loading="loadingComp"
              row-key="id" size="small" :pagination="{ pageSize: 20 }">
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'fecha'">{{ fmtFecha(record.fecha) }}</template>
                <template v-if="column.dataIndex === 'estado_display'">
                  <a-tag :color="ECOLOR[record.estado]" style="font-size:11px">{{ record.estado_display }}</a-tag>
                </template>
                <template v-if="column.dataIndex === 'total'">
                  <span class="num">{{ money(record.total) }}</span>
                </template>
                <template v-if="column.dataIndex === 'saldo_pendiente'">
                  <span :class="['num', parseFloat(record.saldo_pendiente) > 0 ? 'num-red' : '']">
                    {{ money(record.saldo_pendiente) }}
                  </span>
                </template>
              </template>
              <template #emptyText><a-empty description="Sin comprobantes" :image="false" /></template>
            </a-table>
          </div>
        </a-tab-pane>

        <!-- Cuenta Corriente -->
        <a-tab-pane key="cuenta_corriente">
          <template #tab><DollarOutlined /> Cuenta Corriente</template>
          <div class="tab-body">
            <a-spin :spinning="loadingCC">
              <template v-if="cuentaCorriente">
                <div class="cc-summary">
                  <div class="cc-kpi">
                    <span class="kpi-label">Total Facturado</span>
                    <span class="kpi-value">{{ money(cuentaCorriente.total_facturado) }}</span>
                  </div>
                  <div class="cc-kpi cc-kpi--debt">
                    <span class="kpi-label">Saldo Deuda</span>
                    <span class="kpi-value" :class="cuentaCorriente.saldo_deuda > 0 ? 'kv-red' : ''">
                      {{ money(cuentaCorriente.saldo_deuda) }}
                    </span>
                  </div>
                </div>
                <a-table :columns="colsCC" :data-source="cuentaCorriente.movimientos"
                  row-key="id" size="small" :pagination="{ pageSize: 20 }">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.dataIndex === 'fecha'">{{ fmtFecha(record.fecha) }}</template>
                    <template v-if="column.dataIndex === 'total'"><span class="num">{{ money(record.total) }}</span></template>
                    <template v-if="column.dataIndex === 'saldo_pendiente'">
                      <span :class="['num', parseFloat(record.saldo_pendiente) > 0 ? 'num-red' : '']">
                        {{ money(record.saldo_pendiente) }}
                      </span>
                    </template>
                  </template>
                </a-table>
              </template>
            </a-spin>
          </div>
        </a-tab-pane>

      </a-tabs>
    </template>
  </div>
</template>

<style scoped>
.detail-root { background:var(--surface-0,#fff); border-radius:var(--radius-lg,10px); overflow:hidden; box-shadow:var(--card-shadow,0 1px 6px rgba(0,0,0,.07)); display:flex; flex-direction:column; }
.detail-header { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--border,#f0f0f0); gap:12px; flex-wrap:wrap; }
.header-left   { display:flex; flex-direction:column; gap:6px; }
.title-block   { display:flex; flex-direction:column; gap:4px; }
.title-row     { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.detail-title  { margin:0; font-size:20px; font-weight:800; color:var(--text-0); }
.title-meta    { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.badge-cod     { font-family:monospace; font-size:11px; background:var(--surface-1,#f8fafc); border:1px solid var(--border); padding:2px 8px; border-radius:4px; color:var(--text-2); }
.fantasia      { font-size:13px; color:var(--text-2); font-style:italic; }
.kpi-strip     { display:flex; border-bottom:1px solid var(--border,#f0f0f0); overflow-x:auto; }
.kpi           { display:flex; flex-direction:column; gap:2px; padding:14px 20px; border-right:1px solid var(--border); min-width:130px; }
.kpi--debt     { background:#fff5f5; }
.kpi-label     { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--text-2); }
.kpi-value     { font-size:18px; font-weight:800; color:var(--text-0); font-variant-numeric:tabular-nums; }
.kv-red        { color:#b91c1c; }
.detail-tabs :deep(.ant-tabs-nav) { padding:0 20px; margin:0; }
.tab-body      { padding:20px; }
.tab-body.two-col { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.info-card     { background:var(--surface-1,#f8fafc); border-radius:var(--radius-md,8px); padding:16px; border:1px solid var(--border,#e2e8f0); }
.info-card--full { grid-column:1/-1; }
.info-card-title { margin:0 0 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-2); padding-bottom:8px; border-bottom:1px solid var(--border); }
.info-rows { display:flex; flex-direction:column; gap:8px; }
.info-row  { display:flex; align-items:baseline; gap:8px; }
.info-lbl  { font-size:12px; color:var(--text-2); min-width:110px; flex-shrink:0; }
.info-val  { font-size:13px; color:var(--text-0); font-weight:500; }
.obs-text  { margin:0; font-size:13px; color:var(--text-1); line-height:1.6; }
.cc-summary { display:flex; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
.cc-kpi    { background:var(--surface-1,#f8fafc); border-radius:8px; padding:12px 20px; border:1px solid var(--border); }
.cc-kpi--debt { border-color:#fca5a5; background:#fff5f5; }
.mono      { font-family:monospace; }
.num       { font-variant-numeric:tabular-nums; font-size:12px; }
.num-red   { color:#b91c1c; font-weight:700; }
</style>
