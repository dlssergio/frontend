<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  EditOutlined,
  UserOutlined,
  BankOutlined,
  DollarOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  TagsOutlined,
  TeamOutlined,
  ApartmentOutlined,
  EnvironmentOutlined,
  MailOutlined,
  FundOutlined,
  FileTextOutlined,
  CreditCardOutlined,
  WarningOutlined,
  RiseOutlined,
  PartitionOutlined,
} from '@ant-design/icons-vue'
import { fetchCliente, fetchClienteDashboard } from '@/services/clientes'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const cliente = ref(null)
const dashboard = ref(null)

const comprobantesColumns = [
  { title: 'Fecha', dataIndex: 'fecha_fmt', key: 'fecha', width: 120 },
  { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 170 },
  { title: 'Número', dataIndex: 'numero', key: 'numero', width: 180 },
  { title: 'Condición', dataIndex: 'condicion_label', key: 'condicion', width: 120 },
  { title: 'Total', dataIndex: 'total_fmt', key: 'total', width: 120 },
  { title: 'Saldo', dataIndex: 'saldo_fmt', key: 'saldo', width: 120 },
  { title: 'Pago', dataIndex: 'estado_pago_label', key: 'estado_pago', width: 110 },
]

const movimientosColumns = [
  { title: 'Fecha', dataIndex: 'fecha_fmt', key: 'fecha', width: 120 },
  { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', width: 120 },
  { title: 'Número', dataIndex: 'numero', key: 'numero', width: 180 },
  { title: 'Debe', dataIndex: 'debe_fmt', key: 'debe', width: 120 },
  { title: 'Haber', dataIndex: 'haber_fmt', key: 'haber', width: 120 },
  { title: 'Saldo', dataIndex: 'saldo_fmt', key: 'saldo', width: 120 },
]

async function load() {
  loading.value = true
  try {
    const [clienteRes, dashboardRes] = await Promise.all([
      fetchCliente(route.params.id),
      fetchClienteDashboard(route.params.id),
    ])

    cliente.value = clienteRes.data
    dashboard.value = dashboardRes.data
  } catch (e) {
    console.error(e)
    message.error('No se pudo cargar el detalle 360° del cliente')
  } finally {
    loading.value = false
  }
}

const isActive = computed(() => !!cliente.value?.esta_activo)

const statusText = computed(() => {
  if (!cliente.value) return '-'
  return cliente.value.esta_activo ? 'Activo' : 'Inactivo'
})

const statusClass = computed(() => {
  if (!cliente.value) return 'status-pill--muted'
  return cliente.value.esta_activo ? 'status-pill--success' : 'status-pill--muted'
})

const riesgoText = computed(() => {
  const r = dashboard.value?.riesgo
  if (r === 'EXCEDIDO') return 'Crédito excedido'
  if (r === 'SEGUIMIENTO') return 'En seguimiento'
  return 'Situación normal'
})

const riesgoClass = computed(() => {
  const r = dashboard.value?.riesgo
  if (r === 'EXCEDIDO') return 'risk-pill--danger'
  if (r === 'SEGUIMIENTO') return 'risk-pill--warn'
  return 'risk-pill--ok'
})

const money = (value) => {
  const n = Number(value || 0)
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(n)
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

const dashboardKpis = computed(() => [
  {
    key: 'saldo_total',
    label: 'Saldo total',
    value: money(dashboard.value?.saldo_total || 0),
    hint: 'Deuda total pendiente del cliente',
    icon: BankOutlined,
    tone: 'tone-neutral',
  },
  {
    key: 'deuda_vencida',
    label: 'Deuda vencida',
    value: money(dashboard.value?.deuda_vencida || 0),
    hint: 'Saldo vencido según días de vencimiento',
    icon: WarningOutlined,
    tone: Number(dashboard.value?.deuda_vencida || 0) > 0 ? 'tone-danger' : 'tone-neutral',
  },
  {
    key: 'deuda_cta_cte',
    label: 'Deuda cta. cte.',
    value: money(dashboard.value?.deuda_cta_cte || 0),
    hint: 'Comprobantes pendientes en cuenta corriente',
    icon: CreditCardOutlined,
    tone: 'tone-blue',
  },
  {
    key: 'deuda_contado',
    label: 'Pendiente contado',
    value: money(dashboard.value?.deuda_contado || 0),
    hint: 'Comprobantes contado con saldo pendiente',
    icon: PartitionOutlined,
    tone: Number(dashboard.value?.deuda_contado || 0) > 0 ? 'tone-warn' : 'tone-neutral',
  },
  {
    key: 'credito_disponible',
    label: 'Crédito disponible',
    value: money(dashboard.value?.credito_disponible || 0),
    hint: 'Límite menos saldo total',
    icon: DollarOutlined,
    tone: Number(dashboard.value?.credito_disponible || 0) < 0 ? 'tone-danger' : 'tone-success',
  },
  {
    key: 'impagos',
    label: 'Comprobantes impagos',
    value: String(dashboard.value?.comprobantes_impagos || 0),
    hint: 'Cantidad de comprobantes con saldo',
    icon: FileTextOutlined,
    tone: 'tone-neutral',
  },
])

const agingItems = computed(() => {
  const aging = dashboard.value?.aging || {}
  return [
    { label: '0-30 días', value: money(aging.bucket_0_30 || 0), tone: 'tone-blue' },
    { label: '31-60 días', value: money(aging.bucket_31_60 || 0), tone: 'tone-gold' },
    { label: '61-90 días', value: money(aging.bucket_61_90 || 0), tone: 'tone-orange' },
    { label: '+90 días', value: money(aging.bucket_90_plus || 0), tone: 'tone-red' },
  ]
})

const summaryItems = computed(() => [
  {
    label: 'Código cliente',
    value: cliente.value?.codigo_cliente || 'No definido',
    icon: TagsOutlined,
  },
  {
    label: 'Categoría',
    value: cliente.value?.categoria_label || cliente.value?.categoria || '-',
    icon: UserOutlined,
  },
  {
    label: 'Vendedor',
    value: cliente.value?.vendedor?.label || 'Sin asignar',
    icon: TeamOutlined,
  },
  {
    label: 'Lista de precios',
    value: cliente.value?.price_list?.label || 'Sin lista',
    icon: ApartmentOutlined,
  },
  {
    label: 'Límite de crédito',
    value: money(cliente.value?.limite_credito || 0),
    icon: DollarOutlined,
  },
  {
    label: 'Saldo total',
    value: money(dashboard.value?.saldo_total || 0),
    icon: BankOutlined,
  },
])

const indicadoresComerciales = computed(() => {
  const kpis = dashboard.value?.kpis || {}
  const ultimaVenta = dashboard.value?.ultima_venta
  return [
    {
      label: 'Última venta',
      value: ultimaVenta?.fecha ? formatDate(ultimaVenta.fecha) : 'Sin ventas',
    },
    {
      label: 'Total vendido 30 días',
      value: money(kpis.total_vendido_30d || 0),
    },
    {
      label: 'Comprobantes 90 días',
      value: String(kpis.cantidad_comprobantes_90d || 0),
    },
    {
      label: 'Ticket promedio 90 días',
      value: money(kpis.ticket_promedio_90d || 0),
    },
    {
      label: 'Días desde última compra',
      value: kpis.dias_desde_ultima_compra ?? '—',
    },
    {
      label: 'Riesgo comercial',
      value: riesgoText.value,
    },
  ]
})

const ultimosComprobantesRows = computed(() => {
  const list = dashboard.value?.ultimos_comprobantes || []
  return list.map((item) => ({
    ...item,
    key: item.id,
    fecha_fmt: formatDate(item.fecha),
    total_fmt: money(item.total),
    saldo_fmt: money(item.saldo),
    condicion_label:
      item.condicion_venta === 'CC'
        ? 'Cta. Cte.'
        : item.condicion_venta === 'CO'
          ? 'Contado'
          : item.condicion_venta || '-',
    estado_pago_label: item.estado_pago || '-',
  }))
})

const movimientosRows = computed(() => {
  const list = dashboard.value?.movimientos_cta_cte || []
  return list.map((item) => ({
    ...item,
    key: `${item.tipo}-${item.id}`,
    fecha_fmt: formatDate(item.fecha),
    debe_fmt: money(item.debe),
    haber_fmt: money(item.haber),
    saldo_fmt: money(item.saldo),
  }))
})

function goBack() {
  router.push({ name: 'clientes-lista' })
}

function goEdit() {
  router.push({ name: 'cliente-editar', params: { id: route.params.id } })
}

function goToComprobantes() {
  router.push({
    name: 'consulta-comprobantes',
    query: { cliente: route.params.id },
  })
}

function nuevaVenta() {
  router.push({
    name: 'venta-factura-admin-nueva',
    query: { cliente: route.params.id },
  })
}

onMounted(load)
</script>

<template>
  <div class="cliente-detail-page">
    <div class="hero">
      <div class="hero__left">
        <a-button class="back-btn" @click="goBack">
          <template #icon><ArrowLeftOutlined /></template>
        </a-button>

        <div class="hero__title-wrap">
          <div class="hero__eyebrow">Customer Master · ERP Enterprise</div>
          <h1 class="hero__title">
            {{ cliente?.entidad?.razon_social || 'Detalle de cliente' }}
          </h1>
          <div class="hero__subtitle">
            Vista integral comercial, fiscal y operativa del cliente, enriquecida con segmentación, pricing, aging y riesgo crediticio.
          </div>

          <div class="hero__chips">
            <span class="status-pill" :class="statusClass">
              {{ statusText }}
            </span>

            <span class="risk-pill" :class="riesgoClass">
              <FundOutlined />
              {{ riesgoText }}
            </span>

            <span class="info-pill">
              <SafetyCertificateOutlined />
              Fiscal y comercial
            </span>

            <span class="info-pill">
              <EnvironmentOutlined />
              Direcciones múltiples
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
          <div class="metric-card__value">
            {{ money(cliente?.limite_credito || 0) }}
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-card__label">Saldo total</div>
          <div class="metric-card__value">
            {{ money(dashboard?.saldo_total || 0) }}
          </div>
        </div>
      </div>
    </div>

    <section class="kpis-grid">
      <a-card
        v-for="item in dashboardKpis"
        :key="item.key"
        class="kpi-card"
        :class="item.tone"
        :bordered="false"
      >
        <div class="kpi-card__icon">
          <component :is="item.icon" />
        </div>
        <div class="kpi-card__body">
          <div class="kpi-card__label">{{ item.label }}</div>
          <div class="kpi-card__value">{{ item.value }}</div>
          <div class="kpi-card__hint">{{ item.hint }}</div>
        </div>
      </a-card>
    </section>

    <div class="content-grid">
      <section class="main-panel">
        <a-spin :spinning="loading">
          <template v-if="cliente">
            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Aging de deuda</div>
                  <h3 class="section-head__title">Antigüedad de saldos vencidos</h3>
                </div>
              </div>

              <div class="aging-grid">
                <div
                  v-for="item in agingItems"
                  :key="item.label"
                  class="aging-card"
                  :class="item.tone"
                >
                  <div class="aging-card__label">{{ item.label }}</div>
                  <div class="aging-card__value">{{ item.value }}</div>
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Actividad comercial</div>
                  <h3 class="section-head__title">Últimos comprobantes</h3>
                </div>
              </div>

              <a-table
                :columns="comprobantesColumns"
                :data-source="ultimosComprobantesRows"
                :pagination="false"
                size="small"
                :scroll="{ x: 900 }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'estado_pago_label'">
                    <span
                      class="payment-badge"
                      :class="{
                        'payment-badge--paid': record.estado_pago_label === 'PAGADO',
                        'payment-badge--partial': record.estado_pago_label === 'PARCIAL',
                        'payment-badge--unpaid': record.estado_pago_label === 'IMPAGO',
                      }"
                    >
                      {{ record.estado_pago_label }}
                    </span>
                  </template>
                </template>
              </a-table>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Cuenta corriente</div>
                  <h3 class="section-head__title">Resumen de movimientos</h3>
                </div>
              </div>

              <a-table
                :columns="movimientosColumns"
                :data-source="movimientosRows"
                :pagination="false"
                size="small"
                :scroll="{ x: 820 }"
              />
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Identidad</div>
                  <h3 class="section-head__title">Información general</h3>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <div class="info-item__label">Razón social</div>
                  <div class="info-item__value">{{ cliente.entidad?.razon_social || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Código</div>
                  <div class="info-item__value">{{ cliente.codigo_cliente || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Nombre fantasía</div>
                  <div class="info-item__value">{{ cliente.nombre_fantasia || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Categoría</div>
                  <div class="info-item__value">{{ cliente.categoria_label || cliente.categoria || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Zona</div>
                  <div class="info-item__value">{{ cliente.zona || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Activo</div>
                  <div class="info-item__value">
                    <a-badge :status="isActive ? 'success' : 'default'" :text="isActive ? 'Activo' : 'Inactivo'" />
                  </div>
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Compliance</div>
                  <h3 class="section-head__title">Datos fiscales</h3>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <div class="info-item__label">CUIT / CUIL</div>
                  <div class="info-item__value">{{ cliente.entidad?.cuit || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">DNI</div>
                  <div class="info-item__value">{{ cliente.entidad?.dni || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Situación IVA</div>
                  <div class="info-item__value">{{ cliente.entidad?.situacion_iva?.nombre || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Email fiscal</div>
                  <div class="info-item__value">{{ cliente.entidad?.email || '-' }}</div>
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Pricing & Risk</div>
                  <h3 class="section-head__title">Condiciones comerciales</h3>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <div class="info-item__label">Vendedor</div>
                  <div class="info-item__value">{{ cliente.vendedor?.label || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Lista de precios</div>
                  <div class="info-item__value">{{ cliente.price_list?.label || '-' }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Cuenta corriente</div>
                  <div class="info-item__value">
                    <a-tag :color="cliente.permite_cta_cte ? 'blue' : 'default'">
                      {{ cliente.permite_cta_cte ? 'Habilitada' : 'Solo contado' }}
                    </a-tag>
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Límite de crédito</div>
                  <div class="info-item__value">{{ money(cliente.limite_credito || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Deuda total</div>
                  <div class="info-item__value">{{ money(dashboard?.saldo_total || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Deuda vencida</div>
                  <div class="info-item__value">{{ money(dashboard?.deuda_vencida || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Deuda cuenta corriente</div>
                  <div class="info-item__value">{{ money(dashboard?.deuda_cta_cte || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Pendiente contado</div>
                  <div class="info-item__value">{{ money(dashboard?.deuda_contado || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Crédito disponible</div>
                  <div class="info-item__value">{{ money(dashboard?.credito_disponible || 0) }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Días de vencimiento</div>
                  <div class="info-item__value">{{ cliente.dias_vencimiento ?? 0 }}</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Descuento base</div>
                  <div class="info-item__value">{{ cliente.descuento_base ?? 0 }}%</div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Riesgo comercial</div>
                  <div class="info-item__value">
                    <span class="risk-inline" :class="riesgoClass">{{ riesgoText }}</span>
                  </div>
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Relación comercial</div>
                  <h3 class="section-head__title">Contacto principal</h3>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-item">
                  <div class="info-item__label">Nombre</div>
                  <div class="info-item__value">
                    <span class="inline-icon"><PhoneOutlined /></span>
                    {{ cliente.contacto_nombre || '-' }}
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Email</div>
                  <div class="info-item__value">
                    <span class="inline-icon"><MailOutlined /></span>
                    {{ cliente.contacto_email || '-' }}
                  </div>
                </div>

                <div class="info-item">
                  <div class="info-item__label">Teléfono</div>
                  <div class="info-item__value">
                    <span class="inline-icon"><PhoneOutlined /></span>
                    {{ cliente.contacto_telefono || '-' }}
                  </div>
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Logística</div>
                  <h3 class="section-head__title">Direcciones</h3>
                </div>
              </div>

              <div v-if="cliente.domicilios?.length" class="stack-list">
                <div v-for="dom in cliente.domicilios" :key="dom.id || `${dom.calle}-${dom.numero}`" class="stack-card">
                  <div class="stack-card__head">
                    <div class="stack-card__title">
                      {{ dom.tipo_direccion || 'Dirección' }}
                      <a-tag v-if="dom.es_principal" color="blue">Principal</a-tag>
                    </div>
                  </div>

                  <div class="info-grid info-grid--single">
                    <div class="info-item">
                      <div class="info-item__label">Ubicación</div>
                      <div class="info-item__value">
                        {{ [dom.calle, dom.numero, dom.piso, dom.dpto].filter(Boolean).join(' ') || '-' }}
                      </div>
                    </div>

                    <div class="info-item">
                      <div class="info-item__label">Localidad</div>
                      <div class="info-item__value">{{ dom.localidad || '-' }}</div>
                    </div>

                    <div class="info-item">
                      <div class="info-item__label">Referencia</div>
                      <div class="info-item__value">{{ dom.referencia || '-' }}</div>
                    </div>
                  </div>
                </div>
              </div>
              <a-empty v-else description="Sin direcciones cargadas." />
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Canales</div>
                  <h3 class="section-head__title">Teléfonos y emails secundarios</h3>
                </div>
              </div>

              <div class="two-blocks">
                <div class="stack-block">
                  <h4 class="stack-block__title">Teléfonos</h4>
                  <div v-if="cliente.telefonos?.length" class="stack-list">
                    <div v-for="tel in cliente.telefonos" :key="tel.id || `${tel.tipo}-${tel.numero}`" class="stack-card">
                      <div class="info-item">
                        <div class="info-item__label">{{ tel.tipo || 'Tipo' }}</div>
                        <div class="info-item__value">{{ tel.numero || '-' }}</div>
                      </div>
                    </div>
                  </div>
                  <a-empty v-else description="Sin teléfonos adicionales." />
                </div>

                <div class="stack-block">
                  <h4 class="stack-block__title">Emails secundarios</h4>
                  <div v-if="cliente.emails_secundarios?.length" class="stack-list">
                    <div v-for="mail in cliente.emails_secundarios" :key="mail.id || `${mail.tipo}-${mail.email}`" class="stack-card">
                      <div class="info-item">
                        <div class="info-item__label">{{ mail.tipo || 'Tipo' }}</div>
                        <div class="info-item__value">{{ mail.email || '-' }}</div>
                      </div>
                    </div>
                  </div>
                  <a-empty v-else description="Sin emails secundarios." />
                </div>
              </div>
            </a-card>

            <a-card class="detail-card" :bordered="false">
              <div class="section-head">
                <div>
                  <div class="section-head__eyebrow">Notas internas</div>
                  <h3 class="section-head__title">Observaciones</h3>
                </div>
              </div>

              <div class="notes-box">
                {{ cliente.observaciones || 'Sin observaciones registradas.' }}
              </div>
            </a-card>
          </template>

          <a-empty v-else-if="!loading" description="No hay información disponible para este cliente." />
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

        <a-card class="side-card" :bordered="false">
          <div class="side-card__title">Indicadores comerciales</div>

          <div class="summary-list">
            <div v-for="item in indicadoresComerciales" :key="item.label" class="summary-item summary-item--compact">
              <div class="summary-item__content">
                <div class="summary-item__label">{{ item.label }}</div>
                <div class="summary-item__value">{{ item.value }}</div>
              </div>
            </div>
          </div>
        </a-card>

        <a-card class="side-card side-card--highlight" :bordered="false">
          <div class="side-card__title">Estado operativo</div>

          <div class="check-row" :class="{ ok: !!cliente?.entidad?.razon_social }">
            <CheckCircleOutlined />
            <span>Razón social cargada</span>
          </div>

          <div class="check-row" :class="{ ok: !!cliente?.entidad?.situacion_iva }">
            <CheckCircleOutlined />
            <span>Situación IVA definida</span>
          </div>

          <div class="check-row" :class="{ ok: !!cliente?.vendedor }">
            <CheckCircleOutlined />
            <span>Vendedor asignado</span>
          </div>

          <div class="check-row" :class="{ ok: !!cliente?.price_list }">
            <CheckCircleOutlined />
            <span>Lista de precios asignada</span>
          </div>

          <div class="check-row" :class="{ ok: !!cliente?.domicilios?.length }">
            <CheckCircleOutlined />
            <span>Direcciones cargadas</span>
          </div>

          <div class="check-row" :class="{ ok: !!cliente?.telefonos?.length || !!cliente?.contacto_telefono }">
            <CheckCircleOutlined />
            <span>Canales telefónicos disponibles</span>
          </div>
        </a-card>
      </aside>
    </div>

    <div class="sticky-actions">
      <div class="sticky-actions__left">
        <span class="sticky-actions__meta">
          Maestro de cliente · vista 360°
        </span>
      </div>

      <div class="sticky-actions__right">
        <a-button size="large" @click="goBack">Volver</a-button>

        <a-button size="large" @click="goToComprobantes">
          <template #icon><FileTextOutlined /></template>
          Ver comprobantes
        </a-button>

        <a-button size="large" @click="nuevaVenta">
          <template #icon><RiseOutlined /></template>
          Nueva venta
        </a-button>

        <a-button type="primary" size="large" @click="goEdit">
          <template #icon><EditOutlined /></template>
          Editar cliente
        </a-button>
        <a-button @click="$router.push({ name: 'cliente-cuenta-corriente', params: { id: cliente.id } })">
          <template #icon><DollarOutlined /></template>
          Cuenta corriente
        </a-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cliente-detail-page {
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
.info-pill,
.risk-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status-pill--success {
  background: color-mix(in srgb, #16a34a 14%, transparent);
  color: color-mix(in srgb, #16a34a 88%, black 12%);
}

.status-pill--muted {
  background: color-mix(in srgb, var(--text-2) 12%, transparent);
  color: var(--text-1);
}

.risk-pill--ok {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: color-mix(in srgb, #16a34a 84%, black 16%);
}

.risk-pill--warn {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: color-mix(in srgb, #f59e0b 86%, black 14%);
}

.risk-pill--danger {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: color-mix(in srgb, #ef4444 86%, black 14%);
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

.kpis-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
}

.kpi-card {
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  background: var(--surface-0);
  border: 1px solid color-mix(in srgb, var(--text-2) 8%, transparent);
}

.kpi-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  gap: 14px;
}

.kpi-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: rgba(var(--accent-rgb), 0.14);
  color: rgba(var(--accent-rgb), 1);
  font-size: 18px;
  flex: 0 0 auto;
}

.kpi-card__body {
  min-width: 0;
}

.kpi-card__label {
  font-size: 12px;
  color: var(--text-2);
}

.kpi-card__value {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-0);
  line-height: 1.15;
  margin-top: 2px;
}

.kpi-card__hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.35;
}

.kpi-card.tone-danger {
  border-color: rgba(239, 68, 68, 0.22);
}

.kpi-card.tone-danger .kpi-card__icon {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.kpi-card.tone-blue {
  border-color: rgba(59, 130, 246, 0.2);
}

.kpi-card.tone-blue .kpi-card__icon {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.kpi-card.tone-warn {
  border-color: rgba(245, 158, 11, 0.22);
}

.kpi-card.tone-warn .kpi-card__icon {
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
}

.kpi-card.tone-success {
  border-color: rgba(22, 163, 74, 0.2);
}

.kpi-card.tone-success .kpi-card__icon {
  background: rgba(22, 163, 74, 0.12);
  color: #16a34a;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.detail-card,
.side-card {
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  background: var(--surface-0);
}

.main-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.main-panel :deep(.ant-spin-nested-loading),
.main-panel :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
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

.aging-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.aging-card {
  padding: 14px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--text-2) 8%, transparent);
  background: color-mix(in srgb, var(--surface-1) 80%, transparent);
}

.aging-card__label {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 700;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.aging-card__value {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-0);
}

.tone-blue {
  border-color: rgba(59, 130, 246, 0.18);
}

.tone-gold {
  border-color: rgba(245, 158, 11, 0.2);
}

.tone-orange {
  border-color: rgba(249, 115, 22, 0.2);
}

.tone-red {
  border-color: rgba(239, 68, 68, 0.22);
}

.payment-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 82px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.payment-badge--paid {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
}

.payment-badge--partial {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.payment-badge--unpaid {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-grid--single {
  grid-template-columns: 1fr;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 8%, transparent);
}

.info-item__label {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-item__value {
  font-size: 15px;
  color: var(--text-0);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.risk-inline {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.risk-inline.risk-pill--ok {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: color-mix(in srgb, #16a34a 84%, black 16%);
}

.risk-inline.risk-pill--warn {
  background: color-mix(in srgb, #f59e0b 14%, transparent);
  color: color-mix(in srgb, #f59e0b 86%, black 14%);
}

.risk-inline.risk-pill--danger {
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: color-mix(in srgb, #ef4444 86%, black 14%);
}

.inline-icon {
  color: rgba(var(--accent-rgb), 1);
}

.stack-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stack-card {
  padding: 14px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 76%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-2) 10%, transparent);
}

.stack-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.stack-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  color: var(--text-0);
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

.stack-block__title {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-0);
}

.notes-box {
  min-height: 80px;
  padding: 16px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--surface-1) 78%, transparent);
  color: var(--text-1);
  line-height: 1.6;
  border: 1px solid color-mix(in srgb, var(--text-2) 8%, transparent);
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

.summary-item--compact {
  align-items: flex-start;
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
  flex-wrap: wrap;
}

@media (max-width: 1440px) {
  .kpis-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
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

  .aging-grid {
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

  .hero__right,
  .kpis-grid,
  .aging-grid,
  .info-grid {
    grid-template-columns: 1fr;
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
