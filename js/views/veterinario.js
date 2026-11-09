/* ============================================================
   LA JUNGLA · Historial veterinario
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, moneda, diasDesde } from '../lib/formato.js';
import { estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

export async function vistaVeterinario(cont, ctx) {
  const escribir = puedeEscribir(ctx.perfil.rol, 'historial_veterinario');
  const esDueno = ctx.perfil.rol === 'dueno';

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Historial veterinario</h1>
        <p class="page-sub">Consultas, diagnósticos, tratamientos y próximas citas</p>
      </div>
      ${escribir ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nueva atención</button>` : ''}
    </div>

    <div class="kpi-grid" id="kpis"></div>

    <div class="toolbar">
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar por caballo, motivo o veterinario…" aria-label="Buscar" />
      </span>
      <span class="segmented" id="filtro" role="group" aria-label="Filtrar">
        <button type="button" data-f="" aria-pressed="true">Todas</button>
        <button type="button" data-f="citas" aria-pressed="false">Próximas citas</button>
      </span>
    </div>

    <div class="stack" id="lista">${cargando()}</div>`;

  let filas = [], caballos = [], texto = '', filtro = '';

  const recargar = async () => {
    try {
      [filas, caballos] = await Promise.all([
        listar('historial_veterinario', '*, caballos(nombre)',
          { orden: 'fecha', asc: false }),
        listar('caballos', 'id, nombre', { orden: 'nombre', filtros: { estado: 'activo' } }),
      ]);
    } catch (e) {
      document.getElementById('lista').innerHTML =
        `<div class="alert alert--peligro">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
      return;
    }
    pintarKpis();
    pintar();
  };

  function pintarKpis() {
    const esteMes = new Date().toISOString().slice(0, 7);
    const citas = filas.filter((f) => f.proxima_cita && diasDesde(f.proxima_cita) >= 0);
    const mes = filas.filter((f) => String(f.fecha).startsWith(esteMes));
    const gastado = esDueno
      ? filas.filter((f) => String(f.fecha).startsWith(esteMes))
        .reduce((s, f) => s + Number(f.coste || 0), 0)
      : null;

    const kpis = [
      { n: filas.length, label: 'Atenciones registradas', tono: 'tono-verde', ico: 'veterinario' },
      { n: citas.length, label: 'Citas próximas', tono: 'tono-azul', ico: 'calendario' },
      { n: mes.length, label: 'Este mes', tono: 'tono-oro', ico: 'estadisticas' },
      ...(esDueno ? [{ n: moneda(gastado), label: 'Gasto del mes', tono: 'tono-tierra', ico: 'inventario' }] : []),
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
      (!filtro || (f.proxima_cita && diasDesde(f.proxima_cita) >= 0)) &&
      (!q || (f.caballos?.nombre || '').toLowerCase().includes(q) ||
             (f.motivo || '').toLowerCase().includes(q) ||
             (f.veterinario || '').toLowerCase().includes(q) ||
             (f.diagnostico || '').toLowerCase().includes(q)));

    const lista = document.getElementById('lista');
    if (!visibles.length) {
      lista.innerHTML = estadoVacio({
        titulo: filas.length ? 'Sin resultados' : 'Sin registros veterinarios',
        hint: filas.length ? 'Prueba otra búsqueda.' : 'Registra la primera atención veterinaria.',
        icono: 'veterinario',
      });
      return;
    }

    lista.innerHTML = visibles.map((f) => {
      const dCita = f.proxima_cita ? diasDesde(f.proxima_cita) : null;
      return `
      <article class="card">
        <div class="card__head">
          <span class="list__avatar">${icono('veterinario', 18)}</span>
          <div class="grow">
            <h3 class="card__title">${esc(f.motivo)}</h3>
            <p class="small muted">
              <a href="#/caballos/${f.caballo_id}"><strong>${esc(f.caballos?.nombre || '—')}</strong></a>
              · ${esc(fecha(f.fecha))}${f.veterinario ? ' · ' + esc(f.veterinario) : ''}
            </p>
          </div>
          ${escribir ? `
            <button class="icon-btn" data-editar="${f.id}" aria-label="Editar">${icono('editar', 15)}</button>
            <button class="icon-btn" data-borrar="${f.id}" aria-label="Eliminar">${icono('borrar', 15)}</button>` : ''}
        </div>
        <div class="card__body small">
          ${f.diagnostico ? `<p class="mb-8"><strong>Diagnóstico:</strong> ${esc(f.diagnostico)}</p>` : ''}
          ${f.tratamiento ? `<p class="mb-8"><strong>Tratamiento:</strong> ${esc(f.tratamiento)}</p>` : ''}
          ${f.medicamentos ? `<p class="mb-8"><strong>Medicamentos:</strong> ${esc(f.medicamentos)}</p>` : ''}
          <div class="row">
            ${dCita !== null ? `<span class="chip ${dCita <= 7 ? 'chip--ambar' : 'chip--azul'}">
              ${icono('calendario', 13)} Cita: ${esc(fecha(f.proxima_cita))}${dCita === 0 ? ' (hoy)' : ''}</span>` : ''}
            ${f.peso_kg ? `<span class="chip chip--gris">${esc(f.peso_kg)} kg</span>` : ''}
            ${esDueno && f.coste != null ? `<span class="chip chip--oro">Coste: ${esc(moneda(f.coste))}</span>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');

    lista.querySelectorAll('[data-editar]').forEach((b) =>
      b.addEventListener('click', () => formFila(filas.find((x) => x.id === b.dataset.editar))));
    lista.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', () => borrarFila(filas.find((x) => x.id === b.dataset.borrar))));
  };

  function formFila(fila) {
    if (!escribir) return;
    formularioModal({
      titulo: fila ? 'Editar atención' : 'Nueva atención veterinaria',
      campos: [
        {
          nombre: 'caballo_id', etiqueta: 'Caballo', tipo: 'select', obligatorio: true, vacio: 'Selecciona…',
          opciones: caballos.map((c) => ({ valor: c.id, etiqueta: c.nombre })), valor: fila?.caballo_id,
        },
        { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true, valor: fila?.fecha || new Date().toISOString().slice(0, 10) },
        { nombre: 'veterinario', etiqueta: 'Veterinario', valor: fila?.veterinario, placeholder: 'Nombre del profesional' },
        { nombre: 'motivo', etiqueta: 'Motivo', obligatorio: true, ancho: 'full', valor: fila?.motivo,
          placeholder: 'Ej. Revisión anual, cojera, vacunación…' },
        { nombre: 'diagnostico', etiqueta: 'Diagnóstico', tipo: 'textarea', ancho: 'full', valor: fila?.diagnostico },
        { nombre: 'tratamiento', etiqueta: 'Tratamiento', tipo: 'textarea', ancho: 'full', valor: fila?.tratamiento },
        { nombre: 'medicamentos', etiqueta: 'Medicamentos administrados', ancho: 'full', valor: fila?.medicamentos,
          placeholder: 'Ej. Penicilina 5 ml, día 1 y 3' },
        { nombre: 'peso_kg', etiqueta: 'Peso registrado (kg)', tipo: 'number', min: 1, max: 1200, paso: '0.1', valor: fila?.peso_kg },
        { nombre: 'proxima_cita', etiqueta: 'Próxima cita', tipo: 'date', valor: fila?.proxima_cita },
        ...(esDueno ? [{ nombre: 'coste', etiqueta: 'Coste ($)', tipo: 'number', min: 0, paso: '0.01', valor: fila?.coste }] : []),
      ],
      onGuardar: async (v) => {
        if (fila) await actualizar('historial_veterinario', fila.id, v);
        else await insertar('historial_veterinario', v);
        toast(fila ? 'Registro actualizado' : 'Atención registrada');
        await recargar();
      },
    });
  }

  async function borrarFila(fila) {
    const ok = await confirmar({
      titulo: 'Eliminar registro',
      mensaje: `Se eliminará la atención del <strong>${esc(fecha(fila.fecha))}</strong> a ${esc(fila.caballos?.nombre || 'este caballo')}. ¿Continuar?`,
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try { await eliminar('historial_veterinario', fila.id); toast('Registro eliminado'); await recargar(); }
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
