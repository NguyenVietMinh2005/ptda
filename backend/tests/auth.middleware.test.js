// backend/tests/auth.middleware.test.js
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/prisma.js';
import { protect, protectAny } from '../src/middlewares/auth.middleware.js';
import { protectOwner } from '../src/middlewares/owner.middleware.js';
import { protectAdmin } from '../src/middlewares/admin.middleware.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';

function createMockRes() {
  return {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
}

describe('White-Box Testing: Role Authorization Middlewares (Customer, Owner, Admin)', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'middleware-secret-key';

  afterEach(() => {
    restoreAllMocks();
    process.env.JWT_SECRET = originalJwtSecret;
  });

  // =========================================================================
  // 1. protect (Customer)
  // =========================================================================
  describe('protect() middleware', () => {
    it('TC-MID-CUST-01 [Branch: !token] returns 401 when Authorization header is missing', async () => {
      const req = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      await protect(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Không tìm thấy token, yêu cầu bị từ chối.');
      assert.equal(nextCalled, false);
    });

    it('TC-MID-CUST-02 [Branch: invalid token] returns 401 when token verification throws', async () => {
      const req = { headers: { authorization: 'Bearer invalid.token.value' } };
      const res = createMockRes();
      let nextCalled = false;

      await protect(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Token không hợp lệ hoặc đã hết hạn.');
      assert.equal(nextCalled, false);
    });

    it('TC-MID-CUST-03 [Branch: !currentUser] returns 401 when user is not found in DB', async () => {
      const token = jwt.sign({ userId: 999 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);

      await protect(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Người dùng không tồn tại.');
      assert.equal(nextCalled, false);
    });

    it('TC-MID-CUST-04 [Branch: currentUser.isActive === false] returns 403 when user is locked', async () => {
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: false,
      }));

      await protect(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.message, 'Tài khoản đã bị khóa.');
      assert.equal(nextCalled, false);
    });

    it('TC-MID-CUST-05 [Branch: Success user] sets req.user and invokes next()', async () => {
      const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        HoTen: 'Khách Hàng',
        Email: 'khach@test.com',
        isActive: true,
      }));

      await protect(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(req.user.MaNguoiDung, 1);
    });
  });

  // =========================================================================
  // 2. protectOwner (Host)
  // =========================================================================
  describe('protectOwner() middleware', () => {
    it('TC-MID-OWN-01 [Branch: !token] returns 401 when token is missing', async () => {
      const req = { headers: {} };
      const res = createMockRes();
      let nextCalled = false;

      await protectOwner(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Không tìm thấy token, yêu cầu bị từ chối.');
      assert.equal(nextCalled, false);
    });

    it('TC-MID-OWN-02 [Branch: !currentOwner] returns 401 when owner is not found', async () => {
      const token = jwt.sign({ ownerId: 888 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      await protectOwner(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Chủ homestay không tồn tại.');
    });

    it('TC-MID-OWN-03 [Branch: currentOwner.isActive === false] returns 403 when owner locked', async () => {
      const token = jwt.sign({ ownerId: 10 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        isActive: false,
      }));

      await protectOwner(req, res, () => {});

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.message, 'Tài khoản đã bị khóa.');
    });

    it('TC-MID-OWN-04 [Branch: Success owner] sets req.owner and calls next()', async () => {
      const token = jwt.sign({ ownerId: 10 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        HoTen: 'Chủ Homestay',
        isActive: true,
        Quyen: 'chu_homestay',
      }));

      await protectOwner(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(req.owner.MaChu, 10);
    });
  });

  // =========================================================================
  // 3. protectAdmin (Admin)
  // =========================================================================
  describe('protectAdmin() middleware', () => {
    it('TC-MID-ADM-01 [Branch: !token] returns 401 when token is missing', async () => {
      const req = { headers: {} };
      const res = createMockRes();

      await protectAdmin(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Không tìm thấy token.');
    });

    it('TC-MID-ADM-02 [Branch: !admin] returns 401 when user not found in CHU_HOMESTAY', async () => {
      const token = jwt.sign({ ownerId: 777 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      await protectAdmin(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Người dùng không tồn tại.');
    });

    it('TC-MID-ADM-03 [Branch: admin.Quyen !== "admin"] returns 403 when user is normal host', async () => {
      const token = jwt.sign({ ownerId: 15 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 15,
        Quyen: 'chu_homestay', // Không phải admin
      }));

      await protectAdmin(req, res, () => {});

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.message, 'Không có quyền truy cập.');
    });

    it('TC-MID-ADM-04 [Branch: admin.Quyen === "admin"] sets req.owner and calls next()', async () => {
      const token = jwt.sign({ ownerId: 18 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 18,
        HoTen: 'Quản trị viên',
        Quyen: 'admin',
      }));

      await protectAdmin(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(req.owner.MaChu, 18);
      assert.equal(req.owner.Quyen, 'admin');
    });

    it('TC-MID-ADM-05 [Branch: admin.isActive === false] returns 403 when admin is locked', async () => {
      const token = jwt.sign({ ownerId: 19 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 19,
        HoTen: 'Admin Bị Khóa',
        Quyen: 'admin',
        isActive: false,
      }));

      await protectAdmin(req, res, () => { nextCalled = true; });

      assert.equal(res.statusCode, 403);
      assert.equal(res.jsonData.message, 'Tài khoản đã bị khóa.');
      assert.equal(nextCalled, false);
    });
  });

  // =========================================================================
  // 4. protectAny (Customer or Owner)
  // =========================================================================
  describe('protectAny() middleware', () => {
    it('TC-MID-ANY-01 [Branch: !token] returns 401 when token missing', async () => {
      const req = { headers: {} };
      const res = createMockRes();

      await protectAny(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Không tìm thấy token, yêu cầu bị từ chối.');
    });

    it('TC-MID-ANY-02 [Branch: invalid token] returns 401 when token is invalid', async () => {
      const req = { headers: { authorization: 'Bearer malformed.token' } };
      const res = createMockRes();

      await protectAny(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Token không hợp lệ hoặc đã hết hạn.');
    });

    it('TC-MID-ANY-03 [Branch: decoded.userId valid] sets req.user and calls next()', async () => {
      const token = jwt.sign({ userId: 12 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 12,
        HoTen: 'Khách Test',
        isActive: true,
      }));

      await protectAny(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(req.user.MaNguoiDung, 12);
    });

    it('TC-MID-ANY-04 [Branch: decoded.ownerId valid] sets req.owner and calls next()', async () => {
      const token = jwt.sign({ ownerId: 30 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();
      let nextCalled = false;

      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 30,
        HoTen: 'Chủ Test',
        isActive: true,
        Quyen: 'chu_homestay',
      }));

      await protectAny(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.equal(req.owner.MaChu, 30);
    });

    it('TC-MID-ANY-05 [Branch: locked or not found] returns 401', async () => {
      const token = jwt.sign({ userId: 99 }, process.env.JWT_SECRET);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockRes();

      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);

      await protectAny(req, res, () => {});

      assert.equal(res.statusCode, 401);
      assert.equal(res.jsonData.message, 'Tài khoản không tồn tại hoặc đã bị khóa.');
    });
  });
});

