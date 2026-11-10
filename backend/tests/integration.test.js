// backend/tests/integration.test.js
import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import { createTestApp } from './helpers/createTestApp.js';
import { makeRequest } from './helpers/testClient.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('Level 2: Integration Testing (Kiểm thử tích hợp API & Middleware)', () => {
  const app = createTestApp();
  const testSecret = 'integration-jwt-secret-key-2026';
  const originalSecret = process.env.JWT_SECRET;

  before(() => {
    process.env.JWT_SECRET = testSecret;
  });

  afterEach(() => {
    restoreAllMocks();
  });

  // Helper to generate test tokens
  function makeCustomerToken(userId = 1) {
    return jwt.sign({ userId }, testSecret, { expiresIn: '1h' });
  }

  function makeOwnerToken(ownerId = 10, role = 'chu_homestay') {
    return jwt.sign({ ownerId, role }, testSecret, { expiresIn: '1h' });
  }

  function makeAdminToken(ownerId = 18) {
    return jwt.sign({ ownerId, role: 'admin' }, testSecret, { expiresIn: '1h' });
  }

  // =========================================================================
  // FLOW 1: Auth & User Identity Integration
  // =========================================================================
  describe('Flow 1: Authentication & Token Lifecycle Integration', () => {
    it('INT-AUTH-01: POST /api/auth/register creates user and returns 201 with sanitized body', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);
      mockMethod(prisma.nGUOI_DUNG, 'create', async ({ data }) => ({
        MaNguoiDung: 101,
        ...data,
      }));

      const res = await makeRequest(app, '/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Tran Van Test',
          email: 'integration.user@test.com',
          password: 'Password123!',
          soDienThoai: '0912345678',
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.user.Email, 'integration.user@test.com');
      assert.equal(res.body.user.MatKhau, undefined);
    });

    it('INT-AUTH-02: POST /api/auth/register returns 400 when email already exists', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        Email: 'duplicate@test.com',
      }));

      const res = await makeRequest(app, '/api/auth/register', {
        method: 'POST',
        body: {
          fullName: 'Duplicate',
          email: 'duplicate@test.com',
          password: 'Password123!',
        },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Email đã tồn tại');
    });

    it('INT-AUTH-03: POST /api/auth/login returns 200 and valid JWT on correct credentials', async () => {
      const hashed = await bcrypt.hash('CorrectPass123', 10);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 5,
        Email: 'user@test.com',
        MatKhau: hashed,
        isActive: true,
      }));

      const res = await makeRequest(app, '/api/auth/login', {
        method: 'POST',
        body: {
          email: 'user@test.com',
          password: 'CorrectPass123',
        },
      });

      assert.equal(res.status, 200);
      assert.ok(res.body.data.token);
      assert.equal(res.body.data.user.MaNguoiDung, 5);
      assert.equal(res.body.data.user.MatKhau, undefined);
    });

    it('INT-AUTH-04: POST /api/auth/login returns 401 when password does not match', async () => {
      const hashed = await bcrypt.hash('CorrectPass123', 10);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 5,
        Email: 'user@test.com',
        MatKhau: hashed,
        isActive: true,
      }));

      const res = await makeRequest(app, '/api/auth/login', {
        method: 'POST',
        body: {
          email: 'user@test.com',
          password: 'WrongPassword!',
        },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Mật khẩu không chính xác');
    });

    it('INT-AUTH-05: GET /api/auth/me returns 200 and user profile when Bearer JWT is supplied', async () => {
      const token = makeCustomerToken(7);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 7,
        HoTen: 'Nguyen Van A',
        Email: 'a@test.com',
        isActive: true,
      }));

      const res = await makeRequest(app, '/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.user.MaNguoiDung, 7);
      assert.equal(res.body.user.HoTen, 'Nguyen Van A');
    });

    it('INT-AUTH-06: GET /api/auth/me returns 401 when no token is provided', async () => {
      const res = await makeRequest(app, '/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Không tìm thấy token, yêu cầu bị từ chối.');
    });
  });

  // =========================================================================
  // FLOW 2: Booking & Anti-Conflict Overbooking Integration
  // =========================================================================
  describe('Flow 2: Booking & Anti-Conflict Overbooking Integration', () => {
    it('INT-BOOK-01: POST /api/homestays/:id/book returns 401 when unauthenticated', async () => {
      const res = await makeRequest(app, '/api/homestays/1/book', {
        method: 'POST',
        body: { ngayNhan: '2026-11-01', ngayTra: '2026-11-03', soLuongKhach: 2 },
      });

      assert.equal(res.status, 401);
    });

    it('INT-BOOK-02: POST /api/homestays/:id/book returns 400 when check-out <= check-in', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      const res = await makeRequest(app, '/api/homestays/1/book', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          ngayNhan: '2026-11-05',
          ngayTra: '2026-11-04', // check-out trước check-in
          soLuongKhach: 2,
        },
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.message.includes('ít nhất 1 đêm'));
    });

    it('INT-BOOK-03: POST /api/homestays/:id/book returns 400 when date range overlaps existing booking', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 500000,
      }));

      mockTransaction();
      // Giả lập phát hiện xung đột lịch
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 88,
        TrangThai: 'DaXacNhan',
      }));

      const res = await makeRequest(app, '/api/homestays/1/book', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          ngayNhan: '2026-11-02',
          ngayTra: '2026-11-06',
          soLuongKhach: 2,
        },
      });

      assert.equal(res.status, 409);
      assert.ok(res.body.message.includes('Khoảng thời gian này đã có khách đặt'));
    });

    it('INT-BOOK-04: POST /api/homestays/:id/book returns 201 with created booking on valid dates', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        isActive: true,
        TrangThaiDuyet: 'DaDuyet',
        SoKhachToiDa: 4,
        Gia: 600000,
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null); // Không trùng
      mockMethod(prisma.dAT_PHONG, 'create', async ({ data }) => ({
        MaDatPhong: 201,
        ...data,
      }));
      mockMethod(prisma.cHI_TIET_DAT_PHONG, 'create', async ({ data }) => data);

      const res = await makeRequest(app, '/api/homestays/1/book', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          ngayNhan: '2026-11-10',
          ngayTra: '2026-11-13', // 3 đêm -> 1,800,000
          soLuongKhach: 2,
        },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.MaDatPhong, 201);
      assert.equal(res.body.data.Gia, 1800000);
      assert.equal(res.body.data.TrangThai, 'ChoXacNhan');
    });

    it('INT-BOOK-05: PUT /api/bookings/:id/cancel returns 200 when customer cancels their pending booking', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 50,
        MaNguoiDung: 1, // đúng chủ đơn
        TrangThai: 'ChoXacNhan',
      }));
      mockMethod(prisma.dAT_PHONG, 'update', async ({ data }) => ({
        MaDatPhong: 50,
        TrangThai: data.TrangThai,
      }));

      const res = await makeRequest(app, '/api/bookings/50/cancel', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.TrangThai, 'DaHuy');
    });

    it('INT-BOOK-06: PUT /api/bookings/:id/cancel returns 403 when user attempts to cancel someone else booking', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));
      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 50,
        MaNguoiDung: 999, // của người khác
        TrangThai: 'ChoXacNhan',
      }));

      const res = await makeRequest(app, '/api/bookings/50/cancel', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.message, 'Bạn không có quyền hủy đơn này');
    });
  });

  // =========================================================================
  // FLOW 3: Owner Booking Management Integration
  // =========================================================================
  describe('Flow 3: Owner Booking Status Transition Integration', () => {
    it('INT-OWN-01: PUT /api/bookings/:id/status returns 401 when no token is present', async () => {
      const res = await makeRequest(app, '/api/bookings/1/status', {
        method: 'PUT',
        body: { trangThai: 'DaXacNhan' },
      });

      assert.equal(res.status, 401);
    });

    it('INT-OWN-02: PUT /api/bookings/:id/status returns 401 when called with Customer token', async () => {
      // Customer token contains userId, but protectOwner expects ownerId in CHU_HOMESTAY
      const custToken = makeCustomerToken(1);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      const res = await makeRequest(app, '/api/bookings/1/status', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${custToken}` },
        body: { trangThai: 'DaXacNhan' },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Chủ homestay không tồn tại.');
    });

    it('INT-OWN-03: PUT /api/bookings/:id/status returns 200 when Owner confirms pending booking', async () => {
      const ownerToken = makeOwnerToken(10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        HoTen: 'Chu Homestay',
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findFirst', async (args) => {
        if (args.where.MaDatPhong === 1) {
          return {
            MaDatPhong: 1,
            TrangThai: 'ChoXacNhan',
            NgayNhan: new Date('2026-11-01'),
            NgayTra: new Date('2026-11-03'),
            CHI_TIET_DAT_PHONG: [{ MaHomestay: 5 }],
          };
        }
        return null; // Không trùng
      });

      mockMethod(prisma.dAT_PHONG, 'update', async ({ data }) => ({
        MaDatPhong: 1,
        TrangThai: data.TrangThai,
      }));

      const res = await makeRequest(app, '/api/bookings/1/status', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { trangThai: 'DaXacNhan' },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.TrangThai, 'DaXacNhan');
    });

    it('INT-OWN-04: PUT /api/bookings/:id/status returns 500/400 on invalid state transition', async () => {
      const ownerToken = makeOwnerToken(10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        HoTen: 'Chu Homestay',
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 1,
        TrangThai: 'ChoXacNhan', // Đang ChoXacNhan mà đòi chuyển sang DangLuuTru
        CHI_TIET_DAT_PHONG: [{ MaHomestay: 5 }],
      }));

      const res = await makeRequest(app, '/api/bookings/1/status', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: { trangThai: 'DangLuuTru' },
      });

      // Bị chặn vì chưa qua DaXacNhan
      assert.ok(res.status >= 400);
    });
  });

  // =========================================================================
  // FLOW 4: Mock Payment Flow Integration
  // =========================================================================
  describe('Flow 4: Mock Payment & Transaction Flow Integration', () => {
    it('INT-PAY-01: GET /api/bookings/:id/payment-info returns 200 and QR Demo details for guest', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 10,
        MaNguoiDung: 1,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 950000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { TenHomestay: 'Eco Lodge', DiaDiem: 'Sa Pa' } }],
        GIAO_DICH: [],
      }));

      const res = await makeRequest(app, '/api/bookings/10/payment-info', {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.bookingId, 10);
      assert.equal(res.body.data.canPay, true);
      assert.equal(res.body.data.demoBankInfo.transferMemo, 'THANHTOAN DP10');
      assert.ok(res.body.data.demoBankInfo.qrCodeDataUrl);
    });

    it('INT-PAY-02: POST /api/bookings/:id/payment/select-method selects TienMat and initializes txn', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        HoTen: 'Khach Hang A',
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 10,
        MaNguoiDung: 1,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 950000,
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'update', async ({ data }) => ({
        MaDatPhong: 10,
        ...data,
      }));
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => data);

      const res = await makeRequest(app, '/api/bookings/10/payment/select-method', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { method: 'TienMat' },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.PhuongThucThanhToan, 'TienMat');
    });

    it('INT-PAY-03: POST /api/bookings/:id/payment/simulate with success updates status to DaXacNhan & DaThanhToan', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 10,
        MaNguoiDung: 1,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 950000,
        PhuongThucThanhToan: 'ChuyenKhoanQR',
        NGUOI_DUNG: { HoTen: 'Khach Hang A' },
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'update', async ({ data }) => ({
        MaDatPhong: 10,
        ...data,
      }));
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => ({
        MaGiaoDich: 'TX-100',
        ...data,
      }));

      const res = await makeRequest(app, '/api/bookings/10/payment/simulate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { result: 'success' },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.booking.TrangThai, 'DaXacNhan');
      assert.equal(res.body.booking.TrangThaiThanhToan, 'DaThanhToan');
      assert.equal(res.body.transaction.TrangThai, 'ThanhCong');
    });

    it('INT-PAY-04: POST /api/bookings/:id/payment/simulate with failure keeps booking ChuaThanhToan and creates ThatBai txn', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 10,
        MaNguoiDung: 1,
        TrangThai: 'ChoXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 950000,
        PhuongThucThanhToan: 'ChuyenKhoanQR',
        NGUOI_DUNG: { HoTen: 'Khach Hang A' },
      }));

      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => ({
        MaGiaoDich: 'TX-FAIL',
        ...data,
      }));

      const res = await makeRequest(app, '/api/bookings/10/payment/simulate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { result: 'failed', reason: 'So du khong du' },
      });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.booking.TrangThaiThanhToan, 'ChuaThanhToan');
      assert.equal(res.body.transaction.TrangThai, 'ThatBai');
    });

    it('INT-PAY-05: POST /api/bookings/:id/payment/confirm-cash with host token confirms cash payment', async () => {
      const hostToken = makeOwnerToken(10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        HoTen: 'Chu Nha Test',
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 12,
        TrangThai: 'DaXacNhan',
        TrangThaiThanhToan: 'ChuaThanhToan',
        Gia: 500000,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 10 } }],
      }));

      mockTransaction();
      mockMethod(prisma.dAT_PHONG, 'update', async ({ data }) => ({
        MaDatPhong: 12,
        ...data,
      }));
      mockMethod(prisma.gIAO_DICH, 'create', async ({ data }) => data);

      const res = await makeRequest(app, '/api/bookings/12/payment/confirm-cash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hostToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.booking.TrangThaiThanhToan, 'DaThanhToan');
    });

    it('INT-PAY-06: GET /api/bookings/:id/transactions returns 200 and transaction list', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.dAT_PHONG, 'findUnique', async () => ({
        MaDatPhong: 10,
        MaNguoiDung: 1,
        CHI_TIET_DAT_PHONG: [{ HOMESTAY: { MaChu: 5 } }],
        GIAO_DICH: [
          { MaGiaoDich: 'TX-1', SoTien: 950000, TrangThai: 'ThanhCong' },
        ],
      }));

      const res = await makeRequest(app, '/api/bookings/10/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.length, 1);
      assert.equal(res.body.data[0].MaGiaoDich, 'TX-1');
    });
  });

  // =========================================================================
  // FLOW 5: Review Eligibility & Rating Flow Integration
  // =========================================================================
  describe('Flow 5: Review Eligibility & Creation Integration', () => {
    it('INT-REV-01: GET /api/homestays/:id/can-review returns 401 when no token is present', async () => {
      const res = await makeRequest(app, '/api/homestays/1/can-review');
      assert.equal(res.status, 401);
    });

    it('INT-REV-02: GET /api/homestays/:id/can-review returns canReview=false when user has no completed stay', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      // Không tìm thấy đơn hoàn thành nào
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null);

      const res = await makeRequest(app, '/api/homestays/1/can-review', {
        headers: { Authorization: `Bearer ${token}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.canReview, false);
      assert.ok(res.body.reason.includes('Đã hoàn thành'));
    });

    it('INT-REV-03: POST /api/homestays/:id/reviews returns error when user has not completed stay', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1 }));
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null);

      const res = await makeRequest(app, '/api/homestays/1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { soSao: 5, binhLuan: 'Review ảo' },
      });

      assert.ok(res.status >= 400);
      assert.ok(res.body.message.includes('Đã hoàn thành'));
    });

    it('INT-REV-04: POST /api/homestays/:id/reviews returns 201 when customer has completed stay', async () => {
      const token = makeCustomerToken(1);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1 }));
      mockMethod(prisma.dAT_PHONG, 'findFirst', async (args) => {
        if (args.where.TrangThai === 'DaHoanThanh') {
          return { MaDatPhong: 8, TrangThai: 'DaHoanThanh' };
        }
        return null; // Chưa có review cũ
      });

      mockMethod(prisma.dANH_GIA, 'create', async ({ data }) => ({
        MaDanhGia: 99,
        ...data,
      }));

      const res = await makeRequest(app, '/api/homestays/1/reviews', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: { soSao: 5, binhLuan: 'Homestay rất đẹp và sạch sẽ!' },
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.data.SoSao, 5);
      assert.equal(res.body.data.BinhLuan, 'Homestay rất đẹp và sạch sẽ!');
    });
  });

  // =========================================================================
  // FLOW 6: Admin Moderation & Role Barrier Integration
  // =========================================================================
  describe('Flow 6: Admin Moderation & Role Barrier Integration', () => {
    it('INT-ADM-01: GET /api/admin/dashboard-stats returns 401 when no token is present', async () => {
      const res = await makeRequest(app, '/api/admin/dashboard-stats');
      assert.equal(res.status, 401);
    });

    it('INT-ADM-02: GET /api/admin/dashboard-stats returns 401 when Customer token is supplied', async () => {
      const custToken = makeCustomerToken(1);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      const res = await makeRequest(app, '/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${custToken}` },
      });

      assert.equal(res.status, 401);
      assert.equal(res.body.message, 'Người dùng không tồn tại.');
    });

    it('INT-ADM-03: GET /api/admin/dashboard-stats returns 403 when standard Owner token is supplied', async () => {
      const hostToken = makeOwnerToken(10, 'chu_homestay');
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        Quyen: 'chu_homestay', // không phải admin
      }));

      const res = await makeRequest(app, '/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${hostToken}` },
      });

      assert.equal(res.status, 403);
      assert.equal(res.body.message, 'Không có quyền truy cập.');
    });

    it('INT-ADM-04: GET /api/admin/dashboard-stats returns 200 and stats when Admin token is supplied', async () => {
      const adminToken = makeAdminToken(18);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 18,
        Quyen: 'admin',
      }));

      mockMethod(prisma.nGUOI_DUNG, 'count', async () => 20);
      mockMethod(prisma.cHU_HOMESTAY, 'count', async () => 5);
      mockMethod(prisma.hOMESTAY, 'count', async () => 24);
      mockMethod(prisma.dAT_PHONG, 'findMany', async () => []);
      mockMethod(prisma.kHIEU_NAI, 'findMany', async () => []);
      mockMethod(prisma.gIAO_DICH, 'findMany', async () => []);

      const res = await makeRequest(app, '/api/admin/dashboard-stats', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.totalUsers, 20);
      assert.equal(res.body.data.totalHomestays, 24);
    });

    it('INT-ADM-05: PUT /api/admin/homestays/:id/approval with DaDuyet approves homestay successfully', async () => {
      const adminToken = makeAdminToken(18);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 18,
        Quyen: 'admin',
      }));

      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 3,
        TrangThaiDuyet: 'ChoDuyet',
      }));

      mockMethod(prisma.hOMESTAY, 'update', async ({ data }) => ({
        MaHomestay: 3,
        TrangThaiDuyet: data.TrangThaiDuyet,
      }));

      const res = await makeRequest(app, '/api/admin/homestays/3/approval', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { trangThaiDuyet: 'DaDuyet' },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.TrangThaiDuyet, 'DaDuyet');
    });

    it('INT-ADM-06: PUT /api/admin/users/:id/status locks user account successfully', async () => {
      const adminToken = makeAdminToken(18);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 18,
        Quyen: 'admin',
      }));

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 99,
        isActive: true,
      }));

      mockMethod(prisma.nGUOI_DUNG, 'update', async ({ data }) => ({
        MaNguoiDung: 99,
        isActive: data.isActive,
      }));

      const res = await makeRequest(app, '/api/admin/users/99/status', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { isActive: false },
      });

      assert.equal(res.status, 200);
      assert.equal(res.body.data.isActive, false);
    });
  });
});

