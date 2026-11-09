/* ============================================================
   LA JUNGLA · Caballos: listado, alta/edición y ficha detalle
   ============================================================ */

import { listar, insertar, actualizar, eliminar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, hoy, num, etiqueta, iniciales } from '../lib/formato.js';
import { tablaHTML, estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { puedeEscribir } from '../lib/permisos.js';

const COLUMNAS = [
  { clave: 'nombre', etiqueta: 'Caballo', html: (f) => `
    <span class="row" style="gap:9px;flex-wrap:nowrap">
      <span class="list__avatar" style="width:32px;height:32px;font-size:.75rem">${esc(iniciales(f.nombre))}</span>
      <strong>${esc(f.nombre)}</strong>
    </span>` },
  { clave: 'raza', etiqueta: 'Raza', html: (f) => esc(f.raza || '—') },
  { clave: 'sexo', etiqueta: 'Sexo', html: (f) => esc(etiqueta('sexo', f.sexo)) },
  { clave: 'edad', etiqueta: 'Edad', html: (f) => edadTexto(f.fecha_nacimiento) },
  { clave: 'ubicacion', etiqueta: 'Ubicación', html: (f) => esc(f.ubicacion || '—') },
  {
    clave: 'estado', etiqueta: 'Estado', html: (f) => {
      const clase = { activo: '', vendido: 'chip--azul', baja: 'chip--ambar', fallecido: 'chip--gris' }[f.estado] || '';
      return `<span class="chip ${clase}">${esc(etiqueta('estado', f.estado))}</span>`;
    },
  },
];

function campos() {
  return [
    { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, placeholder: 'Ej. Relámpago' },
    { nombre: 'raza', etiqueta: 'Raza', placeholder: 'Ej. Pura Raza Española' },
    {
      nombre: 'sexo', etiqueta: 'Sexo', tipo: 'select', vacio: '—',
      opciones: [{ valor: 'macho', etiqueta: 'Macho' }, { valor: 'hembra', etiqueta: 'Hembra' }],
    },
    { nombre: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'date', max: hoy() },
    { nombre: 'color', etiqueta: 'Color', placeholder: 'Ej. Alazán' },
    { nombre: 'peso_kg', etiqueta: 'Peso (kg)', tipo: 'number', min: 1, max: 1200, paso: '0.1' },
    { nombre: 'numero_registro', etiqueta: 'Nº de registro / chip', placeholder: 'Opcional' },
    { nombre: 'ubicacion', etiqueta: 'Ubicación / box', placeholder: 'Ej. Box 3' },
    {
      nombre: 'estado', etiqueta: 'Estado', tipo: 'select', valor: 'activo',
      opciones: [
        { valor: 'activo', etiqueta: 'Activo' }, { valor: 'baja', etiqueta: 'De baja' },
        { valor: 'vendido', etiqueta: 'Vendido' }, { valor: 'fallecido', etiqueta: 'Fallecido' },
      ],
    },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'textarea', ancho: 'full', placeholder: 'Observaciones generales…' },
  ];
}

function edadTexto(iso) {
  if (!iso) return '—';
  const n = Math.floor((new Date(hoy()) - new Date(iso)) / (365.25 * 86400000));
  if (n < 1) {
    const m = Math.max(0, Math.floor((new Date(hoy()) - new Date(iso)) / (30.4 * 86400000)));
    return `${m} mes${m === 1 ? '' : 'es'}`;
  }
  return `${n} año${n === 1 ? '' : 's'}`;
}

/* ---------------- Listado ---------------- */

export async function vistaCaballos(cont, ctx) {
  const escribir = puedeEscribir(ctx.perfil.rol, 'caballos');
  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Caballos</h1>
        <p class="page-sub">Registro general de la caballeriza</p>
      </div>
      ${escribir ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nuevo caballo</button>` : ''}
    </div>
    <div class="toolbar">
      <span class="search">${icono('buscar', 17)}
        <input class="input" id="q" type="search" placeholder="Buscar por nombre, raza o ubicación…" aria-label="Buscar caballos" />
      </span>
      <span class="segmented" id="filtro" role="group" aria-label="Filtrar por estado">
        <button type="button" data-estado="" aria-pressed="true">Todos</button>
        <button type="button" data-estado="activo" aria-pressed="false">Activos</button>
        <button type="button" data-estado="baja" aria-pressed="false">Baja</button>
        <button type="button" data-estado="vendido" aria-pressed="false">Vendidos</button>
      </span>
    </div>
    <section class="card" id="tabla">${cargando()}</section>`;

  let todos = [];
  try {
    todos = await listar('caballos', '*', { orden: 'nombre' });
  } catch (e) {
    document.getElementById('tabla').innerHTML =
      `<div class="alert alert--peligro" style="margin:14px">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
    return;
  }

  let texto = '';
  let estadoFiltro = '';

  const pintar = () => {
    const q = texto.toLowerCase();
    const filas = todos.filter((c) =>
      (!estadoFiltro || c.estado === estadoFiltro) &&
      (!q || [c.nombre, c.raza, c.ubicacion, c.color].some((v) => (v || '').toLowerCase().includes(q))));

    document.getElementById('tabla').innerHTML = tablaHTML({
      columnas: COLUMNAS,
      filas,
      vacio: {
        titulo: todos.length ? 'Sin resultados' : 'Aún no hay caballos',
        hint: todos.length ? 'Prueba con otro término de búsqueda.' : 'Registra el primer caballo de La Jungla.',
        icono: 'caballos',
      },
    });

    document.querySelectorAll('#tabla tbody tr').forEach((tr) => {
      const abrir = () => { location.hash = '#/caballos/' + filas[Number(tr.dataset.i)].id; };
      tr.addEventListener('click', abrir);
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') abrir(); });
    });
  };

  pintar();

  document.getElementById('q').addEventListener('input', (e) => { texto = e.target.value; pintar(); });
  document.querySelectorAll('#filtro button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('#filtro button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true');
    estadoFiltro = b.dataset.estado;
    pintar();
  }));

  document.getElementById('nuevo')?.addEventListener('click', () => abrirFormulario(null, escribir));
}

function abrirFormulario(fila, escribir) {
  if (!escribir) return;
  formularioModal({
    titulo: fila ? `Editar ${fila.nombre}` : 'Nuevo caballo',
    campos: campos(),
    valores: fila || {},
    textoGuardar: fila ? 'Guardar cambios' : 'Crear caballo',
    onGuardar: async (v) => {
      if (fila) await actualizar('caballos', fila.id, v);
      else await insertar('caballos', v);
      toast(fila ? 'Caballo actualizado' : 'Caballo registrado');
      const { refrescarVista } = await import('../app.js');
      refrescarVista();
    },
  });
}

/* ---------------- Ficha detalle ---------------- */

export async function vistaCaballoDetalle(cont, ctx) {
  const id = ctx.params[0];
  const escribir = puedeEscribir(ctx.perfil.rol, 'caballos');

  cont.innerHTML = `
    <div class="row mb-16">
      <button class="btn btn--fantasma btn--sm" id="volver">${icono('volver', 16)} Volver</button>
    </div>
    <div id="ficha">${cargando()}</div>
    <div id="pestanas"></div>`;

  document.getElementById('volver').addEventListener('click', () => { location.hash = '#/caballos'; });

  let caballo;
  try {
    caballo = await listar('caballos', '*', { filtros: { id } }).then((r) => r[0]);
  } catch (e) {
    document.getElementById('ficha').innerHTML =
      `<div class="alert alert--peligro">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
    return;
  }
  if (!caballo) {
    document.getElementById('ficha').innerHTML = estadoVacio({
      titulo: 'Caballo no encontrado', hint: 'Puede haber sido eliminado.', icono: 'caballos',
    });
    return;
  }

  const inicialesTxt = iniciales(caballo.nombre);
  const claseEstado = { activo: '', vendido: 'chip--azul', baja: 'chip--ambar', fallecido: 'chip--gris' }[caballo.estado];

  document.getElementById('ficha').innerHTML = `
    <div class="detail-hero">
      <span class="detail-hero__avatar">${esc(inicialesTxt)}</span>
      <div class="grow">
        <h1 class="detail-hero__name">${esc(caballo.nombre)}</h1>
        <p class="detail-hero__meta">${esc(caballo.raza || 'Raza no indicada')}${caballo.ubicacion ? ' · ' + esc(caballo.ubicacion) : ''}</p>
        <div class="detail-hero__facts">
          <span class="chip ${claseEstado}">${esc(etiqueta('estado', caballo.estado))}</span>
          <span class="chip chip--oro">${esc(etiqueta('sexo', caballo.sexo))}</span>
          <span class="chip chip--gris">${esc(edadTexto(caballo.fecha_nacimiento))}</span>
          ${caballo.peso_kg ? `<span class="chip chip--gris">${num(caballo.peso_kg)} kg</span>` : ''}
        </div>
      </div>
      <div class="row">
        ${escribir ? `<button class="btn" id="editar">${icono('editar', 16)} Editar</button>` : ''}
        ${escribir ? `<button class="btn btn--peligro" id="borrar">${icono('borrar', 16)} Eliminar</button>` : ''}
      </div>
    </div>

    <div class="card mb-16">
      <div class="card__body datagrid">
        ${dato('Color', caballo.color)}
        ${dato('Fecha de nacimiento', fecha(caballo.fecha_nacimiento, { largo: true }))}
        ${dato('Nº registro / chip', caballo.numero_registro)}
        ${dato('Peso', caballo.peso_kg ? num(caballo.peso_kg) + ' kg' : null)}
        ${dato('Ubicación', caballo.ubicacion)}
        ${dato('Creado', fecha(caballo.created_at))}
      </div>
      ${caballo.notas ? `<div class="card__body" style="border-top:1px solid var(--linea)">
        <p class="field__label mb-8">Notas</p><p class="small">${esc(caballo.notas)}</p></div>` : ''}
    </div>

    <div class="tabs" role="tablist">
      ${['alimentacion', 'herrajes', 'veterinario', 'competencias'].map((t, i) => `
        <button type="button" role="tab" data-tab="${t}" aria-selected="${i === 0}">
          ${{ alimentacion: 'Alimentación', herrajes: 'Herrajes', veterinario: 'Veterinario', competencias: 'Competencias' }[t]}
        </button>`).join('')}
    </div>
    <div id="contenido-tab" role="tabpanel">${cargando(3)}</div>`;

  document.getElementById('editar')?.addEventListener('click', () => {
    abrirFormulario(caballo, escribir);
  });
  document.getElementById('borrar')?.addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Eliminar caballo',
      mensaje: `Se eliminará <strong>${esc(caballo.nombre)}</strong> junto con sus horarios, herrajes, registros veterinarios y competencias. Esta acción no se puede deshacer.`,
      textoAceptar: 'Eliminar todo',
    });
    if (!ok) return;
    try {
      await eliminar('caballos', caballo.id);
      toast('Caballo eliminado');
      location.hash = '#/caballos';
    } catch (e) { toast(mensajeError(e), 'error'); }
  });

  const pintarTab = async (tab) => {
    document.querySelectorAll('[data-tab]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    const destino = document.getElementById('contenido-tab');
    destino.innerHTML = cargando(3);
    try {
      destino.innerHTML = await contenidoTab(tab, caballo, ctx);
    } catch (e) {
      destino.innerHTML = `<div class="alert alert--peligro">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
    }
  };

  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => pintarTab(b.dataset.tab)));

  pintarTab('alimentacion');
}

function dato(k, v) {
  return `<div class="datum"><p class="datum__k">${esc(k)}</p><p class="datum__v">${esc(v || '—')}</p></div>`;
}

async function contenidoTab(tab, caballo, ctx) {
  const id = caballo.id;

  if (tab === 'alimentacion') {
    const filas = await listar('horarios_alimentacion',
      'hora, porcion_kg, notas, activo, tipos_alimento(nombre)',
      { filtros: { caballo_id: id }, orden: 'hora' });
    if (!filas.length) return estadoVacio({ titulo: 'Sin horarios de comida', icono: 'alimentacion' });
    return tablaHTML({
      columnas: [
        { clave: 'hora', etiqueta: 'Hora', html: (f) => `<strong>${esc(String(f.hora).slice(0, 5))}</strong>` },
        { clave: 'alimento', etiqueta: 'Alimento', html: (f) => esc(f.tipos_alimento?.nombre || '—') },
        { clave: 'porcion', etiqueta: 'Porción', num: true, html: (f) => `${num(f.porcion_kg)} kg` },
        { clave: 'activo', etiqueta: 'Estado', html: (f) => f.activo
          ? '<span class="chip">Activo</span>' : '<span class="chip chip--gris">Pausado</span>' },
      ],
      filas,
    });
  }

  if (tab === 'herrajes') {
    const filas = await listar('herrajes', '*', { filtros: { caballo_id: id }, orden: 'fecha', asc: false });
    if (!filas.length) return estadoVacio({ titulo: 'Sin cambios de herraje', icono: 'herrajes' });
    return tablaHTML({
      columnas: [
        { clave: 'fecha', etiqueta: 'Fecha', html: (f) => esc(fecha(f.fecha)) },
        { clave: 'tipo', etiqueta: 'Tipo', html: (f) => esc(f.tipo) },
        { clave: 'herrador', etiqueta: 'Herrador', html: (f) => esc(f.herrador || '—') },
        { clave: 'proxima', etiqueta: 'Próxima', html: (f) => f.proxima_fecha
          ? `<span class="chip chip--ambar">${esc(fecha(f.proxima_fecha))}</span>` : '—' },
        ...(ctx.perfil.rol === 'dueno'
          ? [{ clave: 'coste', etiqueta: 'Coste', num: true, html: (f) => esc(f.coste == null ? '—' : '$' + num(f.coste, 0)) }] : []),
      ],
      filas,
    });
  }

  if (tab === 'veterinario') {
    const filas = await listar('historial_veterinario', '*',
      { filtros: { caballo_id: id }, orden: 'fecha', asc: false });
    if (!filas.length) return estadoVacio({ titulo: 'Sin historial veterinario', icono: 'veterinario' });
    return `<div class="stack">${filas.map((f) => `
      <article class="card">
        <div class="card__head">
          ${icono('veterinario', 17)}
          <h3 class="card__title">${esc(f.motivo)}</h3>
          <span class="chip chip--gris">${esc(fecha(f.fecha))}</span>
        </div>
        <div class="card__body small">
          ${f.veterinario ? `<p class="mb-8"><strong>Veterinario:</strong> ${esc(f.veterinario)}</p>` : ''}
          ${f.diagnostico ? `<p class="mb-8"><strong>Diagnóstico:</strong> ${esc(f.diagnostico)}</p>` : ''}
          ${f.tratamiento ? `<p class="mb-8"><strong>Tratamiento:</strong> ${esc(f.tratamiento)}</p>` : ''}
          ${f.medicamentos ? `<p class="mb-8"><strong>Medicamentos:</strong> ${esc(f.medicamentos)}</p>` : ''}
          <div class="row">
            ${f.proxima_cita ? `<span class="chip chip--azul">${icono('calendario', 13)} Próxima: ${esc(fecha(f.proxima_cita))}</span>` : ''}
            ${ctx.perfil.rol === 'dueno' && f.coste != null ? `<span class="chip chip--oro">Coste: $${num(f.coste, 0)}</span>` : ''}
          </div>
        </div>
      </article>`).join('')}</div>`;
  }

  // competencias
  const filas = await listar('competencias', '*', { filtros: { caballo_id: id }, orden: 'fecha', asc: false });
  if (!filas.length) return estadoVacio({ titulo: 'Sin competencias registradas', icono: 'competencias' });
  return tablaHTML({
    columnas: [
      { clave: 'fecha', etiqueta: 'Fecha', html: (f) => esc(fecha(f.fecha)) },
      { clave: 'nombre', etiqueta: 'Competencia', html: (f) => `<strong>${esc(f.nombre)}</strong>` },
      { clave: 'categoria', etiqueta: 'Categoría', html: (f) => esc(f.categoria || '—') },
      { clave: 'lugar', etiqueta: 'Lugar', html: (f) => esc(f.lugar || '—') },
      { clave: 'puesto', etiqueta: 'Puesto', html: (f) => f.puesto
        ? `<span class="chip ${/1|primer/i.test(f.puesto) ? 'chip--oro' : ''}">${esc(f.puesto)}</span>` : '—' },
    ],
    filas,
  });
}
