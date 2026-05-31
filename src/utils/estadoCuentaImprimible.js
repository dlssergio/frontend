/**
 * estadoCuentaImprimible.js
 *
 * Genera y abre una ventana de impresión con el estado de cuenta
 * del cliente — diseño profesional inspirado en sistemas contables
 * líderes (Tango, Bejerman, Colppy).
 *
 * Uso:
 *   import { imprimirEstadoCuenta } from '@/utils/estadoCuentaImprimible'
 *   await imprimirEstadoCuenta(clienteId, api)
 */

export async function imprimirEstadoCuenta(clienteId, api) {
  // ── Fetch data ────────────────────────────────────────────────────────────
  const [dashRes, cliRes, empRes] = await Promise.all([
    api.get(`/api/clientes-admin/${clienteId}/dashboard/`),
    api.get(`/api/clientes/${clienteId}/`),
    api.get('/api/parametros/configuracion/').catch(() => ({ data: null })),
  ])

  const dash    = dashRes.data
  const cli     = cliRes.data
  const empresa = empRes.data

  // ── Helpers ───────────────────────────────────────────────────────────────
  const m = (n) => (Number(n) || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })

  const fecha = (iso) => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch { return iso }
  }

  const hoy       = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const horaEmis  = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ── Datos empresa ─────────────────────────────────────────────────────────
  const empNombre   = empresa?.nombre_fantasia || empresa?.entidad?.razon_social || 'Empresa'
  const empCuit     = empresa?.entidad?.cuit   || ''
  const empDomicilio = empresa?.entidad?.domicilios?.[0]
    ? `${empresa.entidad.domicilios[0].calle || ''} ${empresa.entidad.domicilios[0].numero || ''}`.trim()
    : ''

  // ── Datos cliente ─────────────────────────────────────────────────────────
  const cliNombre   = cli?.entidad?.razon_social || `Cliente #${clienteId}`
  const cliCuit     = cli?.entidad?.cuit         || '—'
  const cliCodigo   = cli?.codigo_cliente        || '—'
  const cliSitIva   = cli?.entidad?.situacion_iva?.nombre || '—'
  const cliLimite   = Number(cli?.limite_credito  || 0)
  const cliDias     = Number(cli?.dias_vencimiento || 0)
  const cliEmail    = cli?.contacto_email || cli?.entidad?.email || ''
  const cliVendedor = cli?.vendedor
    ? `${cli.vendedor.first_name || ''} ${cli.vendedor.last_name || ''}`.trim() || cli.vendedor.username
    : '—'

  // ── Aging ─────────────────────────────────────────────────────────────────
  const aging = dash.aging || {}
  const agingData = [
    { label: '0 – 30 días',   val: aging.bucket_0_30   || 0, color: '#16a34a' },
    { label: '31 – 60 días',  val: aging.bucket_31_60  || 0, color: '#d97706' },
    { label: '61 – 90 días',  val: aging.bucket_61_90  || 0, color: '#ea580c' },
    { label: '+ 90 días',     val: aging.bucket_90_plus|| 0, color: '#dc2626' },
  ].filter(a => a.val > 0)

  const agingFilas = agingData.map(a =>
    `<div class="aging-row">
      <span class="aging-label">${a.label}</span>
      <span class="aging-bar-wrap">
        <span class="aging-bar" style="width:${Math.min(100, (a.val / (dash.deuda_vencida || 1)) * 100)}%;background:${a.color}"></span>
      </span>
      <span class="aging-monto">$ ${m(a.val)}</span>
    </div>`
  ).join('')

  // ── Movimientos ───────────────────────────────────────────────────────────
  const movs = dash.movimientos_cta_cte || []

  const filasMov = movs.map((mov, i) => {
    const esPar    = i % 2 === 0
    const esRecibo = mov.tipo === 'Recibo'
    const saldoNeg = mov.saldo <= 0
    return `<tr class="${esPar ? 'row-par' : ''}">
      <td class="col-fecha">${fecha(mov.fecha)}</td>
      <td class="col-tipo">
        <span class="badge-tipo ${esRecibo ? 'badge-recibo' : 'badge-factura'}">${mov.tipo}</span>
      </td>
      <td class="col-numero">${mov.numero || '—'}</td>
      <td class="col-debe">${mov.debe > 0 ? '$ ' + m(mov.debe) : ''}</td>
      <td class="col-haber">${mov.haber > 0 ? '$ ' + m(mov.haber) : ''}</td>
      <td class="col-saldo ${saldoNeg ? 'saldo-ok' : 'saldo-deuda'}">$ ${m(mov.saldo)}</td>
    </tr>`
  }).join('')

  // ── Comprobantes impagos ──────────────────────────────────────────────────
  const impagos = (dash.ultimos_comprobantes || []).filter(c => c.saldo > 0)
  const filasImpagos = impagos.map((c, i) => {
    const esPar = i % 2 === 0
    return `<tr class="${esPar ? 'row-par' : ''}">
      <td class="col-fecha">${fecha(c.fecha)}</td>
      <td>${c.tipo || '—'}</td>
      <td class="col-numero">${c.numero || '—'}</td>
      <td class="col-debe">$ ${m(c.total)}</td>
      <td class="col-haber saldo-ok">$ ${m(c.total - c.saldo)}</td>
      <td class="col-saldo saldo-deuda">$ ${m(c.saldo)}</td>
    </tr>`
  }).join('')

  // ── Riesgo ────────────────────────────────────────────────────────────────
  const riesgo      = dash.riesgo || 'NORMAL'
  const riesgoLabel = riesgo === 'EXCEDIDO' ? 'EXCEDIDO' : riesgo === 'SEGUIMIENTO' ? 'EN SEGUIMIENTO' : 'NORMAL'
  const riesgoColor = riesgo === 'EXCEDIDO' ? '#dc2626' : riesgo === 'SEGUIMIENTO' ? '#d97706' : '#16a34a'

  // ── HTML ──────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estado de Cuenta — ${cliNombre}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600;700;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --ink:       #0f172a;
      --ink-2:     #334155;
      --ink-3:     #64748b;
      --ink-4:     #94a3b8;
      --rule:      #e2e8f0;
      --rule-2:    #f1f5f9;
      --accent:    #1e3a5f;
      --accent-lt: #e8f0f9;
      --deuda:     #dc2626;
      --ok:        #16a34a;
      --page-w:    210mm;
    }

    body {
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 9pt;
      color: var(--ink);
      background: #fff;
      padding: 14mm 16mm 14mm 16mm;
      line-height: 1.4;
    }

    /* ── Cabecera ─────────────────────────────────────────────────────── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
      border-bottom: 3px solid var(--accent);
      margin-bottom: 14px;
    }
    .header-empresa { max-width: 55%; }
    .empresa-nombre {
      font-size: 15pt;
      font-weight: 800;
      color: var(--accent);
      letter-spacing: -0.3px;
      line-height: 1.1;
    }
    .empresa-sub {
      font-size: 8pt;
      color: var(--ink-3);
      margin-top: 3px;
      font-family: 'IBM Plex Mono', monospace;
    }

    .header-doc { text-align: right; }
    .doc-titulo {
      font-size: 13pt;
      font-weight: 800;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .doc-sub {
      font-size: 7.5pt;
      color: var(--ink-3);
      margin-top: 4px;
      font-family: 'IBM Plex Mono', monospace;
    }

    /* ── Ficha cliente ────────────────────────────────────────────────── */
    .ficha-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .ficha-box {
      background: var(--rule-2);
      border: 1px solid var(--rule);
      border-radius: 4px;
      padding: 10px 12px;
    }
    .ficha-box--accent {
      background: var(--accent-lt);
      border-color: #b8cfe8;
    }
    .ficha-titulo {
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--ink-3);
      margin-bottom: 7px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--rule);
    }
    .ficha-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 4px;
    }
    .ficha-row:last-child { margin-bottom: 0; }
    .ficha-key {
      font-size: 7.5pt;
      color: var(--ink-3);
      white-space: nowrap;
    }
    .ficha-val {
      font-size: 8.5pt;
      font-weight: 600;
      color: var(--ink);
      text-align: right;
      font-family: 'IBM Plex Mono', monospace;
    }
    .ficha-val--big {
      font-size: 11pt;
      font-weight: 800;
      color: var(--deuda);
    }
    .ficha-val--ok { color: var(--ok); }

    /* ── Riesgo badge ─────────────────────────────────────────────────── */
    .riesgo-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #fff;
      background: ${riesgoColor};
    }

    /* ── Barra crédito ────────────────────────────────────────────────── */
    .credito-bar-wrap {
      margin-top: 6px;
      background: var(--rule);
      border-radius: 3px;
      height: 6px;
      overflow: hidden;
    }
    .credito-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: ${
        cliLimite > 0 && dash.saldo_total > cliLimite ? '#dc2626'
        : cliLimite > 0 && dash.saldo_total > cliLimite * 0.8 ? '#d97706'
        : '#16a34a'
      };
      width: ${cliLimite > 0 ? Math.min(100, (dash.saldo_total / cliLimite) * 100).toFixed(1) : 0}%;
    }
    .credito-pct {
      font-size: 7pt;
      color: var(--ink-3);
      margin-top: 3px;
      text-align: right;
    }

    /* ── KPIs ─────────────────────────────────────────────────────────── */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-item {
      background: var(--rule-2);
      border: 1px solid var(--rule);
      border-radius: 4px;
      padding: 8px 10px;
      text-align: center;
    }
    .kpi-label {
      font-size: 7pt;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--ink-3);
      margin-bottom: 4px;
    }
    .kpi-val {
      font-size: 11pt;
      font-weight: 800;
      color: var(--ink);
      font-family: 'IBM Plex Mono', monospace;
      line-height: 1.1;
    }
    .kpi-val--red  { color: var(--deuda); }
    .kpi-val--green { color: var(--ok); }

    /* ── Aging ────────────────────────────────────────────────────────── */
    .aging-section {
      margin-bottom: 14px;
    }
    .aging-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }
    .aging-label {
      width: 75px;
      font-size: 7.5pt;
      color: var(--ink-2);
      flex-shrink: 0;
    }
    .aging-bar-wrap {
      flex: 1;
      height: 8px;
      background: var(--rule);
      border-radius: 4px;
      overflow: hidden;
    }
    .aging-bar {
      display: block;
      height: 100%;
      border-radius: 4px;
    }
    .aging-monto {
      width: 90px;
      text-align: right;
      font-size: 8pt;
      font-weight: 700;
      font-family: 'IBM Plex Mono', monospace;
      color: var(--ink);
    }

    /* ── Sección título ───────────────────────────────────────────────── */
    .section-title {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--accent);
      border-bottom: 2px solid var(--accent);
      padding-bottom: 4px;
      margin-bottom: 8px;
    }

    /* ── Tablas ───────────────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: 8pt;
    }
    thead tr {
      background: var(--accent);
      color: #fff;
    }
    thead th {
      padding: 5px 7px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      white-space: nowrap;
    }
    tbody td {
      padding: 5px 7px;
      border-bottom: 1px solid var(--rule);
      vertical-align: middle;
    }
    .row-par td { background: var(--rule-2); }

    .col-fecha  { width: 68px;  white-space: nowrap; color: var(--ink-3); }
    .col-tipo   { width: 70px;  }
    .col-numero { font-family: 'IBM Plex Mono', monospace; font-size: 7.5pt; color: var(--ink-2); }
    .col-debe   { width: 100px; text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600; }
    .col-haber  { width: 100px; text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: var(--ok); }
    .col-saldo  { width: 105px; text-align: right; font-family: 'IBM Plex Mono', monospace; font-weight: 800; }
    .saldo-deuda { color: var(--deuda); }
    .saldo-ok    { color: var(--ok); }

    /* Fila total */
    .tr-total td {
      background: var(--accent-lt) !important;
      border-top: 2px solid var(--accent);
      font-weight: 800;
      font-size: 9pt;
    }

    /* Badges tipo */
    .badge-tipo {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-factura { background: #dbeafe; color: #1e40af; }
    .badge-recibo  { background: #dcfce7; color: #166534; }

    /* ── Pie de página ────────────────────────────────────────────────── */
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid var(--rule);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: var(--ink-4);
    }
    .footer-center { text-align: center; }

    /* ── Print ────────────────────────────────────────────────────────── */
    @page {
      size: A4 portrait;
      margin: 0;
    }
    @media print {
      body { padding: 10mm 12mm; }
      .no-print { display: none !important; }
    }

    /* Botón imprimir (solo pantalla) */
    .print-btn {
      position: fixed;
      top: 16px;
      right: 16px;
      padding: 10px 22px;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-family: 'IBM Plex Sans', sans-serif;
      font-size: 11pt;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      z-index: 999;
    }
    .print-btn:hover { background: #162d4a; }
  </style>
</head>
<body>

  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir</button>

  <!-- ── Cabecera ────────────────────────────────────────────────────────── -->
  <div class="header">
    <div class="header-empresa">
      <div class="empresa-nombre">${empNombre}</div>
      ${empCuit     ? `<div class="empresa-sub">CUIT: ${empCuit}</div>` : ''}
      ${empDomicilio ? `<div class="empresa-sub">${empDomicilio}</div>` : ''}
    </div>
    <div class="header-doc">
      <div class="doc-titulo">Estado de Cuenta</div>
      <div class="doc-sub">Emitido: ${hoy} ${horaEmis}hs</div>
      ${cliDias > 0 ? `<div class="doc-sub">Plazo habitual: ${cliDias} días</div>` : ''}
    </div>
  </div>

  <!-- ── Ficha cliente + resumen financiero ──────────────────────────────── -->
  <div class="ficha-grid">

    <!-- Datos del cliente -->
    <div class="ficha-box">
      <div class="ficha-titulo">Datos del cliente</div>
      <div class="ficha-row">
        <span class="ficha-key">Razón social</span>
        <span class="ficha-val" style="font-weight:800;font-family:'IBM Plex Sans',sans-serif">${cliNombre}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">CUIT</span>
        <span class="ficha-val">${cliCuit}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">Código</span>
        <span class="ficha-val">${cliCodigo}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">Situación IVA</span>
        <span class="ficha-val">${cliSitIva}</span>
      </div>
      ${cliEmail ? `
      <div class="ficha-row">
        <span class="ficha-key">Email</span>
        <span class="ficha-val">${cliEmail}</span>
      </div>` : ''}
      <div class="ficha-row">
        <span class="ficha-key">Vendedor</span>
        <span class="ficha-val">${cliVendedor}</span>
      </div>
    </div>

    <!-- Resumen financiero -->
    <div class="ficha-box ficha-box--accent">
      <div class="ficha-titulo">Resumen financiero</div>
      <div class="ficha-row">
        <span class="ficha-key">Saldo total</span>
        <span class="ficha-val ficha-val--big">$ ${m(dash.saldo_total)}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">Deuda vencida</span>
        <span class="ficha-val" style="color:${dash.deuda_vencida > 0 ? '#dc2626' : '#16a34a'};font-weight:700;font-family:'IBM Plex Mono',monospace">$ ${m(dash.deuda_vencida)}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">Deuda no vencida</span>
        <span class="ficha-val ficha-val--ok">$ ${m(dash.deuda_no_vencida)}</span>
      </div>
      <div class="ficha-row">
        <span class="ficha-key">Comprobantes impagos</span>
        <span class="ficha-val">${dash.comprobantes_impagos}</span>
      </div>
      ${cliLimite > 0 ? `
      <div class="ficha-row" style="margin-top:6px">
        <span class="ficha-key">Límite de crédito</span>
        <span class="ficha-val">$ ${m(cliLimite)}</span>
      </div>
      <div class="credito-bar-wrap">
        <div class="credito-bar-fill"></div>
      </div>
      <div class="credito-pct">Crédito disponible: $ ${m(Math.max(0, cliLimite - dash.saldo_total))}</div>
      ` : ''}
      <div class="ficha-row" style="margin-top:8px">
        <span class="ficha-key">Riesgo</span>
        <span class="riesgo-badge">${riesgoLabel}</span>
      </div>
    </div>
  </div>

  <!-- ── KPIs ────────────────────────────────────────────────────────────── -->
  <div class="kpi-strip">
    <div class="kpi-item">
      <div class="kpi-label">Ventas 30 días</div>
      <div class="kpi-val kpi-val--green">$ ${m(dash.kpis?.total_vendido_30d)}</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">Ticket promedio</div>
      <div class="kpi-val">$ ${m(dash.kpis?.ticket_promedio_90d)}</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">Comprobantes 90d</div>
      <div class="kpi-val">${dash.kpis?.cantidad_comprobantes_90d || 0}</div>
    </div>
    <div class="kpi-item">
      <div class="kpi-label">Días sin comprar</div>
      <div class="kpi-val ${(dash.kpis?.dias_desde_ultima_compra || 0) > 60 ? 'kpi-val--red' : ''}">${
        dash.kpis?.dias_desde_ultima_compra != null ? dash.kpis.dias_desde_ultima_compra : '—'
      }</div>
    </div>
  </div>

  <!-- ── Aging de deuda ──────────────────────────────────────────────────── -->
  ${agingData.length > 0 ? `
  <div class="aging-section">
    <div class="section-title">Antigüedad de deuda vencida</div>
    ${agingFilas}
  </div>
  ` : ''}

  <!-- ── Movimientos cuenta corriente ────────────────────────────────────── -->
  ${movs.length > 0 ? `
  <div class="section-title">Movimientos de cuenta corriente</div>
  <table>
    <thead>
      <tr>
        <th class="col-fecha">Fecha</th>
        <th class="col-tipo">Tipo</th>
        <th>Número</th>
        <th style="text-align:right;width:100px">Debe</th>
        <th style="text-align:right;width:100px">Haber</th>
        <th style="text-align:right;width:105px">Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${filasMov}
      <tr class="tr-total">
        <td colspan="3">SALDO FINAL</td>
        <td class="col-debe">${ (() => { const d = movs.reduce((a,m)=>a+(m.debe||0),0); return d>0?'$ '+m(d):'' })() }</td>
        <td class="col-haber">${ (() => { const h = movs.reduce((a,m)=>a+(m.haber||0),0); return h>0?'$ '+m(h):'' })() }</td>
        <td class="col-saldo saldo-deuda">$ ${m(dash.saldo_total)}</td>
      </tr>
    </tbody>
  </table>
  ` : '<p style="color:#94a3b8;font-size:8pt;margin-bottom:16px">Sin movimientos registrados en cuenta corriente.</p>'}

  <!-- ── Comprobantes impagos ─────────────────────────────────────────────── -->
  ${impagos.length > 0 ? `
  <div class="section-title">Comprobantes con saldo pendiente</div>
  <table>
    <thead>
      <tr>
        <th class="col-fecha">Fecha</th>
        <th>Tipo</th>
        <th>Número</th>
        <th style="text-align:right;width:100px">Total</th>
        <th style="text-align:right;width:100px">Pagado</th>
        <th style="text-align:right;width:105px">Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${filasImpagos}
      <tr class="tr-total">
        <td colspan="5">TOTAL PENDIENTE</td>
        <td class="col-saldo saldo-deuda">$ ${m(dash.saldo_total)}</td>
      </tr>
    </tbody>
  </table>
  ` : ''}

  <!-- ── Pie ─────────────────────────────────────────────────────────────── -->
  <div class="footer">
    <div>${empNombre}${empCuit ? ' · CUIT ' + empCuit : ''}</div>
    <div class="footer-center">Estado de cuenta emitido el ${hoy} a las ${horaEmis}hs</div>
    <div>Sistema de Gestión PyME</div>
  </div>

</body>
</html>`

  // ── Abrir e imprimir ──────────────────────────────────────────────────────
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(html)
  win.document.close()
  win.focus()
}
