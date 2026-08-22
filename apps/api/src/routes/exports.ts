import { PassThrough } from "node:stream";
import type { FastifyPluginAsync } from "fastify";
import { countExpensesInGroup, getGroup, listExpensesWithDetails, listMembers } from "../store.js";
import { requireActiveMember } from "../plugins.js";

// Lotes de lectura: el informe se escribe por chunks y la memoria del
// servidor se mantiene plana aunque el grupo tenga cientos de miles de filas.
const BATCH_SIZE = 1000;

const CATEGORY_LABELS: Record<string, string> = {
  food: "Comida",
  transport: "Transporte",
  leisure: "Ocio",
  housing: "Vivienda",
  health: "Salud",
  shopping: "Compras",
  general: "General",
  coffee: "Café",
  pets: "Mascotas",
  streaming: "Streaming",
  sports: "Deportes",
  events: "Eventos",
  family: "Familia",
  pot: "Bote común",
  bet: "Pique",
  recurring: "Recurrente",
};

function csvEscape(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt2 = (n: number) => n.toFixed(2).replace(".", ",");
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("es-ES");
  } catch {
    return iso?.slice(0, 10) ?? "";
  }
};

interface ParticipantJson {
  userId: string;
  share?: number | null;
}

export const exportRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/groups/:groupId/export.csv",
    {
      config: {
        // Exportar es caro: límite específico más estricto que el global.
        rateLimit: {
          max: Number(process.env.EXPORT_RATE_LIMIT_MAX ?? 3),
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { groupId } = request.params as { groupId: string };
      await requireActiveMember(request, groupId);

      const group = await getGroup(request.db, groupId);
      const groupName = group?.name || "Grupo";
      const sym = group?.currency ?? "EUR";
      const members = await listMembers(request.db, groupId);
      const nameOf = (id: string | null | undefined) =>
        (id ? members.find((m) => m.user_id === id)?.name : null) ?? "Desconocido";

      const total = await countExpensesInGroup(request.db, groupId, false);
      const sumRow = await request.db
        .prepare("SELECT COALESCE(SUM(amount_group), 0) AS total FROM expenses WHERE group_id = ? AND deleted = 0")
        .get(groupId);
      const sum = Number((sumRow as { total?: number | string } | undefined)?.total ?? 0);

      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header(
        "Content-Disposition",
        `attachment; filename="divido-${groupName.replace(/[^\w-]+/g, "_")}.csv"`
      );

      const stream = new PassThrough();
      void (async () => {
        try {
          stream.write("\uFEFF");
          stream.write(`INFORME DE GASTOS COMPARTIDOS - ${groupName}\r\n`);
          stream.write(`Fecha de emisión: ${new Date().toLocaleDateString("es-ES")} ; Creado con Divido\r\n`);
          stream.write(`Total acumulado: ${fmt2(sum)} ${sym} ; Gastos registrados: ${total}\r\n`);
          stream.write("\r\n");
          stream.write(
            ["FECHA", "CONCEPTO", "CATEGORÍA", "PAGADO POR", `IMPORTE (${sym})`, "PARTICIPANTES", `CUOTA POR PERSONA (${sym})`].join(";") +
              "\r\n"
          );

          for (let offset = 0; ; offset += BATCH_SIZE) {
            const batch = await listExpensesWithDetails(request.db, groupId, false, {
              limit: BATCH_SIZE,
              offset,
            });
            if (batch.length === 0) break;
            for (const e of batch) {
              let participants: ParticipantJson[] = [];
              try {
                participants = JSON.parse(e.participants_json ?? "[]") as ParticipantJson[];
              } catch {
                participants = [];
              }
              const names = participants.map((p) => nameOf(p.userId)).join(", ");
              const numPersonas =
                participants.length > 0 ? participants.length : 1;
              const importeGrupo = typeof e.amount_group === "number" ? e.amount_group : Number(e.amount_group) || 0;
              stream.write(
                [
                  e.created_at ? fmtDate(e.created_at) : "",
                  csvEscape(cap(e.description || "Sin concepto")),
                  CATEGORY_LABELS[e.category] ?? e.category,
                  csvEscape(e.payer_name || nameOf(e.payer_id)),
                  fmt2(importeGrupo),
                  csvEscape(names),
                  fmt2(importeGrupo / numPersonas),
                ].join(";") + "\r\n"
              );
            }
            if (batch.length < BATCH_SIZE) break;
          }
          stream.end();
        } catch (err) {
          app.log.error({ err }, "export.csv: fallo durante el streaming");
          stream.destroy();
        }
      })();

      return reply.send(stream);
    }
  );
};
