#!/usr/bin/env node
/*
 * Live end-to-end smoke test.
 *
 * It creates temporary Firebase email/password users via the Firebase REST API,
 * starts the built server against a temporary MongoDB database, exercises the
 * API, and then removes the temporary users and database.
 *
 * Requirements:
 *   - npm run build (so server/dist exists)
 *   - server/.env with FIREBASE_PROJECT_ID (and MONGODB_URI unless E2E_USE_MEMORY_DB=1)
 *   - web/.env with VITE_FIREBASE_API_KEY
 *   - Email/Password sign-in enabled in Firebase Authentication
 *   - Optional: Firebase Admin service-account credentials to mark test users verified.
 *     Without them, only live unverified-token enforcement is checked.
 *
 * Run: npm run test:e2e --workspace server
 * Optional: E2E_USE_MEMORY_DB=1 starts a temporary local MongoDB instead of Atlas.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(serverDir, '.env') });
dotenv.config({ path: path.resolve(serverDir, '../web/.env') });

const API_KEY = process.env.VITE_FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const MONGO_URI = process.env.MONGODB_URI;
const USE_MEMORY_DB = Boolean(process.env.E2E_USE_MEMORY_DB);

if (!API_KEY || !PROJECT_ID || (!MONGO_URI && !USE_MEMORY_DB)) {
  console.error(
    'Missing configuration. Need VITE_FIREBASE_API_KEY (web/.env), FIREBASE_PROJECT_ID and MONGODB_URI (server/.env), or E2E_USE_MEMORY_DB=1.'
  );
  process.exit(2);
}

if (!process.env.E2E_ALLOW_LIVE) {
  console.error(
    'Refusing to run without E2E_ALLOW_LIVE=1 because this creates temporary live accounts.'
  );
  process.exit(2);
}

function createAdminAuth() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!json && !jsonPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }

  let credential;
  if (json) {
    credential = admin.credential.cert(JSON.parse(json));
  } else if (jsonPath) {
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  } else {
    credential = admin.credential.applicationDefault();
  }
  const app = admin.initializeApp({ credential, projectId: PROJECT_ID });
  return app.auth();
}

const adminAuth = createAdminAuth();

const stamp = Date.now();
const dbName = `order_billing_e2e_${stamp}`;
const port = 4187;
const base = `http://127.0.0.1:${port}/api`;
const clientRequestId1 = `e2e-memo-1-${stamp}`;
const deletedMemoAt = new Date('2026-11-23T17:59:00.000Z');

let checkCount = 0;
let serverOutput = '';
let child = null;
let mongoClient = null;
let memoryServer = null;
let effectiveMongoUri = MONGO_URI;
const createdUsers = [];

function ok(condition, label) {
  if (!condition) throw new Error(`FAILED: ${label}`);
  checkCount += 1;
  console.log(`  ok - ${label}`);
}

function eq(actual, expected, label) {
  try {
    assert.deepStrictEqual(actual, expected);
  } catch {
    throw new Error(
      `FAILED: ${label}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`
    );
  }
  checkCount += 1;
  console.log(`  ok - ${label}`);
}

function expectStatus(result, status, label) {
  if (result.status !== status) {
    throw new Error(
      `FAILED: ${label}\n       expected HTTP ${status}, got ${result.status}: ${JSON.stringify(result.body)}`
    );
  }
  checkCount += 1;
  console.log(`  ok - ${label} (HTTP ${status})`);
}

async function authRequest(token, method, apiPath, body) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${apiPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, body: payload };
}

async function refreshIdToken(refreshToken) {
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }).toString(),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Could not refresh the test user token: ${JSON.stringify(data)}`);
  }
  return data.id_token;
}

async function signUp(label) {
  const email = `e2e_${label}_${stamp}@example.com`;
  const password = `E2ePass_${stamp}!`;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Firebase sign-up failed for ${label}: ${JSON.stringify(data)}`);
  }
  const user = {
    label,
    email,
    password,
    uid: data.localId,
    token: data.idToken,
    refreshToken: data.refreshToken,
  };
  createdUsers.push(user);
  if (adminAuth) {
    await adminAuth.updateUser(user.uid, { emailVerified: true });
    user.token = await refreshIdToken(user.refreshToken);
  }
  return user;
}

async function waitForHealth() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}.\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Server did not become healthy.\n${serverOutput}`);
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  if (mongoClient) {
    try {
      await mongoClient.db(dbName).dropDatabase();
      console.log(`Cleaned up database ${dbName}.`);
    } catch (error) {
      console.warn('Could not drop test database:', error.message);
    }
    await mongoClient.close().catch(() => undefined);
  }
  if (memoryServer) {
    await memoryServer.stop().catch(() => undefined);
    console.log('Stopped temporary in-memory MongoDB.');
  }
  for (const user of createdUsers) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: user.token }),
        }
      );
      if (!response.ok) {
        console.warn(`Could not delete test user ${user.label}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`Could not delete test user ${user.label}:`, error.message);
    }
  }
  if (adminAuth) {
    await admin.app().delete().catch(() => undefined);
  }
}

async function main() {
  console.log(`E2E database: ${dbName}`);
  console.log(`E2E project: ${PROJECT_ID}`);
  console.log('\n[0] Creating temporary Firebase users');
  const admin = await signUp('admin');
  let user2 = null;
  let user3 = null;
  if (adminAuth) {
    user2 = await signUp('user2');
    user3 = await signUp('rejected');
  } else {
    console.log(
      '  Service account not configured. Only live unverified-token enforcement will run.'
    );
  }
  console.log(`  admin UID: ${admin.uid}`);

  console.log('\n[1] Starting the built server');
  child = spawn(process.execPath, ['dist/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      MONGODB_URI: effectiveMongoUri,
      MONGODB_DB: dbName,
      BOOTSTRAP_ADMIN_UID: admin.uid,
      CORS_ORIGINS: '*',
      SERVE_WEB: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    serverOutput = (serverOutput + chunk.toString()).slice(-20_000);
  });
  child.stderr.on('data', (chunk) => {
    serverOutput = (serverOutput + chunk.toString()).slice(-20_000);
  });
  await waitForHealth();
  ok(true, 'server started and /api/health responded');

  const rootHtml = await fetch(`http://127.0.0.1:${port}/`);
  const rootText = await rootHtml.text();
  ok(rootHtml.status === 200 && rootText.includes('id="root"'), 'serves the built web app');

  if (!adminAuth) {
    console.log('\n[2] Live unverified-token enforcement');
    const unverifiedMe = await authRequest(admin.token, 'GET', '/auth/me');
    expectStatus(unverifiedMe, 403, 'unverified user is blocked from account data');
    eq(
      unverifiedMe.body.error.code,
      'EMAIL_NOT_VERIFIED',
      'unverified error code returned'
    );

    const unverifiedCatalog = await authRequest(admin.token, 'GET', '/catalog');
    expectStatus(unverifiedCatalog, 403, 'unverified user is blocked from billing data');
    eq(
      unverifiedCatalog.body.error.code,
      'EMAIL_NOT_VERIFIED',
      'unverified billing error code returned'
    );

    const ownerRecord = await mongoClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: admin.uid });
    eq(ownerRecord, null, 'unverified owner is not promoted in MongoDB');

    const now = new Date();
    await mongoClient.db(dbName).collection('users').insertOne({
      _id: admin.uid,
      email: admin.email,
      displayName: null,
      photoURL: null,
      status: 'approved',
      role: 'user',
      createdAt: now,
      updatedAt: now,
      approvedAt: now,
      rejectedAt: null,
      revokedAt: null,
      reviewedBy: null,
    });

    const approvedUnverified = await authRequest(admin.token, 'GET', '/catalog');
    expectStatus(approvedUnverified, 403, 'unverified approved user is still blocked');
    eq(
      approvedUnverified.body.error.code,
      'EMAIL_NOT_VERIFIED',
      'unverified approved error code returned'
    );
    const approvedRecord = await mongoClient
      .db(dbName)
      .collection('users')
      .findOne({ _id: admin.uid });
    eq(approvedRecord?.status, 'approved', 'unverified approved status is unchanged');
    eq(approvedRecord?.role, 'user', 'unverified user is not granted admin');

    console.log(
      '\nVerified-user E2E skipped: set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON to run the full suite.'
    );
    console.log(`Passed ${checkCount} live checks.`);
    return;
  }

  console.log('\n[2] Authentication, bootstrap admin, and approval');
  const noAuth = await authRequest(null, 'GET', '/catalog');
  expectStatus(noAuth, 401, 'business API requires authentication');

  const adminMe = await authRequest(admin.token, 'GET', '/auth/me');
  expectStatus(adminMe, 200, 'bootstrap admin can load its profile');
  eq(adminMe.body.user.status, 'approved', 'bootstrap account is approved');
  eq(adminMe.body.user.role, 'admin', 'bootstrap account is admin');

  await authRequest(admin.token, 'GET', '/auth/me');
  const adminMeAgain = await authRequest(admin.token, 'GET', '/auth/me');
  eq(adminMeAgain.body.user.role, 'admin', 'bootstrap initialization is repeatable');

  const user2Me = await authRequest(user2.token, 'GET', '/auth/me');
  expectStatus(user2Me, 200, 'new account can load its status');
  eq(user2Me.body.user.status, 'pending', 'new account starts as Pending');
  const pendingBlocked = await authRequest(user2.token, 'GET', '/catalog');
  expectStatus(pendingBlocked, 403, 'pending account cannot access business data');
  eq(pendingBlocked.body.error.code, 'ACCOUNT_PENDING', 'pending error code');

  const user3Me = await authRequest(user3.token, 'GET', '/auth/me');
  eq(user3Me.body.user.status, 'pending', 'third account starts as Pending');

  const selfRevoke = await authRequest(
    admin.token,
    'POST',
    `/admin/users/${admin.uid}/revoke`
  );
  expectStatus(selfRevoke, 400, 'admin cannot change its own access');

  const usersList = await authRequest(admin.token, 'GET', '/admin/users');
  expectStatus(usersList, 200, 'admin can list accounts');
  eq(usersList.body.users.filter((u) => u.role === 'admin').length, 1, 'one admin account');

  const approveUser2 = await authRequest(
    admin.token,
    'POST',
    `/admin/users/${user2.uid}/approve`
  );
  expectStatus(approveUser2, 200, 'admin can approve a pending account');
  eq(approveUser2.body.user.status, 'approved', 'approved status returned');

  const user2Catalog = await authRequest(user2.token, 'GET', '/catalog');
  expectStatus(user2Catalog, 200, 'approved account can access business data');
  eq(user2Catalog.body.categories.length, 0, 'new workspace starts empty');

  const rejectUser3 = await authRequest(
    admin.token,
    'POST',
    `/admin/users/${user3.uid}/reject`
  );
  expectStatus(rejectUser3, 200, 'admin can reject a pending account');
  const rejectedBlocked = await authRequest(user3.token, 'GET', '/catalog');
  expectStatus(rejectedBlocked, 403, 'rejected account cannot access business data');
  eq(rejectedBlocked.body.error.code, 'ACCOUNT_REJECTED', 'rejected error code');

  console.log('\n[3] Private catalogs and settings');
  const defaultSettings = await authRequest(admin.token, 'GET', '/settings');
  eq(defaultSettings.body.settings.printHeading, 'Sales Memo', 'default print heading');

  const category = await authRequest(admin.token, 'POST', '/categories', {
    name: 'Juice',
  });
  expectStatus(category, 201, 'create category');
  const categoryId = category.body.category.id;

  const itemA = await authRequest(admin.token, 'POST', '/items', {
    categoryId,
    name: 'Juice (Btl) 100',
    defaultRate: 1150,
  });
  expectStatus(itemA, 201, 'create item priced 11.50');
  const itemAId = itemA.body.item.id;

  const itemB = await authRequest(admin.token, 'POST', '/items', {
    categoryId,
    name: 'Juice (Pkt) 125',
    defaultRate: 800,
  });
  expectStatus(itemB, 201, 'create item priced 8.00');
  const itemBId = itemB.body.item.id;

  const itemC = await authRequest(admin.token, 'POST', '/items', {
    categoryId,
    name: 'Chips',
    defaultRate: 2000,
  });
  expectStatus(itemC, 201, 'create a third item with no sales');
  const itemCId = itemC.body.item.id;

  const settingsSaved = await authRequest(admin.token, 'PUT', '/settings', {
    printHeading: 'রহমান ট্রেডার্স / Rahman Traders',
  });
  expectStatus(settingsSaved, 200, 'save a custom print heading');
  eq(
    settingsSaved.body.settings.printHeading,
    'রহমান ট্রেডার্স / Rahman Traders',
    'Bengali print heading preserved'
  );

  const initialSummary = await authRequest(admin.token, 'GET', '/summary');
  expectStatus(initialSummary, 200, 'load initial summary');
  eq(initialSummary.body.memoCount, 0, 'summary starts with zero memos');
  eq(initialSummary.body.totalPieces, 0, 'summary starts with zero pieces');
  eq(initialSummary.body.grossSales, 0, 'summary starts with zero gross sales');
  eq(initialSummary.body.netSales, 0, 'summary starts with zero net sales');
  eq(initialSummary.body.categories.length, 1, 'active category appears');
  eq(initialSummary.body.categories[0].items.length, 3, 'all active items appear with zero sales');
  eq(
    initialSummary.body.categories[0].items.every(
      (item) => item.piecesSold === 0 && item.grossSales === 0
    ),
    true,
    'new items start at zero sales'
  );

  console.log('\n[4] Memo creation, discount math, and idempotency');
  const memoPayload = {
    clientRequestId: clientRequestId1,
    shopName: 'Karim Store',
    address: '12 Main Road, Dhaka',
    note: 'Deliver before noon. নোট সংরক্ষিত।',
    discount: { type: 'percentage', value: 10 },
    lines: [
      { itemId: itemAId, rate: 1150, quantity: 3 },
      { itemId: itemBId, rate: 800, quantity: 2 },
    ],
  };

  const invalidDiscount = await authRequest(admin.token, 'POST', '/memos', {
    ...memoPayload,
    clientRequestId: `${clientRequestId1}-bad-percent`,
    discount: { type: 'percentage', value: 101 },
  });
  expectStatus(invalidDiscount, 400, 'server rejects a percentage above 100');

  const invalidFixed = await authRequest(admin.token, 'POST', '/memos', {
    ...memoPayload,
    clientRequestId: `${clientRequestId1}-bad-fixed`,
    discount: { type: 'fixed', value: 6000 },
  });
  expectStatus(invalidFixed, 400, 'server rejects a fixed discount above subtotal');

  const emptyOrder = await authRequest(admin.token, 'POST', '/memos', {
    ...memoPayload,
    clientRequestId: `${clientRequestId1}-empty`,
    lines: [],
  });
  expectStatus(emptyOrder, 400, 'server rejects an empty order');

  const duplicateLine = await authRequest(admin.token, 'POST', '/memos', {
    ...memoPayload,
    clientRequestId: `${clientRequestId1}-dup`,
    lines: [
      { itemId: itemAId, rate: 1150, quantity: 1 },
      { itemId: itemAId, rate: 1150, quantity: 1 },
    ],
  });
  expectStatus(duplicateLine, 400, 'server rejects duplicate item lines');

  const created = await authRequest(admin.token, 'POST', '/memos', memoPayload);
  expectStatus(created, 201, 'create the memo');
  eq(created.body.duplicate, false, 'first save is not a duplicate');
  const memo = created.body.memo;
  ok(/^M-\d{6}$/.test(memo.memoNumber), 'memo number is unique and formatted');
  eq(memo.totalPieces, 5, 'memo has 5 total pieces');
  eq(memo.subtotal, 5050, 'memo subtotal is 50.50');
  eq(memo.discountAmount, 505, '10% discount is 5.05');
  eq(memo.totalPayable, 4545, 'total payable is 45.45');
  eq(
    memo.printHeading,
    'রহমান ট্রেডার্স / Rahman Traders',
    'memo snapshots the current print heading'
  );
  eq(memo.lines.map((line) => line.lineTotal), [3450, 1600], 'line totals are exact');
  eq(memo.lines.map((line) => line.itemName), ['Juice (Btl) 100', 'Juice (Pkt) 125'], 'line names snapshotted');
  eq(memo.note, memoPayload.note, 'Bengali note preserved exactly');

  const repeated = await authRequest(admin.token, 'POST', '/memos', memoPayload);
  expectStatus(repeated, 200, 'repeated save returns the existing memo');
  eq(repeated.body.duplicate, true, 'repeated save is marked duplicate');
  eq(repeated.body.memo.id, memo.id, 'repeated save does not create another memo');

  const memoList = await authRequest(admin.token, 'GET', '/memos');
  eq(memoList.body.memos.length, 1, 'exactly one memo exists after a repeated save');

  const detail = await authRequest(admin.token, 'GET', `/memos/${memo.id}`);
  expectStatus(detail, 200, 'open memo details');
  eq(detail.body.memo.subtotal, 5050, 'memo details show 50.50 subtotal');
  eq(detail.body.memo.discountAmount, 505, 'memo details show 5.05 discount');
  eq(detail.body.memo.totalPayable, 4545, 'memo details show 45.45 payable');

  const summaryWithMemo = await authRequest(admin.token, 'GET', '/summary');
  eq(summaryWithMemo.body.memoCount, 1, 'summary counts one memo');
  eq(summaryWithMemo.body.totalPieces, 5, 'summary shows 5 pieces');
  eq(summaryWithMemo.body.grossSales, 5050, 'summary shows 50.50 gross');
  eq(summaryWithMemo.body.totalDiscounts, 505, 'summary deducts 5.05 discount once');
  eq(summaryWithMemo.body.netSales, 4545, 'summary shows 45.45 net');
  const itemRows = summaryWithMemo.body.categories.flatMap((cat) => cat.items);
  eq(
    itemRows.find((row) => row.itemId === itemAId).piecesSold,
    3,
    'summary shows 3 pieces for the 11.50 item'
  );
  eq(
    itemRows.find((row) => row.itemId === itemBId).grossSales,
    1600,
    'summary shows 16.00 for the 8.00 item'
  );
  eq(
    itemRows.find((row) => row.itemId === itemCId).grossSales,
    0,
    'active item with no sales stays visible'
  );

  console.log('\n[5] Asia/Dhaka date range, including the full end date');
  if (mongoClient) {
    await mongoClient
      .db(dbName)
      .collection('memos')
      .updateOne({ _id: memo.id }, { $set: { createdAt: deletedMemoAt } });
  }
  const sameDay = await authRequest(
    admin.token,
    'GET',
    '/summary?from=2026-11-23&to=2026-11-23'
  );
  eq(sameDay.body.memoCount, 1, 'end-of-day Dhaka timestamp is included');
  const nextDay = await authRequest(
    admin.token,
    'GET',
    '/summary?from=2026-11-24&to=2026-11-24'
  );
  eq(nextDay.body.memoCount, 0, 'the following Dhaka day is excluded');
  eq(nextDay.body.categories[0].items.length, 3, 'active items remain in an empty range');
  const previousDay = await authRequest(
    admin.token,
    'GET',
    '/summary?from=2026-11-22&to=2026-11-22'
  );
  eq(previousDay.body.memoCount, 0, 'the previous Dhaka day is excluded');
  const invertedRange = await authRequest(
    admin.token,
    'GET',
    '/summary?from=2026-11-24&to=2026-11-23'
  );
  expectStatus(invertedRange, 400, 'server rejects an inverted date range');

  console.log('\n[6] Rate override does not change the catalog default');
  const overrideMemo = await authRequest(admin.token, 'POST', '/memos', {
    clientRequestId: `e2e-override-${stamp}`,
    shopName: 'Override Shop',
    address: '',
    note: '',
    discount: { type: 'none', value: 0 },
    lines: [{ itemId: itemAId, rate: 1200, quantity: 1 }],
  });
  expectStatus(overrideMemo, 201, 'save a memo with an overridden rate');
  eq(overrideMemo.body.memo.lines[0].unitRate, 1200, 'memo uses the override rate');
  const catalogAfterOverride = await authRequest(admin.token, 'GET', '/catalog');
  eq(
    catalogAfterOverride.body.items.find((item) => item.id === itemAId).defaultRate,
    1150,
    'catalog default rate remains unchanged'
  );

  const deletedOverride = await authRequest(admin.token, 'DELETE', `/memos/${overrideMemo.body.memo.id}`);
  expectStatus(deletedOverride, 200, 'delete the override memo');
  const deletedOverrideAgain = await authRequest(
    admin.token,
    'DELETE',
    `/memos/${overrideMemo.body.memo.id}`
  );
  expectStatus(deletedOverrideAgain, 200, 'repeated delete is harmless');
  eq(deletedOverrideAgain.body.alreadyDeleted, true, 'repeated delete reports already deleted');
  const summaryAfterOverrideDelete = await authRequest(admin.token, 'GET', '/summary');
  eq(summaryAfterOverrideDelete.body.memoCount, 1, 'deleted override memo is excluded');
  eq(summaryAfterOverrideDelete.body.grossSales, 5050, 'deleted override sale is not double counted');

  console.log('\n[7] User isolation');
  const user2Category = await authRequest(user2.token, 'POST', '/categories', {
    name: 'Secret Category',
  });
  expectStatus(user2Category, 201, 'second user creates a private category');
  const user2Item = await authRequest(user2.token, 'POST', '/items', {
    categoryId: user2Category.body.category.id,
    name: 'Secret Item',
    defaultRate: 500,
  });
  expectStatus(user2Item, 201, 'second user creates a private item');
  const user2Memo = await authRequest(user2.token, 'POST', '/memos', {
    clientRequestId: `e2e-user2-${stamp}`,
    shopName: 'Second User Shop',
    address: '',
    note: '',
    discount: { type: 'none', value: 0 },
    lines: [{ itemId: user2Item.body.item.id, rate: 500, quantity: 1 }],
  });
  expectStatus(user2Memo, 201, 'second user saves a private memo');

  const adminCatalog = await authRequest(admin.token, 'GET', '/catalog');
  eq(
    adminCatalog.body.items.some((item) => item.name === 'Secret Item'),
    false,
    'admin catalog does not include another user’s items'
  );
  const adminPeekMemo = await authRequest(admin.token, 'GET', `/memos/${user2Memo.body.memo.id}`);
  expectStatus(adminPeekMemo, 404, 'admin cannot open another user’s memo');
  const adminDeleteUser2Memo = await authRequest(
    admin.token,
    'DELETE',
    `/memos/${user2Memo.body.memo.id}`
  );
  expectStatus(adminDeleteUser2Memo, 404, 'admin cannot delete another user’s memo');
  const adminDeleteUser2Item = await authRequest(
    admin.token,
    'DELETE',
    `/items/${user2Item.body.item.id}`
  );
  expectStatus(adminDeleteUser2Item, 404, 'admin cannot archive another user’s item');
  const adminSummaries = await authRequest(admin.token, 'GET', '/summary');
  eq(adminSummaries.body.memoCount, 1, 'admin summary excludes another user’s memo');
  const adminMemos = await authRequest(admin.token, 'GET', '/memos');
  eq(
    adminMemos.body.memos.some((entry) => entry.id === user2Memo.body.memo.id),
    false,
    'admin memo list excludes another user’s memo'
  );

  const user2CatalogView = await authRequest(user2.token, 'GET', '/catalog');
  eq(
    user2CatalogView.body.items.some((item) => item.name === 'Juice (Btl) 100'),
    false,
    'second user cannot see the admin catalog'
  );
  const user2PeekMemo = await authRequest(user2.token, 'GET', `/memos/${memo.id}`);
  expectStatus(user2PeekMemo, 404, 'second user cannot open the admin memo');
  const user2Summary = await authRequest(user2.token, 'GET', '/summary');
  eq(user2Summary.body.memoCount, 1, 'second user sees only its own memo');
  eq(user2Summary.body.grossSales, 500, 'second user sees only its own sales');

  console.log('\n[8] Rename, archive, heading change, and snapshot preservation');
  const renamed = await authRequest(admin.token, 'PATCH', `/items/${itemAId}`, {
    name: 'Juice Bottle Premium',
    defaultRate: 1150,
  });
  expectStatus(renamed, 200, 'rename an item');
  const archived = await authRequest(admin.token, 'DELETE', `/items/${itemBId}`);
  expectStatus(archived, 200, 'archive an item');
  const headingChanged = await authRequest(admin.token, 'PUT', '/settings', {
    printHeading: 'New Heading',
  });
  expectStatus(headingChanged, 200, 'change the print heading');

  const oldMemo = await authRequest(admin.token, 'GET', `/memos/${memo.id}`);
  eq(oldMemo.body.memo.printHeading, 'রহমান ট্রেডার্স / Rahman Traders', 'old memo keeps its original heading');
  eq(
    oldMemo.body.memo.lines.map((line) => line.itemName),
    ['Juice (Btl) 100', 'Juice (Pkt) 125'],
    'old memo keeps original item names'
  );
  eq(oldMemo.body.memo.lines.map((line) => line.unitRate), [1150, 800], 'old memo keeps original rates');
  eq(oldMemo.body.memo.totalPayable, 4545, 'old memo keeps its totals');

  const summaryAfterCatalogChange = await authRequest(admin.token, 'GET', '/summary');
  const rowsAfter = summaryAfterCatalogChange.body.categories.flatMap((cat) => cat.items);
  eq(
    rowsAfter.find((row) => row.itemId === itemAId).itemName,
    'Juice Bottle Premium',
    'summary groups renamed item by ID and shows its current name'
  );
  eq(
    rowsAfter.find((row) => row.itemId === itemAId).grossSales,
    3450,
    'renaming does not split or lose sales'
  );
  eq(
    rowsAfter.find((row) => row.itemId === itemBId).grossSales,
    1600,
    'archived item with sales remains in the summary'
  );

  console.log('\n[9] Revocation takes effect immediately');
  const revoked = await authRequest(admin.token, 'POST', `/admin/users/${user2.uid}/revoke`);
  expectStatus(revoked, 200, 'admin revokes a signed-in user');
  eq(revoked.body.user.status, 'revoked', 'revoked status returned');
  const revokedBlocked = await authRequest(user2.token, 'GET', '/catalog');
  expectStatus(revokedBlocked, 403, 'revoked user loses access on the next request');
  eq(revokedBlocked.body.error.code, 'ACCOUNT_REVOKED', 'revoked error code');

  console.log('\n[10] Deletion, zeroed summary, and single deduction');
  const deleteMemo = await authRequest(admin.token, 'DELETE', `/memos/${memo.id}`);
  expectStatus(deleteMemo, 200, 'delete the only remaining memo');
  eq(deleteMemo.body.alreadyDeleted, false, 'first deletion changes the memo');
  const deleteAgain = await authRequest(admin.token, 'DELETE', `/memos/${memo.id}`);
  expectStatus(deleteAgain, 200, 'repeated deletion succeeds idempotently');
  eq(deleteAgain.body.alreadyDeleted, true, 'repeated deletion reports already deleted');
  eq(deleteAgain.body.deletedAt, deleteMemo.body.deletedAt, 'deletedAt is not rewritten');

  const gone = await authRequest(admin.token, 'GET', `/memos/${memo.id}`);
  expectStatus(gone, 404, 'deleted memo cannot be opened or printed');
  const emptyMemos = await authRequest(admin.token, 'GET', '/memos');
  eq(emptyMemos.body.memos.length, 0, 'deleted memo is gone from history');

  const zeroSummary = await authRequest(admin.token, 'GET', '/summary');
  eq(zeroSummary.body.memoCount, 0, 'summary has zero memos');
  eq(zeroSummary.body.totalPieces, 0, 'summary has zero pieces');
  eq(zeroSummary.body.grossSales, 0, 'summary has zero gross sales');
  eq(zeroSummary.body.totalDiscounts, 0, 'summary has zero discounts');
  eq(zeroSummary.body.netSales, 0, 'summary has zero net sales');
  const zeroRows = zeroSummary.body.categories.flatMap((cat) => cat.items);
  eq(zeroRows.some((row) => row.itemId === itemAId), true, 'active renamed item remains visible at zero');
  eq(zeroRows.some((row) => row.itemId === itemCId), true, 'active unsold item remains visible at zero');
  eq(zeroRows.some((row) => row.itemId === itemBId), false, 'archived item without sales is hidden');
  eq(
    zeroRows.filter((row) => [itemAId, itemCId].includes(row.itemId)).every((row) => row.grossSales === 0),
    true,
    'remaining active items show zero sales'
  );

  console.log('\n[11] Re-approval restores access');
  const reapproved = await authRequest(admin.token, 'POST', `/admin/users/${user2.uid}/approve`);
  expectStatus(reapproved, 200, 'admin re-approves the revoked account');
  const restored = await authRequest(user2.token, 'GET', '/catalog');
  expectStatus(restored, 200, 're-approved user regains access');

  console.log(`\nAll ${checkCount} live checks passed.`);
}

try {
  if (USE_MEMORY_DB) {
    memoryServer = await MongoMemoryServer.create();
    effectiveMongoUri = memoryServer.getUri();
    console.log(`Using temporary in-memory MongoDB: ${effectiveMongoUri}`);
  }
  mongoClient = new MongoClient(effectiveMongoUri);
  await mongoClient.connect();
  await main();
  await cleanup();
  process.exit(0);
} catch (error) {
  console.error(`\nE2E FAILED: ${error.message}`);
  if (serverOutput) console.error(`\nServer output:\n${serverOutput}`);
  await cleanup();
  process.exit(1);
}
