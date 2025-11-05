// src/routes/owner.route.js
import express from 'express';
import * as ownerController from '../controllers/owner.controller.js';
import { protectOwner } from '../middlewares/owner.middleware.js';


const router = express.Router();

// Route đăng ký cho chủ homestay
router.post('/register', ownerController.register);
router.post('/login', ownerController.login);
router.post('/forgot-password', ownerController.forgotPassword); 
router.post('/reset-password', ownerController.resetPassword);   
// (Sau này chúng ta sẽ thêm /login)
// router.post('/login', ownerController.login);
// --- Quản lý Homestay (Cần đăng nhập) ---
router.get('/me/homestays', protectOwner, ownerController.getMyHomestays);
router.get('/me/bookings', protectOwner, ownerController.getMyBookings);
router.get('/me/complaints', protectOwner, ownerController.getMyComplaints);
router.get('/me/dashboard-stats', protectOwner, ownerController.getDashboardStats);


export default router;