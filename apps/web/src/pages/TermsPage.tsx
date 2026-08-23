import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Logo className="h-14 w-14" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100">Términos de uso</h1>
          <p className="mt-1 text-sm text-slate-400">Última actualización: agosto 2026</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-slate-100">1. Qué es Divido</h2>
            <p className="mt-2">Divido es una aplicación web para organizar y saldar gastos compartidos entre grupos de personas. Permite crear grupos, registrar gastos, ver quién debe qué, llevar pagos, deudas informales ("piques"), cuotas fijas y un bote común. <strong>Divido no mueve dinero real</strong>: no es un banco, no es una entidad de pago, no custodia fondos ni ejecuta transferencias. Solo calcula y registra; los pagos reales los hacéis vosotros fuera de la app (Bizum, Revolut, PayPal, efectivo, etc.).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">2. Tu responsabilidad sobre los datos que introduces</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Eres responsable de la exactitud de los gastos, pagos, piques y cuotas que registres.</li>
              <li>No uses Divido para actividades ilegales, fraudulentas o que vulneren derechos de terceros.</li>
              <li>Los métodos de pago (teléfono, Revolut, PayPal) que añadas a tu perfil son visibles para los miembros de tus grupos para que puedan pagarte. No verifiques datos de terceros sin su consentimiento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">3. No somos un servicio financiero</h2>
            <p className="mt-2"><strong>Importante:</strong> Divido no está regulado como entidad de crédito, entidad de pago ni servicio de inversión. No ofrecemos cuentas de pago, tarjetas, préstamos, ni custodia de fondos. Los saldos que ves son <strong>informativos</strong>, calculados a partir de los datos que vosotros introducís. No garantizamos que coincidan con la realidad bancaria de cada persona; son una ayuda para poneros de acuerdo, no un extracto oficial.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">4. Uso aceptable</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>No intentes acceder a cuentas ajenas, manipular saldos, inyectar código o sobrecargar el servicio.</li>
              <li>No subas imágenes ilegales, ofensivas o que no sean comprobantes de gastos reales.</li>
              <li>Respeta a los demás miembros: no uses los piques o deudas para acosar.</li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">Incumplir esto puede suponer la suspensión o eliminación de tu cuenta.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">5. Cuentas, grupos y cierre</h2>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Puedes eliminar tu cuenta en cualquier momento desde tu perfil (ver Política de privacidad para el detalle de qué pasa con tus saldos).</li>
              <li>Un grupo lo elimina su admin manualmente; los miembros siguen viendo el histórico de solo lectura. No hay borrado automático por inactividad.</li>
              <li>Nos reservamos el derecho a suspender el servicio completo con aviso previo razonable (email a usuarios registrados). En ese caso, tendrás tiempo para exportar tus datos.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">6. Propiedad intelectual</h2>
            <p className="mt-2">El código, diseño y marca "Divido" son propiedad de sus creadores. Tus datos (gastos, grupos, fotos) son tuyos; nos das licencia para almacenarlos y mostrarlos dentro del servicio mientras tu cuenta exista.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">7. Limitación de responsabilidad</h2>
            <p className="mt-2">Divido se proporciona "tal cual", sin garantías de disponibilidad ininterrumpida o ausencia de errores. No somos responsables de pérdidas económicas derivadas de uso incorrecto, datos erróneos introducidos por usuarios, ni de pagos que no se materialicen fuera de la app. Nuestra responsabilidad total se limita al importe que hayas pagado por el servicio (hoy: 0 €).</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">8. Ley aplicable y jurisdicción</h2>
            <p className="mt-2">Estos términos se rigen por la legislación española. Para cualquier controversia, los juzgados del domicilio del usuario (consumidor) o de Barcelona (empresa), según corresponda.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">9. Cambios en los términos</h2>
            <p className="mt-2">Publicaremos la versión actualizada aquí con fecha. Si el cambio afecta a tus derechos u obligaciones, te avisaremos por email o banner en la app con antelación razonable. El uso continuado tras el aviso implica aceptación.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-100">10. Contacto</h2>
            <p className="mt-2">Para dudas sobre estos términos: <strong>legal@divido.app</strong>.</p>
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