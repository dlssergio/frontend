<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  UserOutlined, PlusOutlined, ReloadOutlined,
  EditOutlined, DeleteOutlined, LockOutlined,
  CheckCircleOutlined, StopOutlined, TeamOutlined,
  SafetyOutlined, SearchOutlined, KeyOutlined,
} from '@ant-design/icons-vue'
import api from '@/services/api'

const activeTab    = ref('usuarios')
const loading      = ref(false)
const usuarios     = ref([])
const grupos       = ref([])
const searchUs     = ref('')
const filtroActivo = ref('')
const modalUsuario  = ref(false)
const modalGrupo    = ref(false)
const modalPassword = ref(false)
const submitting    = ref(false)
const userEdit      = ref(null)
const grupoEdit     = ref(null)
const userPasswordTarget = ref(null)
const newPassword        = ref('')
const confirmPassword    = ref('')

const formUser = reactive({
  username: '', email: '', first_name: '', last_name: '',
  is_active: true, is_staff: false, password: '', groups: [],
})
const formGrupo = reactive({ name: '' })

const kpis = computed(() => ({
  total:   usuarios.value.length,
  activos: usuarios.value.filter(u => u.is_active).length,
  staff:   usuarios.value.filter(u => u.is_staff).length,
  grupos:  grupos.value.length,
}))

const colsUsuarios = [
  { key: 'avatar',   title: '',              width: 48,  align: 'center' },
  { key: 'nombre',   title: 'Usuario',       ellipsis: true },
  { key: 'email',    title: 'Email',         dataIndex: 'email', width: 220, ellipsis: true },
  { key: 'grupos',   title: 'Grupos / Roles',width: 200 },
  { key: 'estado',   title: 'Estado',        width: 110, align: 'center' },
  { key: 'ultimo',   title: 'Último acceso', width: 140 },
  { key: 'acciones', title: 'Acciones',      width: 170, align: 'center', fixed: 'right' },
]

const colsGrupos = [
  { key: 'name',     title: 'Nombre del Grupo / Rol', ellipsis: true },
  { key: 'cant',     title: 'Usuarios',    width: 120, align: 'center' },
  { key: 'acciones', title: 'Acciones',    width: 110, align: 'center', fixed: 'right' },
]

async function loadUsuarios() {
  loading.value = true
  try {
    const params = {}
    if (searchUs.value)     params.search = searchUs.value
    if (filtroActivo.value) params.activo = filtroActivo.value
    const res = await api.get('/api/auth/usuarios/', { params })
    usuarios.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar usuarios.') }
  finally   { loading.value = false }
}

async function loadGrupos() {
  try {
    const res = await api.get('/api/auth/grupos/')
    grupos.value = res.data.results ?? res.data
  } catch { message.error('Error al cargar grupos.') }
}

function onReset() { searchUs.value = ''; filtroActivo.value = ''; loadUsuarios() }

function abrirNuevoUsuario() {
  userEdit.value = null
  Object.assign(formUser, { username: '', email: '', first_name: '', last_name: '', is_active: true, is_staff: false, password: '', groups: [] })
  modalUsuario.value = true
}

function abrirEditarUsuario(u) {
  userEdit.value = u
  Object.assign(formUser, { username: u.username, email: u.email, first_name: u.first_name, last_name: u.last_name, is_active: u.is_active, is_staff: u.is_staff, password: '', groups: u.groups.map(g => g.id) })
  modalUsuario.value = true
}

async function guardarUsuario() {
  if (!formUser.username.trim()) { message.error('El nombre de usuario es obligatorio.'); return }
  if (!userEdit.value && formUser.password.length < 8) { message.error('La contrasena debe tener al menos 8 caracteres.'); return }
  submitting.value = true
  try {
    const payload = { ...formUser }
    if (!payload.password) delete payload.password
    userEdit.value
      ? await api.patch('/api/auth/usuarios/' + userEdit.value.id + '/', payload)
      : await api.post('/api/auth/usuarios/', payload)
    message.success(userEdit.value ? 'Usuario actualizado.' : 'Usuario creado.')
    modalUsuario.value = false
    loadUsuarios()
  } catch (e) {
    const err = e.response?.data
    message.error(err && typeof err === 'object'
      ? Object.entries(err).map(([k,v]) => k + ': ' + (Array.isArray(v) ? v.join(', ') : v)).join(' | ')
      : 'No se pudo guardar.')
  } finally { submitting.value = false }
}

async function toggleActivo(u) {
  try {
    const accion = u.is_active ? 'desactivar' : 'activar'
    await api.post('/api/auth/usuarios/' + u.id + '/' + accion + '/')
    message.success(u.is_active ? 'Usuario desactivado.' : 'Usuario activado.')
    loadUsuarios()
  } catch (e) { message.error(e.response?.data?.error ?? 'No se pudo cambiar el estado.') }
}

async function eliminarUsuario(u) {
  Modal.confirm({
    title: 'Eliminar usuario ' + u.username,
    content: 'Esta accion no se puede deshacer.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await api.delete('/api/auth/usuarios/' + u.id + '/'); message.success('Eliminado.'); loadUsuarios() }
      catch (e) { message.error(e.response?.data?.error ?? 'No se pudo eliminar.') }
    },
  })
}

function abrirResetPassword(u) {
  userPasswordTarget.value = u
  newPassword.value = ''; confirmPassword.value = ''
  modalPassword.value = true
}

async function guardarPassword() {
  if (newPassword.value.length < 8) { message.error('Minimo 8 caracteres.'); return }
  if (newPassword.value !== confirmPassword.value) { message.error('Las contrasenas no coinciden.'); return }
  submitting.value = true
  try {
    await api.post('/api/auth/usuarios/' + userPasswordTarget.value.id + '/reset-password/', { password: newPassword.value })
    message.success('Contrasena actualizada.')
    modalPassword.value = false
  } catch (e) { message.error(e.response?.data?.error ?? 'No se pudo cambiar.') }
  finally { submitting.value = false }
}

function abrirNuevoGrupo() { grupoEdit.value = null; formGrupo.name = ''; modalGrupo.value = true }
function abrirEditarGrupo(g) { grupoEdit.value = g; formGrupo.name = g.name; modalGrupo.value = true }

async function guardarGrupo() {
  if (!formGrupo.name.trim()) { message.error('El nombre es obligatorio.'); return }
  submitting.value = true
  try {
    grupoEdit.value
      ? await api.patch('/api/auth/grupos/' + grupoEdit.value.id + '/', { name: formGrupo.name })
      : await api.post('/api/auth/grupos/', { name: formGrupo.name })
    message.success(grupoEdit.value ? 'Grupo actualizado.' : 'Grupo creado.')
    modalGrupo.value = false
    loadGrupos(); loadUsuarios()
  } catch (e) { message.error(e.response?.data?.name?.[0] ?? 'No se pudo guardar.') }
  finally { submitting.value = false }
}

async function eliminarGrupo(g) {
  Modal.confirm({
    title: 'Eliminar grupo "' + g.name + '"',
    content: 'Los usuarios perderan este rol.',
    okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
    async onOk() {
      try { await api.delete('/api/auth/grupos/' + g.id + '/'); message.success('Eliminado.'); loadGrupos(); loadUsuarios() }
      catch { message.error('No se pudo eliminar.') }
    },
  })
}

const fmtFecha  = (v) => v ? new Date(v).toLocaleDateString('es-AR', { dateStyle: 'medium' }) : 'Nunca'
const initials  = (u) => {
  const f = (u.first_name || '')[0] || ''
  const l = (u.last_name  || '')[0] || ''
  return (f + l).toUpperCase() || (u.username || 'U')[0].toUpperCase()
}
const cantGrupo = (g) => usuarios.value.filter(u => u.groups.some(ug => ug.id === g.id)).length

onMounted(() => { loadUsuarios(); loadGrupos() })
</script>

<template>
  <div class="usuarios-page">

    <!-- Modal Usuario -->
    <a-modal v-model:open="modalUsuario"
      :title="userEdit ? 'Editar — ' + userEdit.username : 'Nuevo Usuario'"
      :footer="null" width="580px" destroy-on-close>
      <div class="mw">
        <div class="mg2">
          <div class="mf">
            <label class="req">Usuario</label>
            <a-input v-model:value="formUser.username" allow-clear :disabled="!!userEdit" placeholder="ej: jperez" />
            <span v-if="userEdit" class="hint">No se puede cambiar</span>
          </div>
          <div class="mf">
            <label>Email</label>
            <a-input v-model:value="formUser.email" type="email" allow-clear />
          </div>
          <div class="mf">
            <label>Nombre</label>
            <a-input v-model:value="formUser.first_name" allow-clear />
          </div>
          <div class="mf">
            <label>Apellido</label>
            <a-input v-model:value="formUser.last_name" allow-clear />
          </div>
          <div class="mf full">
            <label :class="!userEdit ? 'req' : ''">
              {{ userEdit ? 'Nueva contrasena (vacio = sin cambiar)' : 'Contrasena' }}
            </label>
            <a-input-password v-model:value="formUser.password" placeholder="Minimo 8 caracteres" />
          </div>
          <div class="mf full">
            <label>Grupos / Roles</label>
            <a-select v-model:value="formUser.groups" mode="multiple" style="width:100%"
              placeholder="Selecciona grupos" allow-clear>
              <a-select-option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.name }}</a-select-option>
            </a-select>
          </div>
          <div class="mf full">
            <a-space :size="20">
              <a-checkbox v-model:checked="formUser.is_active">Activo</a-checkbox>
              <a-checkbox v-model:checked="formUser.is_staff">Staff (acceso admin)</a-checkbox>
            </a-space>
          </div>
        </div>
        <div class="mf-foot">
          <a-button @click="modalUsuario = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardarUsuario">
            {{ userEdit ? 'Guardar cambios' : 'Crear usuario' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Modal Reset Password -->
    <a-modal v-model:open="modalPassword"
      :title="'Cambiar contrasena — ' + (userPasswordTarget ? userPasswordTarget.username : '')"
      :footer="null" width="420px" destroy-on-close>
      <div class="mw">
        <div class="mf" style="margin-bottom:12px">
          <label class="req">Nueva contrasena</label>
          <a-input-password v-model:value="newPassword" placeholder="Minimo 8 caracteres" />
        </div>
        <div class="mf" style="margin-bottom:16px">
          <label class="req">Confirmar</label>
          <a-input-password v-model:value="confirmPassword" />
          <span v-if="confirmPassword && newPassword !== confirmPassword" class="error-hint">No coinciden</span>
        </div>
        <div class="mf-foot">
          <a-button @click="modalPassword = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardarPassword">
            <KeyOutlined /> Cambiar
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Modal Grupo -->
    <a-modal v-model:open="modalGrupo"
      :title="grupoEdit ? 'Editar: ' + grupoEdit.name : 'Nuevo Grupo'"
      :footer="null" width="400px" destroy-on-close>
      <div class="mw">
        <div class="mf" style="margin-bottom:16px">
          <label class="req">Nombre del grupo</label>
          <a-input v-model:value="formGrupo.name" allow-clear placeholder="Ej: Vendedores, Administradores" @pressEnter="guardarGrupo" />
          <span class="hint">Se asigna a usuarios para definir su rol.</span>
        </div>
        <div class="mf-foot">
          <a-button @click="modalGrupo = false">Cancelar</a-button>
          <a-button type="primary" :loading="submitting" @click="guardarGrupo">
            {{ grupoEdit ? 'Guardar' : 'Crear' }}
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- Hero -->
    <section class="hero">
      <div class="hero__eyebrow">Sistema</div>
      <h1 class="hero__title">Usuarios y Roles</h1>
      <p class="hero__subtitle">Gestion de accesos, grupos y permisos del sistema.</p>
    </section>

    <!-- KPIs -->
    <section class="kpis">
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--blue"><UserOutlined /></div>
        <div class="kpi-card__content"><div class="kpi-card__label">Usuarios</div><div class="kpi-card__value">{{ kpis.total }}</div></div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--green"><CheckCircleOutlined /></div>
        <div class="kpi-card__content"><div class="kpi-card__label">Activos</div><div class="kpi-card__value">{{ kpis.activos }}</div></div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--gold"><SafetyOutlined /></div>
        <div class="kpi-card__content"><div class="kpi-card__label">Grupos</div><div class="kpi-card__value">{{ kpis.grupos }}</div></div>
      </a-card>
      <a-card class="kpi-card" :bordered="false">
        <div class="kpi-card__icon kpi-card__icon--purple"><LockOutlined /></div>
        <div class="kpi-card__content"><div class="kpi-card__label">Staff</div><div class="kpi-card__value">{{ kpis.staff }}</div></div>
      </a-card>
    </section>

    <!-- Tabs -->
    <a-card class="main-card" :bordered="false">
      <a-tabs v-model:activeKey="activeTab">

        <!-- Usuarios -->
        <a-tab-pane key="usuarios">
          <template #tab><UserOutlined /> Usuarios ({{ kpis.total }})</template>
          <div class="tab-toolbar">
            <div class="toolbar-left">
              <a-input-search v-model:value="searchUs" size="large" allow-clear
                placeholder="Buscar por usuario, nombre, email..." style="width:300px" @search="loadUsuarios">
                <template #prefix><SearchOutlined /></template>
              </a-input-search>
              <a-select v-model:value="filtroActivo" size="large" style="width:150px" @change="loadUsuarios">
                <a-select-option value="">Todos</a-select-option>
                <a-select-option value="true">Activos</a-select-option>
                <a-select-option value="false">Inactivos</a-select-option>
              </a-select>
              <a-button size="large" @click="onReset">Limpiar</a-button>
            </div>
            <div class="toolbar-right">
              <a-button size="large" :loading="loading" @click="loadUsuarios"><ReloadOutlined /></a-button>
              <a-button type="primary" size="large" @click="abrirNuevoUsuario">
                <PlusOutlined /> Nuevo Usuario
              </a-button>
            </div>
          </div>

          <a-table :columns="colsUsuarios" :data-source="usuarios" :loading="loading"
            row-key="id" size="middle"
            :pagination="{ pageSize: 20, showTotal: t => t + ' usuarios', simple: true }"
            :scroll="{ x: 1000 }">
            <template #bodyCell="{ column, record }">

              <template v-if="column.key === 'avatar'">
                <div class="user-avatar" :class="record.is_active ? 'av--active' : 'av--inactive'">
                  {{ initials(record) }}
                </div>
              </template>

              <template v-if="column.key === 'nombre'">
                <div class="u-name">{{ record.first_name }} {{ record.last_name }}</div>
                <div class="u-username">@{{ record.username }}</div>
                <a-tag v-if="record.is_superuser" color="gold"    style="font-size:9px;padding:0 4px">superadmin</a-tag>
                <a-tag v-else-if="record.is_staff" color="purple" style="font-size:9px;padding:0 4px">staff</a-tag>
              </template>

              <template v-if="column.key === 'grupos'">
                <div class="grupos-wrap">
                  <a-tag v-for="g in record.groups" :key="g.id" color="geekblue" style="font-size:11px">{{ g.name }}</a-tag>
                  <span v-if="!record.groups.length" class="sin-grupo">Sin grupo</span>
                </div>
              </template>

              <template v-if="column.key === 'estado'">
                <a-badge :status="record.is_active ? 'success' : 'default'"
                  :text="record.is_active ? 'Activo' : 'Inactivo'" style="font-size:12px" />
              </template>

              <template v-if="column.key === 'ultimo'">
                <span style="font-size:11px;color:var(--text-2)">{{ fmtFecha(record.last_login) }}</span>
              </template>

              <template v-if="column.key === 'acciones'">
                <a-space size="small">
                  <a-tooltip title="Editar">
                    <a-button size="small" @click="abrirEditarUsuario(record)"><EditOutlined /></a-button>
                  </a-tooltip>
                  <a-tooltip title="Cambiar contrasena">
                    <a-button size="small" @click="abrirResetPassword(record)"><KeyOutlined /></a-button>
                  </a-tooltip>
                  <a-tooltip :title="record.is_active ? 'Desactivar' : 'Activar'">
                    <a-button size="small" :danger="record.is_active" @click="toggleActivo(record)">
                      <StopOutlined v-if="record.is_active" /><CheckCircleOutlined v-else />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip v-if="!record.is_superuser" title="Eliminar">
                    <a-button size="small" danger @click="eliminarUsuario(record)"><DeleteOutlined /></a-button>
                  </a-tooltip>
                </a-space>
              </template>

            </template>
            <template #emptyText><a-empty description="Sin usuarios" :image="false" /></template>
          </a-table>
        </a-tab-pane>

        <!-- Grupos -->
        <a-tab-pane key="grupos">
          <template #tab><TeamOutlined /> Grupos / Roles ({{ kpis.grupos }})</template>
          <a-alert type="info" show-icon
            message="Los grupos agrupan usuarios con el mismo rol. Asigna los grupos a usuarios desde la pestana anterior."
            style="margin-bottom:16px;font-size:12px" />
          <div class="tab-toolbar">
            <div class="toolbar-right">
              <a-button type="primary" size="large" @click="abrirNuevoGrupo">
                <PlusOutlined /> Nuevo Grupo
              </a-button>
            </div>
          </div>
          <a-table :columns="colsGrupos" :data-source="grupos"
            row-key="id" size="middle" :pagination="{ pageSize: 20, simple: true }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="grupo-name"><SafetyOutlined style="margin-right:8px;color:#6366f1" />{{ record.name }}</div>
              </template>
              <template v-if="column.key === 'cant'">
                <a-badge :count="cantGrupo(record)" :overflow-count="99" :color="cantGrupo(record) > 0 ? '#6366f1' : '#94a3b8'" />
              </template>
              <template v-if="column.key === 'acciones'">
                <a-space>
                  <a-button size="small" @click="abrirEditarGrupo(record)"><EditOutlined /></a-button>
                  <a-button size="small" danger @click="eliminarGrupo(record)"><DeleteOutlined /></a-button>
                </a-space>
              </template>
            </template>
            <template #emptyText><a-empty description="Sin grupos creados" :image="false" /></template>
          </a-table>
        </a-tab-pane>

      </a-tabs>
    </a-card>

  </div>
</template>

<style scoped>
.usuarios-page { display:flex; flex-direction:column; gap:16px; color:var(--text-0); }
.hero { padding:20px 22px; border-radius:6px; background:radial-gradient(circle at top right,rgba(var(--accent-rgb),.10),transparent 30%),linear-gradient(135deg,color-mix(in srgb,var(--surface-1) 92%,transparent),color-mix(in srgb,var(--surface-0) 96%,transparent)); border:1px solid color-mix(in srgb,var(--text-2) 14%,transparent); box-shadow:0 8px 20px rgba(0,0,0,.08); }
.hero__eyebrow { font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-2); margin-bottom:8px; }
.hero__title   { margin:0; font-size:28px; font-weight:800; color:var(--text-0); }
.hero__subtitle{ margin:10px 0 0; color:var(--text-1); }
.kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
.kpi-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.kpi-card :deep(.ant-card-body) { display:flex; align-items:center; gap:14px; }
.kpi-card__icon { width:46px; height:46px; border-radius:6px; display:grid; place-items:center; font-size:20px; }
.kpi-card__icon--blue   { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 14%,transparent); color:rgba(var(--accent-rgb),1); }
.kpi-card__icon--green  { background:color-mix(in srgb,#16a34a 14%,transparent); color:#16a34a; }
.kpi-card__icon--gold   { background:color-mix(in srgb,#f59e0b 14%,transparent); color:#d97706; }
.kpi-card__icon--purple { background:color-mix(in srgb,#8b5cf6 14%,transparent); color:#7c3aed; }
.kpi-card__label { font-size:12px; color:var(--text-2); }
.kpi-card__value { font-size:24px; font-weight:800; color:var(--text-0); }
.main-card { border-radius:6px; box-shadow:0 6px 18px rgba(0,0,0,.08); background:var(--surface-0); }
.tab-toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.toolbar-left  { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.toolbar-right { display:flex; gap:8px; }
.user-avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; }
.av--active   { background:color-mix(in srgb,rgba(var(--accent-rgb),1) 15%,transparent); color:rgba(var(--accent-rgb),1); }
.av--inactive { background:var(--surface-1,#f1f5f9); color:var(--text-2); }
.u-name     { font-size:13px; font-weight:700; color:var(--text-0); }
.u-username { font-size:11px; color:var(--text-2); font-family:monospace; }
.grupos-wrap { display:flex; flex-wrap:wrap; gap:3px; }
.sin-grupo   { font-size:11px; color:var(--text-2); font-style:italic; }
.grupo-name  { font-size:14px; font-weight:700; display:flex; align-items:center; color:var(--text-0); }
.mw  { padding-top:8px; }
.mg2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.mf  { display:flex; flex-direction:column; gap:4px; }
.mf label { font-size:11px; font-weight:600; color:var(--text-2); }
.mf label.req::after { content:' *'; color:#ef4444; }
.full { grid-column:1/-1; }
.hint { font-size:10px; color:var(--text-2); }
.error-hint { font-size:11px; color:#dc2626; font-weight:600; }
.mf-foot { display:flex; justify-content:flex-end; gap:8px; padding-top:14px; border-top:1px solid var(--border,#f0f0f0); margin-top:12px; }
@media (max-width:1100px) { .kpis { grid-template-columns:repeat(2,1fr); } }
</style>
