/* ============================================================
   LA JUNGLA · Cambios de herraje
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, moneda, diasDesde } from '../lib/formato.js';
import { tablaHTML, estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

const TIPOS = [
  'Herraje completo', 'Cambio de cascos', 'Reparación', 'Revisión',
  'Colocación de herraje de deporte', 'Retirada de herraje',
];

export async function vistaHerrajes(cont, ctx) {
  const escribir = puedeEscribir(ctx.perfil.rol, 'herrajes');
  const esDueno = ctx.perfil.rol === 'dueno';

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Herrajes</h1>
        <p class="page-sub">Historial de cambios de herraje y próximas revisiones</p>
      </div>
      ${escribir ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nuevo registro</button>` : ''}
    </div>
    <div class="toolbar">
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar por caballo o herrador…" aria-label="Buscar" />
      </span>
      <span class="segmented" id="filtro" role="group" aria-label="Filtrar">
        <button type="button" data-f="" aria-pressed="true">Todos</button>
        <button type="button" data-f="proximos" aria-pressed="false">Próximos</button>
      </span>
    </div>
    <section class="card" id="zona">${cargando()}</section>`;

  let filas = [], caballos = [], texto = '', filtro = '';

  const recargar = async () => {
    try {
      [filas, caballos] = await Promise.all([
        listar('herrajes', '*, caballos(nombre)', { orden: 'fecha', asc: false }),
        listar('caballos', 'id, nombre', { orden: 'nombre', filtros: { estado: 'activo' } }),
      ]);
    } catch (e) {
      document.getElementById('zona').innerHTML =
        `<div class="alert alert--peligro" style="margin:14px">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
      return;
    }
    pintar();
  };

  const pintar = () => {
    const q = texto.toLowerCase();
    const visibles = filas.filter((f) =>
      (!filtro || (f.proxima_fecha && diasDesde(f.proxima_fecha) >= 0)) &&
      (!q || (f.caballos?.nombre || '').toLowerCase().includes(q) ||
             (f.herrador || '').toLowerCase().includes(q) ||
             (f.tipo || '').toLowerCase().includes(q)));

    const zona = document.getElementById('zona');
    if (!visibles.length) {
      zona.innerHTML = estadoVacio({
        titulo: filas.length ? 'Sin resultados' : 'Sin registros de herraje',
        hint: filas.length ? 'Prueba otra búsqueda.' : 'Registra cada cambio de herraje con su fecha y próxima revisión.',
        icono: 'herrajes',
      });
      return;
    }

    const columnas = [
      { clave: 'fecha', etiqueta: 'Fecha', html: (f) => esc(fecha(f.fecha)) },
      {
        clave: 'caballo', etiqueta: 'Caballo', html: (f) =>
          `<a href="#/caballos/${f.caballo_id}"><strong>${esc(f.caballos?.nombre || '—')}</strong></a>`,
      },
      { clave: 'tipo', etiqueta: 'Tipo', html: (f) => `<span class="chip chip--tierra">${esc(f.tipo)}</span>` },
      { clave: 'herrador', etiqueta: 'Herrador', html: (f) => esc(f.herrador || '—') },
      {
        clave: 'proxima', etiqueta: 'Próxima revisión', html: (f) => {
          if (!f.proxima_fecha) return '<span class="small muted">—</span>';
          const d = diasDesde(f.proxima_fecha);
          const clase = d < 0 ? 'chip--rojo' : d <= 14 ? 'chip--ambar' : 'chip--gris';
          const txt = d < 0 ? `vencida ${fecha(f.proxima_fecha)}` : fecha(f.proxima_fecha);
          return `<span class="chip ${clase}">${esc(txt)}</span>`;
        },
      },
      ...(esDueno ? [{ clave: 'coste', etiqueta: 'Coste', num: true, html: (f) => esc(moneda(f.coste)) }] : []),
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
      titulo: fila ? 'Editar registro de herraje' : 'Nuevo cambio de herraje',
      campos: [
        {
          nombre: 'caballo_id', etiqueta: 'Caballo', tipo: 'select', obligatorio: true, vacio: 'Selecciona…',
          opciones: caballos.map((c) => ({ valor: c.id, etiqueta: c.nombre })), valor: fila?.caballo_id,
        },
        { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true, valor: fila?.fecha || fechaHoyISO() },
        {
          nombre: 'tipo', etiqueta: 'Tipo de intervención', tipo: 'select', obligatorio: true,
          opciones: TIPOS, valor: fila?.tipo || TIPOS[0],
        },
        { nombre: 'herrador', etiqueta: 'Herrador', valor: fila?.herrador, placeholder: 'Nombre del herrador' },
        { nombre: 'proxima_fecha', etiqueta: 'Próxima revisión', tipo: 'date', valor: fila?.proxima_fecha,
          pista: 'Recomendado: 6–8 semanas después' },
        ...(esDueno ? [{ nombre: 'coste', etiqueta: 'Coste ($)', tipo: 'number', min: 0, paso: '0.01', valor: fila?.coste }] : []),
        { nombre: 'detalle', etiqueta: 'Detalle del trabajo', tipo: 'textarea', ancho: 'full', valor: fila?.detalle,
          placeholder: 'Ej. Frontales delanteros, casco derecho con desgaste…' },
        { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 'full', valor: fila?.notas },
      ],
      onGuardar: async (v) => {
        if (fila) await actualizar('herrajes', fila.id, v);
        else await insertar('herrajes', v);
        toast(fila ? 'Registro actualizado' : 'Herraje registrado');
        await recargar();
      },
    });
  }

  async function borrarFila(fila) {
    const ok = await confirmar({
      titulo: 'Eliminar registro',
      mensaje: `Se eliminará el herraje del <strong>${esc(fecha(fila.fecha))}</strong>. ¿Continuar?`,
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try { await eliminar('herrajes', fila.id); toast('Registro eliminado'); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  document.getElementById('nuevo')?.addEventListener('click', () => formFila(null));
  document.getElementById('q').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
  document.querySelectorAll('#filtro button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#filtro button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    filtro = b.dataset.f;
    pintar();
  }));

  await recargar();
}

function fechaHoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
