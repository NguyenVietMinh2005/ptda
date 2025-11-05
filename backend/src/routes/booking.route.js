// src/routes/booking.route.js
import express from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import { protectOwner } from '../middlewares/owner.middleware.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Chỉ CHU_HOMESTAY mới được phép cập nhật đơn
router.put('/:id/status',protectOwner,bookingController.updateBookingStatus);
// Route cho Người Dùng
router.post('/:id/complain',protect, bookingController.createComplaint);
// Route cho Người Dùng (User) tự hủy đơn
router.put('/:id/cancel',protect,bookingController.cancelMyBooking);

export default router;