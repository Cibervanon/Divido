import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Política de privacidad</h1>
          <p className="mt-1 text-sm text-slate-400">Última actualización: agosto 2026</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-100">1. Qué datos recopilamos</h2>
            <p className="mt-2">Recopilamos solo lo necesario para que el servicio funcione:</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Datos de cuenta:</strong> email, nombre, foto de perfil (opcional), teléfono y métodos de pago (Bizum, Revolut, PayPal) que tú añadas voluntariamente.</li>
              <li><strong>Datos de uso:</strong> grupos a los que perteneces, gastos que creas o en los que participas, pagos que registras, deudas informales ("piques"), cuotas fijas y bote común.</li>
              <li><strong>Fotos de comprobantes:</strong> imágenes de tiques o facturas que subes a los gastos. Se almacenan en Supabase Storage con URLs firmadas que expiran.</li>
              <li><strong>Datos técnicos:</strong> token de sesión (JWT en localStorage), preferencia de tema visual y si has rechazado el banner de notificaciones push.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">2. Para qué usamos tus datos (base legal)</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Ejecución del contrato / servicio:</strong> autenticación, gestión de grupos, cálculo de saldos, registro de gastos y pagos, notificaciones que tú activas. Sin estos datos no podemos prestar el servicio.</li>
              <li><strong>Interés legítimo:</strong> seguridad (detección de abusos), mejora del rendimiento (caché de grupos visitados en tu navegador).</li>
              <li><strong>Consentimiento:</strong> notificaciones push (opt-in explícito), verificación de email, login con Google.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">No usamos tus datos para publicidad, perfiles comerciales ni los vendemos a terceros.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">3. Terceros que procesan datos por nuestra cuenta</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li><strong>Supabase (PostgreSQL + Storage):</strong> alojamiento de la base de datos y almacenamiento de fotos de tiques y avatares. Datos en UE (Frankfurt).</li>
              <li><strong>Resend:</strong> envío de emails transaccionales (verificación de cuenta, restablecimiento de contraseña).</li>
              <li><strong>Google (OAuth):</strong> solo si eliges "Continuar con Google"; recibimos tu email, nombre y foto de perfil públicos de tu cuenta Google. No accedemos a ningún otro dato de tu cuenta Google.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">Todos los proveedores firman cláusulas contractuales tipo (SCC) y cumplen RGPD.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">4. Tus derechos (RGPD) y cómo ejercerlos</h2>
            <ul className="mt-2 space-y-3 list-disc list-inside">
              <li>
                <strong>Acceso y portabilidad:</strong> en tu perfil tienes el botón <strong>"Descargar mis datos (JSON)"</strong> que llama a <code>GET /api/users/me/export</code>. Genera un archivo con tu perfil, grupos, gastos donde eres pagador/creador, pagos y deudas informales.
              </li>
              <li>
                <strong>Supresión ("derecho al olvido"):</strong> en tu perfil está el botón <strong>"Eliminar mi cuenta"</strong> (<code>DELETE /api/users/me</code>). Qué pasa exactamente:
                <ul className="mt-1 ml-4 list-[disc] space-y-1 text-sm">
                  <li>Tu perfil se anonimiza (nombre, email, foto, teléfono, métodos de pago → borrados).</li>
                  <li>Se cierra tu sesión en todos los dispositivos.</li>
                  <li><strong>Tus saldos en cada grupo activo se congelan</strong>: quedas como "exmiembro" con el saldo que tenías en ese momento. El histórico del grupo (gastos, pagos, piques) se conserva para el resto de miembros. Esto es intencional: si debías dinero, esa deuda no desaparece de golpe; el grupo sigue viendo el saldo congelado igual que con cualquier miembro que se va voluntariamente.</li>
                  <li>Si eras el único admin de un grupo, se promociona automáticamente a otro miembro.</li>
                </ul>
              </li>
              <li><strong>Rectificación:</strong> puedes editar tu nombre, foto, teléfono y métodos de pago desde el perfil en cualquier momento.</li>
              <li><strong>Oposición / limitación:</strong> puedes desactivar notificaciones push cuando quieras; el banner tiene botón "Ahora no" que guarda tu rechazo en localStorage.</li>
            </ul>
            <p className="mt-2">Para cualquier otra solicitud (ej. acceso manual, portabilidad en otro formato), escríbenos a <strong>privacidad@divido.app</strong> (pon tu email de cuenta en el asunto). Respondemos en ≤ 30 días.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">5. Conservación de los datos</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Datos de cuenta: mientras la cuenta esté activa.</li>
              <li>Tras eliminación: anonimización inmediata; saldos congelados se conservan mientras el grupo exista (para integridad del histórico del resto de miembros).</li>
              <li>Fotos de tiques: se borran cuando borras el gasto asociado o al eliminar la cuenta (anonimizado).</li>
              <li>Logs de seguridad/errores: 30 días.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">6. Transferencias internacionales</h2>
            <p className="mt-2">Supabase aloja los datos en la UE (Frankfurt). Resend procesa emails desde EE. UU. bajo SCC. Google OAuth puede procesar datos en EE. UU. (Marco de Privacidad UE-EE. UU.). No hay otras transferencias.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">7. Seguridad</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Contraseñas: hash bcrypt (coste 10).</li>
              <li>Sesiones: JWT firmado (HS256), guardado solo en localStorage del navegador (no en cookies).</li>
              <li>Fotos: URLs firmadas con expiración (no enlaces públicos permanentes).</li>
              <li>HTTPS forzado en producción (Vercel + Render).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">8. Contacto</h2>
            <p className="mt-2">Delegado de protección de datos: <strong>privacidad@divido.app</strong>. También puedes usar el formulario de contacto en la web o responder a cualquier email transaccional que recibas de nosotros.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">9. Cambios en esta política</h2>
            <p className="mt-2">Publicaremos la versión actualizada en esta misma URL con la fecha de revisión. Si el cambio es sustancial (nuevo tratamiento, nuevo tercero), te avisaremos por email o con un banner en la app.</p>
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