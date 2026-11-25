import { Router } from 'express';
import type { Filter } from 'mongodb';
import { collections } from '../db';
import { DateRangeError, parseDhakaRange } from '../lib/dateRange';
import { ApiError, asyncHandler } from '../lib/errors';
import { buildSummary } from '../services/summary';
import type { MemoDoc } from '../types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ownerUid = req.authInfo?.uid;
    if (!ownerUid) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    }

    const fromParam = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toParam = typeof req.query.to === 'string' ? req.query.to : undefined;

    let range: ReturnType<typeof parseDhakaRange>;
    try {
      range = parseDhakaRange(fromParam, toParam);
    } catch (error) {
      if (error instanceof DateRangeError) {
        throw new ApiError(400, 'INVALID_DATE_RANGE', error.message);
      }
      throw error;
    }

    const filter: Record<string, unknown> = { ownerUid, deletedAt: null };
    if (range) {
      filter.createdAt = { $gte: range.fromDate, $lt: range.toExclusive };
    }

    const [memos, categories, items] = await Promise.all([
      collections
        .memos()
        .find(filter as Filter<MemoDoc>)
        .sort({ createdAt: -1 })
        .toArray(),
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

    const summary = buildSummary(memos, categories, items);
    res.json({
      ...summary,
      range: range && fromParam && toParam ? { from: fromParam, to: toParam } : null,
    });
  })
);

export default router;
