# Workflow

- Después de cada cambio de código: ejecutar typecheck/build (web: `npm run typecheck -w @divido/web`, api: `npm run typecheck -w @divido/api`), luego hacer commit y push a `main` automáticamente.
- El push a `main` despliega en producción (web en Vercel, API en Render). No esperar confirmación del usuario salvo que el cambio sea destructivo o requiera revisión.
- Mensajes de commit en español, descriptivos y siguiendo el estilo del historial.
- No mezclar cambios no relacionados en un mismo commit.
