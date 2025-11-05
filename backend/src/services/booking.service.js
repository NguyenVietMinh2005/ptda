// src/services/booking.service.js
import prisma from '../config/prisma.js';

/**
 * Cập nhật trạng thái của một đơn đặt phòng (Xác nhận/Hủy)
 * @param {number} bookingId - ID của đơn đặt (MaDatPhong)
 * @param {number} ownerId - ID của chủ homestay (từ req.owner)
 * @param {string} newStatus - Trạng thái mới ('DaXacNhan' hoặc 'DaHuy')
 * @param {string} content - Nội dung khiếu nại (từ req.body)
 * @param {number} userId - ID của người dùng (từ req.user)
 * 
 */
export const updateBookingStatus = async (bookingId, ownerId, newStatus) => {
  // 1. Kiểm tra xem 'newStatus' có hợp lệ không (khớp với Enum)
  if (newStatus !== 'DaXacNhan' && newStatus !== 'DaHuy') {
    throw new Error('Trạng thái cập nhật không hợp lệ'); // Lỗi 400
  }

  // 2. (Quan trọng) Tìm đơn đặt VÀ xác thực quyền sở hữu
  // Tìm một đơn đặt...
  const booking = await prisma.dAT_PHONG.findFirst({
    where: {
      MaDatPhong: bookingId,
      // ...MÀ nó có chi tiết đặt phòng...
      CHI_TIET_DAT_PHONG: {
        some: {
          // ...liên quan đến một homestay...
          HOMESTAY: {
            // ...thuộc sở hữu của chủ này
            MaChu: ownerId,
          },
        },
      },
      // ...VÀ đơn này đang ở trạng thái "Chờ xác nhận"
      TrangThai: 'ChoXacNhan',
    },
  });

  // 3. Nếu không tìm thấy (hoặc không có quyền, hoặc đã xử lý)
  if (!booking) {
    throw new Error(
      'Không tìm thấy đơn đặt, bạn không có quyền, hoặc đơn đã được xử lý'
    ); // Lỗi 404/403
  }

  // 4. Cập nhật trạng thái
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

export const createComplaint = async (bookingId, userId, content) => {
  // 1. Tìm đơn đặt phòng
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng'); // Lỗi 404
  }

  // 2. (Quan trọng) Kiểm tra xem người dùng có phải chủ đơn không
  if (booking.MaNguoiDung !== userId) {
    throw new Error('Bạn không có quyền khiếu nại đơn này'); // Lỗi 403
  }

  // (Nâng cao: Bạn có thể kiểm tra xem đơn đã hoàn thành chưa, v.v.)

  // 3. Kiểm tra xem đã khiếu nại đơn này chưa
  // 'kHIEU_NAI' là tên model Prisma
  const existingComplaint = await prisma.kHIEU_NAI.findFirst({
    where: { MaDatPhong: bookingId },
  });

  if (existingComplaint) {
    throw new Error('Bạn đã khiếu nại đơn này rồi'); // Lỗi 409
  }

  // 4. Tạo khiếu nại
  const newComplaint = await prisma.kHIEU_NAI.create({
    data: {
      MaDatPhong: bookingId,
      MaNguoiDung: userId,
      NoiDung: content,
      TrangThai: 'ChuaXuLy', // Mặc định
    },
  });

  return newComplaint;
};

export const cancelMyBooking = async (bookingId, userId) => {
  // 1. Tìm đơn đặt
  const booking = await prisma.dAT_PHONG.findUnique({
    where: { MaDatPhong: bookingId },
  });

  if (!booking) {
    throw new Error('Không tìm thấy đơn đặt phòng');
  }

  // 2. (Quan trọng) Kiểm tra xem có đúng là chủ đơn không
  if (booking.MaNguoiDung !== userId) {
    throw new Error('Bạn không có quyền hủy đơn này'); // Lỗi 403
  }
  
  // 3. (Quan trọng) Chỉ cho phép hủy khi đang "Chờ Xác Nhận"
  if (booking.TrangThai !== 'ChoXacNhan') {
    throw new Error('Không thể hủy đơn đã được xác nhận hoặc đã bị hủy'); // Lỗi 400
  }

  // 4. Cập nhật trạng thái thành "DaHuy"
  const updatedBooking = await prisma.dAT_PHONG.update({
    where: { MaDatPhong: bookingId },
    data: {
      TrangThai: 'DaHuy',
    },
  });

  return updatedBooking;
};

/**
 * Tạo đơn đặt phòng mới cho người dùng
 */
export const createBooking = async (userId, homestayId, bookingData) => {
  const { NgayNhan, NgayTra, SoLuong, Gia } = bookingData;

  const newBooking = await prisma.dAT_PHONG.create({
    data: {
      MaNguoiDung: userId,
      NgayNhan: new Date(NgayNhan),
      NgayTra: new Date(NgayTra),
      SoLuong: SoLuong,
      Gia: Gia,
      TrangThai: 'ChoXacNhan',
      CHI_TIET_DAT_PHONG: {
        create: {
          MaHomestay: homestayId,
          SoLuongPhong: 1, // hoặc SoLuong nếu 1 đơn = 1 homestay
        },
      },
    },
    include: {
      CHI_TIET_DAT_PHONG: {
        include: { HOMESTAY: true },
      },
      NGUOI_DUNG: true,
    },
  });

  return newBooking;
};
