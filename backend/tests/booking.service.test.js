// backend/tests/booking.service.test.js
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as homestayService from '../src/services/homestay.service.js';
import * as bookingService from '../src/services/booking.service.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('White-Box Testing: Booking Service & Conflict Prevention', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  // =========================================================================
  // 1. homestayService.bookHomestay
  // =========================================================================
  describe('homestayService.bookHomestay()', () => {
    it('TC-BOOK-01 [Branch: !homestay] throws error when homestay is not found', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => homestayService.bookHomestay(10, 999, {
          ngayNhan: '2026-11-01',
          ngayTra: '2026-11-03',
          soLuongKhach: 2,
        }),
        { message: 'Không tìm thấy homestay' }
      );
    });

    it('TC-BOOK-02 [Branch: homestay.isActive === false] throws error when homestay is inactive', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: false,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: '2026-11-01',
          ngayTra: '2026-11-03',
          soLuongKhach: 2,
        }),
        { message: 'Homestay hiện không nhận đặt phòng' }
      );
    });

    it('TC-BOOK-03 [Branch: homestay.TrangThaiDuyet !== "DaDuyet"] throws error when homestay is pending or rejected', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'ChoDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: '2026-11-01',
          ngayTra: '2026-11-03',
          soLuongKhach: 2,
        }),
        { message: 'Homestay hiện không nhận đặt phòng' }
      );
    });

    it('TC-BOOK-04 [Branch: soLuongKhach > SoKhachToiDa] throws error when guest count exceeds limit', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 2,
        Gia: 500000,
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: '2026-11-01',
          ngayTra: '2026-11-03',
          soLuongKhach: 5, // Vượt quá 2
        }),
        { message: 'Số lượng khách vượt quá mức cho phép' }
      );
    });

    it('TC-BOOK-05 [Branch: isNaN(dates)] throws error when booking date string is invalid', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: 'invalid-date',
          ngayTra: '2026-11-03',
          soLuongKhach: 2,
        }),
        { message: 'Ngày nhận hoặc ngày trả phòng không hợp lệ' }
      );
    });

    it('TC-BOOK-06 [Branch: soDem <= 0] throws error when check-out is before or same as check-in', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: '2026-11-05',
          ngayTra: '2026-11-05', // 0 đêm
          soLuongKhach: 2,
        }),
        { message: 'Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm' }
      );
    });

    it('TC-BOOK-07 [Branch: conflictBooking overlap detected] throws conflict error when dates intersect', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 88,
        TrangThai: 'DaXacNhan',
      }));

      await assert.rejects(
        () => homestayService.bookHomestay(10, 1, {
          ngayNhan: '2026-11-02',
          ngayTra: '2026-11-06',
          soLuongKhach: 2,
        }),
        { message: 'Khoảng thời gian này đã có khách đặt hoặc đang chờ xác nhận. Vui lòng chọn ngày khác.' }
      );
    });

    it('TC-BOOK-08 [Branch: Success booking creation] creates booking and computes price correctly', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 600000,
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null); // Không trùng

      let createdDatPhongData = null;
      mockMethod(prisma.dAT_PHONG, 'create', async ({ data }) => {
        createdDatPhongData = data;
        return {
          MaDatPhong: 101,
          ...data,
        };
      });

      let createdChiTietData = null;
      mockMethod(prisma.cHI_TIET_DAT_PHONG, 'create', async ({ data }) => {
        createdChiTietData = data;
        return data;
      });

      const result = await homestayService.bookHomestay(10, 1, {
        ngayNhan: '2026-11-01',
        ngayTra: '2026-11-04', // 3 đêm -> 3 * 600,000 = 1,800,000
        soLuongKhach: 3,
      });

      assert.equal(result.MaDatPhong, 101);
      assert.equal(createdDatPhongData.Gia, 1800000);
      assert.equal(createdDatPhongData.TrangThai, 'ChoXacNhan');
      assert.equal(createdDatPhongData.TrangThaiThanhToan, 'ChuaThanhToan');
      assert.equal(createdChiTietData.MaHomestay, 1);
    });
  });

  // =========================================================================
  // 2. bookingService.updateBookingStatus
  // =========================================================================
  describe('bookingService.updateBookingStatus()', () => {
    it('TC-UB-01 [Branch: !allowedStatuses] throws error for invalid new status', async () => {
      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'TrangThaiTamBho'),
        { message: 'Trạng thái cập nhật không hợp lệ' }
      );
    });

    it('TC-UB-02 [Branch: !booking / not owner] throws error when booking not found or owner unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null);

      await assert.rejects(
        () => bookingService.updateBookingStatus(999, 1, 'DaXacNhan'),
        { message: 'Không tìm thấy đơn đặt, hoặc bạn không có quyền quản lý đơn này' }
      );
    });

    it('TC-UB-03 [Branch: DaXacNhan with status !== ChoXacNhan] throws error', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaHuy', // Không phải ChoXacNhan
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'DaXacNhan'),
        { message: 'Chỉ có thể xác nhận đơn đặt phòng đang ở trạng thái Chờ xác nhận' }
      );
    });

    it('TC-UB-04 [Branch: DaXacNhan conflict with confirmed booking] throws error', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async (args) => {
        // Lần 1: tìm booking hiện tại
        if (args.where.MaDatPhong === 1) {
          return {
            MaDatPhong: 1,
            TrangThai: 'ChoXacNhan',
            NgayNhan: new Date('2026-11-01'),
            NgayTra: new Date('2026-11-04'),
            CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
          };
        }
        // Lần 2: kiểm tra conflict
        return { MaDatPhong: 2, TrangThai: 'DaXacNhan' };
      });

      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'DaXacNhan'),
        { message: 'Không thể xác nhận đơn này vì đã có đơn khác được xác nhận trong cùng khoảng thời gian.' }
      );
    });

    it('TC-UB-05 [Branch: DaXacNhan valid transition] successfully updates status to DaXacNhan', async () => {
      let updateArgs = null;
      mockMethod(prisma.dAT_PHONG, 'findFirst', async (args) => {
        if (args.where.MaDatPhong === 1) {
          return {
            MaDatPhong: 1,
            TrangThai: 'ChoXacNhan',
            NgayNhan: new Date('2026-11-01'),
            NgayTra: new Date('2026-11-04'),
            CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
          };
        }
        return null; // Không trùng
      });

      mockMethod(prisma.dAT_PHONG, 'update', async (args) => {
        updateArgs = args;
        return { MaDatPhong: 1, TrangThai: args.data.TrangThai };
      });

      const res = await bookingService.updateBookingStatus(1, 1, 'DaXacNhan');
      assert.equal(res.TrangThai, 'DaXacNhan');
      assert.equal(updateArgs.data.TrangThai, 'DaXacNhan');
    });

    it('TC-UB-06 [Branch: DangLuuTru with status !== DaXacNhan] throws error', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'ChoXacNhan', // Phải là DaXacNhan mới check in được
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'DangLuuTru'),
        { message: 'Chỉ có thể chuyển sang Đang lưu trú khi đơn đã được xác nhận' }
      );
    });

    it('TC-UB-07 [Branch: DangLuuTru valid transition] updates status to DangLuuTru', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaXacNhan',
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      mockMethod(prisma.dAT_PHONG, 'update', async (args) => ({
        MaDatPhong: 1,
        TrangThai: args.data.TrangThai,
      }));

      const res = await bookingService.updateBookingStatus(1, 1, 'DangLuuTru');
      assert.equal(res.TrangThai, 'DangLuuTru');
    });

    it('TC-UB-08 [Branch: DaHoanThanh from invalid status] throws error', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'ChoXacNhan', // Không thể hoàn thành trực tiếp từ ChoXacNhan
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'DaHoanThanh'),
        { message: 'Chỉ có thể hoàn thành đơn đã được xác nhận hoặc đang lưu trú' }
      );
    });

    it('TC-UB-09 [Branch: DaHoanThanh from DangLuuTru] updates status to DaHoanThanh', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DangLuuTru',
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      mockMethod(prisma.dAT_PHONG, 'update', async (args) => ({
        MaDatPhong: 1,
        TrangThai: args.data.TrangThai,
      }));

      const res = await bookingService.updateBookingStatus(1, 1, 'DaHoanThanh');
      assert.equal(res.TrangThai, 'DaHoanThanh');
    });

    it('TC-UB-10 [Branch: DaHuy when already DaHoanThanh] throws error', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaHoanThanh',
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      await assert.rejects(
        () => bookingService.updateBookingStatus(1, 1, 'DaHuy'),
        { message: 'Không thể hủy đơn đặt phòng đã hoàn thành lưu trú' }
      );
    });

    it('TC-UB-11 [Branch: DaHuy valid transition] updates status to DaHuy', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'ChoXacNhan',
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 1 }],
      }));

      mockMethod(prisma.dAT_PHONG, 'update', async (args) => ({
        MaDatPhong: 1,
        TrangThai: args.data.TrangThai,
      }));

      const res = await bookingService.updateBookingStatus(1, 1, 'DaHuy');
      assert.equal(res.TrangThai, 'DaHuy');
    });
  });

  // =========================================================================
  // 3. bookingService.cancelMyBooking
  // =========================================================================
  describe('bookingService.cancelMyBooking()', () => {
    it('TC-CB-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => bookingService.cancelMyBooking(999, 10),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-CB-02 [Branch: MaNguoiDung !== userId] throws error when user is not owner of booking', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 99, // Người khác
        TrangThai: 'ChoXacNhan',
      }));

      await assert.rejects(
        () => bookingService.cancelMyBooking(1, 10),
        { message: 'Bạn không có quyền hủy đơn này' }
      );
    });

    it('TC-CB-03 [Branch: TrangThai !== ChoXacNhan] throws error when canceling confirmed booking', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'DaXacNhan',
      }));

      await assert.rejects(
        () => bookingService.cancelMyBooking(1, 10),
        { message: 'Không thể hủy đơn đã được xác nhận hoặc đã bị hủy' }
      );
    });

    it('TC-CB-04 [Branch: Success cancel] updates status to DaHuy', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
      }));

      mockMethod(prisma.dAT_PHONG, 'update', async ({ where, data }) => ({
        ...where,
        ...data,
      }));

      const res = await bookingService.cancelMyBooking(1, 10);
      assert.equal(res.TrangThai, 'DaHuy');
    });
  });

  // =========================================================================
  // 4. bookingService.createComplaint
  // =========================================================================
  describe('bookingService.createComplaint()', () => {
    it('TC-CMP-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => bookingService.createComplaint(999, 10, 'Nội dung khiếu nại'),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-CMP-02 [Branch: booking.MaNguoiDung !== userId] throws error when unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 99, // Người khác
      }));

      await assert.rejects(
        () => bookingService.createComplaint(1, 10, 'Nội dung khiếu nại'),
        { message: 'Bạn không có quyền khiếu nại đơn này' }
      );
    });

    it('TC-CMP-03 [Branch: existingComplaint] throws error when already complained', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
      }));

      mockMethod(prisma.kHIEU_NAI, 'findFirst', async () => ({
        MaKhieuNai: 5,
        MaDatPhong: 1,
      }));

      await assert.rejects(
        () => bookingService.createComplaint(1, 10, 'Nội dung khiếu nại lần 2'),
        { message: 'Bạn đã khiếu nại đơn này rồi' }
      );
    });

    it('TC-CMP-04 [Branch: Success creation] creates complaint with ChuaXuLy status', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
      }));

      mockMethod(prisma.kHIEU_NAI, 'findFirst', async () => null);

      let createdData = null;
      mockMethod(prisma.kHIEU_NAI, 'create', async ({ data }) => {
        createdData = data;
        return { MaKhieuNai: 10, ...data };
      });

      const res = await bookingService.createComplaint(1, 10, 'Phòng không đúng như hình');

      assert.equal(res.MaKhieuNai, 10);
      assert.equal(createdData.MaDatPhong, 1);
      assert.equal(createdData.MaNguoiDung, 10);
      assert.equal(createdData.NoiDung, 'Phòng không đúng như hình');
      assert.equal(createdData.TrangThai, 'ChuaXuLy');
    });
  });
});

