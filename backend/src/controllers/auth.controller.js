// src/controllers/auth.controller.js
import * as authService from '../services/auth.service.js';
import * as userService from '../services/user.service.js';
// register
export const register = async (req, res) => {
  try {
    const userData = req.body;
    const user = await authService.registerUser(userData);

    // Xóa dòng này đi, vì service đã làm rồi
    // user.password = undefined; 

    res.status(201).json({ 
        message: 'Đăng ký thành công!', // Đã sửa lại message
        user: user // Service đã trả về user an toàn
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Thêm hàm login
export const login = async (req, res) => {
  try {
    const userData = req.body;
    // Service sẽ trả về { user, token }
    const data = await authService.loginUser(userData); 

    res.status(200).json({ 
        message: 'Đăng nhập thành công!',
        data: data // Gửi cả user và token về
    });
  } catch (error) {
    // Phân biệt lỗi 401 (Sai thông tin) và 404 (Không tìm thấy)
    if (error.message === 'Email không tồn tại' || error.message === 'Mật khẩu không chính xác') {
      res.status(401).json({ message: error.message });
    } 
    else if (error.message === 'Tài khoản của bạn đã bị khóa') {
      res.status(403).json({ message: error.message }); // 403 Forbidden
    }
    else {
      res.status(500).json({ message: 'Lỗi máy chủ' });
    }
  }
};

// Thêm hàm getMe
export const getMe = async (req, res) => {
  // Nhờ middleware 'protect', chúng ta đã có thông tin 'req.user'
  // mà không cần truy vấn lại database
  res.status(200).json({
    message: 'Lấy thông tin người dùng thành công.',
    user: req.user,
  });
};

/**
 * Controller để lấy danh sách yêu thích của tôi
 */
export const getMyFavorites = async (req, res) => {
  try {
    // 1. Lấy ID người dùng từ middleware 'protect'
    const userId = req.user.MaNguoiDung;

    // 2. Gọi service mới
    const favorites = await userService.getFavorites(userId);

    res.status(200).json({
      message: 'Lấy danh sách yêu thích thành công!',
      data: favorites,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * Controller để lấy lịch sử đặt phòng của tôi
 */
export const getMyBookings = async (req, res) => {
  try {
    // 1. Lấy ID người dùng từ middleware 'protect'
    const userId = req.user.MaNguoiDung;

    // 2. Gọi service
    const bookings = await userService.getMyBookings(userId);

    res.status(200).json({
      message: 'Lấy lịch sử đặt phòng thành công!',
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * Controller cho yêu cầu quên mật khẩu
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const resetToken = await userService.requestPasswordReset(email);

    // Mô phỏng: Trả token về. Trong đời thực: gửi email.
    res.status(200).json({
      message: 'Yêu cầu thành công. (Đã mô phỏng gửi token)',
      resetToken: resetToken, // Bạn sẽ dùng token này để test
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
 * Controller cho việc đặt lại mật khẩu
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await userService.resetPassword(token, newPassword);

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
 * Controller để cập nhật thông tin cá nhân
 */
export const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.MaNguoiDung; // Lấy từ middleware 'protect'
    const dataToUpdate = req.body; // { HoTen, SoDienThoai, DiaChi }

    const updatedUser = await userService.updateMyProfile(userId, dataToUpdate);

    res.status(200).json({
      message: 'Cập nhật thông tin thành công!',
      user: updatedUser, // Gửi lại user mới
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};
export const getMyComplaints = async (req, res) => {
  try {
    const userId = req.user.MaNguoiDung;
    const complaints = await userService.getMyComplaints(userId);
    res.status(200).json({
      message: 'Lấy lịch sử khiếu nại thành công!',
      data: complaints,
    });
  } catch (error) {
    console.error('LỖI KHI LẤY KHIẾU NẠI:', error);
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};