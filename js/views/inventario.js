/* ============================================================
   LA JUNGLA · Inventario: alimentos y medicinas
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, num, fecha, vencimiento } from '../lib/formato.js';
import { tablaHTML, estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

export async function vistaInventario(cont, ctx) {
  const rol = ctx.perfil.rol;
  const escribirAlim = puedeEscribir(rol, 'inventario_alimentos');
  const escribirMed = puedeEscribir(rol, 'inventario_medicinas');

  // El veterinario solo ve medicinas; el cuidador prioriza alimentos
  let pestana = rol === 'veterinario' ? 'medicinas' : 'alimentos';

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Inventario</h1>
        <p class="page-sub">Existencias de alimentos y medicinas</p>
      </div>
      <button class="btn btn--oro" id="nuevo">${icono('mas', 17)} <span id="nuevo-texto"></span></button>
    </div>

    <div class="toolbar">
      <span class="segmented" id="pest" role="group" aria-label="Tipo de inventario">
        ${escribirAlim || rol === 'dueno' || rol === 'cuidador'
          ? '<button type="button" data-pest="alimentos" aria-pressed="true">Alimentos</button>' : ''}
        <button type="button" data-pest="medicinas" aria-pressed="${pestana === 'medicinas'}">Medicinas</button>
      </span>
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar insumo o proveedor…" aria-label="Buscar" />
      </span>
      <label class="row small" style="gap:6px;cursor:pointer">
        <input type="checkbox" id="solo-bajo" /> Solo stock bajo
      </label>
    </div>

    <section class="card" id="zona">${cargando()}</section>`;

  // Ocultar pestaña de alimentos a quien no le interesa
  if (rol === 'veterinario') cont.querySelector('[data-pest="alimentos"]')?.remove();

  let alims = [], meds = [], tipos = [], texto = '', soloBajo = false;

  const recargar = async () => {
    try {
      [alims, meds, tipos] = await Promise.all([
        listar('inventario_alimentos', '*', { orden: 'nombre' }),
        listar('inventario_medicinas', '*', { orden: 'nombre' }),
        listar('tipos_alimento', 'id, nombre', { orden: 'nombre' }),
      ]);
    } catch (e) {
      document.getElementById('zona').innerHTML =
        `<div class="alert alert--peligro" style="margin:14px">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
      return;
    }
    pintar();
  };

  const esBajo = (f) => Number(f.cantidad) <= Number(f.stock_minimo);

  const pintar = () => {
    const q = texto.toLowerCase();
    const zona = document.getElementById('zona');
    const esAlim = pestana === 'alimentos';
    const filas = (esAlim ? alims : meds).filter((f) =>
      (!soloBajo || esBajo(f)) &&
      (!q || [f.nombre, f.proveedor, f.principio_activo].some((v) => (v || '').toLowerCase().includes(q))));

    document.getElementById('nuevo-texto').textContent = esAlim ? 'Alimento' : 'Medicina';
    document.getElementById('nuevo').hidden = esAlim ? !escribirAlim : !escribirMed;

    if (!filas.length) {
      zona.innerHTML = estadoVacio({
        titulo: (esAlim ? alims : meds).length
          ? (soloBajo ? 'Sin insumos con stock bajo' : 'Sin resultados')
          : `Aún no hay ${esAlim ? 'alimentos' : 'medicinas'} en inventario`,
        hint: (esAlim ? alims : meds).length ? 'Ajusta la búsqueda o el filtro.' : 'Registra el primer insumo.',
        icono: esAlim ? 'inventario' : 'medicinas',
      });
      return;
    }

    const columnas = esAlim ? [
      { clave: 'nombre', etiqueta: 'Alimento', html: (f) => `<strong>${esc(f.nombre)}</strong>` },
      { clave: 'tipo', etiqueta: 'Tipo', html: (f) => esc(tipos.find((t) => t.id === f.tipo_alimento_id)?.nombre || '—') },
      stockCol(),
      { clave: 'proveedor', etiqueta: 'Proveedor', html: (f) => esc(f.proveedor || '—') },
      vencCol(),
    ] : [
      { clave: 'nombre', etiqueta: 'Medicina', html: (f) => `<strong>${esc(f.nombre)}</strong>` },
      { clave: 'principio_activo', etiqueta: 'Principio activo', html: (f) => esc(f.principio_activo || '—') },
      stockCol(),
      { clave: 'via', etiqueta: 'Vía', html: (f) => esc(f.via_administracion || '—') },
      vencCol(),
    ];

    if (esAlim ? escribirAlim : escribirMed) {
      columnas.push({
        clave: 'acc', etiqueta: '', html: (f) => `
          <span class="row" style="gap:6px;justify-content:flex-end;flex-wrap:nowrap">
            <button class="icon-btn" data-editar="${f.id}" aria-label="Editar">${icono('editar', 15)}</button>
            <button class="icon-btn" data-borrar="${f.id}" aria-label="Eliminar">${icono('borrar', 15)}</button>
          </span>`,
      });
    }

    zona.innerHTML = tablaHTML({ columnas, filas });

    const tabla = esAlim ? alims : meds;
    zona.querySelectorAll('[data-editar]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); formFila(tabla.find((x) => x.id === b.dataset.editar)); }));
    zona.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', (e) => { e.stopPropagation(); borrarFila(tabla.find((x) => x.id === b.dataset.borrar)); }));
  };

  function stockCol() {
    return {
      clave: 'cantidad', etiqueta: 'Existencias', num: true, html: (f) => {
        const clase = Number(f.cantidad) === 0 ? 'chip--rojo' : esBajo(f) ? 'chip--ambar' : '';
        return `<span class="chip ${clase}">${num(f.cantidad)} ${esc(f.unidad)}</span>
                <span class="small muted"> / ${num(f.stock_minimo)}</span>`;
      },
    };
  }

  function vencCol() {
    return {
      clave: 'fecha_vencimiento', etiqueta: 'Vencimiento', html: (f) => {
        if (!f.fecha_vencimiento) return '<span class="small muted">—</span>';
        const v = vencimiento(f.fecha_vencimiento);
        return `<span class="chip ${v.clase}">${esc(v.texto)}</span>`;
      },
    };
  }

  function formFila(fila) {
    const esAlim = pestana === 'alimentos';
    const campos = esAlim ? [
      { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, valor: fila?.nombre, placeholder: 'Ej. Avena' },
      {
        nombre: 'tipo_alimento_id', etiqueta: 'Tipo de alimento', tipo: 'select', vacio: 'Sin asignar',
        opciones: tipos.map((t) => ({ valor: t.id, etiqueta: t.nombre })), valor: fila?.tipo_alimento_id,
      },
      { nombre: 'cantidad', etiqueta: 'Cantidad en stock', tipo: 'number', obligatorio: true, min: 0, paso: '0.01', valor: fila?.cantidad ?? 0 },
      {
        nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: fila?.unidad || 'kg',
        opciones: ['kg', 'g', 'l', 'ml', 'unidad', 'saco', 'fardo'],
      },
      { nombre: 'stock_minimo', etiqueta: 'Stock mínimo (alerta)', tipo: 'number', min: 0, paso: '0.01', valor: fila?.stock_minimo ?? 0 },
      { nombre: 'proveedor', etiqueta: 'Proveedor', valor: fila?.proveedor },
      { nombre: 'fecha_compra', etiqueta: 'Fecha de compra', tipo: 'date', valor: fila?.fecha_compra },
      { nombre: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'date', valor: fila?.fecha_vencimiento },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 'full', valor: fila?.notas },
    ] : [
      { nombre: 'nombre', etiqueta: 'Nombre comercial', obligatorio: true, valor: fila?.nombre, placeholder: 'Ej. Penicilina' },
      { nombre: 'principio_activo', etiqueta: 'Principio activo', valor: fila?.principio_activo },
      { nombre: 'cantidad', etiqueta: 'Cantidad en stock', tipo: 'number', obligatorio: true, min: 0, paso: '0.01', valor: fila?.cantidad ?? 0 },
      {
        nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', valor: fila?.unidad || 'ml',
        opciones: ['ml', 'l', 'dosis', 'comprimido', 'frasco', 'unidad'],
      },
      { nombre: 'stock_minimo', etiqueta: 'Stock mínimo (alerta)', tipo: 'number', min: 0, paso: '0.01', valor: fila?.stock_minimo ?? 0 },
      {
        nombre: 'via_administracion', etiqueta: 'Vía de administración', tipo: 'select', vacio: '—',
        opciones: ['Oral', 'Inyectable', 'Tópica', 'Inhalatoria', 'Rectal'], valor: fila?.via_administracion,
      },
      { nombre: 'proveedor', etiqueta: 'Proveedor', valor: fila?.proveedor },
      { nombre: 'fecha_vencimiento', etiqueta: 'Fecha de vencimiento', tipo: 'date', valor: fila?.fecha_vencimiento },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 'full', valor: fila?.notas },
    ];

    const tabla = esAlim ? 'inventario_alimentos' : 'inventario_medicinas';
    formularioModal({
      titulo: fila ? `Editar ${fila.nombre}` : (esAlim ? 'Nuevo alimento' : 'Nueva medicina'),
      campos,
      onGuardar: async (v) => {
        if (fila) await actualizar(tabla, fila.id, v);
        else await insertar(tabla, v);
        toast(fila ? 'Insumo actualizado' : 'Insumo añadido');
        await recargar();
      },
    });
  }

  async function borrarFila(fila) {
    const ok = await confirmar({
      titulo: 'Eliminar del inventario',
      mensaje: `Se eliminará <strong>${esc(fila.nombre)}</strong> del inventario. ¿Continuar?`,
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try {
      await eliminar(pestana === 'alimentos' ? 'inventario_alimentos' : 'inventario_medicinas', fila.id);
      toast('Insumo eliminado');
      await recargar();
    } catch (e) { toast(mensajeError(e), 'error'); }
  }

  document.getElementById('nuevo').addEventListener('click', () => formFila(null));
  document.getElementById('q').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
  document.getElementById('solo-bajo').addEventListener('change', (e) => { soloBajo = e.target.checked; pintar(); });
  document.querySelectorAll('#pest button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#pest button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    pestana = b.dataset.pest;
    pintar();
  }));

  await recargar();
}
