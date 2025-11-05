// src/services/complaint.service.js
import prisma from '../config/prisma.js';

/**
 * Giải quyết một khiếu nại
 * @param {number} complaintId - ID của khiếu nại (MaKhieuNai)
 * @param {number} ownerId - ID của chủ homestay (từ req.owner)
 * @param {string} resolutionMessage - Nội dung giải quyết (KetQua)
 */
export const resolveComplaint = async (
  complaintId,
  ownerId,
  resolutionMessage
) => {
  // 1. (Quan trọng) Xác thực xem chủ sở hữu này có quyền giải quyết không
  const complaint = await prisma.kHIEU_NAI.findFirst({
    where: {
      MaKhieuNai: complaintId,
      TrangThai: 'ChuaXuLy', // Chỉ giải quyết đơn 'ChuaXuLy'
      DAT_PHONG: {
        CHI_TIET_DAT_PHONG: {
          some: {
            HOMESTAY: {
              MaChu: ownerId,
            },
          },
        },
      },
    },
  });

  if (!complaint) {
    throw new Error(
      'Không tìm thấy khiếu nại, không có quyền, hoặc khiếu nại đã được xử lý'
    );
  }

  // 2. Dùng transaction để thực hiện 2 hành động
  const result = await prisma.$transaction(async (tx) => {
    // a. Cập nhật trạng thái khiếu nại
    await tx.kHIEU_NAI.update({
      where: { MaKhieuNai: complaintId },
      data: { TrangThai: 'DaXuLy' },
    });

    // b. Tạo bản ghi Xử Lý Khiếu Nại
    // 'xU_LY_KHIEU_NAI' là tên model Prisma
    const resolution = await tx.xU_LY_KHIEU_NAI.create({
      data: {
        MaKhieuNai: complaintId,
        MaChu: ownerId,
        KetQua: resolutionMessage,
      },
    });

    return resolution;
  });

  return result;
};