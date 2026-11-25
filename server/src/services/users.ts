import { config } from '../config';
import { collections } from '../db';
import { isDuplicateKeyError } from '../lib/mongo';
import type { AuthInfo, UserDoc } from '../types';

function profileFields(auth: AuthInfo) {
  return {
    email: auth.email,
    displayName: auth.name,
    photoURL: auth.picture,
  };
}

export async function ensureUserRecord(auth: AuthInfo): Promise<UserDoc> {
  const users = collections.users();
  const now = new Date();
  const isBootstrap = Boolean(config.bootstrapAdminUid) && auth.uid === config.bootstrapAdminUid;

  if (isBootstrap) {
    const existing = await users.findOne({ _id: auth.uid });
    if (existing && existing.role === 'admin' && existing.status === 'approved') {
      return existing;
    }
    if (!existing) {
      const doc: UserDoc = {
        _id: auth.uid,
        ...profileFields(auth),
        status: 'approved',
        role: 'admin',
        createdAt: now,
        updatedAt: now,
        approvedAt: now,
        rejectedAt: null,
        revokedAt: null,
        reviewedBy: null,
      };
      try {
        await users.insertOne(doc);
        return doc;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const raced = await users.findOne({ _id: auth.uid });
        if (!raced) throw error;
        return raced;
      }
    }
    await users.updateOne(
      { _id: auth.uid },
      {
        $set: {
          ...profileFields(auth),
          role: 'admin',
          status: 'approved',
          approvedAt: existing.approvedAt ?? now,
          rejectedAt: null,
          revokedAt: null,
          updatedAt: now,
        },
      }
    );
    const updated = await users.findOne({ _id: auth.uid });
    if (!updated) throw new Error('Could not initialize the bootstrap admin account.');
    return updated;
  }

  const existing = await users.findOne({ _id: auth.uid });
  if (existing) return existing;

  const doc: UserDoc = {
    _id: auth.uid,
    ...profileFields(auth),
    status: 'pending',
    role: 'user',
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    rejectedAt: null,
    revokedAt: null,
    reviewedBy: null,
  };
  try {
    await users.insertOne(doc);
    return doc;
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const raced = await users.findOne({ _id: auth.uid });
    if (!raced) throw error;
    return raced;
  }
}

export async function syncUserProfile(auth: AuthInfo): Promise<UserDoc> {
  const users = collections.users();
  const now = new Date();
  await users.updateOne(
    { _id: auth.uid },
    {
      $set: {
        ...profileFields(auth),
        lastSeenAt: now,
        updatedAt: now,
      },
    }
  );
  const user = await users.findOne({ _id: auth.uid });
  if (!user) throw new Error('User record not found.');
  return user;
}

export async function getUserOrThrow(uid: string): Promise<UserDoc> {
  const user = await collections.users().findOne({ _id: uid });
  if (!user) throw new Error('User record not found.');
  return user;
}
