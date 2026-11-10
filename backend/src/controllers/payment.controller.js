// src/controllers/payment.controller.js
import * as paymentService from '../services/payment.service.js';

export const getPaymentInfo = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user?.MaNguoiDung || null;
    const ownerId = req.owner?.MaChu || null;

    if (isNaN(bookingId)) {
      return res.status(400).json({ message: 'Mã đơn đặt phòng không hợp lệ' });
    }

    const paymentInfo = await paymentService.getPaymentInfo(bookingId, userId, ownerId);
    return res.status(200).json({
      message: 'Lấy thông tin thanh toán thành công',
      data: paymentInfo,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ message: error.message });
    }
    console.error('Lỗi khi lấy thông tin thanh toán:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi lấy thông tin thanh toán' });
  }
};

export const selectPaymentMethod = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.MaNguoiDung;
    const { method } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ message: 'Mã đơn đặt phòng không hợp lệ' });
    }

    if (!method) {
      return res.status(400).json({ message: 'Vui lòng chọn phương thức thanh toán' });
    }

    const updatedBooking = await paymentService.selectPaymentMethod(bookingId, userId, method);
    return res.status(200).json({
      message: 'Cập nhật phương thức thanh toán thành công',
      data: updatedBooking,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ message: error.message });
    }
    if (
      error.message.includes('không hợp lệ') ||
      error.message.includes('đang chờ xác nhận') ||
      error.message.includes('đã bị hủy') ||
      error.message.includes('đã được thanh toán')
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Lỗi khi chọn phương thức thanh toán:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

export const simulatePayment = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user.MaNguoiDung;
    const { result, reason } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ message: 'Mã đơn đặt phòng không hợp lệ' });
    }

    if (!result || !['success', 'failed'].includes(result)) {
      return res.status(400).json({ message: "Tham số 'result' phải là 'success' hoặc 'failed'" });
    }

    const simResult = await paymentService.simulatePayment(bookingId, userId, { result, reason });

    const statusCode = simResult.success ? 200 : 400;
    return res.status(statusCode).json(simResult);
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ message: error.message });
    }
    if (
      error.message.includes('chờ xác nhận') ||
      error.message.includes('đã bị hủy') ||
      error.message.includes('đã được thanh toán')
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Lỗi mô phỏng thanh toán:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi mô phỏng thanh toán' });
  }
};

export const confirmCashPayment = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const ownerId = req.owner?.MaChu || null;
    const adminUser = req.admin || (req.owner?.Quyen === 'admin' ? req.owner : null);

    if (isNaN(bookingId)) {
      return res.status(400).json({ message: 'Mã đơn đặt phòng không hợp lệ' });
    }

    const result = await paymentService.confirmCashPayment(bookingId, ownerId, adminUser);
    return res.status(200).json(result);
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ message: error.message });
    }
    if (error.message.includes('đã bị hủy') || error.message.includes('đã được xác nhận thanh toán')) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Lỗi khi xác nhận thu tiền mặt:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ khi xác nhận thu tiền mặt' });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const userId = req.user?.MaNguoiDung || null;
    const ownerId = req.owner?.MaChu || null;

    if (isNaN(bookingId)) {
      return res.status(400).json({ message: 'Mã đơn đặt phòng không hợp lệ' });
    }

    const transactions = await paymentService.getBookingTransactions(bookingId, userId, ownerId);
    return res.status(200).json({
      message: 'Lấy lịch sử giao dịch thành công',
      data: transactions,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes('không có quyền')) {
      return res.status(403).json({ message: error.message });
    }
    console.error('Lỗi khi lấy lịch sử giao dịch:', error);
    return res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

