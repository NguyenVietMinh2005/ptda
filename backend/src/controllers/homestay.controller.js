// src/controllers/homestay.controller.js
import * as homestayService from '../services/homestay.service.js';

/**
 * Controller để lấy tất cả homestay (ĐÃ CẬP NHẬT với bộ lọc)
 */
export const getAllHomestays = async (req, res) => {
  try {
    // req.query là đối tượng chứa các tham số sau dấu '?'
    // Ví dụ: ?diaDiem=Hanoi -> req.query = { diaDiem: "Hanoi" }
    const homestays = await homestayService.getAllHomestays(req.query); 
    
    res.status(200).json({
      message: 'Lấy danh sách homestay thành công!',
      count: homestays.length, // Trả về số lượng kết quả
      data: homestays,
    });
  } catch (error) {
    console.error('LỖI KHI GỌI getAllHomestays:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy homestay.' });
  }
};

// (Sau này bạn sẽ thêm các controller khác như getById, create, ...)

/**
 * Controller để lấy một homestay bằng ID
 */
export const getHomestayById = async (req, res) => {
  try {
    // Lấy 'id' từ URL (ví dụ: /homestays/123)
    // req.params.id sẽ là "123" (kiểu string)
    // Chúng ta cần chuyển nó sang kiểu số (Integer)
    const homestayId = parseInt(req.params.id);

    const homestay = await homestayService.getHomestayById(homestayId);
    
    res.status(200).json({
      message: 'Lấy thông tin homestay thành công!',
      data: homestay,
    });
  } catch (error) {
    if (error.message === 'Không tìm thấy homestay') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để thêm vào yêu thích
 */
export const addFavorite = async (req, res) => {
  try {
    // 1. Lấy ID của homestay từ URL params
    const homestayId = parseInt(req.params.id);
    
    // 2. Lấy ID của người dùng từ middleware 'protect'
    const userId = req.user.MaNguoiDung;

    const favorite = await homestayService.addFavorite(userId, homestayId);
    
    res.status(201).json({ // 201 Created
      message: 'Đã thêm vào danh sách yêu thích!',
      data: favorite,
    });
  } catch (error) {
    if (error.message === 'Không tìm thấy homestay') {
      res.status(404).json({ message: error.message });
    } else if (error.message === 'Homestay này đã có trong danh sách yêu thích') {
      res.status(409).json({ message: error.message }); // 409 Conflict (Bị trùng)
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để xóa khỏi yêu thích
 */
export const removeFavorite = async (req, res) => {
  try {
    // 1. Lấy ID của homestay từ URL params
    const homestayId = parseInt(req.params.id);
    
    // 2. Lấy ID của người dùng từ middleware 'protect'
    const userId = req.user.MaNguoiDung;

    await homestayService.removeFavorite(userId, homestayId);
    
    // Trả về 204 No Content - là tiêu chuẩn cho API DELETE thành công
    res.status(204).send(); 
  } catch (error) {
    if (error.message === 'Homestay này không có trong danh sách yêu thích') {
      res.status(404).json({ message: error.message }); // 404 Not Found
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để tạo một đánh giá mới
 */
export const createReview = async (req, res) => {
  try {
    // 1. Lấy ID của homestay từ URL
    const homestayId = parseInt(req.params.id);
    
    // 2. Lấy ID của người dùng từ middleware
    const userId = req.user.MaNguoiDung;
    
    // 3. Lấy dữ liệu review từ body
    const reviewData = req.body; // Mong đợi { soSao: 5, binhLuan: "..." }

    const review = await homestayService.createReview(userId, homestayId, reviewData);
    
    res.status(201).json({ // 201 Created
      message: 'Gửi đánh giá thành công!',
      data: review,
    });
  } catch (error) {
    if (error.message === 'Không tìm thấy homestay') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để xử lý đặt phòng
 */
export const bookHomestay = async (req, res) => {
  try {
    const homestayId = parseInt(req.params.id);
    const userId = req.user.MaNguoiDung;
    const bookingData = req.body; // { ngayNhan, ngayTra, soLuongKhach }

    const booking = await homestayService.bookHomestay(
      userId,
      homestayId,
      bookingData
    );

    res.status(201).json({
      message: 'Đặt phòng thành công! Chờ xác nhận.',
      data: booking,
    });
  } catch (error) {
    // Bắt các lỗi nghiệp vụ từ service
    if (
      error.message === 'Không tìm thấy homestay' ||
      error.message === 'Ngày trả phải sau ngày nhận'
    ) {
      res.status(404).json({ message: error.message });
    } else if (error.message === 'Số lượng khách vượt quá mức cho phép') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để tạo homestay mới
 */
export const createHomestay = async (req, res) => {
  try {
    // 1. Lấy dữ liệu homestay từ body
    const homestayData = req.body;
    
    // 2. Lấy ID chủ homestay từ middleware 'protectOwner'
    const ownerId = req.owner.MaChu; 

    const homestay = await homestayService.createHomestay(homestayData, ownerId);

    res.status(201).json({
      message: 'Tạo homestay thành công!',
      data: homestay,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi máy chủ.' });
  }
};

/**
 * Controller để cập nhật homestay
 */
export const updateHomestay = async (req, res) => {
  try {
    // 1. Lấy ID homestay từ URL
    const homestayId = parseInt(req.params.id);
    
    // 2. Lấy ID chủ sở hữu từ middleware
    const ownerId = req.owner.MaChu;
    
    // 3. Lấy dữ liệu mới từ body
    const updateData = req.body;

    const homestay = await homestayService.updateHomestay(
      homestayId,
      ownerId,
      updateData
    );

    res.status(200).json({
      message: 'Cập nhật homestay thành công!',
      data: homestay,
    });
  } catch (error) {
    if (error.message === 'Không tìm thấy homestay') {
      res.status(404).json({ message: error.message }); // 404 Not Found
    } else if (error.message === 'Không có quyền chỉnh sửa homestay này') {
      res.status(403).json({ message: error.message }); // 403 Forbidden
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để xóa homestay
 */
export const deleteHomestay = async (req, res) => {
  try {
    // 1. Lấy ID homestay từ URL
    const homestayId = parseInt(req.params.id);
    
    // 2. Lấy ID chủ sở hữu từ middleware
    const ownerId = req.owner.MaChu;

    await homestayService.deleteHomestay(homestayId, ownerId);

    // 204 No Content là mã tiêu chuẩn cho DELETE thành công
    res.status(204).send(); 
  } catch (error) {
    if (error.message === 'Không tìm thấy homestay') {
      res.status(404).json({ message: error.message }); // 404 Not Found
    } else if (error.message === 'Không có quyền xóa homestay này') {
      res.status(403).json({ message: error.message }); // 403 Forbidden
    } else {
      res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
  }
};

/**
 * Controller để upload ảnh
 */
export const uploadImages = async (req, res) => {
  try {
    const homestayId = parseInt(req.params.id);
    const ownerId = req.owner.MaChu;
    
    // 'req.files' được tạo bởi middleware 'upload.array()'
    const files = req.files; 

    const images = await homestayService.uploadImages(homestayId, ownerId, files);

    res.status(201).json({
      message: `Tải lên ${files.length} ảnh thành công!`,
      data: images,
    });
  } catch (error) {
    if (error.message.includes('Không có quyền')) {
      res.status(403).json({ message: error.message });
    } else if (error.message.includes('Không tìm thấy')) {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
};