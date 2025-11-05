// src/routes/homestay.route.js
import express from 'express';
import * as homestayController from '../controllers/homestay.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { protectOwner } from '../middlewares/owner.middleware.js';
import upload from '../middlewares/upload.middleware.js';

const router = express.Router();

// --- Public Routes ---
router.get('/', homestayController.getAllHomestays);
router.get('/:id', homestayController.getHomestayById);

// --- Owner Routes (Dành cho CHU_HOMESTAY) ---
router.post('/', protectOwner, homestayController.createHomestay);
router.put('/:id', protectOwner, homestayController.updateHomestay);
router.delete('/:id', protectOwner, homestayController.deleteHomestay);
router.post('/:id/images',protectOwner,upload.array('images', 10), homestayController.uploadImages);

// --- User Routes (Dành cho NGUOI_DUNG) ---
// Thêm homestay vào yêu thích (yêu cầu đăng nhập)
router.post('/:id/favorite', protect, homestayController.addFavorite);

// Xóa homestay khỏi yêu thích (yêu cầu đăng nhập)
router.delete('/:id/favorite', protect, homestayController.removeFavorite);

// Gửi đánh giá cho một homestay (yêu cầu đăng nhập)
router.post('/:id/reviews', protect, homestayController.createReview);

// Đặt phòng (yêu cầu đăng nhập)
router.post('/:id/book', protect, homestayController.bookHomestay);



export default router;