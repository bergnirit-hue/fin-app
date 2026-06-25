import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextApiRequest, NextApiResponse } from 'next';
import { randomBytes } from 'crypto';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const TOKEN_COOKIE = 'auth_token';
const TOKEN_EXPIRY = '7d';
const TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export interface TokenPayload {
  userId: string;
  email: string;
  householdId?: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'passwordTooShort';
  if (!/[A-Z]/.test(password)) return 'passwordNoUppercase';
  if (!/[a-z]/.test(password)) return 'passwordNoLowercase';
  if (!/[0-9]/.test(password)) return 'passwordNoNumber';
  return null;
}

export function createToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET!, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET!) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: NextApiResponse, token: string): void {
  res.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );
}

export function clearAuthCookie(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${TOKEN_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`
  );
}

export function getTokenFromRequest(req: NextApiRequest): string | null {
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.split(';').find((c) => c.trim().startsWith(`${TOKEN_COOKIE}=`));
    if (match) {
      return match.split('=')[1].trim();
    }
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export function extractUserFromRequest(req: NextApiRequest): TokenPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}
