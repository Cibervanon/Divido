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
            <p className="mt-2"><strong>No usamos cookies HTTP.</strong> Divido no utiliza cookies de sesión, de terceros, de analítica ni de publicidad. La única tecnología de almacenamiento que usamos es <code>localStorage</code> (ver sección 2).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">2. Qué guardamos en tu navegador (localStorage)</h2>
            <p className="mt-2">Utilizamos <code>localStorage</code> para lo siguiente:</p>
            <ul className="mt-2 space-y-2 list-disc list-inside">
              <li>
                <strong>Token de sesión (JWT):</strong> te mantiene identificado al cerrar y volver a abrir la pestaña. Es "estrictamente necesario" según la normativa (ePrivacy / RGPD) y no requiere consentimiento previo.
              </li>
              <li>
                <strong>Preferencia de tema visual:</strong> tu elección de modo oscuro/claro/sistema. Persiste entre sesiones.
              </li>
              <li>
                <strong>Rechazo del banner de notificaciones push:</strong> si pulsas "Ahora no" en el banner de activación de notificaciones, guardamos esa preferencia para no volver a molestarte. También es estrictamente necesario.
              </li>
              <li>
                <strong>Consentimiento de analítica (PostHog):</strong> si aceptas el banner de analítica, guardamos tu decisión ("sí" o "no") en <code>localStorage</code> con la clave <code>divido.analytics_consent</code>. Esto nos permite recordar tu elección y no volver a preguntar. Si no aceptas, no se guarda ningún identificador de analítica.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">3. Banner de consentimiento de analítica</h2>
            <p className="mt-2">Si la analítica está activada (variable de entorno <code>VITE_POSTHOG_KEY</code> configurada), verás un banner la primera vez que entres a la app preguntando si aceptas analítica anónima. El banner explica:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              <li>Qué es: analítica de producto (PostHog Cloud, región UE: <code>eu.i.posthog.com</code>).</li>
              <li>Qué recoge: páginas visitadas (<code>$pageview</code>) y eventos de uso (<code>grupo_creado</code>, <code>gasto_creado</code>, <code>invitacion_copiada</code>, <code>invitacion_aceptada</code>). <strong>No</strong> recoge emails, nombres, importes de gastos ni descripciones.</li>
              <li>Identificador: un <code>distinct_id</code> anónimo generado por PostHog y guardado en <code>localStorage</code> (nunca en cookies HTTP).</li>
              <li>No se activa hasta que pulsas "Aceptar". Si pulsas "Ahora no", no se envía ningún evento a PostHog.</li>
            </ul>
            <p className="mt-2">Puedes cambiar de opinión en cualquier momento desde la propia app, sin recargar:</p>
            <ul className="mt-2 ml-4 list-disc space-y-1 text-sm">
              <li>Abre tu <strong>perfil</strong> (tu avatar arriba a la derecha) y baja hasta la sección <strong>"Legal"</strong>: ahí tienes el bloque <strong>"Analítica anónima"</strong> con un botón <strong>Activar / Desactivar</strong>. El cambio se aplica al instante.</li>
              <li>También puedes borrar la clave <code>divido.analytics_consent</code> del <code>localStorage</code>; si lo haces, el banner volverá a preguntarte.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">4. Terceros que podrían almacenar algo</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>PostHog (analítica):</strong> solo si aceptas el banner. Almacena un identificador anónimo en <code>localStorage</code> (dominio <code>eu.i.posthog.com</code>) y procesa los eventos listados arriba. Datos alojados en la UE (Frankfurt).</li>
              <li><strong>Google (OAuth):</strong> si usas "Continuar con Google", Google puede establecer sus propias cookies en <code>accounts.google.com</code> para gestionar tu sesión de Google. Eso escapa a nuestro control y se rige por la política de Google.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">Nosotros no leemos ni escribimos esas cookies; las gestiona cada proveedor en su dominio.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">5. Cómo borrar lo que guardamos</h2>
            <p className="mt-2">Puedes borrar el <code>localStorage</code> de Divido desde las herramientas de desarrollador de tu navegador (Aplicación → Almacenamiento local → https://tu-dominio → Eliminar todo). Al cerrar sesión en la app, el token de sesión se elimina automáticamente; el tema, la preferencia de push y el consentimiento de analítica permanecen hasta que los borres manualmente o uses "Eliminar mi cuenta" (que también limpia el localStorage).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">6. Cambios en esta política</h2>
            <p className="mt-2">Si en el futuro añadimos otras tecnologías que requieran consentimiento, actualizaremos esta página <strong>antes</strong> de activarlas y mostraremos el banner correspondiente. La fecha de "Última actualización" reflejará el cambio.</p>
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