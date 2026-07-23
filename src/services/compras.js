// src/services/compras.js
import api from './api'

// ─── Proveedores ──────────────────────────────────────────────

export const proveedoresService = {
  listar(params = {})    { return api.get('/api/proveedores/', { params }) },
  obtener(id)            { return api.get(`/api/proveedores/${id}/`) },
  crear(data)            { return api.post('/api/proveedores/', data) },
  actualizar(id, data)   { return api.patch(`/api/proveedores/${id}/`, data) },
  eliminar(id)           { return api.delete(`/api/proveedores/${id}/`) },
  comprobantes(id, params = {}) {
    return api.get(`/api/proveedores/${id}/comprobantes/`, { params })
  },

  // ENDPOINTS DE CUENTA CORRIENTE
  cuentaCorriente(id, params = {}) {
    return api.get(`/api/proveedores-admin/${id}/cuenta-corriente/`, { params })
  },
  comprobantesImpagos(id) {
    return api.get(`/api/proveedores-admin/${id}/comprobantes-impagos/`)
  },
  ordenesPago(id) {
    return api.get(`/api/proveedores-admin/${id}/ordenes-pago/`)
  },
  resumenCartera(params = {}) {
    return api.get('/api/proveedores-admin/resumen-cartera/', { params })
  }
}

// ─── Comprobantes de Compra ────────────────────────────────────

export const comprobantesCompraService = {
  listar(params = {})  { return api.get('/api/comprobantes-compra/', { params }) },
  obtener(id)          { return api.get(`/api/comprobantes-compra/${id}/`) },
  crear(data)          { return api.post('/api/comprobantes-compra/', data) },
  actualizar(id, data) { return api.patch(`/api/comprobantes-compra/${id}/`, data) },
  confirmar(id)        { return api.post(`/api/comprobantes-compra/${id}/confirmar/`) },
  anular(id)           { return api.post(`/api/comprobantes-compra/${id}/anular/`) },
}

// ─── Órdenes de Pago ──────────────────────────────────────────

export const ordenesPagoService = {
  listar(params = {})  { return api.get('/api/ordenes-pago/', { params }) },
  obtener(id)          { return api.get(`/api/ordenes-pago/${id}/`) },
  crear(data)          { return api.post('/api/ordenes-pago/', data) },
  actualizar(id, data) { return api.patch(`/api/ordenes-pago/${id}/`, data) },
  confirmar(id)        { return api.post(`/api/ordenes-pago/${id}/confirmar/`) },
  anular(id)           { return api.post(`/api/ordenes-pago/${id}/anular/`) },
}

// ─── Listas de Precios ────────────────────────────────────────

export const listasPreciosService = {
  // ── CRUD lista ──────────────────────────────────────────────
  listar(params = {})           { return api.get('/api/listas-precios/', { params }) },
  obtener(id)                   { return api.get(`/api/listas-precios/${id}/`) },
  crear(data)                   { return api.post('/api/listas-precios/', data) },
  actualizar(id, data)          { return api.patch(`/api/listas-precios/${id}/`, data) },
  eliminar(id)                  { return api.delete(`/api/listas-precios/${id}/`) },

  // ── CRUD ítems ──────────────────────────────────────────────
  agregarItem(id, data)         { return api.post(`/api/listas-precios/${id}/agregar_item/`, data) },
  editarItem(id, itemId, data)  { return api.patch(`/api/listas-precios/${id}/items/${itemId}/editar/`, data) },
  eliminarItem(id, itemId)      { return api.delete(`/api/listas-precios/${id}/items/${itemId}/`) },

  // ── Acciones masivas ────────────────────────────────────────
  bulkAjustePrecio(id, data)    { return api.post(`/api/listas-precios/${id}/bulk/ajuste-precio/`, data) },
  bulkDescuentos(id, data)      { return api.post(`/api/listas-precios/${id}/bulk/descuentos/`, data) },
  copiarLista(id, data)         { return api.post(`/api/listas-precios/${id}/bulk/copiar-lista/`, data) },
  exportarCSV(id)               { return api.get(`/api/listas-precios/${id}/exportar-csv/`, { responseType: 'blob' }) },
  historial(id, params = {})    { return api.get(`/api/listas-precios/${id}/historial/`, { params }) },
}
