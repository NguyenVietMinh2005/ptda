// src/routes/complaint.route.js
import express from 'express';
import * as complaintController from '../controllers/complaint.controller.js';
import { protectOwner } from '../middlewares/owner.middleware.js';

const router = express.Router();

// Chỉ CHU_HOMESTAY mới được giải quyết
router.post(
  '/:id/resolve',
  protectOwner,
  complaintController.resolveComplaint
);

export default router;