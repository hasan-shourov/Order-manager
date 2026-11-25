import { Router } from 'express';
import { asyncHandler } from '../lib/errors';
import { authenticateRequest } from '../middleware/auth';
import { serializeUser } from '../services/serialize';
import { syncUserProfile } from '../services/users';

const router = Router();

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    await authenticateRequest(req);
    const auth = req.authInfo;
    if (!auth) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } });
      return;
    }
    const user = await syncUserProfile(auth);
    res.json({ user: serializeUser(user) });
  })
);

export default router;
