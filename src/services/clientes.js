import api from '@/services/api'

/**
 * =========================================
 * CLIENTES ADMIN
 * =========================================
 */

export const fetchClientes = (params = {}) =>
  api.get('/api/clientes-admin/', { params })

export const fetchCliente = (id) =>
  api.get(`/api/clientes-admin/${id}/`)

export const fetchClienteDashboard = (id) =>
  api.get(`/api/clientes-admin/${id}/dashboard/`)

export const createCliente = (payload) =>
  api.post('/api/clientes-admin/', payload)

export const updateCliente = (id, payload) =>
  api.put(`/api/clientes-admin/${id}/`, payload)

export const patchCliente = (id, payload) =>
  api.patch(`/api/clientes-admin/${id}/`, payload)

export const deleteCliente = (id) =>
  api.delete(`/api/clientes-admin/${id}/`)

export const deactivateCliente = (id) =>
  api.delete(`/api/clientes-admin/${id}/`)

export const bloquearCliente = (id) =>
  api.post(`/api/clientes-admin/${id}/desactivar/`)

export const activarCliente = (id) =>
  api.post(`/api/clientes-admin/${id}/activar/`)

/**
 * =========================================
 * METADATA / CATÁLOGOS
 * =========================================
 */

export const fetchSituacionesIVA = () =>
  api.get('/api/clientes-admin-meta/situaciones-iva/')

export const fetchCategoriasCliente = () =>
  api.get('/api/clientes-admin-meta/categorias/')

export const fetchVendedores = () =>
  api.get('/api/clientes-admin-meta/vendedores/')

export const fetchPriceLists = () =>
  api.get('/api/clientes-admin-meta/price-lists/')
