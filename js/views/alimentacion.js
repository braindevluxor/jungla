/* ============================================================
   LA JUNGLA · Alimentación: horarios por caballo + tipos de alimento
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, hora, num } from '../lib/formato.js';
import { tablaHTML, estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

export async function vistaAlimentacion(cont, ctx) {
  const escribir = puedeEscribir(ctx.perfil.rol, 'horarios_alimentacion');
  const escribirTipos = puedeEscribir(ctx.perfil.rol, 'tipos_alimento');

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Alimentación</h1>
        <p class="page-sub">Horas de comida, porciones y tipos de alimento</p>
      </div>
      ${escribir ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nuevo horario</button>` : ''}
    </div>

    <div class="toolbar">
      <span class="segmented" id="vista-seg" role="group" aria-label="Cambiar vista">
        <button type="button" data-vista="horarios" aria-pressed="true">Horarios</button>
        <button type="button" data-vista="tipos" aria-pressed="false">Tipos de alimento</button>
      </span>
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar caballo o alimento…" aria-label="Buscar" />
      </span>
    </div>

    <section class="card" id="zona">${cargando()}</section>`;

  let vista = 'horarios';
  let texto = '';
  let horarios = [];
  let tipos = [];
  let caballos = [];

  const recargar = async () => {
    try {
      [horarios, tipos, caballos] = await Promise.all([
        listar('horarios_alimentacion',
          'id, hora, porcion_kg, notas, activo, caballo_id, tipo_alimento_id, caballos(nombre), tipos_alimento(nombre)',
          { orden: 'hora' }),
        listar('tipos_alimento', '*', { orden: 'nombre' }),
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
    const zona = document.getElementById('zona');

    if (vista === 'horarios') {
      const filas = horarios.filter((h) =>
        !q || (h.caballos?.nombre || '').toLowerCase().includes(q) ||
               (h.tipos_alimento?.nombre || '').toLowerCase().includes(q));

      if (!filas.length) {
        zona.innerHTML = estadoVacio({
          titulo: horarios.length ? 'Sin resultados' : 'Sin horarios de comida',
          hint: horarios.length ? 'Prueba otra búsqueda.' : 'Registra a qué hora come cada caballo y cuánto.',
          icono: 'alimentacion',
          accion: escribir ? '<button class="btn btn--oro" data-nuevo-horario>Nuevo horario</button>' : '',
        });
        zona.querySelector('[data-nuevo-horario]')?.addEventListener('click', formHorario);
        return;
      }

      // Resumen por caballo
      const porCaballo = new Map();
      for (const h of filas) {
        const nombre = h.caballos?.nombre || '—';
        if (!porCaballo.has(nombre)) porCaballo.set(nombre, []);
        porCaballo.get(nombre).push(h);
      }

      zona.innerHTML = `<div class="stack" style="padding:14px">${[...porCaballo.entries()].map(([nombre, hs]) => `
        <div class="card" style="box-shadow:none">
          <div class="card__head">
            ${icono('caballos', 17)}
            <h3 class="card__title">${esc(nombre)}</h3>
            <span class="chip chip--oro">${hs.filter((h) => h.activo).length} comidas/día</span>
            <span class="chip chip--gris">${num(hs.reduce((s, h) => s + Number(h.porcion_kg), 0))} kg/día</span>
            ${escribir ? `<button class="btn btn--sm btn--fantasma" data-add="${esc(nombre)}">${icono('mas', 14)} Añadir</button>` : ''}
          </div>
          ${tablaHTML({
        columnas: [
          { clave: 'hora', etiqueta: 'Hora', html: (f) => `<strong>${esc(hora(f.hora))}</strong>` },
          { clave: 'alimento', etiqueta: 'Alimento', html: (f) => esc(f.tipos_alimento?.nombre || 'Sin asignar') },
          { clave: 'porcion', etiqueta: 'Porción', num: true, html: (f) => `${num(f.porcion_kg)} kg` },
          { clave: 'activo', etiqueta: 'Estado', html: (f) => f.activo
            ? '<span class="chip">Activo</span>' : '<span class="chip chip--gris">Pausado</span>' },
          ...(escribir ? [{
            clave: 'acc', etiqueta: '', html: (f) => `
              <span class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">
                <button class="icon-btn" data-editar="${f.id}" aria-label="Editar">${icono('editar', 15)}</button>
                <button class="icon-btn" data-borrar="${f.id}" aria-label="Eliminar">${icono('borrar', 15)}</button>
              </span>`,
          }] : []),
        ],
        filas: hs,
      })}
        </div>`).join('')}</div>`;

      zona.querySelectorAll('[data-add]').forEach((b) =>
        b.addEventListener('click', () => formHorario(null, caballos.find((c) => c.nombre === b.dataset.add))));
      zona.querySelectorAll('[data-editar]').forEach((b) =>
        b.addEventListener('click', () => formHorario(horarios.find((h) => h.id === b.dataset.editar))));
      zona.querySelectorAll('[data-borrar]').forEach((b) =>
        b.addEventListener('click', () => borrarHorario(b.dataset.borrar)));

    } else {
      const filas = tipos.filter((t) =>
        !q || (t.nombre || '').toLowerCase().includes(q) || (t.descripcion || '').toLowerCase().includes(q));

      if (!filas.length) {
        zona.innerHTML = estadoVacio({
          titulo: tipos.length ? 'Sin resultados' : 'Sin tipos de alimento',
          hint: 'Define los tipos que usas: concentrado, heno, avena…',
          icono: 'inventario',
          accion: escribirTipos ? '<button class="btn btn--oro" data-nuevo-tipo>Nuevo tipo</button>' : '',
        });
        zona.querySelector('[data-nuevo-tipo]')?.addEventListener('click', formTipo);
        return;
      }

      const usos = new Map();
      for (const h of horarios) {
        if (h.tipo_alimento_id) usos.set(h.tipo_alimento_id, (usos.get(h.tipo_alimento_id) || 0) + 1);
      }

      zona.innerHTML = tablaHTML({
        columnas: [
          { clave: 'nombre', etiqueta: 'Tipo', html: (f) => `<strong>${esc(f.nombre)}</strong>` },
          { clave: 'descripcion', etiqueta: 'Descripción', html: (f) => esc(f.descripcion || '—') },
          { clave: 'usos', etiqueta: 'Horarios activos', num: true, html: (f) => String(usos.get(f.id) || 0) },
          ...(escribirTipos ? [{
            clave: 'acc', etiqueta: '', html: (f) => `
              <span class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">
                <button class="icon-btn" data-editar-tipo="${f.id}" aria-label="Editar">${icono('editar', 15)}</button>
                <button class="icon-btn" data-borrar-tipo="${f.id}" aria-label="Eliminar">${icono('borrar', 15)}</button>
              </span>`,
          }] : []),
        ],
        filas,
      });

      zona.querySelectorAll('[data-editar-tipo]').forEach((b) =>
        b.addEventListener('click', () => formTipo(tipos.find((t) => t.id === b.dataset.editarTipo))));
      zona.querySelectorAll('[data-borrar-tipo]').forEach((b) =>
        b.addEventListener('click', () => borrarTipo(b.dataset.borrarTipo)));
    }
  };

  function formHorario(fila, caballoPrefijo) {
    if (!escribir) return;
    formularioModal({
      titulo: fila ? 'Editar horario' : 'Nuevo horario de comida',
      campos: [
        {
          nombre: 'caballo_id', etiqueta: 'Caballo', tipo: 'select', obligatorio: true,
          vacio: 'Selecciona…',
          opciones: caballos.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
          valor: fila?.caballo_id || caballoPrefijo?.id,
        },
        { nombre: 'hora', etiqueta: 'Hora', tipo: 'time', obligatorio: true, valor: fila?.hora },
        {
          nombre: 'tipo_alimento_id', etiqueta: 'Tipo de alimento', tipo: 'select', vacio: 'Sin asignar',
          opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })),
          valor: fila?.tipo_alimento_id,
        },
        {
          nombre: 'porcion_kg', etiqueta: 'Porción (kg)', tipo: 'number',
          obligatorio: true, min: 0.05, max: 50, paso: '0.05', valor: fila?.porcion_kg,
          pista: 'Cantidad por toma',
        },
        {
          nombre: 'activo', etiqueta: 'Estado', tipo: 'select', valor: String(fila?.activo ?? true),
          opciones: [{ valor: 'true', etiqueta: 'Activo' }, { valor: 'false', etiqueta: 'Pausado' }],
        },
        { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 'full', valor: fila?.notas, placeholder: 'Ej. Mezclar con suplemento' },
      ],
      valores: {},
      onGuardar: async (v) => {
        const payload = { ...v, activo: v.activo === 'true' };
        if (fila) await actualizar('horarios_alimentacion', fila.id, payload);
        else await insertar('horarios_alimentacion', payload);
        toast(fila ? 'Horario actualizado' : 'Horario creado');
        await recargar();
      },
    });
  }

  async function borrarHorario(id) {
    const ok = await confirmar({
      titulo: 'Eliminar horario',
      mensaje: 'Se eliminará este horario de comida. ¿Continuar?',
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try { await eliminar('horarios_alimentacion', id); toast('Horario eliminado'); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  function formTipo(fila) {
    if (!escribirTipos) return;
    formularioModal({
      titulo: fila ? `Editar ${fila.nombre}` : 'Nuevo tipo de alimento',
      campos: [
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, valor: fila?.nombre, placeholder: 'Ej. Concentrado' },
        { nombre: 'descripcion', etiqueta: 'Descripción', ancho: 'full', valor: fila?.descripcion, placeholder: 'Detalle opcional…' },
      ],
      onGuardar: async (v) => {
        if (fila) await actualizar('tipos_alimento', fila.id, v);
        else await insertar('tipos_alimento', v);
        toast(fila ? 'Tipo actualizado' : 'Tipo creado');
        await recargar();
      },
    });
  }

  async function borrarTipo(id) {
    const usados = horarios.filter((h) => h.tipo_alimento_id === id).length;
    const ok = await confirmar({
      titulo: 'Eliminar tipo de alimento',
      mensaje: usados
        ? `Lo usan <strong>${usados}</strong> horario(s). Esos horarios quedarán sin tipo asignado. ¿Continuar?`
        : 'Se eliminará este tipo de alimento. ¿Continuar?',
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try { await eliminar('tipos_alimento', id); toast('Tipo eliminado'); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  document.getElementById('nuevo')?.addEventListener('click', formHorario);
  document.getElementById('q').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
  document.querySelectorAll('#vista-seg button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#vista-seg button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    vista = b.dataset.vista;
    pintar();
  }));

  await recargar();
}
