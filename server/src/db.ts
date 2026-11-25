import { Db, MongoClient } from 'mongodb';
import { config } from './config';
import type {
  CategoryDoc,
  CounterDoc,
  ItemDoc,
  MemoDoc,
  SettingsDoc,
  UserDoc,
} from './types';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (database) return database;
  client = new MongoClient(config.mongodbUri, { appName: 'order-billing-app' });
  await client.connect();
  database = client.db(config.mongodbDb);
  await ensureIndexes(database);
  return database;
}

export function getDb(): Db {
  if (!database) {
    throw new Error('Database is not connected yet.');
  }
  return database;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection<UserDoc>('users').createIndex({ status: 1 }),
    db
      .collection<CategoryDoc>('categories')
      .createIndex({ ownerUid: 1, archivedAt: 1, position: 1 }),
    db
      .collection<ItemDoc>('items')
      .createIndex({ ownerUid: 1, categoryId: 1, archivedAt: 1, position: 1 }),
    db
      .collection<MemoDoc>('memos')
      .createIndex({ ownerUid: 1, createdAt: -1 }),
    db
      .collection<MemoDoc>('memos')
      .createIndex({ ownerUid: 1, deletedAt: 1, createdAt: -1 }),
    db
      .collection<MemoDoc>('memos')
      .createIndex({ ownerUid: 1, memoNumber: 1 }, { unique: true }),
    db.collection<MemoDoc>('memos').createIndex(
      { ownerUid: 1, clientRequestId: 1 },
      {
        unique: true,
        partialFilterExpression: { clientRequestId: { $type: 'string' } },
      }
    ),
  ]);
}

export const collections = {
  users: () => getDb().collection<UserDoc>('users'),
  categories: () => getDb().collection<CategoryDoc>('categories'),
  items: () => getDb().collection<ItemDoc>('items'),
  memos: () => getDb().collection<MemoDoc>('memos'),
  settings: () => getDb().collection<SettingsDoc>('settings'),
  counters: () => getDb().collection<CounterDoc>('counters'),
};
