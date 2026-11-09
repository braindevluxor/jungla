-- ============================================================
-- LA JUNGLA · RESETEAR LA CONTRASEÑA DE UN USUARIO
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Útil cuando alguien olvida su contraseña y no quieres depender
-- del correo de recuperación. Cambia la contraseña directamente en
-- la cuenta de autenticación.
--
-- ⚠️ Requiere la extensión pgcrypto (viene incluida en Supabase).
-- ============================================================

begin;

-- pgcrypto aporta crypt()/gen_salt(); en Supabase ya viene instalada
create extension if not exists pgcrypto with schema extensions;

-- 1) Pon aquí el email de la cuenta y la contraseña nueva
do $$
declare
  v_email   text := 'jr@jungla.com';          -- ← email de la cuenta
  v_pass    text := 'CAMBIA_ESTA_CONTRASENA'; -- ← contraseña nueva (mín. 6)
  v_uid     uuid;
begin
  if length(v_pass) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres.';
  end if;

  select id into v_uid from auth.users where lower(email) = lower(v_email);

  if v_uid is null then
    raise exception 'No existe ninguna cuenta con el email %.', v_email;
  end if;

  update auth.users
     set encrypted_password = crypt(v_pass, gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = null,
         recovery_sent_at = null,
         updated_at = now()
   where id = v_uid;

  raise notice 'Contraseña actualizada para %.', v_email;
end $$;

commit;

-- Verificación: la cuenta debe quedar confirmada
select u.email,
       u.email_confirmed_at is not null as confirmado,
       u.encrypted_password is not null as password_set,
       p.usuario,
       p.rol
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;
