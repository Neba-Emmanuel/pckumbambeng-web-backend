import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { env } from '../config/env';
import { Admin } from '../models/types';
import { RowDataPacket } from 'mysql2';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const TOKEN_EXPIRY_SECONDS = 30 * 60; // 30 minutes

export interface LoginInput {
  email: string;
  password: string;
}

export interface AdminWithoutPassword {
  id: number;
  name: string;
  email: string;
  role: 'administrator';
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TokenPayload {
  sub: number;
  role: 'administrator';
  iat: number;
  exp: number;
}

function stripPassword(admin: Admin): AdminWithoutPassword {
  const { password_hash, ...rest } = admin;
  return rest;
}

export class AuthService {
  /**
   * Authenticate an administrator with email and password.
   * Handles account lockout, failed attempt tracking, and password verification.
   */
  async login(input: LoginInput): Promise<AdminWithoutPassword> {
    const { email, password } = input;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM members WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      const error = new Error('Invalid email or password');
      (error as any).code = 'INVALID_CREDENTIALS';
      (error as any).statusCode = 401;
      throw error;
    }

    const admin = rows[0] as Admin;

    // Check if account is locked
    if (admin.locked_until) {
      const now = new Date();
      const lockedUntil = new Date(admin.locked_until);

      if (lockedUntil > now) {
        const remainingMs = lockedUntil.getTime() - now.getTime();
        const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));

        const error = new Error(
          `Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`
        );
        (error as any).code = 'ACCOUNT_LOCKED';
        (error as any).statusCode = 423;
        (error as any).remainingMinutes = remainingMinutes;
        throw error;
      }
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      const newFailedAttempts = admin.failed_login_attempts + 1;

      if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
        await pool.query(
          `UPDATE members SET failed_login_attempts = ?, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE), updated_at = NOW() WHERE id = ?`,
          [newFailedAttempts, LOCKOUT_DURATION_MINUTES, admin.id]
        );
      } else {
        await pool.query(
          'UPDATE members SET failed_login_attempts = ?, updated_at = NOW() WHERE id = ?',
          [newFailedAttempts, admin.id]
        );
      }

      const error = new Error('Invalid email or password');
      (error as any).code = 'INVALID_CREDENTIALS';
      (error as any).statusCode = 401;
      throw error;
    }

    await pool.query(
      'UPDATE members SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = ?',
      [admin.id]
    );

    return stripPassword({ ...admin, failed_login_attempts: 0, locked_until: null });
  }

  /**
   * Issue a JWT token for an authenticated administrator.
   * Token payload: { sub: admin.id, role: 'administrator', iat, exp }. Expiry: 30 minutes.
   */
  issueToken(admin: { id: number }): string {
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = {
      sub: admin.id,
      role: 'administrator',
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS,
    };

    return jwt.sign(payload, env.jwt.secret);
  }
}

export const authService = new AuthService();
