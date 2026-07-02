import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not forward async handler rejections to `next()` on its
 * own — wrap async handlers so thrown/rejected errors reach the centralized
 * error handler instead of crashing the process.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
