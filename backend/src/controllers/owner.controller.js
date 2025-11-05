// src/controllers/owner.controller.js
import * as ownerService from '../services/owner.service.js';

/**
 * Controller để đăng ký Chủ Homestay
 */
export const register = async (req, res) => {
  try {
    const ownerData = req.body; // Lấy dữ liệu từ body
    const owner = await ownerService.registerOwner(ownerData);

    res.status(201).json({ 
        message: 'Đăng ký tài khoản chủ homestay thành công!',
        data: owner
    });
  } catch (error) {
    // Bắt lỗi trùng lặp
    if (error.message === 'Email đã tồn tại' || error.message === 'Số CCCD đã tồn tại') {
      res.status(409).json({ message: error.message }); // 409 Conflict
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để đăng nhập Chủ Homestay
 */
export const login = async (req, res) => {
  try {
    const ownerData = req.body; // Lấy { email, password } từ body
    
    // Service sẽ trả về { owner, token }
    const data = await ownerService.loginOwner(ownerData); 

    res.status(200).json({ 
        message: 'Đăng nhập thành công!',
        data: data
    });
  } catch (error) {
    if (error.message === 'Email không tồn tại' || error.message === 'Mật khẩu không chính xác') {
      res.status(401).json({ message: error.message }); // 401 Unauthorized
    } 
    else if (error.message === 'Tài khoản của bạn đã bị khóa') {
      res.status(403).json({ message: error.message }); // 403 Forbidden
    }
    
    else {
      res.status(500).json({ message: 'Lỗi máy chủ' });
    }
  }
};
/**
 * Controller cho yêu cầu quên mật khẩu (Chủ Homestay)
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const resetToken = await ownerService.requestPasswordReset(email);

    res.status(200).json({
      message: 'Yêu cầu thành công. (Đã mô phỏng gửi token)',
      resetToken: resetToken,
    });
  } catch (error) {
    if (error.message === 'Email không tồn tại') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller cho việc đặt lại mật khẩu (Chủ Homestay)
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await ownerService.resetPassword(token, newPassword);

    res.status(200).json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    if (error.message === 'Token không hợp lệ hoặc đã hết hạn') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để lấy danh sách homestay của tôi
 */
export const getMyHomestays = async (req, res) => {
  try {
    // 1. Lấy ID chủ homestay từ middleware
    const ownerId = req.owner.MaChu;

    const homestays = await ownerService.getMyHomestays(ownerId);

    res.status(200).json({
      message: 'Lấy danh sách homestay của bạn thành công!',
      data: homestays,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * Controller để lấy danh sách đơn đặt phòng
 */
export const getMyBookings = async (req, res) => {
  try {
    const ownerId = req.owner.MaChu;
    const bookings = await ownerService.getMyBookings(ownerId);

    res.status(200).json({
      message: 'Lấy danh sách đơn đặt phòng thành công!',
      data: bookings,
    });
  } catch (error) {
    console.error(error); // In lỗi ra để debug
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * Controller để lấy danh sách khiếu nại
 */
export const getMyComplaints = async (req, res) => {
  try {
    const ownerId = req.owner.MaChu;
    const complaints = await ownerService.getMyComplaints(ownerId);

    res.status(200).json({
      message: 'Lấy danh sách khiếu nại thành công!',
      data: complaints,
    });
  } catch (error) {
    console.error(error); // In lỗi ra để debug
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};
/**
 * Controller để lấy số liệu dashboard
 */
export const getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.owner.MaChu;
    const stats = await ownerService.getDashboardStats(ownerId);

    res.status(200).json({
      message: 'Lấy số liệu thống kê thành công!',
      data: stats,
    });
  } catch (error) {
    console.error(error); // In lỗi ra để debug
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};