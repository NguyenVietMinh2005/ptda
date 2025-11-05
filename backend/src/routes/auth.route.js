// src/routes/auth.route.js
import express from 'express';
import * as authController from '../controllers/auth.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();
// --- Các route không cần bảo vệ ---
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword); 
router.post('/reset-password', authController.resetPassword);   
router.get('/me/complaints', protect, authController.getMyComplaints);

// --- Các route cần bảo vệ ---
router.get('/me', protect, authController.getMe);
// Lấy danh sách yêu thích của người dùng đang đăng nhập
router.get('/me/favorites', protect, authController.getMyFavorites);
// Lấy lịch sử đặt phòng của người dùng đang đăng nhập
router.get('/me/bookings', protect, authController.getMyBookings);
router.put('/me', protect, authController.updateMyProfile);


export default router; // <-- export default