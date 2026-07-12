/**
 * Wrap an async route handler so rejected promises reach Express's error
 * middleware (Express 4 doesn't catch async errors on its own).
 */
import type { Request, RequestHandler, Response } from 'express';

export function asyncHandler(fn: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res).catch(next);
  };
}
