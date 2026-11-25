import type { NextFunction, Request, Response } from 'express';
import { ApiError, asyncHandler } from '../lib/errors';
import { verifyFirebaseToken } from '../firebase';
import { ensureUserRecord } from '../services/users';
import type { UserStatus } from '../types';

const STATUS_CODE: Record<UserStatus, string> = {
  pending: 'ACCOUNT_PENDING',
  approved: 'ACCOUNT_APPROVED',
  rejected: 'ACCOUNT_REJECTED',
  revoked: 'ACCOUNT_REVOKED',
};

const STATUS_MESSAGE: Record<UserStatus, string> = {
  pending: 'Your account is pending administrator approval.',
  approved: 'Your account is approved.',
  rejected: 'Your account was not approved.',
  revoked: 'Your access has been revoked.',
};

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') return null;
  return token.trim() || null;
}

export async function authenticateRequest(req: Request): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }

  let auth;
  try {
    auth = await verifyFirebaseToken(token);
  } catch {
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'Your session has expired. Please sign in again.'
    );
  }

  if (!auth.emailVerified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Verify your email address before continuing.'
    );
  }

  const user = await ensureUserRecord(auth);
  req.authInfo = auth;
  req.currentUser = user;
}

export const requireAuth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    await authenticateRequest(req);
    const user = req.currentUser;
    if (!user) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    }
    if (user.status !== 'approved') {
      throw new ApiError(403, STATUS_CODE[user.status], STATUS_MESSAGE[user.status]);
    }
    next();
  }
);

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.currentUser || req.currentUser.role !== 'admin') {
    next(new ApiError(403, 'FORBIDDEN', 'Administrator access is required.'));
    return;
  }
  next();
}
