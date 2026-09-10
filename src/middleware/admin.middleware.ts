import { Request, Response, NextFunction } from 'express';

/**
 * Admin middleware: checks that the authenticated user has the administrator role.
 * Must be used after authMiddleware.
 */
export const adminMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.member || req.member.role !== 'administrator') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Administrator access required',
      },
    });
    return;
  }

  next();
};
