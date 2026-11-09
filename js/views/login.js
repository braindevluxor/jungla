/* ============================================================
   LA JUNGLA · pantalla de acceso
   ============================================================ */

import { supabase, mensajeError, resolverLogin } from '../lib/db.js';
import { icono } from '../lib/icons.js';
import { toast } from '../lib/ui.js';

export function vistaLogin() {
  const cont = document.createElement('div');
  cont.className = 'login';

  cont.innerHTML = `
    <div class="login__card">
      <div class="login__brand">
        <img class="login__logo" id="login-logo" src="public/logo.webp" alt="La Jungla" width="66" height="66" />
        <h1 class="login__name">La Jungla</h1>
        <p class="login__tag">Caballeriza · Sistema de gestión</p>
      </div>

      <form class="login__form" novalidate>
        <div class="field">
          <label class="field__label" for="identidad">Usuario</label>
          <input class="input" id="identidad" name="identidad" type="text"
                 autocomplete="username" placeholder="Tu usuario"
                 autocapitalize="none" spellcheck="false" required />
          <span class="field__hint">También puedes escribir tu email.</span>
          <span class="field__error" data-error-for="identidad" hidden></span>
        </div>
        <div class="field">
          <label class="field__label" for="password">Contraseña</label>
          <input class="input" id="password" name="password" type="password"
                 autocomplete="current-password" placeholder="••••••••" required />
          <span class="field__error" data-error-for="password" hidden></span>
        </div>

        <div class="alert alert--info" style="margin:0">
          ${icono('info', 17)}
          <span>Entra con el usuario y la contraseña que te asignó el dueño.</span>
        </div>

        <button class="btn btn--oro" type="submit" style="width:100%;padding:11px">
          ${icono('salir', 18)} Entrar
        </button>
      </form>

      <p class="login__foot">¿Problemas para entrar? Contacta al dueño de la caballeriza.</p>
    </div>`;

  const form = cont.querySelector('form');
  const btn = form.querySelector('button[type="submit"]');

  // Si el logo no carga, probamos el PNG y después la herradura SVG
  const imgLogo = cont.querySelector('#login-logo');
  imgLogo.addEventListener('error', function reintento() {
    if (!this.dataset.intento) {
      this.dataset.intento = 'png';
      this.src = 'public/logo.png';
      return;
    }
    const div = document.createElement('div');
    div.className = 'login__logo';
    div.innerHTML = icono('herradura', 32);
    this.replaceWith(div);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identidad = form.identidad.value.trim();
    const password = form.password.value;

    form.querySelectorAll('[data-error-for]').forEach((el) => { el.hidden = true; });
    if (!identidad || !password) {
      const el = form.querySelector(`[data-error-for="${!identidad ? 'identidad' : 'password'}"]`);
      el.hidden = false;
      el.textContent = 'Campo obligatorio.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando…';
    try {
      // Usuario → email interno de la cuenta (o email directo)
      const email = await resolverLogin(identidad);
      if (!email) {
        // No existe perfil activo con ese usuario (o no se ejecutó el SQL 03)
        throw { code: 'usuario_no_encontrado', message: 'Usuario no encontrado' };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // El detalle real se ve en consola; el usuario recibe un mensaje claro
        console.warn('[login] Supabase devolvió:', JSON.stringify({
          message: error.message, code: error.code, status: error.status,
        }));
        throw error;
      }
      // El render lo dispara onAuthStateChange
    } catch (err) {
      toast(mensajeError(err), 'error');
      btn.disabled = false;
      btn.innerHTML = `${icono('salir', 18)} Entrar`;
    }
  });

  return cont;
}
