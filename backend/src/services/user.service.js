// src/services/user.service.js
import prisma from '../config/prisma.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Lấy tất cả homestay yêu thích của một người dùng
 * @param {number} userId - ID của người dùng
 * @param {object} data - Dữ liệu cần cập nhật (HoTen, SoDienThoai, DiaChi)
 * 
 */
export const getFavorites = async (userId) => {
  // 1. Tìm tất cả các bản ghi YEU_THICH của người dùng này
  const favorites = await prisma.yEU_THICH.findMany({
    where: {
      MaNguoiDung: userId,
    },
    // 2. (Quan trọng) Sử dụng 'include' để lấy luôn thông tin
    // của HOMESTAY liên quan đến mục yêu thích đó
    include: {
      HOMESTAY: true, // Tên 'HOMESTAY' phải khớp với tên relation trong schema
    },
  });

  // 3. Trả về danh sách (có thể rỗng)
  return favorites;
};

export const getMyBookings = async (userId) => {
  // 1. Tìm tất cả các đơn DAT_PHONG của người dùng này
  const bookings = await prisma.dAT_PHONG.findMany({
    where: {
      MaNguoiDung: userId,
    },
    // 2. (Quan trọng) Lấy kèm chi tiết
    include: {
      // Lấy các chi tiết trong bảng CHI_TIET_DAT_PHONG
      CHI_TIET_DAT_PHONG: {
        // Từ bảng chi tiết, lấy luôn thông tin HOMESTAY
        include: {
          HOMESTAY: true, // Lấy thông tin homestay đã đặt
        },
      },
    },
    // Sắp xếp đơn mới nhất lên đầu
    orderBy: {
      created_at: 'desc',
    },
  });

  return bookings;
};

/**
 * Xử lý yêu cầu quên mật khẩu
 */
export const requestPasswordReset = async (email) => {
  // 1. Tìm user
  const user = await prisma.nGUOI_DUNG.findUnique({
    where: { Email: email },
  });

  if (!user) {
    throw new Error('Email không tồn tại');
  }

  // 2. Tạo token ngẫu nhiên (để "gửi email")
  const resetToken = crypto.randomBytes(32).toString('hex');

  // 3. Băm token này để lưu vào DB (bảo mật)
  const hashedToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // 4. Đặt thời gian hết hạn (10 phút)
  const resetExpires = new Date(Date.now() + 10 * 60 * 1000); 

  // 5. Cập nhật user với token đã băm
  await prisma.nGUOI_DUNG.update({
    where: { Email: email },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpires: resetExpires,
    },
  });

  // 6. Trả về token gốc (để "gửi email")
  // TRONG ĐỜI THỰC: Bạn sẽ dùng 'nodemailer' để gửi 'resetToken'
  return resetToken; 
};

/**
 * Xử lý đặt lại mật khẩu
 */
export const resetPassword = async (token, newPassword) => {
  // 1. Băm token nhận được
  const hashedToken = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // 2. Tìm user bằng token đã băm VÀ token chưa hết hạn
  const user = await prisma.nGUOI_DUNG.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpires: { gt: new Date() }, // 'gt' = greater than
    },
  });

  if (!user) {
    throw new Error('Token không hợp lệ hoặc đã hết hạn');
  }

  // 3. Băm mật khẩu mới
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // 4. Cập nhật mật khẩu và xóa token
  await prisma.nGUOI_DUNG.update({
    where: { MaNguoiDung: user.MaNguoiDung },
    data: {
      MatKhau: hashedPassword,
      passwordResetToken: null, // Xóa token
      passwordResetExpires: null, // Xóa thời gian
    },
  });

  return; // Thành công
};


// Cập nhật thông tin cá nhân của người dùng
export const updateMyProfile = async (userId, data) => {
  const { HoTen, SoDienThoai, DiaChi } = data;

  const user = await prisma.nGUOI_DUNG.update({
    where: { MaNguoiDung: userId },
    data: {
      HoTen: HoTen,
      SoDienThoai: SoDienThoai,
      DiaChi: DiaChi,
    },
  });

  delete user.MatKhau; // Luôn xóa mật khẩu trước khi trả về
  return user;
};

export const getMyComplaints = async (userId) => {
  const complaints = await prisma.kHIEU_NAI.findMany({
    where: {
      MaNguoiDung: userId,
    },
    include: {
      DAT_PHONG: {
        select: {
          MaDatPhong: true,
        }
      },
      XU_LY_KHIEU_NAI: true
    },
    orderBy: {
      NgayTao: 'desc',
    },
  });
  return complaints;
};