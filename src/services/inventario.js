// src/services/inventario.js
// Capa centralizada de llamadas API para el módulo de Inventario.
// Nunca llamar a axios directamente desde las vistas — siempre usar este módulo.

import api from './api'  // instancia de Axios con baseURL y token configurados

// ─────────────────────────────────────────────
//  ARTÍCULOS
// ─────────────────────────────────────────────

export const articulosService = {
  /**
   * Lista paginada de artículos con filtros.
   * @param {Object} params - search, rubro, marca, activo, perfil, bajo_minimo, page, page_size
   */
  listar(params = {}) {
    return api.get('/api/articulos/', { params })
  },

  /**
   * Detalle completo de un artículo (todas las pestañas).
   */
  obtener(id) {
    return api.get(`/api/articulos/${id}/`)
  },

  /**
   * Crear artículo nuevo.
   * @param {Object} data - campos del ArticuloWriteSerializer
   */
  crear(data) {
    // Si hay foto como File, usar FormData; si no, JSON normal
    if (data.foto instanceof File) {
      const fd = buildFormData(data)
      return api.post('/api/articulos/', fd)
    }
    return api.post('/api/articulos/', data)
  },

  /**
   * Crear con FormData ya construido externamente (desde ArticuloFormView).
   * Se usa cuando el llamador necesita control total sobre los campos del FormData.
   */
  crearConFoto(formData) {
    return api.post('/api/articulos/', formData)
  },

  /**
   * Actualizar artículo (PATCH — parcial).
   */
  actualizar(id, data) {
    if (data.foto instanceof File) {
      const fd = buildFormData(data)
      return api.patch(`/api/articulos/${id}/`, fd)
    }
    return api.patch(`/api/articulos/${id}/`, data)
  },

  /**
   * Actualizar con FormData ya construido externamente (desde ArticuloFormView).
   */
  actualizarConFoto(id, formData) {
    return api.patch(`/api/articulos/${id}/`, formData)
  },

  /**
   * Desactivar artículo (nunca DELETE físico).
   */
  desactivar(id) {
    return api.post(`/api/articulos/${id}/desactivar/`)
  },

  activar(id) {
    return api.post(`/api/articulos/${id}/activar/`)
  },

  /**
   * Balance de stock del artículo por depósito.
   */
  stockPorDeposito(id) {
    return api.get(`/api/articulos/${id}/stock/`)
  },

  /**
   * Kardex: historial de movimientos con saldo acumulado.
   * @param {number} id
   * @param {Object} params - deposito, desde, hasta
   */
  kardex(id, params = {}) {
    return api.get(`/api/articulos/${id}/kardex/`, { params })
  },

  /**
   * Opciones para selects (perfil, etc.)
   */
  choices() {
    return api.get('/api/articulos/choices/')
  },

  /**
   * Artículos bajo stock mínimo (alertas de reposición).
   */
  alertas() {
    return api.get('/api/articulos/alertas/')
  },

  /**
   * KPIs de inventario para el panel.
   */
  dashboard() {
    return api.get('/api/articulos/dashboard/')
  },

  /**
   * Búsqueda rápida (typeahead) — retorna lista compacta.
   * @param {string} query - texto a buscar
   * @param {Object} extra - filtros adicionales opcionales
   */
  buscar(query, extra = {}) {
    return api.get('/api/articulos/', {
      params: { search: query, page_size: 20, activo: true, ...extra },
    })
  },
}

// ─────────────────────────────────────────────
//  MAESTROS
// ─────────────────────────────────────────────

export const marcasService = {
  listar(params = {}) { return api.get('/api/marcas/', { params }) },
  crear(data)          { return api.post('/api/marcas/', data) },
  actualizar(id, data) { return api.patch(`/api/marcas/${id}/`, data) },
  eliminar(id)         { return api.delete(`/api/marcas/${id}/`) },
}

export const rubrosService = {
  listar(params = {}) { return api.get('/api/rubros/', { params }) },
  crear(data)          { return api.post('/api/rubros/', data) },
  actualizar(id, data) { return api.patch(`/api/rubros/${id}/`, data) },
  eliminar(id)         { return api.delete(`/api/rubros/${id}/`) },
}

export const depositosService = {
  listar(params = {}) { return api.get('/api/inventario/depositos/', { params }) },
  obtener(id)          { return api.get(`/api/inventario/depositos/${id}/`) },
  crear(data)          { return api.post('/api/inventario/depositos/', data) },
  actualizar(id, data) { return api.patch(`/api/inventario/depositos/${id}/`, data) },
  eliminar(id)         { return api.delete(`/api/inventario/depositos/${id}/`) },
}

export const motivosAjusteService = {
  listar()             { return api.get('/api/inventario/motivos-ajuste/') },
  crear(data)          { return api.post('/api/inventario/motivos-ajuste/', data) },
  actualizar(id, data) { return api.patch(`/api/inventario/motivos-ajuste/${id}/`, data) },
  eliminar(id)         { return api.delete(`/api/inventario/motivos-ajuste/${id}/`) },
}

export const tiposStockService = {
  listar() { return api.get('/api/inventario/tipos-stock/') },
}

// ─────────────────────────────────────────────
//  AJUSTES DE STOCK
// ─────────────────────────────────────────────

export const ajustesService = {
  /**
   * Lista de ajustes.
   * @param {Object} params - deposito, estado, motivo, desde, hasta
   */
  listar(params = {}) {
    return api.get('/api/inventario/ajustes/', { params })
  },

  obtener(id) {
    return api.get(`/api/inventario/ajustes/${id}/`)
  },

  /**
   * Crear ajuste (queda en estado Borrador).
   * @param {Object} data - { deposito, motivo, observaciones, items: [{articulo, tipo_movimiento, cantidad}] }
   */
  crear(data) {
    return api.post('/api/inventario/ajustes/', data)
  },

  actualizar(id, data) {
    return api.patch(`/api/inventario/ajustes/${id}/`, data)
  },

  eliminar(id) {
    return api.delete(`/api/inventario/ajustes/${id}/`)
  },

  /**
   * Confirmar ajuste — aplica el impacto en el stock.
   */
  confirmar(id) {
    return api.post(`/api/inventario/ajustes/${id}/confirmar/`)
  },

  /**
   * Anular ajuste.
   */
  anular(id) {
    return api.post(`/api/inventario/ajustes/${id}/anular/`)
  },
}

// ─────────────────────────────────────────────
//  TRANSFERENCIAS ENTRE DEPÓSITOS
// ─────────────────────────────────────────────

export const transferenciasService = {
  /**
   * Lista de transferencias.
   * @param {Object} params - estado, origen, destino, desde, hasta
   */
  listar(params = {}) {
    return api.get('/api/inventario/transferencias/', { params })
  },

  obtener(id) {
    return api.get(`/api/inventario/transferencias/${id}/`)
  },

  /**
   * Crear transferencia (queda en estado Borrador).
   * @param {Object} data - { origen, destino, observaciones, items: [{articulo, cantidad}] }
   */
  crear(data) {
    return api.post('/api/inventario/transferencias/', data)
  },

  actualizar(id, data) {
    return api.patch(`/api/inventario/transferencias/${id}/`, data)
  },

  eliminar(id) {
    return api.delete(`/api/inventario/transferencias/${id}/`)
  },

  /**
   * Enviar / despachar mercadería.
   * Estado: Borrador → En Tránsito. Aplica salida del depósito origen.
   */
  enviar(id) {
    return api.post(`/api/inventario/transferencias/${id}/enviar/`)
  },

  /**
   * Recibir mercadería.
   * Estado: En Tránsito → Completada. Aplica entrada en depósito destino.
   */
  recibir(id) {
    return api.post(`/api/inventario/transferencias/${id}/recibir/`)
  },

  anular(id) {
    return api.post(`/api/inventario/transferencias/${id}/anular/`)
  },
}

// ─────────────────────────────────────────────
//  LEDGER Y BALANCE (consultas)
// ─────────────────────────────────────────────

export const ledgerService = {
  /**
   * Historial inmutable de movimientos.
   * @param {Object} params - articulo, deposito, origen_sistema, desde, hasta
   */
  listar(params = {}) {
    return api.get('/api/inventario/ledger/', { params })
  },
}

export const balanceService = {
  /**
   * Balance actual de stock.
   * @param {Object} params - articulo, deposito, solo_fisico, solo_positivos
   */
  listar(params = {}) {
    return api.get('/api/inventario/balance/', { params })
  },
}

// ─────────────────────────────────────────────
//  UTILIDADES INTERNAS

// ─────────────────────────────────────────────
//  PROVEEDOR DE ARTÍCULO
// ─────────────────────────────────────────────

export const proveedorArticuloService = {
  listar(articuloId) {
    return api.get(`/api/articulos/${articuloId}/proveedores/`)
  },
  crear(articuloId, data) {
    return api.post(`/api/articulos/${articuloId}/proveedores/`, data)
  },
  actualizar(articuloId, id, data) {
    return api.patch(`/api/articulos/${articuloId}/proveedores/${id}/`, data)
  },
  eliminar(articuloId, id) {
    return api.delete(`/api/articulos/${articuloId}/proveedores/${id}/`)
  },
  setFuenteDeVerdad(articuloId, id) {
    return api.post(`/api/articulos/${articuloId}/proveedores/${id}/set_fuente_de_verdad/`)
  },
}
// ─────────────────────────────────────────────

/**
 * Convierte un objeto plano en FormData para envíos con archivos.
 * Arrays se envían como campos múltiples (e.g. impuestos=[1,2,3]).
 */
function buildFormData(data) {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach(v => fd.append(key, v))
    } else {
      fd.append(key, value)
    }
  }
  return fd
}
