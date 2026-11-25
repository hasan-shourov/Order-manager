import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemoDoc, UserDoc } from '../types';

vi.mock('../firebase', () => ({
  verifyFirebaseToken: vi.fn(),
}));

const OWNER_UID = 'owner-test-uid';
const OTHER_UID = 'regular-test-uid';

process.env.NODE_ENV = 'test';
process.env.MONGODB_DB = 'order_billing_auth_test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/placeholder';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.BOOTSTRAP_ADMIN_UID = OWNER_UID;
process.env.CORS_ORIGINS = '*';
process.env.SERVE_WEB = 'false';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

let memoryServer: MongoMemoryServer;
let dbModule: typeof import('../db');
let authModule: typeof import('../middleware/auth');
let firebaseModule: typeof import('../firebase');

function tokenFor(uid: string, emailVerified: boolean, email = `${uid}@example.com`) {
  vi.mocked(firebaseModule.verifyFirebaseToken).mockResolvedValue({
    uid,
    email,
    name: null,
    picture: null,
    emailVerified,
  });
}

function request(): Request {
  return {
    headers: { authorization: 'Bearer test-token' },
  } as unknown as Request;
}

function run(handler: RequestHandler, req: Request): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      resolve(error);
    };
    try {
      handler(req, {} as Response, ((error?: unknown) => finish(error)) as NextFunction);
    } catch (error) {
      reject(error);
    }
  });
}

async function seedUser(overrides: Partial<UserDoc> & { _id: string }): Promise<void> {
  const now = new Date();
  const doc: UserDoc = {
    email: `${overrides._id}@example.com`,
    displayName: null,
    photoURL: null,
    status: 'pending',
    role: 'user',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    approvedAt: null,
    rejectedAt: null,
    revokedAt: null,
    reviewedBy: null,
    ...overrides,
    _id: overrides._id,
  };
  doc.updatedAt = now;
  await dbModule.collections.users().insertOne(doc);
}

async function loadUser(uid: string): Promise<UserDoc | null> {
  return dbModule.collections.users().findOne({ _id: uid });
}

async function seedMemo(ownerUid: string): Promise<void> {
  const memo: MemoDoc = {
    _id: 'preserved-memo',
    ownerUid,
    memoNumber: 'M-000001',
    sequence: 1,
    clientRequestId: 'preserved-memo-request',
    shopName: 'Existing Shop',
    address: '',
    note: '',
    printHeading: 'Sales Memo',
    lines: [],
    subtotal: 0,
    discountType: 'none',
    discountValue: 0,
    discountAmount: 0,
    totalPayable: 0,
    totalPieces: 0,
    createdAt: CREATED_AT,
    deletedAt: null,
  };
  await dbModule.collections.memos().insertOne(memo);
}

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = memoryServer.getUri();
  dbModule = await import('../db');
  authModule = await import('../middleware/auth');
  firebaseModule = await import('../firebase');
  await dbModule.connectDb();
}, 120_000);

beforeEach(async () => {
  await dbModule.collections.users().deleteMany({});
  await dbModule.collections.memos().deleteMany({});
  vi.clearAllMocks();
});

afterAll(async () => {
  await dbModule?.closeDb();
  await memoryServer?.stop();
}, 30_000);

describe('email verification and owner access', () => {
  it('blocks an unverified approved user before business access', async () => {
    await seedUser({ _id: OTHER_UID, status: 'approved', approvedAt: CREATED_AT });
    tokenFor(OTHER_UID, false);

    const error = await run(authModule.requireAuth, request());

    expect(error).toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('does not promote an unverified owner', async () => {
    await seedUser({ _id: OWNER_UID });
    tokenFor(OWNER_UID, false);

    const error = await run(authModule.requireAuth, request());
    const user = await loadUser(OWNER_UID);

    expect(error).toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
    expect(user?.status).toBe('pending');
    expect(user?.role).toBe('user');
  });

  it('promotes an existing pending owner before the approval check and preserves data', async () => {
    await seedUser({
      _id: OWNER_UID,
      email: 'old-owner@example.com',
      displayName: 'Existing Owner',
    });
    await seedMemo(OWNER_UID);
    tokenFor(OWNER_UID, true, 'owner@example.com');

    const error = await run(authModule.requireAuth, request());
    const user = await loadUser(OWNER_UID);
    const firstApprovedAt = user?.approvedAt;
    const preservedMemos = await dbModule.collections.memos().countDocuments({ ownerUid: OWNER_UID });

    expect(error).toBeUndefined();
    expect(user).toMatchObject({
      status: 'approved',
      role: 'admin',
      email: 'owner@example.com',
      createdAt: CREATED_AT,
    });
    expect(firstApprovedAt).toBeInstanceOf(Date);
    expect(preservedMemos).toBe(1);

    const secondError = await run(authModule.requireAuth, request());
    const again = await loadUser(OWNER_UID);

    expect(secondError).toBeUndefined();
    expect(again?.approvedAt).toEqual(firstApprovedAt);
    expect(again?.status).toBe('approved');
    expect(again?.role).toBe('admin');
  });

  it('keeps a verified non-owner pending and blocks access', async () => {
    await seedUser({ _id: OTHER_UID });
    tokenFor(OTHER_UID, true);

    const error = await run(authModule.requireAuth, request());
    const user = await loadUser(OTHER_UID);

    expect(error).toMatchObject({ status: 403, code: 'ACCOUNT_PENDING' });
    expect(user?.status).toBe('pending');
    expect(user?.role).toBe('user');
  });

  it('allows a verified approved regular user without granting admin access', async () => {
    await seedUser({ _id: OTHER_UID, status: 'approved', approvedAt: CREATED_AT });
    tokenFor(OTHER_UID, true);
    const req = request();

    const authError = await run(authModule.requireAuth, req);
    const adminError = await run(authModule.requireAdmin, req);
    const user = await loadUser(OTHER_UID);

    expect(authError).toBeUndefined();
    expect(adminError).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    expect(user?.role).toBe('user');
  });

  it('allows the verified owner into admin routes', async () => {
    await seedUser({ _id: OWNER_UID });
    tokenFor(OWNER_UID, true);
    const req = request();

    const authError = await run(authModule.requireAuth, req);
    const adminError = await run(authModule.requireAdmin, req);
    const user = await loadUser(OWNER_UID);

    expect(authError).toBeUndefined();
    expect(adminError).toBeUndefined();
    expect(user?.role).toBe('admin');
    expect(user?.status).toBe('approved');
  });
});
