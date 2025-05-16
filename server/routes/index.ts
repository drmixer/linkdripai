import express from 'express';
import outreachRoutes from './outreach-routes';

const router = express.Router();

// Mount outreach routes
router.use(outreachRoutes);

export default router;