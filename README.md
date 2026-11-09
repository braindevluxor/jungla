# 🐎 La Jungla · Caballeriza

Aplicación web **PWA responsive** para administrar la caballeriza *La Jungla*.
Sin build ni dependencias: HTML + CSS + JavaScript moderno, con **Supabase** como base de datos.

---

## Qué incluye

| Sección | Contenido | Dueño | Cuidador | Veterinario |
|---|---|:-:|:-:|:-:|
| **Panel** | KPIs, comidas de hoy, stock bajo, citas y próximos herrajes | ✅ | ✅ | ✅ |
| **Caballos** | Registro con raza, sexo, nacimiento, color, peso, nº de registro, ubicación, estado, notas. Ficha con pestañas | ✅ | ✅ | 👁 |
| **Alimentación** | Horas de comida por caballo, porción en kg, tipo de alimento, pausar/activar + gestión de tipos | ✅ | ✅ | — |
| **Inventario** | Alimentos y medicinas con cantidad, unidad, proveedor, vencimiento y **alerta de stock mínimo** | ✅ | 🍽 | 💊 |
| **Herrajes** | Cambios de herraje, herrador, coste, **próxima revisión** con aviso si vence | ✅ | ✅ | — |
| **Veterinario** | Historial: motivo, diagnóstico, tratamiento, medicamentos, peso, próxima cita, coste | ✅ | 👁 | ✅ |
| **Competencias** | Histórico: fecha, categoría, lugar, puesto, premio + KPIs de podios | ✅ | ✅ | 👁 |
| **Usuarios** | Altas de cuidador/veterinario/dueño, cambio de rol y suspensión de cuentas | ✅ | — | — |

👁 = lectura · 🍽/💊 = según inventario · — = no visible

**PWA**: se puede instalar desde el navegador (Añadir a pantalla de inicio), funciona con la
app ya cargada sin conexión y guarda los iconos en caché.

---

## Puesta en marcha (5 pasos)

### 1. Limpiar las tablas existentes de Supabase

Abre **Supabase Dashboard → SQL Editor → New query**, pega el contenido de
[`sql/00_limpiar_todo.sql`](sql/00_limpiar_todo.sql) y pulsa **Run**.

> ⚠️ Borra **todas** las tablas, vistas y funciones del esquema `public`
> (incluye `horses`, `medical_records`, etc.). No se puede deshacer.

### 2. Crear el esquema nuevo

Pega [`sql/01_esquema.sql`](sql/01_esquema.sql) en un query nuevo y **Run**.
Crea las 9 tablas, las políticas RLS por rol, la función de acceso por
usuario y 6 tipos de alimento de ejemplo.

> **Si el esquema se creó antes de añadir el acceso por usuario**, ejecuta
> además [`sql/03_login_con_usuario.sql`](sql/03_login_con_usuario.sql):
> añade la columna `usuario`, rellena las cuentas existentes y crea la
> función `login_email`. Es inocuo si ya está todo creado.

### 3. Crear la cuenta del dueño

1. **Authentication → Users → Add user**: email + contraseña (mín. 6 caracteres)
   y marca *Auto Confirm User*. El email es interno: **para entrar se usa el
   usuario**.
2. En [`sql/02_crear_dueno.sql`](sql/02_crear_dueno.sql) sustuye
   `CAMBIA_ESTO@ejemplo.com` por ese email y `dueno` por el usuario con el
   que quieres entrar, y ejecútalo.

### 4. Ajustes de autenticación (recomendado)

En **Supabase Dashboard → Authentication → Providers → Email**:

- Mantén *Sign ups* **activado** (la app crea usuarios desde la sección Usuarios).
- Desactiva *Confirm email* si quieres que el dueño pueda dar de alta cuentas y
  que entren de inmediato sin validar el correo. Si lo dejas activado, cada
  usuario nuevo deberá pulsar el enlace de su correo la primera vez.

### 5. Ejecutar la app en local

```powershell
# desde la carpeta del proyecto
python -m http.server 8080
```

Abre <http://localhost:8080> y entra con el **usuario** del dueño
(también acepta el email).

> ⚠️ **No abras `index.html` con doble clic** (`file://`): los módulos ES y el
> service worker están bloqueados por CORS en ese modo, así que la app no carga.
> Si lo haces, verás un aviso con estas instrucciones en pantalla. Necesitas HTTP:

### 6. Crear el resto de usuarios

Entrando como **dueño**, ve a **Usuarios → Nuevo usuario** y rellena:

- **Nombre** y **usuario** (obligatorios): a-z, 0-9, punto, guion bajo o
  guion, de 3 a 20 caracteres. El usuario es con lo que se entra.
- **Email** (opcional): solo sirve para recuperar la contraseña. Si se deja
  vacío, la app genera uno interno (`usuario@lajungla.local`) que no se usa
  para nada visible.
- **Rol** y **contraseña**.

### Acceso por usuario

La pantalla de entrada tiene un único campo **Usuario**:

- Si se teclea un usuario (`carlos.c`), la app lo traduce al email interno
  de la cuenta con la función SQL `login_email` y entra.
- Si se teclea algo con `@`, se usa como email directamente.

Los usuarios **suspendidos** no pueden entrar (la función no devuelve su email).

---

## Despliegue (PWA instalable)

Sube la carpeta tal cual a **Netlify, Vercel, GitHub Pages o Cloudflare Pages**
(sin build). Luego, en el dispositivo:

- **Android/Chrome**: menú → *Instalar aplicación*.
- **iPhone/Safari**: Compartir → *Añadir a pantalla de inicio*.

Configura en Supabase **Authentication → URL Configuration** la URL del sitio
para que los enlaces de correo apunten a tu dominio.

---

## Estructura

```
La Jungla/
├── index.html              Arranque + registro del service worker
├── manifest.webmanifest    Definición PWA (nombre, iconos, colores)
├── sw.js                   Caché de la app shell (funciona offline)
├── css/styles.css          Diseño responsive (mobile first + escritorio)
├── js/
│   ├── app.js              Sesión, rutas (#/caballos/…) y maquetación
│   ├── lib/
│   │   ├── db.js           Cliente Supabase + CRUD y manejo de errores
│   │   ├── permisos.js     Roles, menú y tablas escribibles (espejo del SQL)
│   │   ├── ui.js           Modales, formularios, tablas, toasts
│   │   ├── icons.js        Set de iconos SVG en línea
│   │   └── formato.js      Fechas, números, moneda, escapado HTML
│   └── views/              Una vista por sección
├── icons/                  Iconos PWA (generados con Pillow)
│   └── flaticon/           Iconos de Flaticon (caballo y herradura)
├── public/
│   ├── logo.png            Logotipo original (dorado, fondo transparente)
│   ├── logo.webp           Versión WebP con base verde (la que usa la app)
│   └── convertir_logo.py   Regenera logo.webp desde logo.png
└── sql/                    00 limpieza · 01 esquema · 02 dueño · 03 acceso por usuario
```

### Roles y seguridad

Los permisos están definidos **dos veces a propósito**: en las políticas RLS de
[`sql/01_esquema.sql`](sql/01_esquema.sql) (`puede_escribir()`) y en
`js/lib/permisos.js`. La base de datos es la autoridad: aunque alguien manipule
el cliente, Supabase rechazará la escritura. Si cambias uno, cambia el otro.

### Regenerar iconos

```powershell
python icons/generar_iconos.py
```

### Regenerar el logo WebP

```powershell
python public/convertir_logo.py
```

### Pruebas

`_test/` contiene bancos de pruebas que se abren en Chrome (sin dependencias):

```powershell
python -m http.server 8080
# en Chrome: http://localhost:8080/_test/form.html      → validación de formularios
#             http://localhost:8080/_test/login.html    → acceso por usuario/email
```

Cada página imprime un `<div id="resultado-prueba">` con el JSON de resultados
(`"pasa": true/false` o `"errores": []`). `run_login.ps1` los recorre con
Chrome headless y devuelve 0 si todo pasa.

| Página | Qué comprueba |
|---|---|
| `_test/form.html` | Validación de formularios (usuario, email, números) |
| `_test/login.html` | Acceso por usuario y por email |
| `_test/iconos.html` | Iconos SVG y raster en varios fondos |
| `_test/mask.html` | Que los PNG de Flaticon cargan y se pintan |
| `_test/menu.html` | Menú lateral completo con el CSS real |

---

## Notas

- **Stock bajo**: en Inventario, marca *Solo stock bajo*; el panel lo resume.
- **Próximas revisiones**: en Herrajes, fecha *Próxima revisión* → el chip pasa a
  ámbar a 14 días y a rojo si está vencida.
- **Suspender un usuario** (Usuarios → Estado) corta el acceso sin borrar su
  historial.
- Los precios (`coste`, `premio`) solo los ve el **dueño**.

## Créditos de iconos

Los iconos de **Caballos** y **Herrajes** son de [Flaticon](https://www.flaticon.es/)
y están en `icons/flaticon/`:

- *Cabeza de caballo* — [Freepik](https://www.flaticon.es/autor/freepik) · id 12436093
- *Herradura* — [Freepik](https://www.flaticon.es/autor/freepik) · id 16066462

La licencia gratuita de Flaticon exige **atribución**. Si la app se publica con
fines comerciales, añade en la interfaz o en los créditos algo como
*"Iconos de Freepik vía Flaticon"*; si no quieres esa atribución visible,
sustituye esos dos PNG por iconos propios en `icons/flaticon/` (las claves
`RASTER` de `js/lib/icons.js` no cambian).

El resto de iconos son SVG de trazo propios y el logo es de la caballeriza.
