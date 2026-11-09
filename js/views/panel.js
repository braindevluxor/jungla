/* ============================================================
   LA JUNGLA · Panel principal (KPIs + tareas del día)
   ============================================================ */

import { listar, contar } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, hora, hoy, diasDesde, moneda, num, etiqueta, iniciales } from '../lib/formato.js';
import { tablaHTML, estadoVacio } from '../lib/ui.js';

export async function vistaPanel(cont, ctx) {
  const esDueno = ctx.perfil.rol === 'dueno';
  const esVet = ctx.perfil.rol === 'veterinario';

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Hola, ${esc(ctx.perfil.nombre.split(' ')[0])}</h1>
        <p class="page-sub">Resumen de La Jungla · ${esc(fecha(hoy(), { largo: true }))}</p>
      </div>
    </div>
    <div class="kpi-grid" id="kpis">${kpiEsqueleto()}</div>
    <div class="grid-2">
      <section class="card">
        <div class="card__head">${icono('alimentacion', 18)}<h2 class="card__title">Comidas de hoy</h2></div>
        <div id="comidas">${cargando(3)}</div>
      </section>
      <section class="card">
        <div class="card__head">${icono('veterinario', 18)}<h2 class="card__title">${esVet ? 'Próximas citas' : 'Atenciones recientes'}</h2></div>
        <div id="vet">${cargando(3)}</div>
      </section>
      <section class="card">
        <div class="card__head">${icono('inventario', 18)}<h2 class="card__title">Stock bajo</h2></div>
        <div id="stock">${cargando(3)}</div>
      </section>
      <section class="card">
        <div class="card__head">${icono('herrajes', 18)}<h2 class="card__title">Próximos herrajes</h2></div>
        <div id="herrajes">${cargando(3)}</div>
      </section>
    </div>`;

  const [nCaballos, nComidas, nStockBajo, nCitas, caballos, comidas, vets, alims, meds, herrajes] =
    await Promise.all([
      contar('caballos', { estado: 'activo' }),
      contar('horarios_alimentacion', { activo: true }),
      stockBajoTotal(),
      citasProximas(),
      listar('caballos', 'id, nombre, raza, sexo, estado', { orden: 'nombre' }),
      listar('horarios_alimentacion',
        'hora, porcion_kg, activo, caballos(nombre), tipos_alimento(nombre)',
        { orden: 'hora' }),
      listar('historial_veterinario',
        'fecha, motivo, proxima_cita, coste, caballos(nombre), veterinario',
        { orden: 'fecha', asc: false, limite: 6 }),
      listar('inventario_alimentos', 'nombre, cantidad, unidad, stock_minimo'),
      listar('inventario_medicinas', 'nombre, cantidad, unidad, stock_minimo'),
      listar('herrajes', 'fecha, proxima_fecha, tipo, caballos(nombre), herrador',
        { orden: 'proxima_fecha', asc: true }),
    ]);

  const kpis = [
    { n: nCaballos, label: 'Caballos activos', tono: 'tono-verde', ico: 'caballos', nav: 'caballos' },
    { n: nComidas, label: 'Horarios de comida', tono: 'tono-oro', ico: 'alimentacion', nav: esVet ? null : 'alimentacion' },
    { n: nStockBajo, label: 'Insumos con stock bajo', tono: nStockBajo ? 'tono-rojo' : 'tono-verde', ico: 'inventario', nav: 'inventario' },
    { n: nCitas, label: 'Citas veterinarias próximas', tono: 'tono-azul', ico: 'veterinario', nav: esVet || esDueno ? 'veterinario' : null },
  ];

  document.getElementById('kpis').innerHTML = kpis.map((k) => `
    <button type="button" class="kpi" ${k.nav ? `data-ir="${k.nav}"` : 'disabled style="cursor:default"'}>
      <span class="kpi__band ${k.tono}"></span>
      <span class="kpi__ico ${k.tono}">${icono(k.ico, 19)}</span>
      <span class="kpi__num">${k.n}</span>
      <span class="kpi__label">${esc(k.label)}</span>
    </button>`).join('');

  document.querySelectorAll('[data-ir]').forEach((b) =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.ir; }));

  /* Comidas de hoy (horarios activos) */
  const activas = comidas.filter((c) => c.activo);
  document.getElementById('comidas').innerHTML = activas.length
    ? tablaHTML({
      columnas: [
        { clave: 'hora', etiqueta: 'Hora', html: (f) => `<strong>${esc(hora(f.hora))}</strong>` },
        { clave: 'caballo', etiqueta: 'Caballo', html: (f) => esc(f.caballos?.nombre || '—') },
        { clave: 'alimento', etiqueta: 'Alimento', html: (f) => esc(f.tipos_alimento?.nombre || '—') },
        { clave: 'porcion', etiqueta: 'Porción', num: true, html: (f) => `${num(f.porcion_kg)} kg` },
      ],
      filas: activas,
      vacio: { titulo: 'Sin horarios', hint: 'Añade horarios de comida desde Alimentación.', icono: 'alimentacion' },
    })
    : estadoVacio({ titulo: 'Sin horarios de comida', hint: 'Regístralos en la sección Alimentación.', icono: 'alimentacion' });

  /* Veterinario: próximas citas si hay, si no últimas atenciones */
  const proximas = vets.filter((v) => v.proxima_cita && diasDesde(v.proxima_cita) >= 0);
  const filasVet = (esVet ? proximas : vets).slice(0, 6);
  document.getElementById('vet').innerHTML = filasVet.length
    ? tablaHTML({
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', html: (f) => esc(fecha(esVet ? f.proxima_cita : f.fecha)) },
        { clave: 'caballo', etiqueta: 'Caballo', html: (f) => esc(f.caballos?.nombre || '—') },
        { clave: 'motivo', etiqueta: 'Motivo', html: (f) => esc(f.motivo) },
        ...(esDueno ? [{ clave: 'coste', etiqueta: 'Coste', num: true, html: (f) => esc(moneda(f.coste)) }] : []),
      ],
      filas: filasVet,
      vacio: { titulo: 'Sin registros', icono: 'veterinario' },
    })
    : estadoVacio({ titulo: esVet ? 'Sin citas próximas' : 'Sin registros veterinarios', icono: 'veterinario' });

  /* Stock bajo (alimentos + medicinas) */
  const bajos = [
    ...alims.filter((a) => Number(a.cantidad) <= Number(a.stock_minimo))
      .map((a) => ({ ...a, tipo: 'Alimento' })),
    ...meds.filter((m) => Number(m.cantidad) <= Number(m.stock_minimo))
      .map((m) => ({ ...m, tipo: 'Medicina' })),
  ].sort((a, b) => (a.cantidad / (a.stock_minimo || 1)) - (b.cantidad / (b.stock_minimo || 1)));

  document.getElementById('stock').innerHTML = bajos.length
    ? `<div class="list">${bajos.slice(0, 7).map((s) => `
        <div class="list__item">
          <span class="list__avatar ${Number(s.cantidad) === 0 ? 'tono-rojo' : 'tono-ambar'}">${icono(s.tipo === 'Alimento' ? 'inventario' : 'medicinas', 18)}</span>
          <span class="list__main">
            <span class="list__title">${esc(s.nombre)}</span>
            <span class="list__meta">${esc(s.tipo)} · mínimo ${num(s.stock_minimo)} ${esc(s.unidad)}</span>
          </span>
          <span class="list__side">
            <span class="chip ${Number(s.cantidad) === 0 ? 'chip--rojo' : 'chip--ambar'}">${num(s.cantidad)} ${esc(s.unidad)}</span>
          </span>
        </div>`).join('')}</div>`
    : estadoVacio({ titulo: 'Todo con stock suficiente', hint: 'Ningún insumo está por debajo del mínimo.', icono: 'check' });

  /* Próximos herrajes */
  const proxHerr = herrajes.filter((h) => h.proxima_fecha && diasDesde(h.proxima_fecha) >= 0).slice(0, 6);
  document.getElementById('herrajes').innerHTML = proxHerr.length
    ? tablaHTML({
      columnas: [
        { clave: 'fecha', etiqueta: 'Caballo', html: (f) => esc(f.caballos?.nombre || '—') },
        { clave: 'proxima_fecha', etiqueta: 'Próxima', html: (f) => {
          const d = diasDesde(f.proxima_fecha);
          const clase = d <= 7 ? 'chip--ambar' : 'chip--gris';
          return `<span class="chip ${clase}">${esc(fecha(f.proxima_fecha))}</span>`;
        } },
        { clave: 'tipo', etiqueta: 'Tipo', html: (f) => esc(f.tipo) },
      ],
      filas: proxHerr,
      vacio: { titulo: 'Sin herrajes programados', icono: 'herrajes' },
    })
    : estadoVacio({ titulo: 'Sin herrajes programados', hint: 'Registra cambios de herraje con su próxima fecha.', icono: 'herrajes' });
}

function kpiEsqueleto() {
  return Array.from({ length: 4 }, () =>
    '<div class="kpi" style="cursor:default"><div class="skeleton" style="height:36px;width:36px;border-radius:8px"></div>' +
    '<div class="skeleton" style="height:26px;width:60px;margin-top:10px"></div>' +
    '<div class="skeleton" style="height:12px;width:90%;margin-top:8px"></div></div>').join('');
}

function cargando(n) {
  return `<div class="stack">${Array.from({ length: n }, () =>
    '<div class="skeleton" style="height:44px"></div>').join('')}</div>`;
}

async function stockBajoTotal() {
  const [a, m] = await Promise.all([
    listar('inventario_alimentos', 'cantidad, stock_minimo'),
    listar('inventario_medicinas', 'cantidad, stock_minimo'),
  ]);
  return [
    ...a.filter((x) => Number(x.cantidad) <= Number(x.stock_minimo)),
    ...m.filter((x) => Number(x.cantidad) <= Number(x.stock_minimo)),
  ].length;
}

async function citasProximas() {
  const vets = await listar('historial_veterinario', 'proxima_cita', {});
  return vets.filter((v) => v.proxima_cita && diasDesde(v.proxima_cita) >= 0).length;
}
