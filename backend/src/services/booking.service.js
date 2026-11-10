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
  const allowedStatuses = ['DaXacNhan', 'DaHuy', 'DangLuuTru', 'DaHoanThanh'];
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error('Trạng thái cập nhật không hợp lệ');
  }

  // 1. Tìm đơn đặt VÀ xác thực quyền sở hữu của chủ nhà
  const booking = await prisma.dAT_PHONG.findFirst({
    where: {
      MaDatPhong: bookingId,
      CHI_TIET_DAT_PHONG: {
        some: {
          HOMESTAY: {
            MaChu: ownerId,
          },
        },
      },
    },
    include: {
      CHI_TIET_DAT_PHONG: true,
    },
  });

  if (!booking) {
    throw new Error(
      'Không tìm thấy đơn đặt, hoặc bạn không có quyền quản lý đơn này'
    );
  }

  // 2. Kiểm tra tính hợp lệ của luồng chuyển đổi trạng thái
  if (newStatus === 'DaXacNhan') {
    if (booking.TrangThai !== 'ChoXacNhan') {
      throw new Error('Chỉ có thể xác nhận đơn đặt phòng đang ở trạng thái Chờ xác nhận');
    }

    // KIỂM TRA LẠI LỊCH TRÙNG TRƯỚC KHI XÁC NHẬN
    const homestayId = booking.CHI_TIET_DAT_PHONG[0]?.MaHomestay;
    if (homestayId) {
      const conflict = await prisma.dAT_PHONG.findFirst({
        where: {
          MaDatPhong: { not: bookingId },
          CHI_TIET_DAT_PHONG: {
            some: { MaHomestay: homestayId },
          },
          TrangThai: {
            in: ['DaXacNhan', 'DangLuuTru'],
          },
          AND: [
            { NgayNhan: { lt: booking.NgayTra } },
            { NgayTra: { gt: booking.NgayNhan } },
          ],
        },
      });

      if (conflict) {
        throw new Error('Không thể xác nhận đơn này vì đã có đơn khác được xác nhận trong cùng khoảng thời gian.');
      }
    }
  } else if (newStatus === 'DangLuuTru') {
    if (booking.TrangThai !== 'DaXacNhan') {
      throw new Error('Chỉ có thể chuyển sang Đang lưu trú khi đơn đã được xác nhận');
    }
  } else if (newStatus === 'DaHoanThanh') {
    if (booking.TrangThai !== 'DangLuuTru' && booking.TrangThai !== 'DaXacNhan') {
      throw new Error('Chỉ có thể hoàn thành đơn đã được xác nhận hoặc đang lưu trú');
    }
  } else if (newStatus === 'DaHuy') {
    if (booking.TrangThai === 'DaHoanThanh') {
      throw new Error('Không thể hủy đơn đặt phòng đã hoàn thành lưu trú');
    }
  }

  // 3. Cập nhật trạng thái mới
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
  const { NgayNhan, NgayTra, SoLuong } = bookingData; // Bỏ 'Gia' ở đây, ta sẽ tự tính

  // 1. Lấy thông tin Homestay để lấy GIÁ GỐC
  const homestay = await prisma.hOMESTAY.findUnique({
    where: { MaHomestay: homestayId }
  });

  if (!homestay) {
    throw new Error('Homestay không tồn tại');
  }

  // 2. Tính toán số ngày lưu trú
  const startDate = new Date(NgayNhan);
  const endDate = new Date(NgayTra);

  // Tính hiệu số mili-giây: (1000ms * 60s * 60m * 24h = 86400000)
  const differenceInTime = endDate.getTime() - startDate.getTime();
  let soNgay = Math.ceil(differenceInTime / (1000 * 3600 * 24));

  // Nếu khách chọn ngày đi trùng ngày về (0 ngày) hoặc lỗi, mặc định tính ít nhất 1 đêm
  if (soNgay <= 0) soNgay = 1;

  // 3. TÍNH TỔNG TIỀN = Giá gốc * Số ngày
  const tongTien = homestay.Gia * soNgay;

  // 4. Tạo đơn với giá đã tính toán
  const newBooking = await prisma.dAT_PHONG.create({
    data: {
      MaNguoiDung: userId,
      NgayNhan: startDate,
      NgayTra: endDate,
      SoLuong: SoLuong,
      Gia: tongTien, // <--- Lưu giá do Backend tính
      TrangThai: 'ChoXacNhan',
      CHI_TIET_DAT_PHONG: {
        create: {
          MaHomestay: homestayId,
          SoLuongPhong: 1, 
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
