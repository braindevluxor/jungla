-- ============================================================
-- LA JUNGLA · PASO 2 — CREAR LA CUENTA DEL DUEÑO
-- Ejecutar DESPUÉS de 01_esquema.sql
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Pasos:
--   1) En Supabase ve a  Authentication → Users → "Add user"
--        · Email:        un email real (solo lo usa Supabase por
--                        debajo; para entrar se usa el USUARIO)
--        · Contraseña:   mínimo 6 caracteres
--        · Marca "Auto Confirm User" para entrar sin validar email
--   2) Abajo, pon ese mismo email y el USUARIO con el que quieres
--      entrar (minúsculas, 3-20 caracteres: a-z 0-9 . _ -).
--   3) Ejecuta este script.
-- ============================================================

do $$
declare
  v_email   text := 'CAMBIA_ESTO@ejemplo.com';  -- ← el email de la cuenta
  v_usuario text := 'dueno';                    -- ← tu usuario de acceso
  v_uid     uuid;
begin
  if v_usuario !~ '^[a-z0-9._-]{3,20}$' then
    raise exception 'El usuario % no es válido. Usa 3-20 caracteres: a-z 0-9 . _ - (minúsculas).', v_usuario;
  end if;

  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    raise exception 'No existe ninguna cuenta con el email %. Créala primero en Authentication → Users.', v_email;
  end if;

  if exists (select 1 from public.profiles where usuario = v_usuario and id <> v_uid) then
    raise exception 'El usuario % ya está en uso por otra cuenta.', v_usuario;
  end if;

  insert into public.profiles (id, usuario, nombre, rol, activo)
  values (v_uid, v_usuario, 'Dueño de La Jungla', 'dueno', true)
  on conflict (id) do update
    set rol     = 'dueno',
        activo  = true,
        usuario = excluded.usuario,
        nombre  = coalesce(public.profiles.nombre, excluded.nombre);

  raise notice 'Usuario % convertido en DUEÑO (cuenta %).', v_usuario, v_email;
end $$;

-- Verificación: acceso_ok debe ser true
select p.usuario, p.rol, p.activo,
       public.login_email(p.usuario) is not null as acceso_ok
  from public.profiles p
 order by p.usuario;
