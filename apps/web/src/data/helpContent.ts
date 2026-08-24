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
    "articles": []
  },
  {
    "id": "sec-2",
    "title": "📊 Dashboard y Grupos",
    "articles": [
      {
        "id": "ancla-tus-grupos-con",
        "title": "Ancla tus grupos con 📌",
        "content": "Los grupos que más uses pueden quedar fijados arriba para tenerlos siempre a mano:",
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
        "content": "Cada grupo tiene un estado que indica si está en marcha o en pausa: Abierto 🟢 — funcionamiento normal: gastos, piques, pagos y aportaciones al bote fluyen sin restricciones. Cerrado 🔴 — el grupo queda en solo lectura: nadie crea ni modifica movimientos hasta reabrirlo. Ideal al terminar un viaje o una convivencia y querer conservar las cuentas tal cual. Solo un administrador puede cambiarlo desde Ajustes del grupo, con el botón Cerrar grupo / Reabrir grupo. Aparece una pantalla «Cerrando…» mientras se aplica el cambio, y el estado queda visible en la cabecera del grupo para todos los miembros.",
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
        "content": "Pulsa el botón único 🔍 Filtros sobre el historial: dentro conviven la búsqueda por texto y los chips de categoría en español — Comida 🍕 · Casa 🏠 · Transporte 🚗 · Ocio 🎮 · Salud 💊 · Otros — en una tira deslizable en horizontal en móvil. Activa también Mi pagador para ver solo lo que pagaste tú. Los filtros activos quedan como chips visibles encima de la lista, con un botón Limpiar para quitarlos todos de golpe.",
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
        "content": "En grupos con mucha actividad, las pestañas de Gastos y Actividad cargan por páginas (50 gastos y 100 eventos) para que la app siga siendo rápida. Al final de cada lista verás el botón «Cargar más»: púlsalo tantas veces como quieras para ir trayendo el resto del histórico. Los filtros y la búsqueda se aplican a todo el histórico, no solo a la página visible, y los elementos ya cargados permanecen en pantalla al recargar. Si exportas un CSV o PDF, recibirás siempre todas las filas, no solo las visibles.",
        "category": "sec-3",
        "faqs": []
      },
      {
        "id": "historial-y-auditoria-de-gastos-borrados",
        "title": "Historial y auditoría de gastos borrados",
        "content": "Un gasto eliminado nunca desaparece del historial: se atenúa visualmente (opacity 50%), se tacha y se etiqueta como Borrado. Así el historial es una auditoría completa y siempre puedes reconstruir qué pasó.",
        "category": "sec-3",
        "faqs": []
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
        "content": "Al crear un pago (pestaña Saldos → Pagar), aparece un área opcional «Comprobante (opcional)». Puedes: Hacer foto con la cámara del móvil (captura directa). Subir imagen desde la galería (JPG/PNG, máx. 5 MB). Ver miniatura del comprobante en el listado de pagos; click para ampliar a pantalla completa. > **Ejemplo** Pagas tu parte de la cena y subes la foto del ticket del restaurante. El comprobante queda vinculado al pago y visible para el acreedor.",
        "category": "sec-3c",
        "faqs": []
      },
      {
        "id": "autoconfirmacion-de-pagos-recibidos",
        "title": "Autoconfirmación de pagos recibidos",
        "content": "En Perfil → Ajustes → Autoconfirmar pagos puedes activar un interruptor que hace que cualquier pago que recibas se marque automáticamente como confirmado sin esperar a que tú lo apruebes manualmente.",
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
        "content": "Al escribir la descripción del gasto, la app compara el texto (normalizado: minúsculas, sin tildes) con las palabras clave de cada categoría. La primera categoría con coincidencias gana. Si no hay coincidencias, se usa General (wallet). > **Ejemplo** Escribes «Cena con los compis en el italiano». Palabras detectadas: cena, italiano → Categoría Comida, icono utensils naranja.",
        "category": "sec-3b",
        "faqs": []
      },
      {
        "id": "seleccion-manual",
        "title": "Selección manual",
        "content": "En el formulario del gasto hay una fila de chips de categoría. Al pulsar uno, la categoría se fija (modo manual) y deja de detectarse automáticamente aunque cambies la descripción. Para volver al modo automático, pulsa el chip Auto.",
        "category": "sec-3b",
        "faqs": []
      },
      {
        "id": "iconos-de-modulo-fallbacks",
        "title": "Iconos de módulo (fallbacks)",
        "content": "Además de los gastos, los otros módulos tienen su icono fijo:",
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
        "content": "Divido aplica un algoritmo voraz de saldo neto (Greedy Net Debt Settlement): Se calcula lo que cada miembro gana o pierde en total. 2 · Deudores → acreedores Cada deudor paga a quien más crédito tiene, en orden. 3 · Transferencias mínimas El menor número posible de pagos para dejar todo a cero.",
        "category": "sec-4",
        "faqs": []
      },
      {
        "id": "panel-de-desglose",
        "title": "Panel de desglose",
        "content": "Ana+€24.00te deben €24.00 Bea€0.00saldado Car−€15.00debe €15.00 Diego−€9.00debe €9.00 ResultadoEn lugar de 6 pagos cruzados, solo hace falta un pago: Car paga €15.00 a Ana y Diego paga €9.00 a Ana.",
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
        "content": "El bote funciona como una mini cuenta bancaria: su pantalla muestra un extracto con cada movimiento — aportación (+) o pago realizado desde el bote (−) — junto al saldo acumulado tras cada operación, la fecha y el concepto. Los movimientos ligados a un gasto actúan como enlaces: tócalos y saltas directo al gasto correspondiente del historial.",
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
        "content": "Un proceso que se ejecuta en el servidor (vía cron, periódicamente) revisa todos los gastos fijos activos con autoregistro y genera automáticamente el gasto cuando vence su fecha. Tú solo eliges:",
        "category": "sec-6",
        "faqs": []
      },
      {
        "id": "pausa-y-gestion",
        "title": "Pausa y gestión",
        "content": "Pausar: detiene la generación futura sin borrar la configuración. Ideal para vacaciones. Reanudar: vuelve a activar la cuota; el motor la retoma. Eliminar: borra la cuota de forma definitiva. Los gastos ya generados se mantienen en el historial. > **Truco** Si una cuota se genera por error (por ejemplo, un importe mal configurado), elimina el gasto como cualquier otro: aparecerá atenuado en el historial para auditoría (ver Sección 3).",
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
        "title": "Panel in-app",
        "content": "La campana muestra el número de avisos sin leer: del 1 al 9 se ve el número exacto y a partir de 10 se muestra +9. Al pulsar una notificación, navegas al instante (al grupo, gasto o pago relacionado) y la lectura se marca en segundo plano: experiencia optimista, sin esperas. En el panel puedes marcar como leída una notificación individual con el botón de la derecha, o usar «Marcar todas como leídas» para limpiar el contador de golpe. El icono de ajustes de la cabecera te lleva directo al perfil, donde puedes elegir qué avisos recibes (más abajo). Cuando no hay avisos, el panel muestra un mensaje vacío: todo está al día.",
        "category": "sec-7",
        "faqs": []
      },
      {
        "id": "notificaciones-nativas-web-push",
        "title": "Notificaciones nativas (Web Push)",
        "content": "Cuando activas el push, las notificaciones llegan al sistema operativo: verás el aviso en la pantalla del móvil o del escritorio, aunque la app esté cerrada. Toca «Activar»Banner del dashboard o Ajustes 2Acepta el permisoDiálogo del sistema 3ListoRecibes avisos nativos > **Consejo** Para no perderte nada, instala la app: en iOS usa «Compartir → Añadir a pantalla de inicio»; en Android y escritorio usa el botón Instalar del navegador. Así Divido se abre a pantalla completa como una app nativa. > **Nota** Si deniegas el permiso, el navegador no podrá volver a preguntártelo automáticamente. Puedes reactivarlo desde los ajustes del navegador (sección de notificaciones del sitio).",
        "category": "sec-7",
        "faqs": []
      },
      {
        "id": "ajusta-que-avisos-recibes",
        "title": "Ajusta qué avisos recibes",
        "content": "No todo el mundo quiere enterarse de todo. Abre Perfil → Ajustes y, en la sección Notificaciones, activa o desactiva cada tipo de aviso con un interruptor. Los cambios se guardan al instante y se aplican al panel in-app y al push.",
        "category": "sec-7",
        "faqs": []
      }
    ]
  },
  {
    "id": "sec-8",
    "title": "❓ Preguntas Frecuentes",
    "articles": []
  },
  {
    "id": "sec-9",
    "title": "📷 Tiques en la nube y actualización en vivo",
    "articles": [
      {
        "id": "tu-tique-guardado-y-privado",
        "title": "Tu tique, guardado y privado",
        "content": "Cuando adjuntas una foto del tique al crear o editar un gasto, esta se sube a un almacenamiento privado: nunca es pública ni accesible por quien no pertenece al grupo. Al verla (botón tique en la lista de gastos), la app genera un enlace temporal que caduca en 1 hora; si vuelve a pulsarse, se genera uno nuevo automáticamente. Adjunta la foto desde tu galería o archivos: cada imagen se optimiza sola antes de subirse (máximo 1200 px, JPEG comprimido por debajo de ~500 KB), así va ligera y tu móvil no se ahoga. Las fotos de perfil y logos de grupo se aligeran igual (hasta 512 px). Solo se aceptan imágenes JPG o PNG de hasta 5 MB. Los tiques antiguos siguen viéndose igual. Si pierdes conexión durante la subida, te avisamos y puedes reintentarlo; el gasto no se registra sin el tique que pediste. > **Ejemplo** Añades «Cena italiana» con la foto del ticket: mientras ves la barra Subiendo tique…, la imagen viaja cifrada a la nube. Tu compañero abre el gasto dos días después y ve la foto nítida, aunque haya cambiado de móvil.",
        "category": "sec-9",
        "faqs": []
      },
      {
        "id": "la-app-se-actualiza-sola",
        "title": "La app se actualiza sola",
        "content": "Gastos, saldos e historial: si alguien del grupo añade, edita o elimina un gasto (o aprueba una solicitud), lo verás al momento sin recargar la página. Pagos entre miembros: cuando te envían o confirman un pago, tu balance se refresca solo. Campana 🔔: los avisos nuevos aparecen al instante, sin esperar al minuto siguiente. Nada cambia en cómo haces las cosas: sigues tocando los mismos botones; simplemente todo llega antes. > **Nota** Si tu navegador bloquea conexiones en tiempo real, Divido sigue funcionando con normalidad: los datos se refrescan como siempre al entrar en cada pantalla.",
        "category": "sec-9",
        "faqs": []
      }
    ]
  }
];

export const keyboardShortcuts: KeyboardShortcut[] = [];

export const iconMeanings: IconMeaning[] = [];

export const expenseCategories: ExpenseCategory[] = [
  {
    "name": "Comida",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "Transporte",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "Ocio",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "Vivienda",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "Salud",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "Compras",
    "color": "",
    "icon": "",
    "keywords": ""
  },
  {
    "name": "General",
    "color": "",
    "icon": "",
    "keywords": ""
  }
];

export const helpSearchIndex = [
  {
    "id": "ancla-tus-grupos-con",
    "title": "Ancla tus grupos con 📌",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Los grupos que más uses pueden quedar fijados arriba para tenerlos siempre a mano:"
  },
  {
    "id": "ordenacion-inteligente",
    "title": "Ordenación inteligente ⇅",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Ordena tu lista de grupos por el selector ⇅: por actividad reciente, por nombre (A–Z) o por saldo. Los grupos anclados siempre se mantienen por encima del resto, ordenados según este criterio."
  },
  {
    "id": "estado-del-grupo-abierto-o-cerrado",
    "title": "🟢🔴 Estado del grupo: abierto o cerrado",
    "category": "📊 Dashboard y Grupos",
    "categoryId": "sec-2",
    "content": "Cada grupo tiene un estado que indica si está en marcha o en pausa: Abierto 🟢 — funcionamiento normal: gastos, piques, pagos y aportaciones al bote fluyen sin restricciones. Cerrado 🔴 — el grupo que"
  },
  {
    "id": "filtros-que-si-ayudan",
    "title": "🔍 Filtros que sí ayudan",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Pulsa el botón único 🔍 Filtros sobre el historial: dentro conviven la búsqueda por texto y los chips de categoría en español — Comida 🍕 · Casa 🏠 · Transporte 🚗 · Ocio 🎮 · Salud 💊 · Otros — en un"
  },
  {
    "id": "historial-interactivo",
    "title": "👆 Historial interactivo",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Toca cualquier gasto del historial y se abre su ficha completa: importe, pagador, participantes, reparto, comprobante adjunto y acciones disponibles según tus permisos (editar o eliminar). Cada línea "
  },
  {
    "id": "cargar-mas-listas-paginadas",
    "title": "Cargar más: listas paginadas",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "En grupos con mucha actividad, las pestañas de Gastos y Actividad cargan por páginas (50 gastos y 100 eventos) para que la app siga siendo rápida. Al final de cada lista verás el botón «Cargar más»: p"
  },
  {
    "id": "historial-y-auditoria-de-gastos-borrados",
    "title": "Historial y auditoría de gastos borrados",
    "category": "🧾 Gastos e Historial",
    "categoryId": "sec-3",
    "content": "Un gasto eliminado nunca desaparece del historial: se atenúa visualmente (opacity 50%), se tacha y se etiqueta como Borrado. Así el historial es una auditoría completa y siempre puedes reconstruir qué"
  },
  {
    "id": "adjuntar-tique-al-registrar-un-pago",
    "title": "Adjuntar tique al registrar un pago",
    "category": "📷 Comprobantes y Autoconfirmación",
    "categoryId": "sec-3c",
    "content": "Al crear un pago (pestaña Saldos → Pagar), aparece un área opcional «Comprobante (opcional)». Puedes: Hacer foto con la cámara del móvil (captura directa). Subir imagen desde la galería (JPG/PNG, máx."
  },
  {
    "id": "autoconfirmacion-de-pagos-recibidos",
    "title": "Autoconfirmación de pagos recibidos",
    "category": "📷 Comprobantes y Autoconfirmación",
    "categoryId": "sec-3c",
    "content": "En Perfil → Ajustes → Autoconfirmar pagos puedes activar un interruptor que hace que cualquier pago que recibas se marque automáticamente como confirmado sin esperar a que tú lo apruebes manualmente."
  },
  {
    "id": "categorias-de-gastos",
    "title": "Categorías de gastos",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Cada gasto pertenece a una categoría que define su icono y color. La app detecta la categoría automáticamente a partir de la descripción (título) del gasto, buscando palabras clave. Si la detección no"
  },
  {
    "id": "deteccion-automatica",
    "title": "Detección automática",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Al escribir la descripción del gasto, la app compara el texto (normalizado: minúsculas, sin tildes) con las palabras clave de cada categoría. La primera categoría con coincidencias gana. Si no hay coi"
  },
  {
    "id": "seleccion-manual",
    "title": "Selección manual",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "En el formulario del gasto hay una fila de chips de categoría. Al pulsar uno, la categoría se fija (modo manual) y deja de detectarse automáticamente aunque cambies la descripción. Para volver al modo"
  },
  {
    "id": "iconos-de-modulo-fallbacks",
    "title": "Iconos de módulo (fallbacks)",
    "category": "🏷️ Categorías e Iconos",
    "categoryId": "sec-3b",
    "content": "Además de los gastos, los otros módulos tienen su icono fijo:"
  },
  {
    "id": "el-algoritmo-greedy-net-debt-settlement",
    "title": "El algoritmo: Greedy Net Debt Settlement",
    "category": "⚡ Simplificación de Deudas",
    "categoryId": "sec-4",
    "content": "Divido aplica un algoritmo voraz de saldo neto (Greedy Net Debt Settlement): Se calcula lo que cada miembro gana o pierde en total. 2 · Deudores → acreedores Cada deudor paga a quien más crédito tiene"
  },
  {
    "id": "panel-de-desglose",
    "title": "Panel de desglose",
    "category": "⚡ Simplificación de Deudas",
    "categoryId": "sec-4",
    "content": "Ana+€24.00te deben €24.00 Bea€0.00saldado Car−€15.00debe €15.00 Diego−€9.00debe €9.00 ResultadoEn lugar de 6 pagos cruzados, solo hace falta un pago: Car paga €15.00 a Ana y Diego paga €9.00 a Ana."
  },
  {
    "id": "extracto-contable-del-bote",
    "title": "📒 Extracto contable del bote",
    "category": "🐷 Bote Común y Piques",
    "categoryId": "sec-5",
    "content": "El bote funciona como una mini cuenta bancaria: su pantalla muestra un extracto con cada movimiento — aportación (+) o pago realizado desde el bote (−) — junto al saldo acumulado tras cada operación, "
  },
  {
    "id": "motor-de-automatizacion",
    "title": "Motor de automatización",
    "category": "🔁 Gastos Fijos",
    "categoryId": "sec-6",
    "content": "Un proceso que se ejecuta en el servidor (vía cron, periódicamente) revisa todos los gastos fijos activos con autoregistro y genera automáticamente el gasto cuando vence su fecha. Tú solo eliges:"
  },
  {
    "id": "pausa-y-gestion",
    "title": "Pausa y gestión",
    "category": "🔁 Gastos Fijos",
    "categoryId": "sec-6",
    "content": "Pausar: detiene la generación futura sin borrar la configuración. Ideal para vacaciones. Reanudar: vuelve a activar la cuota; el motor la retoma. Eliminar: borra la cuota de forma definitiva. Los gast"
  },
  {
    "id": "panel-in-app",
    "title": "Panel in-app",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "La campana muestra el número de avisos sin leer: del 1 al 9 se ve el número exacto y a partir de 10 se muestra +9. Al pulsar una notificación, navegas al instante (al grupo, gasto o pago relacionado) "
  },
  {
    "id": "notificaciones-nativas-web-push",
    "title": "Notificaciones nativas (Web Push)",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "Cuando activas el push, las notificaciones llegan al sistema operativo: verás el aviso en la pantalla del móvil o del escritorio, aunque la app esté cerrada. Toca «Activar»Banner del dashboard o Ajust"
  },
  {
    "id": "ajusta-que-avisos-recibes",
    "title": "Ajusta qué avisos recibes",
    "category": "🔔 Notificaciones PWA",
    "categoryId": "sec-7",
    "content": "No todo el mundo quiere enterarse de todo. Abre Perfil → Ajustes y, en la sección Notificaciones, activa o desactiva cada tipo de aviso con un interruptor. Los cambios se guardan al instante y se apli"
  },
  {
    "id": "tu-tique-guardado-y-privado",
    "title": "Tu tique, guardado y privado",
    "category": "📷 Tiques en la nube y actualización en vivo",
    "categoryId": "sec-9",
    "content": "Cuando adjuntas una foto del tique al crear o editar un gasto, esta se sube a un almacenamiento privado: nunca es pública ni accesible por quien no pertenece al grupo. Al verla (botón tique en la list"
  },
  {
    "id": "la-app-se-actualiza-sola",
    "title": "La app se actualiza sola",
    "category": "📷 Tiques en la nube y actualización en vivo",
    "categoryId": "sec-9",
    "content": "Gastos, saldos e historial: si alguien del grupo añade, edita o elimina un gasto (o aprueba una solicitud), lo verás al momento sin recargar la página. Pagos entre miembros: cuando te envían o confirm"
  },
  {
    "id": "faq-0",
    "title": "Pregunta 1",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-1",
    "title": "Pregunta 2",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-2",
    "title": "Pregunta 3",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-3",
    "title": "Pregunta 4",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-4",
    "title": "Pregunta 5",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-5",
    "title": "Pregunta 6",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-6",
    "title": "Pregunta 7",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-7",
    "title": "Pregunta 8",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-8",
    "title": "Pregunta 9",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-9",
    "title": "Pregunta 10",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-10",
    "title": "Pregunta 11",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-11",
    "title": "Pregunta 12",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-12",
    "title": "Pregunta 13",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-13",
    "title": "Pregunta 14",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  },
  {
    "id": "faq-14",
    "title": "Pregunta 15",
    "category": "Preguntas Frecuentes",
    "categoryId": "faq",
    "content": ""
  }
];
