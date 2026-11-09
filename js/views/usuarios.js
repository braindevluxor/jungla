/* ============================================================
   LA JUNGLA · Usuarios (solo el dueño)
   Alta de cuentas, roles y estado de acceso.
   ============================================================ */

import { supabase, listar, actualizar, mensajeError } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { esc, fecha, iniciales } from '../lib/formato.js';
import { estadoVacio, formularioModal, confirmar, toast, cargando } from '../lib/ui.js';
import { ETIQUETA_ROL } from '../lib/permisos.js';

export async function vistaUsuarios(cont, ctx) {
  const esDueno = ctx.perfil.rol === 'dueno';

  cont.innerHTML = `
    <div class="page-head">
      <div class="page-head__text">
        <h1 class="page-title">Usuarios</h1>
        <p class="page-sub">Cuentas de acceso y roles de La Jungla</p>
      </div>
      ${esDueno ? `<button class="btn btn--oro" id="nuevo">${icono('mas', 17)} Nuevo usuario</button>` : ''}
    </div>

    ${esDueno ? `
    <div class="alert alert--info">
      ${icono('info', 17)}
      <span><strong>Cuidador:</strong> caballos, alimentación, alimentos, herrajes y competencias.
      <strong>Veterinario:</strong> historial veterinario y medicinas.
      <strong>Dueño:</strong> acceso completo, incluidos precios y gastos.</span>
    </div>` : ''}

    <section class="card" id="zona">${cargando()}</section>`;

  if (!esDueno) {
    document.getElementById('zona').innerHTML = estadoVacio({
      titulo: 'Sección reservada al dueño',
      hint: 'Solo la cuenta del dueño puede gestionar usuarios.',
      icono: 'llave',
    });
    return;
  }

  let perfiles = [];
  const recargar = async () => {
    try {
      perfiles = await listar('profiles', '*', { orden: 'created_at', asc: false });
    } catch (e) {
      document.getElementById('zona').innerHTML =
        `<div class="alert alert--peligro" style="margin:14px">${icono('aviso', 17)}<span>${esc(mensajeError(e))}</span></div>`;
      return;
    }
    pintar();
  };

  const claseRol = { dueno: 'chip--oro', cuidador: '', veterinario: 'chip--azul' };

  const pintar = () => {
    const zona = document.getElementById('zona');
    if (!perfiles.length) {
      zona.innerHTML = estadoVacio({ titulo: 'Sin usuarios', icono: 'usuarios' });
      return;
    }

    zona.innerHTML = `<div class="list">${perfiles.map((p) => `
      <div class="list__item">
        <span class="list__avatar">${esc(iniciales(p.nombre))}</span>
        <span class="list__main">
          <span class="list__title">${esc(p.nombre)}
            ${p.id === ctx.usuario?.id ? '<span class="chip chip--gris" style="margin-left:6px">Tú</span>' : ''}
          </span>
          <span class="list__meta">
            <strong>@${esc(p.usuario)}</strong>${p.telefono ? ' · ' + esc(p.telefono) : ''} · Creado ${esc(fecha(p.created_at))}
          </span>
        </span>
        <span class="list__side">
          <span class="chip ${claseRol[p.rol] || ''}">${esc(ETIQUETA_ROL[p.rol] || p.rol)}</span>
          <span class="chip ${p.activo ? '' : 'chip--rojo'}">${p.activo ? 'Activo' : 'Suspendido'}</span>
          <span class="row" style="gap:6px">
            <button class="icon-btn" data-editar="${p.id}" aria-label="Editar usuario">${icono('editar', 15)}</button>
            ${p.id !== ctx.usuario?.id ? `<button class="icon-btn" data-borrar="${p.id}" aria-label="Eliminar usuario">${icono('borrar', 15)}</button>` : ''}
          </span>
        </span>
      </div>`).join('')}</div>`;

    zona.querySelectorAll('[data-editar]').forEach((b) =>
      b.addEventListener('click', () => formEditar(perfiles.find((x) => x.id === b.dataset.editar))));
    zona.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', () => borrar(perfiles.find((x) => x.id === b.dataset.borrar))));
  };

  function formEditar(p) {
    formularioModal({
      titulo: `Editar ${p.nombre}`,
      campos: [
        { nombre: 'nombre', etiqueta: 'Nombre completo', obligatorio: true, valor: p.nombre },
        {
          nombre: 'usuario', etiqueta: 'Usuario de acceso', obligatorio: true, valor: p.usuario,
          patron: /^[a-z0-9._-]{3,20}$/, mensajePatron: 'De 3 a 20 caracteres: a-z, 0-9, punto, guion bajo o guion.',
          transformar: (s) => s.toLowerCase(), autocompletar: 'username',
          pista: 'Con esto entra al sistema. Ej. carlos.c',
        },
        { nombre: 'telefono', etiqueta: 'Teléfono', valor: p.telefono },
        {
          nombre: 'rol', etiqueta: 'Rol', tipo: 'select', obligatorio: true, valor: p.rol,
          opciones: [
            { valor: 'dueno', etiqueta: 'Dueño' },
            { valor: 'cuidador', etiqueta: 'Cuidador' },
            { valor: 'veterinario', etiqueta: 'Veterinario' },
          ],
          pista: 'Determina qué secciones y tablas puede modificar',
        },
        {
          nombre: 'activo', etiqueta: 'Estado de la cuenta', tipo: 'select', valor: String(p.activo),
          opciones: [{ valor: 'true', etiqueta: 'Activo (puede entrar)' }, { valor: 'false', etiqueta: 'Suspendido (no puede entrar)' }],
        },
      ],
      onGuardar: async (v) => {
        if (v.usuario !== p.usuario && perfiles.some((x) => x.usuario === v.usuario && x.id !== p.id)) {
          toast('Ese usuario ya está en uso.', 'error');
          return false;
        }
        await actualizar('profiles', p.id, {
          nombre: v.nombre, usuario: v.usuario, telefono: v.telefono,
          rol: v.rol, activo: v.activo === 'true',
        });
        toast('Usuario actualizado');
        await recargar();
      },
    });
  }

  async function borrar(p) {
    const ok = await confirmar({
      titulo: 'Eliminar usuario',
      mensaje: `Se eliminará el perfil de <strong>${esc(p.nombre)}</strong>. Su cuenta de acceso quedará sin rol y no podrá entrar. ¿Continuar?`,
      textoAceptar: 'Eliminar',
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', p.id);
      if (error) throw error;
      toast('Usuario eliminado');
      await recargar();
    } catch (e) { toast(mensajeError(e), 'error'); }
  }

  document.getElementById('nuevo').addEventListener('click', () => {
    formularioModal({
      titulo: 'Nuevo usuario',
      campos: [
        { nombre: 'nombre', etiqueta: 'Nombre completo', obligatorio: true, placeholder: 'Ej. Ana Pérez' },
        {
          nombre: 'usuario', etiqueta: 'Usuario de acceso', obligatorio: true, ancho: 'full',
          patron: /^[a-z0-9._-]{3,20}$/, mensajePatron: 'De 3 a 20 caracteres: a-z, 0-9, punto, guion bajo o guion.',
          transformar: (s) => s.toLowerCase(), autocompletar: 'username',
          placeholder: 'Ej. ana.perez', pista: 'Con esto entrará al sistema.',
        },
        { nombre: 'telefono', etiqueta: 'Teléfono', placeholder: 'Opcional' },
        {
          nombre: 'rol', etiqueta: 'Rol', tipo: 'select', obligatorio: true, valor: 'cuidador',
          opciones: [
            { valor: 'cuidador', etiqueta: 'Cuidador' },
            { valor: 'veterinario', etiqueta: 'Veterinario' },
            { valor: 'dueno', etiqueta: 'Dueño' },
          ],
        },
        {
          nombre: 'email', etiqueta: 'Email (opcional)', tipo: 'email', ancho: 'full',
          placeholder: 'para recuperar la contraseña', autocompletar: 'off',
          pista: 'Si se deja vacío, la app genera uno interno que no se usa para entrar.',
        },
        { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', obligatorio: true, minLength: 6,
          ancho: 'full', placeholder: 'Mínimo 6 caracteres', autocompletar: 'new-password',
          pista: 'Compártela con el usuario; podrá cambiarla después.' },
      ],
      textoGuardar: 'Crear usuario',
      onGuardar: async (v) => {
        if (perfiles.some((x) => x.usuario === v.usuario)) {
          toast('Ese usuario ya está en uso.', 'error');
          return false;
        }

        // Supabase autentica con email: si no se dio uno, usamos uno interno
        // derivado del usuario (nunca se muestra ni se usa para entrar).
        const email = v.email || `${v.usuario}@lajungla.local`;

        // Guardamos la sesión del dueño: si Supabase inicia sesión con el
        // usuario recién creado (confirmación de email desactivada),
        // se la devolvemos al dueño justo después.
        const { data: sesionActual } = await supabase.auth.getSession();
        const duenoTokens = sesionActual.session
          ? { access_token: sesionActual.session.access_token, refresh_token: sesionActual.session.refresh_token }
          : null;

        // 1) Cuenta de autenticación
        const { data, error } = await supabase.auth.signUp({
          email,
          password: v.password,
          options: { data: { nombre: v.nombre, usuario: v.usuario } },
        });
        if (error) throw error;

        const uid = data.user?.id;
        if (!uid) {
          throw new Error('No se pudo crear la cuenta. Revisa que el registro esté habilitado en Supabase.');
        }

        // Restaurar la sesión del dueño si cambió
        if (duenoTokens && data.session && data.session.user.id !== ctx.usuario?.id) {
          await supabase.auth.setSession(duenoTokens);
        }

        // 2) Perfil con usuario y rol
        const { error: errPerfil } = await supabase.from('profiles').insert({
          id: uid, usuario: v.usuario, nombre: v.nombre,
          telefono: v.telefono || null, rol: v.rol, activo: true,
        });
        if (errPerfil) throw errPerfil;

        toast(`Usuario @${v.usuario} creado. Ya puede entrar.`);
        await recargar();
      },
    });
  });

  await recargar();
}
