import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { collections } from '../db';
import { ApiError, asyncHandler } from '../lib/errors';
import { calculateDiscount, DEFAULT_PRINT_HEADING } from '../lib/money';
import { isDuplicateKeyError } from '../lib/mongo';
import { createMemoSchema } from '../lib/schemas';
import { serializeMemo, serializeMemoSummary } from '../services/serialize';
import type { MemoDoc, MemoLineDoc } from '../types';

const router = Router();

function requireOwner(req: Express.Request): string {
  const uid = req.authInfo?.uid;
  if (!uid) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  }
  return uid;
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const input = createMemoSchema.parse(req.body);

    if (new Set(input.lines.map((line) => line.itemId)).size !== input.lines.length) {
      throw new ApiError(
        400,
        'DUPLICATE_ITEM',
        'Each item can appear only once in an order.'
      );
    }

    const existing = await collections
      .memos()
      .findOne({ ownerUid, clientRequestId: input.clientRequestId });
    if (existing) {
      res.status(200).json({ memo: serializeMemo(existing), duplicate: true });
      return;
    }

    const itemIds = input.lines.map((line) => line.itemId);
    const [itemDocs, settings] = await Promise.all([
      collections.items().find({ ownerUid, _id: { $in: itemIds } }).toArray(),
      collections.settings().findOne({ _id: ownerUid }),
    ]);
    const itemMap = new Map(itemDocs.map((item) => [item._id, item]));
    if (itemMap.size !== itemIds.length) {
      throw new ApiError(
        400,
        'ITEM_NOT_FOUND',
        'One or more selected items could not be found in your catalog.'
      );
    }

    const categoryIds = [...new Set(itemDocs.map((item) => item.categoryId))];
    const categoryDocs = await collections
      .categories()
      .find({ ownerUid, _id: { $in: categoryIds } })
      .toArray();
    const categoryMap = new Map(categoryDocs.map((category) => [category._id, category]));
    if (categoryMap.size !== categoryIds.length) {
      throw new ApiError(
        400,
        'CATEGORY_NOT_FOUND',
        'One or more categories for this order could not be found.'
      );
    }

    const lines: MemoLineDoc[] = [];
    let subtotal = 0;
    let totalPieces = 0;

    for (const line of input.lines) {
      const item = itemMap.get(line.itemId);
      if (!item) {
        throw new ApiError(400, 'ITEM_NOT_FOUND', 'That item could not be found.');
      }
      const category = categoryMap.get(item.categoryId);
      if (!category) {
        throw new ApiError(400, 'CATEGORY_NOT_FOUND', 'That category could not be found.');
      }
      if (item.archivedAt !== null) {
        throw new ApiError(
          400,
          'ITEM_ARCHIVED',
          `"${item.name}" was archived. Remove it from the order and try again.`
        );
      }
      if (category.archivedAt !== null) {
        throw new ApiError(
          400,
          'CATEGORY_ARCHIVED',
          `The category "${category.name}" was archived. Remove its items and try again.`
        );
      }
      const lineTotal = line.rate * line.quantity;
      if (!Number.isSafeInteger(lineTotal)) {
        throw new ApiError(400, 'TOTAL_TOO_LARGE', 'The order total is too large.');
      }
      subtotal += lineTotal;
      if (!Number.isSafeInteger(subtotal)) {
        throw new ApiError(400, 'TOTAL_TOO_LARGE', 'The order total is too large.');
      }
      totalPieces += line.quantity;
      lines.push({
        itemId: item._id,
        categoryId: category._id,
        itemName: item.name,
        categoryName: category.name,
        unitRate: line.rate,
        quantity: line.quantity,
        lineTotal,
      });
    }

    let discountAmount = 0;
    try {
      discountAmount = calculateDiscount(subtotal, input.discount).discountAmount;
    } catch (error) {
      throw new ApiError(
        400,
        'INVALID_DISCOUNT',
        error instanceof Error ? error.message : 'Enter a valid discount.'
      );
    }

    const printHeading = settings?.printHeading?.trim() || DEFAULT_PRINT_HEADING;
    const totalPayable = subtotal - discountAmount;

    const counter = await collections.counters().findOneAndUpdate(
      { _id: ownerUid },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false }
    );
    if (!counter) {
      throw new ApiError(500, 'NUMBERING_FAILED', 'Could not assign a memo number.');
    }

    const now = new Date();
    const memo: MemoDoc = {
      _id: randomUUID(),
      ownerUid,
      memoNumber: `M-${String(counter.seq).padStart(6, '0')}`,
      sequence: counter.seq,
      clientRequestId: input.clientRequestId,
      shopName: input.shopName,
      address: input.address,
      note: input.note,
      printHeading,
      lines,
      subtotal,
      discountType: input.discount.type,
      discountValue: input.discount.type === 'none' ? 0 : input.discount.value,
      discountAmount,
      totalPayable,
      totalPieces,
      createdAt: now,
      deletedAt: null,
    };

    try {
      await collections.memos().insertOne(memo);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const duplicate = await collections
          .memos()
          .findOne({ ownerUid, clientRequestId: input.clientRequestId });
        if (duplicate) {
          res.status(200).json({ memo: serializeMemo(duplicate), duplicate: true });
          return;
        }
      }
      throw error;
    }

    res.status(201).json({ memo: serializeMemo(memo), duplicate: false });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const memos = await collections
      .memos()
      .find({ ownerUid, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
    res.json({ memos: memos.map(serializeMemoSummary) });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const memo = await collections
      .memos()
      .findOne({ _id: req.params.id, ownerUid, deletedAt: null });
    if (!memo) {
      throw new ApiError(404, 'MEMO_NOT_FOUND', 'That memo could not be found.');
    }
    res.json({ memo: serializeMemo(memo) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ownerUid = requireOwner(req);
    const memo = await collections
      .memos()
      .findOne({ _id: req.params.id, ownerUid });
    if (!memo) {
      throw new ApiError(404, 'MEMO_NOT_FOUND', 'That memo could not be found.');
    }
    if (memo.deletedAt) {
      res.json({ ok: true, alreadyDeleted: true, deletedAt: memo.deletedAt.toISOString() });
      return;
    }
    const now = new Date();
    const result = await collections.memos().updateOne(
      { _id: memo._id, ownerUid, deletedAt: null },
      { $set: { deletedAt: now } }
    );
    const updated = await collections.memos().findOne({ _id: memo._id, ownerUid });
    res.json({
      ok: true,
      alreadyDeleted: result.modifiedCount === 0,
      deletedAt: (updated?.deletedAt ?? now).toISOString(),
    });
  })
);

export default router;
