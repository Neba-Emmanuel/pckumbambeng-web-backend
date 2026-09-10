import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Creates a simple in-memory rate limiter middleware.
 * @param maxRequests - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  // Clean up expired entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, windowMs);
  cleanupInterval.unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      // First request or window expired: start fresh
      store.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
        },
      });
      return;
    }

    entry.count++;
    next();
  };
}

/**
 * General rate limiter: 100 requests per minute per IP.
 */
export const generalRateLimit = createRateLimiter(100, 60 * 1000);

/**
 * Auth rate limiter: 10 requests per minute per IP.
 * Applied to login and registration endpoints.
 */
export const authRateLimit = createRateLimiter(10, 60 * 1000);
