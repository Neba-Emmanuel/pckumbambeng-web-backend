import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { authService } from '../services/auth.service';
import { loginSchema } from '../models/schemas';
import { env } from '../config/env';
import { pool } from '../config';
import { RowDataPacket } from 'mysql2';
import { ApiErrorResponse, ApiSuccessResponse } from '../models/responses';

/**
 * POST /api/auth/login
 * Authenticate a member, set JWT cookie.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const parsed = loginSchema.parse(req.body);

    // Call auth service to login
    const member = await authService.login(parsed);

    // Issue JWT token
    const token = authService.issueToken({ id: member.id });

    // Set httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
      maxAge: 30 * 60 * 1000, // 30 minutes
    });

    res.status(200).json({
      success: true,
      data: member,
    } as ApiSuccessResponse<typeof member>);
  } catch (error: any) {
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.');
        details[field] = issue.message;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login data',
          details,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

    if (error.code === 'ACCOUNT_LOCKED') {
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: error.message,
        },
      } as ApiErrorResponse);
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * POST /api/auth/logout
 * Clear the authentication cookie.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      success: true,
      data: { message: 'Logged out' },
    } as ApiSuccessResponse<{ message: string }>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}

/**
 * GET /api/auth/me
 * Return the currently authenticated member's info.
 * Requires authMiddleware to be applied before this handler.
 */
export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.member) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      } as ApiErrorResponse);
      return;
    }

    // Fetch full member info from DB (without password)
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, role, created_at, updated_at FROM members WHERE id = ?',
      [req.member.id]
    );

    if (rows.length === 0) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Member not found',
        },
      } as ApiErrorResponse);
      return;
    }

    const member = rows[0];

    res.status(200).json({
      success: true,
      data: member,
    } as ApiSuccessResponse<typeof member>);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    } as ApiErrorResponse);
  }
}
