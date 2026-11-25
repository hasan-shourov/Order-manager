import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { collections } from '../db';
import { ApiError, asyncHandler } from '../lib/errors';
import {
  createCategorySchema,
  createItemSchema,
  updateCategorySchema,
  updateItemSchema,
} from '../lib/schemas';
import { serializeCategory, serializeItem } from '../services/serialize';
import type { CategoryDoc, ItemDoc } from '../types';

const router = Router();

function requireOwner(req: Express.Request): string {
  const uid = req.authInfo?.uid;
  if (!uid) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return uid;
}

router.get(
  '/catalog',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const [categories, items] = await Promise.all([
      collections
        .categories()
        .find({ ownerUid })
        .sort({ position: 1, createdAt: 1 })
        .toArray(),
      collections
        .items()
        .find({ ownerUid })
        .sort({ position: 1, createdAt: 1 })
        .toArray(),
    ]);
    res.json({
      categories: categories.map(serializeCategory),
      items: items.map(serializeItem),
    });
  })
);

router.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const input = createCategorySchema.parse(req.body);
    const last = await collections
      .categories()
      .find({ ownerUid, archivedAt: null })
      .sort({ position: -1 })
      .limit(1)
      .next();
    const now = new Date();
    const category: CategoryDoc = {
      _id: randomUUID(),
      ownerUid,
      name: input.name,
      position: (last?.position ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await collections.categories().insertOne(category);
    res.status(201).json({ category: serializeCategory(category) });
  })
);

router.patch(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const input = updateCategorySchema.parse(req.body);
    const now = new Date();
    const updated = await collections.categories().findOneAndUpdate(
      { _id: req.params.id, ownerUid, archivedAt: null },
      { $set: { name: input.name, updatedAt: now } },
      { returnDocument: 'after', includeResultMetadata: false }
    );
    if (!updated) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category could not be found.');
    }
    res.json({ category: serializeCategory(updated) });
  })
);

router.delete(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const category = await collections
      .categories()
      .findOne({ _id: req.params.id, ownerUid, archivedAt: null });
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category could not be found.');
    }
    const now = new Date();
    const itemResult = await collections.items().updateMany(
      { ownerUid, categoryId: category._id, archivedAt: null },
      { $set: { archivedAt: now, updatedAt: now } }
    );
    await collections.categories().updateOne(
      { _id: category._id, ownerUid },
      { $set: { archivedAt: now, updatedAt: now } }
    );
    res.json({ archivedItemCount: itemResult.modifiedCount });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const input = createItemSchema.parse(req.body);
    const category = await collections
      .categories()
      .findOne({ _id: input.categoryId, ownerUid, archivedAt: null });
    if (!category) {
      throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'That category could not be found.');
    }
    const last = await collections
      .items()
      .find({ ownerUid, categoryId: category._id, archivedAt: null })
      .sort({ position: -1 })
      .limit(1)
      .next();
    const now = new Date();
    const item: ItemDoc = {
      _id: randomUUID(),
      ownerUid,
      categoryId: category._id,
      name: input.name,
      defaultRate: input.defaultRate,
      position: (last?.position ?? 0) + 1,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    await collections.items().insertOne(item);
    res.status(201).json({ item: serializeItem(item) });
  })
);

router.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const input = updateItemSchema.parse(req.body);
    const item = await collections
      .items()
      .findOne({ _id: req.params.id, ownerUid, archivedAt: null });
    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'That item could not be found.');
    }
    const category = await collections
      .categories()
      .findOne({ _id: item.categoryId, ownerUid, archivedAt: null });
    if (!category) {
      throw new ApiError(409, 'CATEGORY_ARCHIVED', 'This item belongs to an archived category.');
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.defaultRate !== undefined) updates.defaultRate = input.defaultRate;
    const updated = await collections.items().findOneAndUpdate(
      { _id: item._id, ownerUid },
      { $set: updates },
      { returnDocument: 'after', includeResultMetadata: false }
    );
    if (!updated) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'That item could not be found.');
    }
    res.json({ item: serializeItem(updated) });
  })
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const item = await collections
      .items()
      .findOne({ _id: req.params.id, ownerUid, archivedAt: null });
    if (!item) {
      throw new ApiError(404, 'ITEM_NOT_FOUND', 'That item could not be found.');
    }
    const now = new Date();
    await collections.items().updateOne(
      { _id: item._id, ownerUid },
      { $set: { archivedAt: now, updatedAt: now } }
    );
    res.json({ ok: true });
  })
);

export default router;
