/* ============================================================
   LA JUNGLA · arranque, sesión, enrutado y maquetación
   ============================================================ */

import { supabase, mensajeError } from './lib/db.js';
import { icono } from './lib/icons.js';
import { esc } from './lib/formato.js';
import { menuDe, ETIQUETA_ROL } from './lib/permisos.js';
import { toast } from './lib/ui.js';

import { vistaLogin } from './views/login.js';
import { vistaPanel } from './views/panel.js';
import { vistaCaballos, vistaCaballoDetalle } from './views/caballos.js';
import { vistaAlimentacion } from './views/alimentacion.js';
import { vistaInventario } from './views/inventario.js';
import { vistaHerrajes } from './views/herrajes.js';
import { vistaVeterinario } from './views/veterinario.js';
import { vistaCompetencias } from './views/competencias.js';
import { vistaUsuarios } from './views/usuarios.js';

const RUTAS = {
  panel: vistaPanel,
  caballos: vistaCaballos,
  caballo: vistaCaballoDetalle,
  alimentacion: vistaAlimentacion,
  inventario: vistaInventario,
  herrajes: vistaHerrajes,
  veterinario: vistaVeterinario,
  competencias: vistaCompetencias,
  usuarios: vistaUsuarios,
};

export const estado = {
  usuario: null,   // auth user
  perfil: null,    // { id, nombre, rol, telefono, activo }
  ruta: 'panel',
  params: {},
};

const app = () => document.getElementById('app');

/* ---------------- Sesión ---------------- */

async function cargarPerfil(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, usuario, nombre, rol, telefono, activo')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function arrancar() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    try {
      estado.usuario = session.user;
      estado.perfil = await cargarPerfil(session.user.id);
    } catch (e) {
      console.error(e);
      estado.perfil = null;
    }
    // Sin perfil activo (cuenta sin rol o suspendida) → fuera
    if (!estado.perfil?.activo) {
      estado.usuario = null;
      estado.perfil = null;
      await supabase.auth.signOut();
    }
  }
  // Leer la ruta inicial (#/caballos, accesos directos del PWA)
  if (estado.perfil) enrutar();
  else render();
}

supabase.auth.onAuthStateChange(async (_evento, session) => {
  const uid = session?.user?.id ?? null;
  const actual = estado.usuario?.id ?? null;
  // Sin cambios de cuenta relevantes → no volver a pintar
  if (uid === actual && (uid === null || estado.perfil)) return;

  let perfil = null;
  if (uid) {
    try { perfil = await cargarPerfil(uid); } catch (e) { console.error(e); }

    // La sesión pudo cambiar mientras cargábamos (p. ej. al crear un
    // usuario desde el panel del dueño): descartamos el evento obsoleto.
    const { data } = await supabase.auth.getSession();
    if ((data.session?.user?.id ?? null) !== uid) return;

    if (perfil && !perfil.activo) {
      await supabase.auth.signOut(); // el evento posterior vuelve a pintar
      return;
    }
  }

  estado.usuario = uid ? session.user : null;
  estado.perfil = perfil;
  render();
});

/* ---------------- Enrutado ---------------- */

function parsearHash() {
  const bruto = (location.hash || '#/panel').replace(/^#\/?/, '');
  const [ruta, ...resto] = bruto.split('/');
  return { ruta: RUTAS[ruta] ? ruta : 'panel', params: resto.filter(Boolean) };
}

export function navegar(destino) {
  const hash = '#/' + destino.replace(/^\/+/, '');
  if (location.hash === hash) enrutar();
  else location.hash = hash;
}

function enrutar() {
  if (!estado.perfil) return;
  const { ruta, params } = parsearHash();
  estado.ruta = ruta;
  estado.params = params;
  render();
}

window.addEventListener('hashchange', enrutar);

/* ---------------- Render ---------------- */

export function render() {
  const raiz = app();
  const boot = document.getElementById('boot');
  if (boot) boot.remove();

  if (!estado.perfil) {
    raiz.hidden = false;
    raiz.innerHTML = '';
    raiz.appendChild(vistaLogin());
    return;
  }

  const menu = menuDe(estado.perfil.rol);
  // 'caballo' (ficha) pertenece a la sección 'caballos'
  const seccion = estado.ruta === 'caballo' ? 'caballos' : estado.ruta;
  if (!menu.some((m) => m.id === seccion)) {
    // Ruta no permitida para este rol → volver al panel
    if (location.hash !== '#/panel') { location.hash = '#/panel'; return; }
    estado.ruta = 'panel';
  }

  raiz.hidden = false;
  raiz.innerHTML = `
    ${barraSuperior()}
    <div class="layout">
      <nav class="sidebar" aria-label="Secciones">
        <p class="sidebar__group-title">Caballeriza</p>
        ${menu.map(itemMenu).join('')}
      </nav>
      <main class="main" id="vista" tabindex="-1"></main>
    </div>
    <nav class="bottomnav" aria-label="Secciones">
      ${menu.slice(0, 5).map(itemMenuMovil).join('')}
    </nav>`;

  raiz.querySelectorAll('[data-nav]').forEach((b) => {
    b.addEventListener('click', () => navegar(b.dataset.nav));
  });
  raiz.querySelector('[data-salir]')?.addEventListener('click', salir);
  raiz.querySelector('[data-perfil]')?.addEventListener('click', () => navegar('usuarios'));

  // Logo de marca con respaldo: WebP → PNG → herradura SVG
  raiz.querySelector('#topbar-logo')?.addEventListener('error', function reintento() {
    if (!this.dataset.intento) {
      this.dataset.intento = 'png';
      this.src = 'public/logo.png';
      return;
    }
    const s = document.createElement('span');
    s.className = 'topbar__logo';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = icono('herradura', 19);
    this.replaceWith(s);
  });

  pintarVista();
}

async function pintarVista() {
  const cont = document.getElementById('vista');
  if (!cont) return;
  // #/caballos/<id> → ficha detalle; #/caballos → listado
  const clave = (estado.ruta === 'caballos' && estado.params[0]) ? 'caballo' : estado.ruta;
  const vista = RUTAS[clave] || vistaPanel;
  try {
    await vista(cont, estado);
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="alert alert--peligro">${icono('aviso', 18)}
      <span>No se pudo cargar la sección: ${esc(mensajeError(e))}</span></div>`;
  }
}

/** Vuelve a pintar solo el contenido (sin recargar la maqueta). */
export function refrescarVista() { pintarVista(); }

function itemMenu(m) {
  const activo = estado.ruta === m.id ||
    (m.id === 'caballos' && estado.ruta === 'caballo');
  return `<button type="button" class="navitem" data-nav="${m.id}" ${activo ? 'aria-current="page"' : ''}>
    ${icono(m.icono, 19)}<span>${esc(m.etiqueta)}</span></button>`;
}

function itemMenuMovil(m) {
  const activo = estado.ruta === m.id ||
    (m.id === 'caballos' && estado.ruta === 'caballo');
  return `<button type="button" data-nav="${m.id}" ${activo ? 'aria-current="page"' : ''}>
    ${icono(m.icono, 21)}<span>${esc(m.etiqueta)}</span></button>`;
}

function barraSuperior() {
  const perfil = estado.perfil;
  const iniciales = (perfil.nombre || '?').trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase();
  return `
  <header class="topbar">
    <div class="topbar__brand">
      <img class="topbar__logo" id="topbar-logo" src="public/logo.webp" alt="" width="34" height="34" />
      <span>
        <span class="topbar__name">La Jungla</span>
        <span class="topbar__sub">Caballeriza</span>
      </span>
    </div>
    <span class="topbar__spacer"></span>
    <button type="button" class="navitem" ${perfil.rol === 'dueno' ? 'data-perfil' : 'disabled'}
      title="${perfil.rol === 'dueno' ? 'Gestionar usuarios' : 'Tu cuenta'}"
      style="width:auto;padding:6px 10px;margin:0;${perfil.rol === 'dueno' ? '' : 'cursor:default;opacity:.9'}">
      <span class="list__avatar" style="width:28px;height:28px;font-size:.72rem">${esc(iniciales)}</span>
      <span style="text-align:left;line-height:1.15">
        <span style="display:block;font-size:.84rem">${esc(perfil.nombre)}</span>
        <span style="display:block;font-size:.68rem;color:var(--oro-400)">@${esc(perfil.usuario || '')} · ${esc(ETIQUETA_ROL[perfil.rol] || perfil.rol)}</span>
      </span>
    </button>
    <button type="button" class="icon-btn" data-salir title="Cerrar sesión"
      aria-label="Cerrar sesión" style="background:transparent;border-color:rgba(255,255,255,.25);color:#fff">
      ${icono('salir', 18)}
    </button>
  </header>`;
}

async function salir() {
  const { error } = await supabase.auth.signOut();
  if (error) toast(mensajeError(error), 'error');
  estado.usuario = null;
  estado.perfil = null;
  location.hash = '';
  render();
}

/* ---------------- Arranque ---------------- */
arrancar();
