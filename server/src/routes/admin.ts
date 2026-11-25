import { Router } from 'express';
import { collections } from '../db';
import { ApiError, asyncHandler } from '../lib/errors';
import { serializeUser } from '../services/serialize';
import type { UserDoc, UserStatus } from '../types';

const router = Router();

const STATUS_ORDER: Record<UserStatus, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  revoked: 3,
};

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await collections.users().find({}).toArray();
    users.sort((a, b) => {
      const rankDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (rankDiff !== 0) return rankDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    res.json({ users: users.map(serializeUser) });
  })
);

async function loadTarget(uid: string): Promise<UserDoc> {
  const target = await collections.users().findOne({ _id: uid });
  if (!target) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'That account could not be found.');
  }
  return target;
}

function assertManageable(req: Express.Request, target: UserDoc): void {
  if (!req.currentUser) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  if (req.currentUser._id === target._id) {
    throw new ApiError(400, 'SELF_ACTION', 'You cannot change your own access.');
  }
  if (target.role === 'admin') {
    throw new ApiError(400, 'ADMIN_ACTION', 'Administrator accounts cannot be changed here.');
  }
}

router.post(
  '/users/:uid/approve',
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.uid ?? '');
    assertManageable(req, target);
    if (target.status === 'approved') {
      res.json({ user: serializeUser(target) });
      return;
    }
    const now = new Date();
    await collections.users().updateOne(
      { _id: target._id },
      {
        $set: {
          status: 'approved',
          approvedAt: now,
          rejectedAt: null,
          revokedAt: null,
          reviewedBy: req.currentUser?._id ?? null,
          updatedAt: now,
        },
      }
    );
    const updated = await loadTarget(target._id);
    res.json({ user: serializeUser(updated) });
  })
);

router.post(
  '/users/:uid/reject',
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.uid ?? '');
    assertManageable(req, target);
    if (target.status === 'rejected') {
      res.json({ user: serializeUser(target) });
      return;
    }
    const now = new Date();
    await collections.users().updateOne(
      { _id: target._id },
      {
        $set: {
          status: 'rejected',
          rejectedAt: now,
          approvedAt: null,
          reviewedBy: req.currentUser?._id ?? null,
          updatedAt: now,
        },
      }
    );
    const updated = await loadTarget(target._id);
    res.json({ user: serializeUser(updated) });
  })
);

router.post(
  '/users/:uid/revoke',
  asyncHandler(async (req, res) => {
    const target = await loadTarget(req.params.uid ?? '');
    assertManageable(req, target);
    if (target.status === 'revoked') {
      res.json({ user: serializeUser(target) });
      return;
    }
    if (target.status !== 'approved') {
      throw new ApiError(409, 'NOT_APPROVED', 'Only approved accounts can be revoked.');
    }
    const now = new Date();
    await collections.users().updateOne(
      { _id: target._id },
      {
        $set: {
          status: 'revoked',
          revokedAt: now,
          reviewedBy: req.currentUser?._id ?? null,
          updatedAt: now,
        },
      }
    );
    const updated = await loadTarget(target._id);
    res.json({ user: serializeUser(updated) });
  })
);

export default router;

