// src/routes/admin.route.js
import express from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { protectAdmin } from '../middlewares/admin.middleware.js'; // <-- Import middleware Admin

const router = express.Router();

// Tất cả các route trong này đều phải qua 'protectAdmin'
router.use(protectAdmin);

// GET /api/admin/users
router.get('/users', adminController.getAllUsers);
router.get('/owners', adminController.getAllOwners);
router.get('/homestays', adminController.getAllHomestays);
router.put('/users/:id/status', adminController.updateUserStatus);
router.put('/owners/:id/status', adminController.updateOwnerStatus);
router.delete('/homestays/:id', adminController.deleteHomestay);
router.delete('/reviews/:id', adminController.deleteReview);
router.get('/bookings', adminController.getAllBookings);
router.put('/bookings/:id/status', adminController.updateBookingStatus);
router.get('/complaints', adminController.getAllComplaints);
router.put('/owners/:id/role', adminController.updateOwnerRole);
router.post('/complaints/:id/resolve', adminController.adminResolveComplaint);

export default router;