export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg, "BAD_REQUEST");
export const unauthorized = (msg = "No autenticado") => new HttpError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "Permiso denegado") => new HttpError(403, msg, "FORBIDDEN");
export const notFound = (msg = "No encontrado") => new HttpError(404, msg, "NOT_FOUND");
export const conflict = (msg: string) => new HttpError(409, msg, "CONFLICT");
export const unavailable = (msg: string) => new HttpError(503, msg, "SERVICE_UNAVAILABLE");
