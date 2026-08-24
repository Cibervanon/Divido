// Auto-generated from manual-usuario-divido.html
// DO NOT EDIT MANUALLY - Run scripts/extract-help-content.js to regenerate

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface HelpCategory {
  id: string;
  title: string;
  articles: HelpArticle[];
}

export interface KeyboardShortcut {
  key: string;
  description: string;
}

export interface IconMeaning {
  icon: string;
  meaning: string;
}

export interface ExpenseCategory {
  name: string;
  color: string;
  icon: string;
  keywords: string;
}

export const helpCategories: HelpCategory[] = [
  {
    "id": "sec-1",
    "title": "🚀 Inicio Rápido",
    "articles": [
      {
        "id": "crear-tu-primer-grupo",
        "title": "Crear tu primer grupo",
        "content": "1. Pulsa el botón **+** en el Dashboard\n2. Elige un nombre y una moneda (no se puede cambiar después)\n3. Selecciona el tipo: **Abierto** (cualquiera invita) o **Cerrado** (solo admins)\n4. ¡Listo! Comparte el enlace de invitación o el código QR",
        "category": "sec-1",
        "faqs": [
          { "question": "¿Puedo cambiar la moneda después?", "answer": "No, la moneda se fija al crear el grupo para mantener la integridad de los saldos." },
          { "question": "¿Cuál es la diferencia entre Abierto y Cerrado?", "answer": "En Abierto, cualquier miembro puede invitar. En Cerrado, solo los administradores." }
        ]
      },
      {
        "id": "anadir-tu-primer-gasto",
        "title": "Añadir tu primer gasto",
        "content": "1. Entra en tu grupo y pulsa **Nuevo gasto**\n2. Escribe descripción e importe\n3. Elige **quién pagó**\n4. Selecciona el reparto: **Iguales** (a partes iguales), **%** (porcentajes), **€** (importes exactos) o **Bote** (desde el bote común)\n5. Añade foto del tique si quieres (opcional)\n6. Guarda",
        "category": "sec-1",
        "faqs": [
          { "question": "¿Qué significa cada tipo de reparto?", "answer": "Iguales = todos pagan lo mismo. % = porcentajes personalizados (ej. 60/40). € = cantidades exactas por persona. Bote = se descuenta del bote común." }
        ]
      },
      {
        "id": "entender-los-saldos",
        "title": "Entender los saldos (verde/rojo)",
        "content": "En la lista de grupos y en la pestaña **Saldos**:\n- **Verde (+)** = te deben dinero\n- **Rojo (−)** = debes dinero\n- El **neto** (arriba a la derecha) resume tu posición global en ese grupo\n\nLa **Simplificación** reduce los pagos cruzados al mínimo (máx. n−1 transferencias).",
        "category": "sec-1",
        "faqs": [
          { "question": "¿Cómo sé a quién pagar?", "answer": "Ve a la pestaña Saldos → Ver desglose. Te saldrá la lista exacta de transferencias necesarias." }
        ]
      },
      {
        "id": "pagar-y-cobrar",
        "title": "Pagar y cobrar entre amigos",
        "content": "1. Pestaña **Saldos** → **Pagar**\n2. Elige a quién pagar (la app sugiere la cantidad exacta)\n3. Opcional: adjunta foto del comprobante\n4. El acreedor recibe notificación y confirma\n5. Al confirmar, los saldos se actualizan al instante",
        "category": "sec-1",
        "faqs": [
          { "question": "¿Qué pasa si el acreedor no confirma?", "answer": "Puedes activar **Autoconfirmar pagos** en Perfil → Ajustes para que se marquen solos." }
        ]
      }
    ]
  },
  {
    "id": "sec-2",
    "title": "📊 Dashboard y Grupos",
    "articles": [
      {
        "id": "ancla-tus-grupos-con",
        "title": "Ancla tus grupos con 📌",
        "content": "Los grupos que más uses pueden quedar fijados arriba para tenerlos siempre a mano: pulsa el menú ⋮ del grupo → **Anclar**. Los anclados se mantienen por encima del resto, ordenados por tu criterio (actividad, nombre o saldo).",
        "category": "sec-2",
        "faqs": []
      },
      {
        "id": "ordenacion-inteligente",
        "title": "Ordenación inteligente ⇅",
        "content": "Ordena tu lista de grupos por el selector ⇅: por actividad reciente, por nombre (A–Z) o por saldo. Los grupos anclados siempre se mantienen por encima del resto, ordenados según este criterio.",
        "category": "sec-2",
        "faqs": []
      },
      {
        "id": "estado-del-grupo-abierto-o-cerrado",
        "title": "🟢🔴 Estado del grupo: abierto o cerrado",
        "content": "Cada grupo tiene un estado que indica si está en marcha o en pausa:\n\n**Abierto 🟢** — funcionamiento normal: gastos, piques, pagos y aportaciones al bote fluyen sin restricciones.\n\n**Cerrado 🔴** — el grupo queda en solo lectura: nadie crea ni modifica movimientos hasta reabrirlo. Ideal al terminar un viaje o una convivencia y querer conservar las cuentas tal cual.\n\nSolo un administrador puede cambiarlo desde Ajustes del grupo, con el botón **Cerrar grupo / Reabrir grupo**. Aparece una pantalla «Cerrando…» mientras se aplica el cambio, y el estado queda visible en la cabecera del grupo para todos los miembros.",
        "category": "sec-2",
        "faqs": []
      },
      {
        "id": "ajustes-del-grupo",
        "title": "Ajustes del grupo",
        "content": "Desde el menú ⋮ del grupo → **Ajustes** puedes:\n- Cambiar nombre, logo, tipo (abierto/cerrado)\n- Ver/regenerar enlace de invitación\n- Gestionar miembros (cambiar roles, expulsar)\n- Cerrar/Reabrir grupo\n- Eliminar grupo (solo creador)",
        "category": "sec-2",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-3",
    "title": "🧾 Gastos e Historial",
    "articles": [
      {
        "id": "filtros-que-si-ayudan",
        "title": "🔍 Filtros que sí ayudan",
        "content": "Pulsa el botón único **🔍 Filtros** sobre el historial: dentro conviven la búsqueda por texto y los chips de categoría en español — **Comida 🍕 · Casa 🏠 · Transporte 🚗 · Ocio 🎮 · Salud 💊 · Otros** — en una tira deslizable en horizontal en móvil. Activa también **Mi pagador** para ver solo lo que pagaste tú. Los filtros activos quedan como chips visibles encima de la lista, con un botón **Limpiar** para quitarlos todos de golpe.",
        "category": "sec-3",
        "faqs": []
      },
      {
        "id": "historial-interactivo",
        "title": "👆 Historial interactivo",
        "content": "Toca cualquier gasto del historial y se abre su ficha completa: importe, pagador, participantes, reparto, comprobante adjunto y acciones disponibles según tus permisos (editar o eliminar). Cada línea es una puerta directa a su detalle auditable: nada de buscar a ciegas.",
        "category": "sec-3",
        "faqs": []
      },
      {
        "id": "cargar-mas-listas-paginadas",
        "title": "Cargar más: listas paginadas",
        "content": "En grupos con mucha actividad, las pestañas de **Gastos** y **Actividad** cargan por páginas (50 gastos y 100 eventos) para que la app siga siendo rápida. Al final de cada lista verás el botón **«Cargar más»**: púlsalo tantas veces como quieras para ir trayendo el resto del histórico. Los filtros y la búsqueda se aplican a todo el histórico, no solo a la página visible, y los elementos ya cargados permanecen en pantalla al recargar. Si exportas un CSV o PDF, recibirás siempre todas las filas, no solo las visibles.",
        "category": "sec-3",
        "faqs": []
      },
      {
        "id": "historial-y-auditoria-de-gastos-borrados",
        "title": "Historial y auditoría de gastos borrados",
        "content": "Un gasto eliminado nunca desaparece del historial: se atenúa visualmente (opacity 50%), se tacha y se etiqueta como **Borrado**. Así el historial es una auditoría completa y siempre puedes reconstruir qué pasó.",
        "category": "sec-3",
        "faqs": []
      },
      {
        "id": "editar-o-borrar-un-gasto",
        "title": "Editar o borrar un gasto",
        "content": "Abre el gasto desde el historial → menú ⋮ → **Editar** o **Eliminar**.\n- **Editar**: cambias descripción, importe, categoría, pagador, reparto. Los saldos se recalculan al guardar.\n- **Eliminar**: el gasto se marca como borrado en el historial (no desaparece) y los saldos se ajustan.",
        "category": "sec-3",
        "faqs": [
          { "question": "¿Quién puede editar/borrar?", "answer": "El creador del gasto y los administradores del grupo." }
        ]
      }
    ]
  },
  {
    "id": "sec-3c",
    "title": "📷 Comprobantes y Autoconfirmación",
    "articles": [
      {
        "id": "adjuntar-tique-al-registrar-un-pago",
        "title": "Adjuntar tique al registrar un pago",
        "content": "Al crear un pago (pestaña Saldos → **Pagar**), aparece un área opcional **«Comprobante (opcional)»**. Puedes:\n- Hacer foto con la cámara del móvil (captura directa)\n- Subir imagen desde la galería (JPG/PNG, máx. 5 MB)\n- Ver miniatura del comprobante en el listado de pagos; click para ampliar a pantalla completa\n\n> **Ejemplo** Pagas tu parte de la cena y subes la foto del ticket del restaurante. El comprobante queda vinculado al pago y visible para el acreedor.",
        "category": "sec-3c",
        "faqs": []
      },
      {
        "id": "autoconfirmacion-de-pagos-recibidos",
        "title": "Autoconfirmación de pagos recibidos",
        "content": "En **Perfil → Ajustes → Autoconfirmar pagos** puedes activar un interruptor que hace que cualquier pago que recibas se marque automáticamente como confirmado sin esperar a que tú lo apruebes manualmente.",
        "category": "sec-3c",
        "faqs": [
          { "question": "¿Es recomendable?", "answer": "Sí, si confías en tu grupo. Ahorra el paso manual de confirmar cada pago recibido." }
        ]
      },
      {
        "id": "ver-comprobantes",
        "title": "Ver comprobantes adjuntos",
        "content": "En la lista de pagos (pestaña Saldos), los pagos con comprobante muestran un icono 📎. Pulsa para ver la imagen a pantalla completa. También accesible desde el detalle del gasto → pagos asociados.",
        "category": "sec-3c",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-3b",
    "title": "🏷️ Categorías e Iconos",
    "articles": [
      {
        "id": "categorias-de-gastos",
        "title": "Categorías de gastos",
        "content": "Cada gasto pertenece a una categoría que define su icono y color. La app detecta la categoría automáticamente a partir de la descripción (título) del gasto, buscando palabras clave. Si la detección no acierta, puedes elegir la categoría manualmente.",
        "category": "sec-3b",
        "faqs": []
      },
      {
        "id": "deteccion-automatica",
        "title": "Detección automática",
        "content": "Al escribir la descripción del gasto, la app compara el texto (normalizado: minúsculas, sin tildes) con las palabras clave de cada categoría. La primera categoría con coincidencias gana. Si no hay coincidencias, se usa **General** (wallet).\n\n> **Ejemplo** Escribes «Cena con los compis en el italiano». Palabras detectadas: cena, italiano → Categoría **Comida**, icono 🍴 naranja.",
        "category": "sec-3b",
        "faqs": []
      },
      {
        "id": "seleccion-manual",
        "title": "Selección manual",
        "content": "En el formulario del gasto hay una fila de chips de categoría. Al pulsar uno, la categoría se fija (**modo manual**) y deja de detectarse automáticamente aunque cambies la descripción. Para volver al modo automático, pulsa el chip **Auto**.",
        "category": "sec-3b",
        "faqs": []
      },
      {
        "id": "iconos-de-modulo-fallbacks",
        "title": "Iconos de módulo (fallbacks)",
        "content": "Además de los gastos, los otros módulos tienen su icono fijo:\n- **Piques** → 🤝 (handshake)\n- **Bote común** → 🐷 (piggy-bank)\n- **Gastos fijos** → 🔁 (repeat)\n- **Pagos** → 💸 (currency-exchange)\n- **Miembros** → 👥 (users)",
        "category": "sec-3b",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-4",
    "title": "⚡ Simplificación de Deudas",
    "articles": [
      {
        "id": "el-algoritmo-greedy-net-debt-settlement",
        "title": "El algoritmo: Greedy Net Debt Settlement",
        "content": "Divido aplica un algoritmo voraz de saldo neto (**Greedy Net Debt Settlement**):\n\n1. Se calcula lo que cada miembro gana o pierde en total (saldo neto)\n2. **Deudores → acreedores**: cada deudor paga a quien más crédito tiene, en orden\n3. **Transferencias mínimas**: el menor número posible de pagos para dejar todo a cero (máx. n−1 pagos)",
        "category": "sec-4",
        "faqs": [
          { "question": "¿Por qué no pago a todo el mundo?", "answer": "El algoritmo optimiza para que hagas el mínimo de transferencias. En lugar de pagar a 3 personas, pagas a 1 que ya debe a las otras." }
        ]
      },
      {
        "id": "panel-de-desglose",
        "title": "Panel de desglose",
        "content": "En la pestaña **Saldos** pulsa **Ver desglose** de cualquier miembro. Verás exactamente qué transferencias hacer:\n\n```\nAna    +€24.00  → te deben €24.00\nBea     €0.00  → saldado\nCar    −€15.00  → debe €15.00\nDiego   −€9.00  → debe €9.00\n```\n\n**Resultado**: En lugar de 6 pagos cruzados, solo hace falta:\n- Car paga €15.00 a Ana\n- Diego paga €9.00 a Ana",
        "category": "sec-4",
        "faqs": []
      },
      {
        "id": "simplificacion-activada-por-defecto",
        "title": "Simplificación activada por defecto",
        "content": "La simplificación está **activada por defecto** en todos los grupos. Puedes desactivarla en Ajustes del grupo → **Simplificar deudas** (pero no se recomienda: multiplica los pagos necesarios).",
        "category": "sec-4",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-5",
    "title": "🐷 Bote Común y Piques",
    "articles": [
      {
        "id": "extracto-contable-del-bote",
        "title": "📒 Extracto contable del bote",
        "content": "El bote funciona como una mini cuenta bancaria: su pantalla muestra un extracto con cada movimiento — **aportación (+)** o **pago realizado desde el bote (−)** — junto al saldo acumulado tras cada operación, la fecha y el concepto. Los movimientos ligados a un gasto actúan como enlaces: tócalos y saltas directo al gasto correspondiente del historial.",
        "category": "sec-5",
        "faqs": []
      },
      {
        "id": "aportar-al-bote",
        "title": "Aportar al bote",
        "content": "Pestaña **Bote** → **Aportar**. Elige importe y concepto (ej. «Fondo viaje»). La aportación suma al saldo del bote y al balance del miembro (se le debe ese dinero).",
        "category": "sec-5",
        "faqs": []
      },
      {
        "id": "pagar-desde-el-bote",
        "title": "Pagar un gasto desde el bote",
        "content": "Al crear un gasto, elige reparto **Bote**. El importe se descuenta del saldo del bote (no de los miembros). Útil para gastos compartidos del día a día (super, café, peajes) sin tener que cuadrar después.",
        "category": "sec-5",
        "faqs": [
          { "question": "¿Qué pasa si el bote no tiene suficiente?", "answer": "La app te avisa y no deja crear el gasto. Aporta primero o elige otro reparto." }
        ]
      },
      {
        "id": "piques-informales",
        "title": "Piques informales (entre dos)",
        "content": "Fuera de grupos, puedes crear **piques 1-a-1** desde el Dashboard → **Nuevo pique**. Funcionan igual que un grupo de dos: añades gastos, ves saldos, pagas. Ideales para cosas puntuales (una cena, un regalo compartido) sin montar un grupo entero.",
        "category": "sec-5",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-6",
    "title": "🔁 Gastos Fijos",
    "articles": [
      {
        "id": "motor-de-automatizacion",
        "title": "Motor de automatización",
        "content": "Un proceso que se ejecuta en el servidor (vía cron, periódicamente) revisa todos los gastos fijos activos con **autoregistro** y genera automáticamente el gasto cuando vence su fecha. Tú solo eliges:\n- Frecuencia: semanal, quincenal, mensual, anual\n- Día de la semana / día del mes\n- Importe, categoría, pagador, reparto\n- Participantes (por defecto: todos los miembros activos)",
        "category": "sec-6",
        "faqs": []
      },
      {
        "id": "pausa-y-gestion",
        "title": "Pausa y gestión",
        "content": "**Pausar**: detiene la generación futura sin borrar la configuración. Ideal para vacaciones.\n\n**Reanudar**: vuelve a activar la cuota; el motor la retoma.\n\n**Eliminar**: borra la cuota de forma definitiva. Los gastos ya generados se mantienen en el historial.\n\n> **Truco** Si una cuota se genera por error (por ejemplo, un importe mal configurado), elimina el gasto como cualquier otro: aparecerá atenuado en el historial para auditoría (ver Sección 3).",
        "category": "sec-6",
        "faqs": []
      },
      {
        "id": "crear-gasto-fijo",
        "title": "Crear un gasto fijo",
        "content": "En el grupo → pestaña **Gastos fijos** → **Nuevo gasto fijo**. Rellena: nombre, importe, frecuencia, día, categoría, pagador, reparto, participantes. Activa **Autoregistro** para que se cree solo.",
        "category": "sec-6",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-7",
    "title": "🔔 Notificaciones PWA",
    "articles": [
      {
        "id": "panel-in-app",
        "title": "Panel in-app (campana 🔔)",
        "content": "La campana muestra el número de avisos sin leer: del 1 al 9 se ve el número exacto y a partir de 10 se muestra **+9**. Al pulsar una notificación, navegas al instante (al grupo, gasto o pago relacionado) y la lectura se marca en segundo plano: experiencia optimista, sin esperas. En el panel puedes marcar como leída una notificación individual con el botón de la derecha, o usar **«Marcar todas como leídas»** para limpiar el contador de golpe. El icono de ajustes de la cabecera te lleva directo al perfil, donde puedes elegir qué avisos recibes. Cuando no hay avisos, el panel muestra un mensaje vacío: todo está al día.",
        "category": "sec-7",
        "faqs": []
      },
      {
        "id": "notificaciones-nativas-web-push",
        "title": "Notificaciones nativas (Web Push)",
        "content": "Cuando activas el push, las notificaciones llegan al sistema operativo: verás el aviso en la pantalla del móvil o del escritorio, aunque la app esté cerrada.\n\n1. Toca **«Activar»** (Banner del dashboard o Ajustes)\n2. Acepta el permiso (Diálogo del sistema)\n3. ¡Listo! Recibes avisos nativos\n\n> **Consejo** Para no perderte nada, **instala la app**: en iOS usa «Compartir → Añadir a pantalla de inicio»; en Android y escritorio usa el botón **Instalar** del navegador. Así Divido se abre a pantalla completa como una app nativa.\n\n> **Nota** Si deniegas el permiso, el navegador no podrá volver a preguntártelo automáticamente. Puedes reactivarlo desde los ajustes del navegador (sección de notificaciones del sitio).",
        "category": "sec-7",
        "faqs": []
      },
      {
        "id": "ajusta-que-avisos-recibes",
        "title": "Ajusta qué avisos recibes",
        "content": "No todo el mundo quiere enterarse de todo. Abre **Perfil → Ajustes** y, en la sección **Notificaciones**, activa o desactiva cada tipo de aviso con un interruptor. Los cambios se guardan al instante y se aplican al panel in-app y al push.\n\nTipos: nuevo gasto, gasto editado/borrado, pago recibido, pago confirmado, pique, invitación, gasto fijo generado, mención, etc.",
        "category": "sec-7",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-8",
    "title": "❓ Preguntas Frecuentes (FAQ)",
    "articles": [
      {
        "id": "faq-cuenta-acceso",
        "title": "Cuenta y acceso",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Puedo usar Divido sin crear cuenta?", "answer": "No. Necesitas cuenta para que tus saldos y grupos se guarden en la nube y sincronicen entre dispositivos." },
          { "question": "¿Cómo recupero mi contraseña?", "answer": "En la pantalla de login pulsa **¿Olvidaste la contraseña?**, introduce tu email y recibirás un enlace para restablecerla." },
          { "question": "¿Puedo usar mi cuenta de Google/Apple?", "answer": "Sí, Divido soporta login con Google y Apple (Sign in with Apple) además de email/contraseña." },
          { "question": "¿Mis datos están seguros?", "answer": "Sí. Usamos Supabase (PostgreSQL) con Row Level Security: solo tú y los miembros de tus grupos veis vuestros datos. Las contraseñas se hascean con bcrypt." }
        ]
      },
      {
        "id": "faq-grupos-miembros",
        "title": "Grupos y miembros",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Cuántos grupos puedo crear?", "answer": "Ilimitados. No hay límite en el plan actual." },
          { "question": "¿Puedo eliminar un grupo?", "answer": "Solo el creador puede eliminarlo (Ajustes → Eliminar grupo). Se borra todo: gastos, saldos, historial, bote." },
          { "question": "¿Qué son los miembros «fantasma» (sin cuenta)?", "answer": "Puedes añadir gente sin cuenta (nombre solo) para que aparezcan en los repartos. No reciben notificaciones ni ven la app. Si luego se registran con el mismo email, se vinculan automáticamente." },
          { "question": "¿Cómo cambio de administrador?", "answer": "Un admin puede dar rol de admin a otro miembro (Ajustes → Miembros → ⋮ → Hacer admin). Si el único admin se va, la app asigna el rol al siguiente miembro activo." }
        ]
      },
      {
        "id": "faq-gastos-saldos",
        "title": "Gastos y saldos",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Por qué mi saldo no cuadra?", "answer": "Revisa: 1) ¿Todos los gastos están en la categoría correcta? 2) ¿Falta algún pago confirmado? 3) ¿Hay gastos borrados que no deberían? Usa el historial para auditar." },
          { "question": "¿Qué es el «neto»?", "answer": "Es la diferencia entre lo que te deben y lo que debes. Positivo (verde) = te deben. Negativo (rojo) = debes. Cero = saldado." },
          { "question": "¿Puedo dividir un gasto de forma desigual?", "answer": "Sí. En el formulario elige **%** (porcentajes) o **€** (importes exactos) y ajusta por persona." },
          { "question": "¿Los gastos en otras monedas se convierten?", "answer": "No. Cada grupo tiene UNA moneda fija. No hay conversión automática. Si viajas, crea un grupo en la moneda local." }
        ]
      },
      {
        "id": "faq-pagos-bote",
        "title": "Pagos y bote común",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Cómo funciona «Autoconfirmar pagos»?", "answer": "Actívalo en Perfil → Ajustes. Cualquier pago que recibas se marca como confirmado al instante, sin que tengas que pulsar «Confirmar». Útil en grupos de confianza." },
          { "question": "¿Puedo cancelar un pago ya enviado?", "answer": "Solo si el acreedor no lo ha confirmado aún. En Saldos → pagos pendientes → ⋮ → Cancelar." },
          { "question": "¿Para qué sirve el bote común?", "answer": "Es un fondo compartido del grupo. Aportas dinero y luego pagas gastos **desde el bote** (reparto «Bote»), sin tocar saldos individuales. Ideal para viajes: metéis dinero al inicio y pagáis todo desde ahí." }
        ]
      },
      {
        "id": "faq-notificaciones-pwa",
        "title": "Notificaciones e instalación",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Cómo instalo Divido como app nativa?", "answer": "**iOS**: Safari → Compartir → Añadir a pantalla de inicio. **Android/Chrome/Edge**: botón **Instalar** en la barra de direcciones o menú ⋮ → Instalar. **Escritorio**: mismo botón Instalar." },
          { "question": "¿Funciona sin internet?", "answer": "Sí, como PWA instalada funciona **offline** para ver grupos, gastos y saldos ya cargados. Las escrituras (nuevo gasto, pago) se sincronizan al volver la conexión." },
          { "question": "No me llegan notificaciones push", "answer": "1. Verifica Perfil → Ajustes → Notificaciones (todas activadas). 2. Ajustes del navegador → Sitios → Notificaciones → Divido → Permitir. 3. Instala la app (requisito en iOS/Android para push nativo)." }
        ]
      },
      {
        "id": "faq-tecnico",
        "title": "Técnico y privacidad",
        "content": "",
        "category": "sec-8",
        "faqs": [
          { "question": "¿Dónde se guardan mis datos?", "answer": "En Supabase (PostgreSQL) alojado en EU (Frankfurt). Cumple GDPR. No vendemos datos ni hacemos publicidad." },
          { "question": "¿Puedo exportar mis datos?", "answer": "Sí. En cada grupo → Ajustes → **Exportar** (CSV/PDF). También en Perfil → **Exportar todos mis datos** (JSON completo)." },
          { "question": "¿Cómo borro mi cuenta?", "answer": "Perfil → Ajustes → **Eliminar cuenta**. Borra todo: usuario, grupos creados, gastos, pagos, notificaciones. Irreversible." },
          { "question": "¿Hay API pública?", "answer": "No por ahora. Si necesitas integración, escríbenos a soporte@divido.app" }
        ]
      }
    ]
  },
  {
    "id": "sec-9",
    "title": "📷 Tiques en la nube y actualización en vivo",
    "articles": [
      {
        "id": "tu-tique-guardado-y-privado",
        "title": "Tu tique, guardado y privado",
        "content": "Cuando adjuntas una foto del tique al crear o editar un gasto, esta se sube a un almacenamiento privado: nunca es pública ni accesible por quien no pertenece al grupo. Al verla (botón tique en la lista de gastos), la app genera un enlace temporal que caduca en 1 hora; si vuelve a pulsarse, se genera uno nuevo automáticamente. Adjunta la foto desde tu galería o archivos: cada imagen se optimiza sola antes de subirse (máximo 1200 px, JPEG comprimido por debajo de ~500 KB), así va ligera y tu móvil no se ahoga. Las fotos de perfil y logos de grupo se aligeran igual (hasta 512 px). Solo se aceptan imágenes JPG o PNG de hasta 5 MB. Los tiques antiguos siguen viéndose igual. Si pierdes conexión durante la subida, te avisamos y puedes reintentarlo; el gasto no se registra sin el tique que pediste.\n\n> **Ejemplo** Añades «Cena italiana» con la foto del ticket: mientras ves la barra «Subiendo tique…», la imagen viaja cifrada a la nube. Tu compañero abre el gasto dos días después y ve la foto nítida, aunque haya cambiado de móvil.",
        "category": "sec-9",
        "faqs": []
      },
      {
        "id": "la-app-se-actualiza-sola",
        "title": "La app se actualiza sola (Tiempo real)",
        "content": "Gastos, saldos e historial: si alguien del grupo añade, edita o elimina un gasto (o aprueba una solicitud), lo verás al momento sin recargar la página. Pagos entre miembros: cuando te envían o confirman un pago, tu balance se refresca solo. Campana 🔔: los avisos nuevos aparecen al instante, sin esperar al minuto siguiente. Nada cambia en cómo haces las cosas: sigues tocando los mismos botones; simplemente todo llega antes.\n\n> **Nota** Si tu navegador bloquea conexiones en tiempo real, Divido sigue funcionando con normalidad: los datos se refrescan como siempre al entrar en cada pantalla.",
        "category": "sec-9",
        "faqs": []
      }
    ]
  }
];

export const keyboardShortcuts: KeyboardShortcut[] = [
  { "key": "?", "description": "Abrir / cerrar Ayuda" },
  { "key": "Esc", "description": "Cerrar modal / cancelar" },
  { "key": "Ctrl/Cmd + K", "description": "Buscar en la ayuda (foco en input)" },
  { "key": "N", "description": "Nuevo gasto (en grupo)" },
  { "key": "G", "description": "Nuevo grupo (en Dashboard)" },
  { "key": "P", "description": "Pagar / Saldos (en grupo)" },
  { "key": "B", "description": "Bote común (en grupo)" },
  { "key": "H", "description": "Historial / Actividad (en grupo)" },
  { "key": "F", "description": "Filtros (en historial)" },
  { "key": "← / →", "description": "Navegar pasos del tutorial (cuando está activo)" },
];

export const iconMeanings: IconMeaning[] = [
  { "icon": "📌", "meaning": "Grupo anclado (fijado arriba)" },
  { "icon": "🟢", "meaning": "Grupo abierto (activo)" },
  { "icon": "🔴", "meaning": "Grupo cerrado (solo lectura)" },
  { "icon": "👑", "meaning": "Administrador del grupo" },
  { "icon": "👤", "meaning": "Miembro normal" },
  { "icon": "👻", "meaning": "Miembro fantasma (sin cuenta)" },
  { "icon": "💰", "meaning": "Saldo positivo (te deben)" },
  { "icon": "💸", "meaning": "Saldo negativo (debes) / Pago" },
  { "icon": "🐷", "meaning": "Bote común" },
  { "icon": "🤝", "meaning": "Pique (entre dos personas)" },
  { "icon": "🔁", "meaning": "Gasto fijo / recurrente" },
  { "icon": "📷", "meaning": "Comprobante / foto adjunta" },
  { "icon": "✅", "meaning": "Confirmado / completado" },
  { "icon": "⏳", "meaning": "Pendiente / en proceso" },
  { "icon": "🔔", "meaning": "Notificaciones (campana)" },
  { "icon": "📌", "meaning": "Anclar / desanclar" },
  { "icon": "⚙️", "meaning": "Ajustes / configuración" },
  { "icon": "📤", "meaning": "Exportar / compartir" },
  { "icon": "🗑️", "meaning": "Eliminar / borrar" },
  { "icon": "✏️", "meaning": "Editar" },
  { "icon": "👁️", "meaning": "Ver detalle" },
  { "icon": "🔍", "meaning": "Buscar / filtros" },
  { "icon": "⇅", "meaning": "Ordenar" },
  { "icon": "📥", "meaning": "Importar / cargar más" },
];

export const expenseCategories: ExpenseCategory[] = [
  { "name": "Comida", "color": "#f97316", "icon": "🍴", "keywords": "cena, comida, almuerzo, desayuno, restaurante, bar, tapas, pizza, burger, sushi, kebab, italiano, chino, mexicano, japonés, tailandés, indio, brunch, merienda, snack, picnic, catering" },
  { "name": "Transporte", "color": "#3b82f6", "icon": "🚌", "keywords": "bus, metro, tren, taxi, uber, cabify, bolt, vueling, iberia, ryanair, avion, avión, parking, gasolina, diesel, peaje, alquiler, coche, bici, patinete, blablacar, renfe, ave, cercanías, tranvía, ferry, barco" },
  { "name": "Ocio", "color": "#8b5cf6", "icon": "🎮", "keywords": "cine, teatro, concierto, festival, museo, exposición, disco, pub, bar, copas, fiesta, bowling, escape room, karaoke, videojuegos, steam, playstation, xbox, nintendo, suscripción, netflix, spotify, hbo, disney+, prime" },
  { "name": "Vivienda", "color": "#10b981", "icon": "🏠", "keywords": "alquiler, hipoteca, comunidad, ibi, basuras, agua, luz, electricidad, gas, internet, wifi, fibra, telefono, teléfono, reparación, arreglo, fontanero, electricista, pintor, mudanza, fianza, depósito, inmobiliaria" },
  { "name": "Salud", "color": "#ef4444", "icon": "💊", "keywords": "farmacia, medico, médico, doctor, hospital, urgencias, dentista, óptica, gafas, lentillas, fisioterapia, psicólogo, terapia, seguro, mutua, receta, medicina, vitaminas, suplementos, análisis, resonancia, tac, ecografía" },
  { "name": "Compras", "color": "#f59e0b", "icon": "🛍️", "keywords": "supermercado, mercadona, lidl, aldi, carrefour, dia, eroski, compra, amazon, zara, h&m, primark, decathlon, ikea, leroy merlin, bricolaje, ropa, zapatos, electrónica, móvil, portátil, regalo, cumpleaños, navidad, reyes, amigo invisible" },
  { "name": "General", "color": "#6b7280", "icon": "💼", "keywords": "otros, varios, miscelánea, general, wallet, efectivo, tarjeta, bizum, transferencia, paypal, revolut, wise, n26, banco, cajero, comisión, tasa, impuesto, multa, seguro, suscripción, servicio, mantenimiento, limpieza, lavandería, tintorería, peluquería, estética, gimnasio, deporte, clase, entrenador" }
];

export const helpSearchIndex = [
  {
    "id": "crear-tu-primer-grupo",
    "title": "Crear tu primer grupo",
    "category": "🚀 Inicio Rápido",
    "categoryId": "sec-1",
    "content": "Pulsa el botón + en el Dashboard. Elige nombre, moneda y tipo: Abierto o Cerrado."
  },
  {
    "id": "anadir-tu-primer-gasto",
    "title": "Añadir tu primer gasto",
    "category": "🚀 Inicio Rápido",
    "categoryId": "sec-1",
    "content": "Entra en tu grupo → Nuevo gasto. Descripción, importe, quién pagó, reparto (Iguales, %, €, Bote)."
  },
  {
    "id": "entender-los-saldos",
    "title": "Entender los saldos (verde/rojo)",
    "category": "🚀 Inicio Rápido",
    "categoryId": "sec-1",
    "content": "Verde = te deben. Rojo = debes. Neto = posición global. Simplificación = menos pagos."
  },
  {
    "id": "pagar-y-cobrar",
    "title": "Pagar y cobrar entre amigos",
    "category": "🚀 Inicio Rápido",
    "categoryId": "sec-1",
    "content": "Saldos → Pagar. Elige a quién, importe sugerido, comprobante opcional. Acreedor confirma."
  },
  {
    "id": "ancla-tus-grupos-con",
    "title": "Ancla tus grupos con 📌",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Menú ⋮ del grupo → Anclar. Los anclados se mantienen arriba ordenados por tu criterio."
  },
  {
    "id": "ordenacion-inteligente",
    "title": "Ordenación inteligente ⇅",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Selector ⇅: por actividad reciente, nombre A–Z, o saldo. Anclados siempre arriba."
  },
  {
    "id": "estado-del-grupo-abierto-o-cerrado",
    "title": "🟢🔴 Estado del grupo: abierto o cerrado",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Abierto = normal. Cerrado = solo lectura. Solo admins cambian estado en Ajustes."
  },
  {
    "id": "ajustes-del-grupo",
    "title": "Ajustes del grupo",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Menú ⋮ → Ajustes: nombre, logo, tipo, invitación, miembros, cerrar/eliminar."
  },
  {
    "id": "filtros-que-si-ayudan",
    "title": "🔍 Filtros que sí ayudan",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Botón 🔍 Filtros: búsqueda texto, chips categoría (Comida, Casa, Transporte, Ocio, Salud, Otros), Mi pagador. Chips activos visibles, botón Limpiar."
  },
  {
    "id": "historial-interactivo",
    "title": "👆 Historial interactivo",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Toca cualquier gasto → ficha completa: importe, pagador, participantes, reparto, comprobante, editar/eliminar."
  },
  {
    "id": "cargar-mas-listas-paginadas",
    "title": "Cargar más: listas paginadas",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Paginación 50 gastos / 100 eventos. Botón Cargar más. Filtros aplican a todo el histórico. Export CSV/PDF = todas las filas."
  },
  {
    "id": "historial-y-auditoria-de-gastos-borrados",
    "title": "Historial y auditoría de gastos borrados",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Gasto borrado = atenuado 50%, tachado, etiqueta Borrado. Auditoría completa siempre."
  },
  {
    "id": "editar-o-borrar-un-gasto",
    "title": "Editar o borrar un gasto",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Historial → ⋮ → Editar/Eliminar. Creador y admins. Saldos se recalculan. Borrado queda en historial."
  },
  {
    "id": "adjuntar-tique-al-registrar-un-pago",
    "title": "Adjuntar tique al registrar un pago",
    "category": "📷 Comprobantes y Autoconfirmación",
    "categoryId": "sec-3c",
    "content": "Saldos → Pagar → Comprobante opcional. Cámara o galería. JPG/PNG máx 5MB. Miniatura en lista."
  },
  {
    "id": "autoconfirmacion-de-pagos-recibidos",
    "title": "Autoconfirmación de pagos recibidos",
    "category": "📷 Comprobantes y Autoconfirmación",
    "categoryId": "sec-3c",
    "content": "Perfil → Ajustes → Autoconfirmar pagos. Pagos recibidos se marcan solos sin confirmar manual."
  },
  {
    "id": "ver-comprobantes",
    "title": "Ver comprobantes adjuntos",
    "category": "📷 Comprobantes y Autoconfirmación",
    "categoryId": "sec-3c",
    "content": "Lista pagos → icono 📎 = tiene comprobante. Click = ver a pantalla completa. También en detalle gasto."
  },
  {
    "id": "categorias-de-gastos",
    "title": "Categorías de gastos",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Cada gasto tiene categoría con icono y color. Detección automática por palabras clave en descripción."
  },
  {
    "id": "deteccion-automatica",
    "title": "Detección automática",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Texto normalizado (minúsculas, sin tildes) vs palabras clave. Primera coincidencia gana. Sin match = General."
  },
  {
    "id": "seleccion-manual",
    "title": "Selección manual",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Chips de categoría en formulario. Pulsa uno = modo manual (fija categoría). Chip Auto = vuelve a automático."
  },
  {
    "id": "iconos-de-modulo-fallbacks",
    "title": "Iconos de módulo (fallbacks)",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Piques 🤝, Bote 🐷, Gastos fijos 🔁, Pagos 💸, Miembros 👥."
  },
  {
    "id": "el-algoritmo-greedy-net-debt-settlement",
    "title": "El algoritmo: Greedy Net Debt Settlement",
    "category": "⚡ Simplificación de Deudas",
    "categoryId": "sec-4",
    "content": "1. Saldo neto por miembro. 2. Deudor paga a mayor acreedor. 3. Mínimas transferencias (máx n-1)."
  },
  {
    "id": "panel-de-desglose",
    "title": "Panel de desglose",
    "category": "⚡ Simplificación de Deudas",
    "categoryId": "sec-4",
    "content": "Saldos → Ver desglose. Lista exacta transferencias. Ej: Car paga €15 a Ana, Diego paga €9 a Ana."
  },
  {
    "id": "simplificacion-activada-por-defecto",
    "title": "Simplificación activada por defecto",
    "category": "⚡ Simplificación de Deudas",
    "categoryId": "sec-4",
    "content": "Activa por defecto en todos los grupos. Desactivable en Ajustes (no recomendado: multiplica pagos)."
  },
  {
    "id": "extracto-contable-del-bote",
    "title": "📒 Extracto contable del bote",
    "category": "🐷 Bote Común y Piques",
    "categoryId": "sec-5",
    "content": "Bote = mini cuenta bancaria. Extracto con aportaciones (+) y pagos (−), saldo acumulado, fecha, concepto. Enlaces a gastos."
  },
  {
    "id": "aportar-al-bote",
    "title": "Aportar al bote",
    "category": "🐷 Bote Común y Piques",
    "categoryId": "sec-5",
    "content": "Pestaña Bote → Aportar. Importe + concepto. Suma a saldo bote y balance miembro (se le debe)."
  },
  {
    "id": "pagar-desde-el-bote",
    "title": "Pagar un gasto desde el bote",
    "category": "🐷 Bote Común y Piques",
    "categoryId": "sec-5",
    "content": "Nuevo gasto → reparto Bote. Importe sale del bote, no de miembros. Para gastos compartidos diarios."
  },
  {
    "id": "piques-informales",
    "title": "Piques informales (entre dos)",
    "category": "🐷 Bote Común y Piques",
    "categoryId": "sec-5",
    "content": "Dashboard → Nuevo pique. Grupo de dos: gastos, saldos, pagos. Para cosas puntuales sin montar grupo."
  },
  {
    "id": "motor-de-automatizacion",
    "title": "Motor de automatización",
    "category": "🔁 Gastos Fijos",
    "categoryId": "sec-6",
    "content": "Cron en servidor revisa gastos fijos con autoregistro. Genera gasto al vencer. Frecuencia: semanal, quincenal, mensual, anual."
  },
  {
    "id": "pausa-y-gestion",
    "title": "Pausa y gestión",
    "category": "🔁 Gastos Fijos",
    "categoryId": "sec-6",
    "content": "Pausar = detiene generación futura. Reanudar = retoma. Eliminar = borra cuota (gastos generados quedan)."
  },
  {
    "id": "crear-gasto-fijo",
    "title": "Crear un gasto fijo",
    "category": "🔁 Gastos Fijos",
    "categoryId": "sec-6",
    "content": "Grupo → Gastos fijos → Nuevo. Nombre, importe, frecuencia, día, categoría, pagador, reparto, participantes, Autoregistro."
  },
  {
    "id": "panel-in-app",
    "title": "Panel in-app (campana 🔔)",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "Campana: 1-9 = número exacto, 10+ = +9. Click notificación = navega instantáneo. Marcar leída individual o «Marcar todas»."
  },
  {
    "id": "notificaciones-nativas-web-push",
    "title": "Notificaciones nativas (Web Push)",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "Activar push → permiso sistema → avisos en SO aunque app cerrada. Instalar app para push nativo (iOS/Android)."
  },
  {
    "id": "ajusta-que-avisos-recibes",
    "title": "Ajusta qué avisos recibes",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "Perfil → Ajustes → Notificaciones. Interruptores por tipo: gasto, pago, pique, invitación, fijo, mención..."
  },
  {
    "id": "tu-tique-guardado-y-privado",
    "title": "Tu tique, guardado y privado",
    "category": "📷 Tiques en la nube y actualización en vivo",
    "categoryId": "sec-9",
    "content": "Foto tique → almacenamiento privado (solo grupo). Enlace temporal 1h. Optimización auto (1200px, <500KB JPEG). JPG/PNG máx 5MB."
  },
  {
    "id": "la-app-se-actualiza-sola",
    "title": "La app se actualiza sola (Tiempo real)",
    "category": "📷 Tiques en la nube y actualización en vivo",
    "categoryId": "sec-9",
    "content": "Tiempo real: gastos, saldos, historial, pagos, notificaciones al instante sin recargar. Fallback: refresh normal al entrar."
  },
  // FAQ entries for search
  { "id": "faq-cuenta-acceso", "title": "Cuenta y acceso", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Cuenta necesaria para sincronizar. Login Google/Apple/email. Recuperar contraseña en login. Datos seguros (Supabase EU, RLS, bcrypt)." },
  { "id": "faq-grupos-miembros", "title": "Grupos y miembros", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Grupos ilimitados. Solo creador elimina. Miembros fantasma = sin cuenta, se vinculan si registran. Cambio admin en Ajustes → Miembros." },
  { "id": "faq-gastos-saldos", "title": "Gastos y saldos", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Saldo no cuadra = revisar categorías, pagos confirmados, gastos borrados. Neto = te deben (verde) / debes (rojo). Reparto desigual con % o €. Sin conversión moneda (1 grupo = 1 moneda)." },
  { "id": "faq-pagos-bote", "title": "Pagos y bote común", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Autoconfirmar = pagos recibidos se marcan solos. Cancelar pago = solo si no confirmado. Bote = fondo compartido, gastos con reparto Bote salen de ahí." },
  { "id": "faq-notificaciones-pwa", "title": "Notificaciones e instalación", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Instalar: iOS Compartir→Pantalla inicio, Android/Escritorio botón Instalar. Offline funciona (ver cargado). Push: ajustes notificaciones + permiso navegador + app instalada." },
  { "id": "faq-tecnico", "title": "Técnico y privacidad", "category": "❓ Preguntas Frecuentes", "categoryId": "faq", "content": "Datos en Supabase EU (Frankfurt), GDPR, RLS, sin venta/publicidad. Exportar CSV/PDF por grupo o JSON completo en Perfil. Eliminar cuenta en Perfil→Ajustes (irreversible). Sin API pública aún." }
];