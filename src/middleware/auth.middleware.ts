import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// Extend Express Request to include the authenticated administrator.
// The property is named `member` for backward compatibility with existing
// admin controllers that read `req.member!.id`.
declare global {
  namespace Express {
    interface Request {
      member?: {
        id: number;
        role: 'administrator';
      };
    }
  }
}

interface JwtTokenPayload {
  sub: number;
  role: 'administrator';
  iat: number;
  exp: number;
}

/**
 * Auth middleware: extracts the JWT from an httpOnly cookie, verifies it,
 * attaches the admin to req, and implements sliding-window token refresh.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret) as unknown as JwtTokenPayload;

    req.member = {
      id: decoded.sub,
      role: decoded.role,
    };

    // Sliding window refresh: reissue if within 5 minutes of expiry.
    const now = Math.floor(Date.now() / 1000);
    const timeToExpiry = decoded.exp - now;
    const FIVE_MINUTES = 5 * 60;

    if (timeToExpiry > 0 && timeToExpiry <= FIVE_MINUTES) {
      const newToken = jwt.sign(
        { sub: decoded.sub, role: decoded.role },
        env.jwt.secret,
        { expiresIn: '30m' }
      );

      res.cookie('token', newToken, {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 30 * 60 * 1000,
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Session expired or invalid' },
    });
  }
};

/**
 * Admin middleware: ensures the authenticated user is an administrator.
 * Must be used after authMiddleware. With admin-only auth, any valid token is
 * an administrator, but this remains as a defensive check.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.member || req.member.role !== 'administrator') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Administrator access required' },
    });
    return;
  }
  next();
};
