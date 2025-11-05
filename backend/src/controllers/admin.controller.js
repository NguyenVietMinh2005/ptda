// src/controllers/admin.controller.js
import * as adminService from '../services/admin.service.js';

/**
 * (Admin) Controller lấy tất cả người dùng
 */
export const getAllUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
    res.status(200).json({
      message: 'Lấy danh sách người dùng thành công!',
      data: users,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};
/**
 * (Admin) Controller lấy tất cả chủ homestay
 */
export const getAllOwners = async (req, res) => {
  try {
    const owners = await adminService.getAllOwners();
    res.status(200).json({
      message: 'Lấy danh sách chủ homestay thành công!',
      data: owners,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};
/**
 * (Admin) Controller lấy tất cả homestay
 */
export const getAllHomestays = async (req, res) => {
  try {
    const homestays = await adminService.getAllHomestays();
    res.status(200).json({
      message: 'Lấy danh sách tất cả homestay thành công!',
      data: homestays,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * (Admin) Controller cập nhật trạng thái người dùng
 */
export const updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body; // Mong đợi { "isActive": false }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Trường isActive là bắt buộc và phải là boolean' });
    }

    const user = await adminService.updateUserStatus(userId, isActive);

    res.status(200).json({
      message: `Cập nhật trạng thái người dùng ${userId} thành ${isActive} thành công!`,
      data: user,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};
/**
 * (Admin) Controller cập nhật trạng thái chủ homestay
 */
export const updateOwnerStatus = async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'Trường isActive là bắt buộc' });
    }

    const owner = await adminService.updateOwnerStatus(ownerId, isActive);

    res.status(200).json({
      message: `Cập nhật trạng thái chủ homestay ${ownerId} thành ${isActive} thành công!`,
      data: owner,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * (Admin) Controller xóa homestay
 */
export const deleteHomestay = async (req, res) => {
  try {
    const homestayId = parseInt(req.params.id);

    await adminService.deleteHomestay(homestayId);

    // 204 No Content là mã tiêu chuẩn cho DELETE thành công
    res.status(204).send();
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * (Admin) Controller xóa đánh giá
 */
export const deleteReview = async (req, res) => {
  try {
    const reviewId = parseInt(req.params.id);

    await adminService.deleteReview(reviewId);

    res.status(204).send(); // 204 No Content
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * (Admin) Controller lấy tất cả đơn đặt phòng
 */
export const getAllBookings = async (req, res) => {
  try {
    const bookings = await adminService.getAllBookings();
    res.status(200).json({
      message: 'Lấy danh sách tất cả đơn đặt phòng thành công!',
      data: bookings,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * (Admin) Controller cập nhật trạng thái đơn đặt phòng
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { trangThai } = req.body; // Lấy trạng thái mới từ body

    const updatedBooking = await adminService.updateBookingStatus(
      bookingId,
      trangThai
    );

    res.status(200).json({
      message: `(Admin) Cập nhật trạng thái đơn ${bookingId} thành '${trangThai}' thành công!`,
      data: updatedBooking,
    });
  } catch (error) {
    if (error.message.includes('Trạng thái cập nhật không hợp lệ')) {
      res.status(400).json({ message: error.message });
    } else if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * (Admin) Controller lấy tất cả khiếu nại
 */
export const getAllComplaints = async (req, res) => {
  try {
    const complaints = await adminService.getAllComplaints();
    res.status(200).json({
      message: 'Lấy danh sách tất cả khiếu nại thành công!',
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

export const updateOwnerRole = async (req, res) => {
  try {
    const ownerId = parseInt(req.params.id);
    const { role } = req.body; // Lấy { "role": "admin" }

    // Admin không thể tự đổi quyền của chính mình
    if (req.owner.MaChu === ownerId) {
      return res.status(403).json({ message: 'Bạn không thể tự thay đổi quyền của mình.' });
    }

    const owner = await adminService.updateOwnerRole(ownerId, role);

    res.status(200).json({
      message: `Cập nhật quyền cho ${owner.HoTen} thành ${role} thành công!`,
      data: owner,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * (Admin) Controller giải quyết khiếu nại
 */
export const adminResolveComplaint = async (req, res) => {
  try {
    const complaintId = parseInt(req.params.id);
    const adminId = req.owner.MaChu; // Lấy ID Admin từ middleware
    const { ketQua } = req.body; // Lấy nội dung phản hồi

    if (!ketQua) {
      return res.status(400).json({ message: 'Nội dung phản hồi là bắt buộc.' });
    }

    const resolution = await adminService.adminResolveComplaint(
      complaintId,
      adminId,
      ketQua
    );

    res.status(201).json({
      message: 'Giải quyết khiếu nại thành công!',
      data: resolution,
    });
  } catch (error) {
    if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};