/* ============================================================
   LA JUNGLA · kit de interfaz: toasts, modales, formularios,
   tablas y estados vacíos.
   ============================================================ */

import { icono } from './icons.js';
import { esc } from './formato.js';

/* ---------------- Toasts ---------------- */
export function toast(mensaje, tipo = 'ok') {
  const raiz = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.innerHTML = `${icono(tipo === 'error' ? 'aviso' : 'check', 18)}<span>${esc(mensaje)}</span>`;
  raiz.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 320);
  }, 3200);
}

/* ---------------- Modal ---------------- */
let modalActual = null;

/**
 * Abre un modal. `contenido` es HTMLElement u HTML string.
 * Devuelve { raiz, cerrar }.
 */
export function abrirModal({ titulo, contenido, pie, alCerrar }) {
  cerrarModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', titulo);

  // Esqueleto primero (innerHTML no acepta nodos DOM) y luego el contenido
  modal.innerHTML = `
    <div class="modal__head">
      <h2 class="modal__title">${esc(titulo)}</h2>
      <button type="button" class="icon-btn" data-cerrar aria-label="Cerrar">${icono('cerrar', 18)}</button>
    </div>
    <div class="modal__body" data-cuerpo></div>
    ${pie ? `<div class="modal__foot" data-pie>${pie}</div>` : ''}
  `;

  const cuerpo = modal.querySelector('[data-cuerpo]');
  if (typeof contenido === 'string') cuerpo.innerHTML = contenido;
  else cuerpo.appendChild(contenido);

  backdrop.appendChild(modal);
  document.getElementById('modal-root').appendChild(backdrop);

  const cerrar = () => {
    if (modalActual !== cerrar) return;
    backdrop.remove();
    modalActual = null;
    document.removeEventListener('keydown', onKey);
    alCerrar?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') cerrar(); };

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) cerrar(); });
  modal.querySelector('[data-cerrar]').addEventListener('click', cerrar);
  document.addEventListener('keydown', onKey);

  modalActual = cerrar;
  const primero = modal.querySelector('input, select, textarea, button:not([data-cerrar])');
  primero?.focus({ preventScroll: true });

  return { raiz: modal, cerrar };
}

export function cerrarModal() {
  modalActual?.();
}

/** Confirmación destructiva. Resuelve true si el usuario acepta. */
export function confirmar({ titulo, mensaje, textoAceptar = 'Eliminar', peligro = true }) {
  return new Promise((resolve) => {
    let resuelto = false;
    const fin = (v) => { if (!resuelto) { resuelto = true; resolve(v); } };
    const { cerrar } = abrirModal({
      titulo,
      contenido: `<p class="muted">${mensaje}</p>`,
      pie: `
        <button type="button" class="btn btn--fantasma" data-no>Cancelar</button>
        <button type="button" class="btn ${peligro ? 'btn--peligro' : ''}" data-si>${esc(textoAceptar)}</button>`,
      alCerrar: () => fin(false),
    });
    const m = modalActual && document.querySelector('.modal');
    m?.querySelector('[data-no]')?.addEventListener('click', () => { fin(false); cerrar(); });
    m?.querySelector('[data-si]')?.addEventListener('click', () => { fin(true); cerrar(); });
  });
}

/* ---------------- Formularios ---------------- */
/**
 * Construye un formulario desde una definición de campos.
 * campos: [{ nombre, etiqueta, tipo, obligatorio, opciones, pista, ancho, min, max, paso, valor, placeholder }]
 * Devuelve el <form>.
 */
export function crearFormulario(campos, valores = {}) {
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.noValidate = true;

  for (const c of campos) {
    const id = `f_${c.nombre}`;
    const valor = valores[c.nombre] ?? c.valor ?? '';
    const wrap = document.createElement('div');
    wrap.className = `field${c.ancho === 'full' ? ' field--full' : ''}`;

    let control = '';
    if (c.tipo === 'textarea') {
      control = `<textarea class="textarea" id="${id}" name="${c.nombre}"
        placeholder="${esc(c.placeholder || '')}">${esc(valor)}</textarea>`;
    } else if (c.tipo === 'select') {
      const opts = (c.opciones || []).map((o) => {
        const v = typeof o === 'string' ? o : o.valor;
        const t = typeof o === 'string' ? o : o.etiqueta;
        return `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(t)}</option>`;
      }).join('');
      control = `<select class="select" id="${id}" name="${c.nombre}">
        ${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}${opts}</select>`;
    } else {
      control = `<input class="input" id="${id}" name="${c.nombre}" type="${c.tipo || 'text'}"
        value="${esc(valor)}"
        ${c.obligatorio ? 'required' : ''}
        ${c.min !== undefined ? `min="${c.min}"` : ''}
        ${c.max !== undefined ? `max="${c.max}"` : ''}
        ${c.paso !== undefined ? `step="${c.paso}"` : ''}
        ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}
        ${c.autocompletar ? `autocomplete="${c.autocompletar}"` : 'autocomplete="off"'} />`;
    }

    wrap.innerHTML = `
      <label class="field__label" for="${id}">
        ${esc(c.etiqueta)}${c.obligatorio ? ' <span class="req" aria-hidden="true">*</span>' : ''}
      </label>
      ${control}
      ${c.pista ? `<span class="field__hint">${esc(c.pista)}</span>` : ''}
      <span class="field__error" data-error-for="${c.nombre}" hidden></span>`;
    form.appendChild(wrap);
  }
  // Botón de envío oculto: permite guardar con Enter
  const envio = document.createElement('button');
  envio.type = 'submit';
  envio.className = 'sr-only';
  envio.tabIndex = -1;
  envio.setAttribute('aria-hidden', 'true');
  envio.textContent = 'Guardar';
  form.appendChild(envio);
  return form;
}

/** Lee y valida un formulario. Devuelve { valores } o { errores }. */
export function leerFormulario(form, campos) {
  const fd = new FormData(form);
  const valores = {};
  const errores = {};

  for (const c of campos) {
    let v = fd.get(c.nombre);
    if (typeof v === 'string') v = v.trim();
    // Normalización previa (p. ej. usuario a minúsculas)
    if (c.transformar && typeof v === 'string') v = c.transformar(v);

    if (c.tipo === 'number') {
      if (v === '' || v === null) {
        valores[c.nombre] = null;
      } else {
        const n = Number(v);
        if (Number.isNaN(n)) errores[c.nombre] = 'Debe ser un número.';
        else if (c.min !== undefined && n < c.min) errores[c.nombre] = `Mínimo ${c.min}.`;
        else if (c.max !== undefined && n > c.max) errores[c.nombre] = `Máximo ${c.max}.`;
        else valores[c.nombre] = n;
      }
    } else if (c.tipo === 'date' || c.tipo === 'time') {
      valores[c.nombre] = v || null;
    } else {
      valores[c.nombre] = v || null;
    }

    if (c.obligatorio && (valores[c.nombre] === null || valores[c.nombre] === '')) {
      errores[c.nombre] = 'Campo obligatorio.';
    }
    if (c.tipo === 'email' && valores[c.nombre] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores[c.nombre])) {
      errores[c.nombre] = 'Email no válido.';
    }
    if (c.minLength && valores[c.nombre] && valores[c.nombre].length < c.minLength) {
      errores[c.nombre] = `Mínimo ${c.minLength} caracteres.`;
    }
    // patron: RegExp opcional (se aplica solo si hay valor)
    if (c.patron && typeof valores[c.nombre] === 'string' && valores[c.nombre] && !c.patron.test(valores[c.nombre])) {
      errores[c.nombre] = c.mensajePatron || 'Formato no válido.';
    }
  }
  return { valores, errores };
}

/** Pinta los errores dentro del formulario. */
export function pintarErrores(form, errores) {
  form.querySelectorAll('[data-error-for]').forEach((el) => {
    const nombre = el.dataset.errorFor;
    const msg = errores[nombre];
    el.hidden = !msg;
    el.textContent = msg || '';
    const ctrl = form.elements[nombre];
    if (ctrl) ctrl.setAttribute('aria-invalid', msg ? 'true' : 'false');
  });
  const primero = Object.keys(errores)[0];
  if (primero) form.elements[primero]?.focus();
}

/**
 * Modal con formulario listo para guardar.
 * onGuardar(valores) puede lanzar error (se muestra) o devolver false.
 */
export function formularioModal({ titulo, campos, valores = {}, textoGuardar = 'Guardar', onGuardar }) {
  const form = crearFormulario(campos, valores);
  const { cerrar, raiz } = abrirModal({
    titulo,
    contenido: form,
    pie: `
      <button type="button" class="btn btn--fantasma" data-cancelar>Cancelar</button>
      <button type="submit" class="btn btn--oro" data-guardar>${esc(textoGuardar)}</button>`,
  });

  const btn = raiz.querySelector('[data-guardar]');
  raiz.querySelector('[data-cancelar]').addEventListener('click', cerrar);
  // El botón de pie está fuera del <form>: lo enlazamos a su envío
  btn.addEventListener('click', (e) => { e.preventDefault(); form.requestSubmit(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { valores: v, errores } = leerFormulario(form, campos);
    pintarErrores(form, errores);
    if (Object.keys(errores).length) return;

    btn.disabled = true;
    const textoOriginal = btn.textContent;
    btn.textContent = 'Guardando…';
    try {
      const r = await onGuardar(v);
      if (r === false) { btn.disabled = false; btn.textContent = textoOriginal; return; }
      cerrar();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = textoOriginal;
      toast(err.message || 'No se pudo guardar', 'error');
    }
  });

  return { cerrar, form };
}

/* ---------------- Tablas ---------------- */
/**
 * columnas: [{ clave, etiqueta, num?, html? (fila)=>string }]
 * filas: array de objetos
 */
export function tablaHTML({ columnas, filas, vacio = {}, onFila }) {
  if (!filas.length) return estadoVacio(vacio);

  const thead = columnas.map((c) => `<th scope="col" class="${c.num ? 'num' : ''}">${esc(c.etiqueta)}</th>`).join('');

  const tbody = filas.map((f, i) => {
    const celdas = columnas.map((c) => {
      const contenido = c.html ? c.html(f) : esc(f[c.clave] ?? '—');
      return `<td data-label="${esc(c.etiqueta)}" class="${c.num ? 'num' : ''}">${contenido}</td>`;
    }).join('');
    const attrs = `data-i="${i}"${onFila ? ' tabindex="0" role="button" style="cursor:pointer"' : ''}`;
    return `<tr ${attrs}>${celdas}</tr>`;
  }).join('');

  return `<div class="table-wrap"><table class="data">
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
  </table></div>`;
}

export function estadoVacio({ titulo = 'Sin registros', hint = '', icono: ico = 'inventario', accion = '' } = {}) {
  return `<div class="empty">
    <div class="empty__ico">${icono(ico, 44)}</div>
    <p class="empty__title">${esc(titulo)}</p>
    ${hint ? `<p class="empty__hint">${esc(hint)}</p>` : ''}
    ${accion ? `<div class="mt-16">${accion}</div>` : ''}
  </div>`;
}

/** Tarjetas de esqueleto mientras carga. */
export function cargando(n = 4) {
  return `<div class="stack">${Array.from({ length: n }, () =>
    '<div class="skeleton" style="height:56px"></div>').join('')}</div>`;
}
