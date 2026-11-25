import { Router } from 'express';
import { collections } from '../db';
import { asyncHandler } from '../lib/errors';
import { updateSettingsSchema } from '../lib/schemas';
import { serializeSettings } from '../services/serialize';
import type { SettingsDoc } from '../types';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ownerUid = req.authInfo?.uid;
    if (!ownerUid) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
      return;
    }
    const settings = await collections.settings().findOne({ _id: ownerUid });
    res.json({ settings: serializeSettings(settings) });
  })
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const ownerUid = req.authInfo?.uid;
    if (!ownerUid) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
      return;
    }
    const input = updateSettingsSchema.parse(req.body);
    const now = new Date();
    const settings: SettingsDoc = {
      _id: ownerUid,
      printHeading: input.printHeading,
      updatedAt: now,
    };
    await collections
      .settings()
      .updateOne({ _id: ownerUid }, { $set: settings }, { upsert: true });
    const saved = await collections.settings().findOne({ _id: ownerUid });
    res.json({ settings: serializeSettings(saved) });
  })
);

export default router;
