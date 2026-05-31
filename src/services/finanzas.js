// src/services/finanzas.js
import api from './api'

export const cuentasFondoService = {
  listar(params = {})         { return api.get('/api/finanzas/cuentas-fondo/', { params }) },
  obtener(id)                 { return api.get(`/api/finanzas/cuentas-fondo/${id}/`) },
  movimientos(id, params = {}){ return api.get(`/api/finanzas/cuentas-fondo/${id}/movimientos/`, { params }) },
  registrarMovimiento(id, data){ return api.post(`/api/finanzas/cuentas-fondo/${id}/movimiento/`, data) },
}

export const chequesService = {
  listar(params = {})  { return api.get('/api/finanzas/cheques/', { params }) },
  obtener(id)          { return api.get(`/api/finanzas/cheques/${id}/`) },
  crear(data)          { return api.post('/api/finanzas/cheques/', data) },
  actualizar(id, data) { return api.patch(`/api/finanzas/cheques/${id}/`, data) },
  resumen()            { return api.get('/api/finanzas/cheques/resumen/') },
  depositar(id)        { return api.post(`/api/finanzas/cheques/${id}/depositar/`) },
  cobrar(id)           { return api.post(`/api/finanzas/cheques/${id}/cobrar/`) },
  rechazar(id)         { return api.post(`/api/finanzas/cheques/${id}/rechazar/`) },
  anular(id)           { return api.post(`/api/finanzas/cheques/${id}/anular/`) },
}

export const bancosService = {
  listar() { return api.get('/api/finanzas/bancos/') },
}

export const tiposValorService = {
  listar() { return api.get('/api/finanzas/tipos-valores/') },
}
