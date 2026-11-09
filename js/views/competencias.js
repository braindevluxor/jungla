/* ============================================================
   LA JUNGLA · Histórico de competencias
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, moneda } from '../lib/formato.js';
import { tablaHTML, estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

export async function vistaCompetencias(cont, ctx) {
  const escribir = puedeEscribir(ctx.perfil.rol, 'competencias');

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Competencias</h1>
        <p class="page-sub">Histórico de participaciones, categorías y resultados</p>
      </div>
      ${escribir ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nueva competencia</button>` : ''}
    </div>

    <div class="kpi-grid" id="kpis"></div>

    <div class="toolbar">
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar por competencia, caballo o lugar…" aria-label="Buscar" />
      </span>
      <label class="row small" style="gap:6px;cursor:pointer">
        <input type="checkbox" id="solo-podios" /> Solo con premio/puesto
      </label>
    </div>

    <section class="card" id="zona">${cargando()}</section>`;

  let filas = [], caballos = [], texto = '', soloPodios = false;

  const recargar = async () => {
    try {
      [filas, caballos] = await Promise.all([
        listar('competencias', '*, caballos(nombre)', { orden: 'fecha', asc: false }),
        listar('caballos', 'id, nombre', { orden: 'nombre', filtros: { estado: 'activo' } }),
      ]);
    } catch (e) {
      document.getElementById('zona').innerHTML =
        `<div class="alert alert--peligro" style="margin:14px">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
      return;
    }
    pintarKpis();
    pintar();
  };

  const esPodio = (f) => !!f.puesto && /1|2|3|primer|segundo|tercer|oro|plata|bronce/i.test(f.puesto) || !!f.premio;

  function pintarKpis() {
    const podios = filas.filter((f) => /1|2|3|primer|segundo|tercer|oro|plata|bronce/i.test(f.puesto || '')).length;
    const premios = filas.reduce((s, f) => s + Number(f.premio || 0), 0);
    const caballosDistintos = new Set(filas.map((f) => f.caballo_id)).size;

    const kpis = [
      { n: filas.length, label: 'Participaciones', tono: 'tono-verde', ico: 'competencias' },
      { n: podios, label: 'Podios', tono: 'tono-oro', ico: 'estadisticas' },
      { n: caballosDistintos, label: 'Caballos en competición', tono: 'tono-azul', ico: 'caballos' },
      { n: moneda(premios), label: 'Premios acumulados', tono: 'tono-tierra', ico: 'inventario' },
    ];
    document.getElementById('kpis').innerHTML = kpis.map((k) => `
      <div class="kpi" style="cursor:default">
        <span class="kpi__band ${k.tono}"></span>
        <span class="kpi__ico ${k.tono}">${icono(k.ico, 19)}</span>
        <span class="kpi__num">${k.n}</span>
        <span class="kpi__label">${esc(k.label)}</span>
      </div>`).join('');
  }

  const pintar = () => {
    const q = texto.toLowerCase();
    const visibles = filas.filter((f) =>
      (!soloPodios || esPodio(f)) &&
      (!q || (f.nombre || '').toLowerCase().includes(q) ||
             (f.caballos?.nombre || '').toLowerCase().includes(q) ||
             (f.lugar || '').toLowerCase().includes(q) ||
             (f.categoria || '').toLowerCase().includes(q)));

    const zona = document.getElementById('zona');
    if (!visibles.length) {
      zona.innerHTML = estadoVacio({
        titulo: filas.length ? 'Sin resultados' : 'Sin competencias registradas',
        hint: filas.length ? 'Prueba otra búsqueda.' : 'Registra la primera participación de La Jungla.',
        icono: 'competencias',
      });
      return;
    }

    const columnas = [
      { clave: 'fecha', etiqueta: 'Fecha', html: (f) => esc(fecha(f.fecha)) },
      { clave: 'nombre', etiqueta: 'Competencia', html: (f) => `<strong>${esc(f.nombre)}</strong>` },
      {
        clave: 'caballo', etiqueta: 'Caballo', html: (f) =>
          `<a href="#/caballos/${f.caballo_id}">${esc(f.caballos?.nombre || '—')}</a>`,
      },
      { clave: 'categoria', etiqueta: 'Categoría', html: (f) => esc(f.categoria || '—') },
      { clave: 'lugar', etiqueta: 'Lugar', html: (f) => esc(f.lugar || '—') },
      {
        clave: 'puesto', etiqueta: 'Resultado', html: (f) => {
          if (!f.puesto) return '<span class="small muted">—</span>';
          const clase = /1|primer|oro/i.test(f.puesto) ? 'chip--oro'
            : /2|segundo|plata/i.test(f.puesto) ? 'chip--gris'
              : /3|tercer|bronce/i.test(f.puesto) ? 'chip--tierra' : 'chip--azul';
          return `<span class="chip ${clase}">${esc(f.puesto)}</span>`;
        },
      },
      { clave: 'premio', etiqueta: 'Premio', num: true, html: (f) => esc(moneda(f.premio)) },
      ...(escribir ? [{
        clave: 'acc', etiqueta: '', html: (f) => `
          <span class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">
            <button class="icon-btn" data-editar="${f.id}" aria-label="Editar">${icono('editar', 15)}</button>
            <button class="icon-btn" data-borrar="${f.id}" aria-label="Eliminar">${icono('borrar', 15)}</button>
          </span>`,
      }] : []),
    ];

    zona.innerHTML = tablaHTML({ columnas, filas: visibles });
    zona.querySelectorAll('[data-editar]').forEach((b) =>
      b.addEventListener('click', () => formFila(filas.find((x) => x.id === b.dataset.editar))));
    zona.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', () => borrarFila(filas.find((x) => x.id === b.dataset.borrar))));
  };

  function formFila(fila) {
    if (!escribir) return;
    formularioModal({
      titulo: fila ? 'Editar competencia' : 'Nueva competencia',
      campos: [
        { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true, valor: fila?.fecha || new Date().toISOString().slice(0, 10) },
        { nombre: 'nombre', etiqueta: 'Nombre de la competencia', obligatorio: true, valor: fila?.nombre,
          placeholder: 'Ej. Concurso Hípico de Primavera' },
        {
          nombre: 'caballo_id', etiqueta: 'Caballo', tipo: 'select', obligatorio: true, vacio: 'Selecciona…',
          opciones: caballos.map((c) => ({ valor: c.id, etiqueta: c.nombre })), valor: fila?.caballo_id,
        },
        { nombre: 'categoria', etiqueta: 'Categoría', valor: fila?.categoria, placeholder: 'Ej. Salto 1,10 m' },
        { nombre: 'lugar', etiqueta: 'Lugar', valor: fila?.lugar, placeholder: 'Ej. Madrid' },
        { nombre: 'puesto', etiqueta: 'Resultado / puesto', valor: fila?.puesto, placeholder: 'Ej. 1º, 4º, Finalista' },
        { nombre: 'premio', etiqueta: 'Premio ($)', tipo: 'number', min: 0, paso: '0.01', valor: fila?.premio },
        { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'textarea', ancho: 'full', valor: fila?.observaciones },
      ],
      onGuardar: async (v) => {
        if (fila) await actualizar('competencias', fila.id, v);
        else await insertar('competencias', v);
        toast(fila ? 'Competencia actualizada' : 'Competencia registrada');
        await recargar();
      },
    });
  }

  async function borrarFila(fila) {
    const ok = await confirmar({
      titulo: 'Eliminar competencia',
      mensaje: `Se eliminará <strong>${esc(fila.nombre)}</strong> del histórico. ¿Continuar?`,
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try { await eliminar('competencias', fila.id); toast('Competencia eliminada'); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  document.getElementById('nuevo')?.addEventListener('click', () => formFila(null));
  document.getElementById('q').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
  document.getElementById('solo-podios').addEventListener('change', (e) => { soloPodios = e.target.checked; pintar(); });

  await recargar();
}
