// backend/tests/payment.service.test.js
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as paymentService from '../src/services/payment.service.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('White-Box Testing: Mock Payment Service & Status Transitions', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  // =========================================================================
  // 1. paymentService.getPaymentInfo
  // =========================================================================
  describe('paymentService.getPaymentInfo()', () => {
    it('TC-PAY-INFO-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => paymentService.getPaymentInfo(999, 1),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-PAY-INFO-02 [Branch: !isGuest && !isOwner] throws error when unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10, // Khách khác
        CHI_TIET_DAT_PHONG: [
          { HOMESTAY: { MaChu: 5 } } // Chủ khác
        ],
      }));

      await assert.rejects(
        () => paymentService.getPaymentInfo(1, 99, 99),
        { message: 'Bạn không có quyền xem thông tin thanh toán đơn này' }
      );
    });

    it('TC-PAY-INFO-03 [Branch: isCancelled] returns canPay false with cancellation restriction', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'DaHuy',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 1200000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { TenHomestay: 'Test HS', DiaDiem: 'HN' } }],
        GIAO_DICH: [],
      }));

      const info = await paymentService.getPaymentInfo(1, 10);
      assert.equal(info.canPay, false);
      assert.equal(info.paymentRestrictionMessage, 'Đơn đặt phòng này đã bị hủy, không thể thực hiện thanh toán.');
    });

    it('TC-PAY-INFO-04 [Branch: isPaid] returns canPay false with paid message', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 2,
        MaNguoiDung: 10,
        TrangThai: 'DaXacNhan',
        TrangThaiThanhToan: 'DaThanhToan',
        Gia: 1200000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { TenHomestay: 'Test HS', DiaDiem: 'HN' } }],
        GIAO_DICH: [],
      }));

      const info = await paymentService.getPaymentInfo(2, 10);
      assert.equal(info.canPay, false);
      assert.equal(info.isPaid, true);
      assert.equal(info.paymentRestrictionMessage, 'Đơn đặt phòng này đã được thanh toán thành công.');
    });

    it('TC-PAY-INFO-05 [Branch: canPay true] returns QR demo info and bank transfer memo', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 3,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 850000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { TenHomestay: 'Villa Ha Noi', DiaDiem: 'Hà Nội' } }],
        GIAO_DICH: [],
      }));

      const info = await paymentService.getPaymentInfo(3, 10);
      assert.equal(info.canPay, true);
      assert.equal(info.soTien, 850000);
      assert.equal(info.demoBankInfo.transferMemo, 'THANHTOAN DP3');
      assert.ok(info.demoBankInfo.qrCodeDataUrl); // Sinh QR Data URL
    });
  });

  // =========================================================================
  // 2. paymentService.selectPaymentMethod
  // =========================================================================
  describe('paymentService.selectPaymentMethod()', () => {
    it('TC-PAY-SEL-01 [Branch: invalid method] throws error when method is unsupported', async () => {
      await assert.rejects(
        () => paymentService.selectPaymentMethod(1, 10, 'Bitcoin'),
        { message: 'Phương thức thanh toán không hợp lệ. Chỉ chấp nhận ChuyenKhoanQR hoặc TienMat.' }
      );
    });

    it('TC-PAY-SEL-02 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => paymentService.selectPaymentMethod(999, 10, 'TienMat'),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-PAY-SEL-03 [Branch: booking.MaNguoiDung !== userId] throws error when user unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 5, // Người khác
      }));

      await assert.rejects(
        () => paymentService.selectPaymentMethod(1, 10, 'TienMat'),
        { message: 'Bạn không có quyền thay đổi phương thức thanh toán cho đơn này' }
      );
    });

    it('TC-PAY-SEL-04 [Branch: booking.TrangThai === DaHuy] throws error when booking is cancelled', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'DaHuy',
      }));

      await assert.rejects(
        () => paymentService.selectPaymentMethod(1, 10, 'ChuyenKhoanQR'),
        { message: 'Đơn đặt phòng đã bị hủy.' }
      );
    });

    it('TC-PAY-SEL-05 [Branch: booking.TrangThaiThanhToan === DaThanhToan] throws error when already paid', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'DaThanhToan',
      }));

      await assert.rejects(
        () => paymentService.selectPaymentMethod(1, 10, 'ChuyenKhoanQR'),
        { message: 'Đơn đặt phòng đã được thanh toán.' }
      );
    });

    it('TC-PAY-SEL-06 [Branch: Success select method] updates method and creates initial GIAO_DICH', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 500000,
      }));

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        HoTen: 'Khách A',
      }));

      mockTransaction();

      let updatedData = null;
      mockMethod(prisma.dAT_PHONG, 'update', async ({ where, data }) => {
        updatedData = data;
        return { MaDatPhong: 1, ...data };
      });

      let createdTxn = null;
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => {
        createdTxn = data;
        return data;
      });

      const res = await paymentService.selectPaymentMethod(1, 10, 'TienMat');
      assert.equal(res.PhuongThucThanhToan, 'TienMat');
      assert.equal(updatedData.PhuongThucThanhToan, 'TienMat');
      assert.equal(createdTxn.TrangThai, 'ChoThanhToan');
      assert.equal(createdTxn.PhuongThuc, 'TienMat');
    });
  });

  // =========================================================================
  // 3. paymentService.simulatePayment
  // =========================================================================
  describe('paymentService.simulatePayment()', () => {
    it('TC-PAY-SIM-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => paymentService.simulatePayment(999, 10, { result: 'success' }),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-PAY-SIM-02 [Branch: unauthorized user] throws error when user is not owner of booking', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 99,
      }));

      await assert.rejects(
        () => paymentService.simulatePayment(1, 10, { result: 'success' }),
        { message: 'Bạn không có quyền thực hiện thanh toán cho đơn này' }
      );
    });

    it('TC-PAY-SIM-03 [Branch: cancelled booking] throws error when booking was cancelled', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'DaHuy',
      }));

      await assert.rejects(
        () => paymentService.simulatePayment(1, 10, { result: 'success' }),
        { message: 'Đơn đặt phòng đã bị hủy, không thể thực hiện giao dịch.' }
      );
    });

    it('TC-PAY-SIM-04 [Branch: already paid] throws error when already paid', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'DaThanhToan',
      }));

      await assert.rejects(
        () => paymentService.simulatePayment(1, 10, { result: 'success' }),
        { message: 'Đơn đặt phòng này đã được thanh toán trước đó. Không thể thanh toán lần hai.' }
      );
    });

    it('TC-PAY-SIM-05 [Branch: result === "success"] updates booking to DaXacNhan and creates ThanhCong txn', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 1500000,
        PhuongThucThanhToan: 'ChuyenKhoanQR',
        NGUOI_DUNG: { HoTen: 'Khách VIP' },
      }));

      mockTransaction();

      let updatedBookingData = null;
      mockMethod(prisma.dAT_PHONG, 'update', async ({ where, data }) => {
        updatedBookingData = data;
        return { MaDatPhong: 1, ...data };
      });

      let createdTxnData = null;
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => {
        createdTxnData = data;
        return data;
      });

      const res = await paymentService.simulatePayment(1, 10, { result: 'success' });

      assert.equal(res.success, true);
      assert.equal(updatedBookingData.TrangThai, 'DaXacNhan');
      assert.equal(updatedBookingData.TrangThaiThanhToan, 'DaThanhToan');
      assert.equal(createdTxnData.TrangThai, 'ThanhCong');
      assert.equal(createdTxnData.SoTien, 1500000);
    });

    it('TC-PAY-SIM-06 [Branch: result === "failure"] leaves booking unpaid and creates ThatBai txn', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 2,
        MaNguoiDung: 10,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 1500000,
        PhuongThucThanhToan: 'ChuyenKhoanQR',
        NGUOI_DUNG: { HoTen: 'Khách VIP' },
      }));

      let createdTxnData = null;
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => {
        createdTxnData = data;
        return data;
      });

      const res = await paymentService.simulatePayment(2, 10, {
        result: 'failure',
        reason: 'Số dư tài khoản không đủ để thanh toán',
      });

      assert.equal(res.success, false);
      assert.equal(res.booking.TrangThaiThanhToan, 'ChuaThanhToan'); // Vẫn là chưa thanh toán
      assert.equal(createdTxnData.TrangThai, 'ThatBai');
      assert.equal(createdTxnData.GhiChu, 'Số dư tài khoản không đủ để thanh toán');
    });
  });

  // =========================================================================
  // 4. paymentService.confirmCashPayment
  // =========================================================================
  describe('paymentService.confirmCashPayment()', () => {
    it('TC-PAY-CASH-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => paymentService.confirmCashPayment(999, 1),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-PAY-CASH-02 [Branch: !isOwner && !isAdmin] throws error when caller is unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      await assert.rejects(
        () => paymentService.confirmCashPayment(1, 99, null), // Không phải chủ 10, không phải admin
        { message: 'Bạn không có quyền xác nhận thu tiền cho đơn đặt phòng này' }
      );
    });

    it('TC-PAY-CASH-03 [Branch: booking.TrangThai === DaHuy] throws error when booking was cancelled', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaHuy',
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      await assert.rejects(
        () => paymentService.confirmCashPayment(1, 10, null),
        { message: 'Đơn đặt phòng đã bị hủy, không thể thu tiền' }
      );
    });

    it('TC-PAY-CASH-04 [Branch: booking.TrangThaiThanhToan === DaThanhToan] throws error when already confirmed', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaXacNhan',
        TrangThaiThanhToan: 'DaThanhToan',
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      await assert.rejects(
        () => paymentService.confirmCashPayment(1, 10, null),
        { message: 'Đơn đặt phòng này đã được xác nhận thanh toán trước đó' }
      );
    });

    it('TC-PAY-CASH-05 [Branch: Success by Owner] updates booking and creates cash txn with ChuHomestay role', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 800000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        HoTen: 'Chủ Homestay Nam',
      }));

      mockTransaction();

      let updatedBookingData = null;
      mockMethod(prisma.dAT_PHONG, 'update', async ({ where, data }) => {
        updatedBookingData = data;
        return { MaDatPhong: 1, ...data };
      });

      let createdTxnData = null;
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => {
        createdTxnData = data;
        return data;
      });

      const res = await paymentService.confirmCashPayment(1, 10, null);

      assert.equal(res.success, true);
      assert.equal(updatedBookingData.TrangThaiThanhToan, 'DaThanhToan');
      assert.equal(updatedBookingData.PhuongThucThanhToan, 'TienMat');
      assert.equal(createdTxnData.VaiTroNguoiThaoTac, 'ChuHomestay');
      assert.equal(createdTxnData.NguoiThaoTac, 'Chủ Homestay Nam');
    });

    it('TC-PAY-CASH-06 [Branch: Success by Admin] updates booking and creates cash txn with Admin role', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        TrangThai: 'DaXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 800000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      mockTransaction();

      let updatedBookingData = null;
      mockMethod(prisma.dAT_PHONG, 'update', async ({ where, data }) => {
        updatedBookingData = data;
        return { MaDatPhong: 1, ...data };
      });

      let createdTxnData = null;
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => {
        createdTxnData = data;
        return data;
      });

      const adminUser = { HoTen: 'Quản Trị Viên A', MaChu: 18, Quyen: 'admin' };
      const res = await paymentService.confirmCashPayment(1, null, adminUser);

      assert.equal(res.success, true);
      assert.equal(updatedBookingData.TrangThaiThanhToan, 'DaThanhToan');
      assert.equal(createdTxnData.VaiTroNguoiThaoTac, 'Admin');
      assert.equal(createdTxnData.NguoiThaoTac, 'Quản Trị Viên A');
    });
  });

  // =========================================================================
  // 5. paymentService.getBookingTransactions
  // =========================================================================
  describe('paymentService.getBookingTransactions()', () => {
    it('TC-PAY-TXN-01 [Branch: !booking] throws error when booking not found', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => null);

      await assert.rejects(
        () => paymentService.getBookingTransactions(999, 1),
        { message: 'Không tìm thấy đơn đặt phòng' }
      );
    });

    it('TC-PAY-TXN-02 [Branch: !isGuest && !isOwner] throws error when unauthorized', async () => {
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 5 } }],
      }));

      await assert.rejects(
        () => paymentService.getBookingTransactions(1, 99, 99),
        { message: 'Bạn không có quyền xem lịch sử giao dịch của đơn này' }
      );
    });

    it('TC-PAY-TXN-03 [Branch: Success] returns transaction list', async () => {
      const mockTxns = [
        { MaGiaoDich: 'TX-1', SoTien: 500000, TrangThai: 'ThanhCong' },
      ];
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 1,
        MaNguoiDung: 10,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 5 } }],
        GIAO_DICH: mockTxns,
      }));

      const res = await paymentService.getBookingTransactions(1, 10, null);
      assert.equal(res.length, 1);
      assert.equal(res[0].MaGiaoDich, 'TX-1');
    });
  });
});

