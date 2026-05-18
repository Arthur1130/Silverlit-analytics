import type { Request, Response, NextFunction, RequestHandler } from 'express';

// Erreur HTTP applicative avec code de statut explicite
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Enveloppe un handler async pour router les rejets vers le gestionnaire d'erreurs
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Gestionnaire d'erreurs centralisé
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('[error]', err);
  return res.status(500).json({ error: 'Erreur interne du serveur' });
}
