// src/routes/booking.route.js
import express from 'express';
import * as bookingController from '../controllers/booking.controller.js';
import * as paymentController from '../controllers/payment.controller.js';
import { protectOwner } from '../middlewares/owner.middleware.js';
import { protect, protectAny } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Chỉ CHU_HOMESTAY mới được phép cập nhật trạng thái đơn (Xác nhận, Check-in, Check-out, Hủy)
router.put('/:id/status', protectOwner, bookingController.updateBookingStatus);

// Route cho Người Dùng gửi khiếu nại
router.post('/:id/complain', protect, bookingController.createComplaint);

// Route cho Người Dùng (User) tự hủy đơn
router.put('/:id/cancel', protect, bookingController.cancelMyBooking);

// --- CÁC ROUTE THANH TOÁN MÔ PHỎNG (PAYMENT & TRANSACTIONS) ---
// 1. Lấy thông tin thanh toán & mã QR demo (Khách hoặc Chủ)
router.get('/:id/payment-info', protectAny, paymentController.getPaymentInfo);

// 2. Khách chọn phương thức thanh toán (Tiền mặt hoặc Chuyển khoản QR)
router.post('/:id/payment/select-method', protect, paymentController.selectPaymentMethod);

// 3. Khách mô phỏng kết quả thanh toán QR (Thành công / Thất bại)
router.post('/:id/payment/simulate', protect, paymentController.simulatePayment);

// 4. Chủ Homestay hoặc Admin xác nhận đã thu tiền mặt khi khách nhận phòng
router.post('/:id/payment/confirm-cash', protectOwner, paymentController.confirmCashPayment);

// 5. Xem lịch sử giao dịch của đơn đặt phòng
router.get('/:id/transactions', protectAny, paymentController.getTransactions);

export default router;