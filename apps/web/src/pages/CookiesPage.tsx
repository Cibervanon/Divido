import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export default function CookiesPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Política de cookies</h1>
          <p className="mt-1 text-sm text-slate-400">Última actualización: agosto 2026</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-100">1. ¿Usamos cookies?</h2>
            <p className="mt-2"><strong>No.</strong> A día de hoy Divido no utiliza cookies HTTP (ni de sesión, ni de terceros, ni de analítica, ni de publicidad).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">2. Qué guardamos en tu navegador (localStorage)</h2>
            <p className="mt-2">Utilizamos <code>localStorage</code> (almacenamiento local del navegador) para tres cosas estrictamente necesarias para el funcionamiento del servicio:</p>
            <ul className="mt-2 space-y-2 list-disc list-inside">
              <li>
                <strong>Token de sesión (JWT):</strong> te mantiene identificado al cerrar y volver a abrir la pestaña. Sin esto tendrías que volver a iniciar sesión cada vez. Es "estrictamente necesario" según la normativa de cookies (ePrivacy / RGPD) y no requiere consentimiento previo.
              </li>
              <li>
                <strong>Preferencia de tema visual:</strong> tu elección de modo oscuro/claro/sistema. Persiste entre sesiones para que no tengas que reconfigurarlo.
              </li>
              <li>
                <strong>Rechazo del banner de notificaciones push:</strong> si pulsas "Ahora no" en el banner de activación de notificaciones, guardamos esa preferencia para no volver a molestarte. También es estrictamente necesario para respetar tu decisión.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">3. Por qué no hay banner de consentimiento</h2>
            <p className="mt-2">La directiva ePrivacy y el RGPD exigen consentimiento informado, libre y específico <strong>solo</strong> para cookies (o tecnologías equivalentes) que <strong>no sean estrictamente necesarias</strong> para prestar el servicio solicitado por el usuario. Como hoy solo guardamos lo anterior (todo estrictamente necesario), <strong>no es legalmente obligatorio ni adecuado mostrar un banner de consentimiento</strong> — hacerlo sería "consentimiento fatiga" innecesario.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">4. Terceros que podrían almacenar algo</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Supabase (auth):</strong> al iniciar sesión con email/contraseña o Google, Supabase puede establecer cookies de sesión en su dominio (<code>*.supabase.co</code>) para gestionar la autenticación. Son cookies de terceros estrictamente necesarias para el login; no las controlamos nosotros directamente.</li>
              <li><strong>Google (OAuth):</strong> si usas "Continuar con Google", Google puede establecer sus propias cookies en <code>accounts.google.com</code> para gestionar tu sesión de Google. Eso escapa a nuestro control y se rige por la política de Google.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">Nosotros no leemos ni escribimos esas cookies; las gestiona cada proveedor en su dominio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">5. Cómo borrar lo que guardamos</h2>
            <p className="mt-2">Puedes borrar el <code>localStorage</code> de Divido desde las herramientas de desarrollador de tu navegador (Aplicación → Almacenamiento local → https://tu-dominio → Eliminar todo). Al cerrar sesión en la app, el token de sesión se elimina automáticamente; el tema y la preferencia de push permanecen hasta que los borres manualmente o uses "Eliminar mi cuenta" (que también limpia el localStorage).</p>
          </section>

          {/* NOTA INTERNA PARA DESARROLLADORES:
               ------------------------------------------------------------------
               ESTE DOCUMENTO DEBE REVISARSE EN CUANTO SE AÑADA CUALQUIER HERRAMIENTA
               DE ANALÍTICA (PostHog, Plausible, GA, Mixpanel, etc.) O CUALQUIER
               SCRIPT DE TERCEROS QUE ESCRIBA COOKIES/LOCALSTORAGE NO ESENCIALES.
               EN ESE MOMENTO:
                 1. Añadir aquí la lista de cookies/tecnologías nuevas y su finalidad.
                 2. Implementar banner de consentimiento (opt-in ANTES de cargar el script).
                 3. Añadir enlace a "Configuración de cookies" en el pie de la app.
               NO PUBLIQUES ANALÍTICA SIN ACTUALIZAR ESTA PÁGINA Y EL BANNER.
               ------------------------------------------------------------------ */}

          <section>
            <h2 className="text-lg font-semibold text-slate-100">6. Cambios en esta política</h2>
            <p className="mt-2">Si en el futuro añadimos analítica, publicidad u otras tecnologías que requieran consentimiento, actualizaremos esta página <strong>antes</strong> de activarlas y mostraremos el banner correspondiente. La fecha de "Última actualización" reflejará el cambio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">7. Contacto</h2>
            <p className="mt-2">Dudas sobre esta política: <strong>privacidad@divido.app</strong>.</p>
          </section>

          <div className="pt-4 border-t border-slate-800 text-center">
            <Link to="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}