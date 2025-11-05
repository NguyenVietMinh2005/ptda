// src/services/admin.service.js
import prisma from '../config/prisma.js';

/**
 * (Admin) Lấy tất cả người dùng
 */
export const getAllUsers = async () => {
  const users = await prisma.nGUOI_DUNG.findMany({
    select: {
      MaNguoiDung: true,
      HoTen: true,
      Email: true,
      SoDienThoai: true,
      DiaChi: true,
      // Tuyệt đối không trả về MatKhau
    },
  });
  return users;
};

/**
 * (Admin) Lấy tất cả chủ homestay
 */
export const getAllOwners = async () => {
  const owners = await prisma.cHU_HOMESTAY.findMany({
    select: {
      MaChu: true,
      HoTen: true,
      Email: true,
      SoDienThoai: true,
      DiaChi: true,
      SoCCCD: true,
      Quyen: true, // Hiển thị quyền (admin/chu_homestay)
      created_at: true,
    },
  });
  return owners;
};

/**
 * (Admin) Lấy tất cả homestay trong hệ thống
 */
export const getAllHomestays = async () => {
  const homestays = await prisma.hOMESTAY.findMany({
    include: {
      CHU_HOMESTAY: { // Lấy thông tin chủ sở hữu
        select: {
          HoTen: true,
          Email: true,
        },
      },
      DANH_GIA: true, // Lấy kèm đánh giá
      HINH_ANH: {
        take: 1 // Lấy 1 ảnh đại diện
      }
    },
    orderBy: {
      created_at: 'desc', // Sắp xếp theo ngày tạo
    },
  });
  return homestays;
};

/**
 * (Admin) Cập nhật trạng thái (ban/unban) của người dùng
 * @param {number} userId - ID của người dùng
 * @param {boolean} isActive - Trạng thái mới (true hoặc false)
 */
/**
 * (Admin) Xóa bất kỳ homestay nào
 * @param {number} homestayId - ID của homestay
 * @param {number} reviewId - ID của đánh giá (MaDanhGia)
 * @param {number} bookingId - ID của đơn đặt (MaDatPhong)
 * @param {string} newStatus - Trạng thái mới ('DaXacNhan', 'DaHuy', 'ChoXacNhan')
 *
 */
/**
 * (Admin) Giải quyết bất kỳ khiếu nại nào
 * @param {number} complaintId - ID của khiếu nại
 * @param {number} adminId - ID của Admin xử lý (từ req.owner.MaChu)
 * @param {string} resolutionMessage - Nội dung giải quyết
 */

export const adminResolveComplaint = async (complaintId, adminId, resolutionMessage) => {
  // 1. Tìm khiếu nại (chỉ cần tồn tại và chưa xử lý)
  const complaint = await prisma.kHIEU_NAI.findFirst({
    where: {
      MaKhieuNai: complaintId,
      TrangThai: 'ChuaXuLy',
    },
  });

  if (!complaint) {
    throw new Error('Không tìm thấy khiếu nại hoặc khiếu nại đã được xử lý');
  }

  // 2. Dùng transaction để Cập nhật + Tạo xử lý
  const result = await prisma.$transaction(async (tx) => {
    // a. Cập nhật trạng thái
    await tx.kHIEU_NAI.update({
      where: { MaKhieuNai: complaintId },
      data: { TrangThai: 'DaXuLy' },
    });

    // b. Tạo bản ghi Xử Lý (với MaChu là của Admin)
    const resolution = await tx.xU_LY_KHIEU_NAI.create({
      data: {
        MaKhieuNai: complaintId,
        MaChu: adminId, // ID của Admin đã giải quyết
        KetQua: resolutionMessage,
      },
    });

    return resolution;
  });

  return result;
};


export const updateUserStatus = async (userId, isActive) => {
  // 1. Kiểm tra xem người dùng có tồn tại không
  const user = await prisma.nGUOI_DUNG.findUnique({
    where: { MaNguoiDung: userId },
  });

  if (!user) {
    throw new Error('Không tìm thấy người dùng');
  }

  // 2. Cập nhật trạng thái
  const updatedUser = await prisma.nGUOI_DUNG.update({
    where: { MaNguoiDung: userId },
    data: {
      isActive: isActive, // Cập nhật trạng thái
    },
  });

  delete updatedUser.MatKhau; // Xóa mật khẩu trước khi trả về
  return updatedUser;
};

export const updateOwnerStatus = async (ownerId, isActive) => {
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { MaChu: ownerId },
  });

  if (!owner) {
    throw new Error('Không tìm thấy chủ homestay');
  }

  const updatedOwner = await prisma.cHU_HOMESTAY.update({
    where: { MaChu: ownerId },
    data: {
      isActive: isActive,
    },
  });

  delete updatedOwner.MatKhau;
  return updatedOwner;
};

export const updateOwnerRole = async (ownerId, newRole) => {
  // 1. Kiểm tra xem Quyền có hợp lệ không
  if (newRole !== 'admin' && newRole !== 'chu_homestay') {
    throw new Error('Quyền không hợp lệ.');
  }

  // 2. Tìm chủ nhà
  const owner = await prisma.cHU_HOMESTAY.findUnique({
    where: { MaChu: ownerId },
  });
  if (!owner) {
    throw new Error('Không tìm thấy chủ homestay');
  }

  // 3. Cập nhật
  const updatedOwner = await prisma.cHU_HOMESTAY.update({
    where: { MaChu: ownerId },
    data: {
      Quyen: newRole,
    },
  });

  delete updatedOwner.MatKhau;
  return updatedOwner;
};

export const deleteHomestay = async (homestayId) => {
  // 1. Kiểm tra xem homestay có tồn tại không
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId },
  });

  if (!homestay) {
    throw new Error('Không tìm thấy homestay');
  }

  // 2. Xóa homestay (Admin không cần kiểm tra quyền sở hữu)
  await prisma.hOMESTAY.delete({
    where: { MaHomestay: homestayId },
  });

  return;
};

export const deleteReview = async (reviewId) => {
  // 1. Kiểm tra xem đánh giá có tồn tại không
  // 'dANH_GIA' là tên model Prisma
  const review = await prisma.dANH_GIA.findUnique({
    where: { MaDanhGia: reviewId },
  });

  if (!review) {
    throw new Error('Không tìm thấy đánh giá');
  }

  // 2. Xóa đánh giá (Admin không cần kiểm tra quyền sở hữu)
  await prisma.dANH_GIA.delete({
    where: { MaDanhGia: reviewId },
  });

  return;
};

/**
 * (Admin) Lấy tất cả đơn đặt phòng trong hệ thống
 */
export const getAllBookings = async () => {
  const bookings = await prisma.dAT_PHONG.findMany({
    include: {
      NGUOI_DUNG: { // Lấy thông tin người đặt
        select: { HoTen: true, Email: true },
      },
      CHI_TIET_DAT_PHONG: { // Lấy chi tiết homestay đã đặt
        include: {
          HOMESTAY: {
            select: { TenHomestay: true },
          },
        },
      },
    },
    orderBy: {
      created_at: 'desc', // Sắp xếp theo ngày tạo
    },
  });
  return bookings;
};

export const updateBookingStatus = async (bookingId, newStatus) => {
  // 1. Kiểm tra xem trạng thái có hợp lệ không
  const validStatus = ['DaXacNhan', 'DaHuy', 'ChoXacNhan'];
  if (!validStatus.includes(newStatus)) {
    throw new Error('Trạng thái cập nhật không hợp lệ');
  }

  // 2. Kiểm tra xem đơn đặt có tồn tại không
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  // 3. Cập nhật trạng thái (Admin không cần kiểm tra quyền sở hữu)
  const updatedBooking = await prisma.dAT_PHONG.update({
    where: {
      MaDatPhong: bookingId,
    },
    data: {
      TrangThai: newStatus,
    },
  });

  return updatedBooking;
};

/**
 * (Admin) Lấy tất cả khiếu nại trong hệ thống
 */
export const getAllComplaints = async () => {
  const complaints = await prisma.kHIEU_NAI.findMany({
    include: {
      NGUOI_DUNG: { // Lấy thông tin người khiếu nại
        select: { HoTen: true, Email: true },
      },
      DAT_PHONG: { // Lấy thông tin đơn đặt
        select: { MaDatPhong: true },
      },
      XU_LY_KHIEU_NAI: true, // Lấy thông tin xử lý (nếu có)
    },
    orderBy: {
      NgayTao: 'desc',
    },
  });
  return complaints;
};

