// backend/tests/auth.service.test.js
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/prisma.js';
import * as authService from '../src/services/auth.service.js';
import * as ownerService from '../src/services/owner.service.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';

describe('White-Box Testing: Authentication Services (Customer & Owner)', () => {
  const originalJwtSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret-key-123';

  afterEach(() => {
    restoreAllMocks();
    process.env.JWT_SECRET = originalJwtSecret;
  });

  // =========================================================================
  // 1. authService.registerUser
  // =========================================================================
  describe('authService.registerUser()', () => {
    it('TC-AUTH-REG-01 [Branch: existingUser] throws error when email is already registered', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        Email: 'duplicate@test.com',
      }));

      await assert.rejects(
        () => authService.registerUser({
          fullName: 'Test User',
          email: 'duplicate@test.com',
          password: 'Password123',
        }),
        { message: 'Email đã tồn tại' }
      );
    });

    it('TC-AUTH-REG-02 [Branch: Success creation] creates user and strips MatKhau', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);

      let createdData = null;
      mockMethod(prisma.nGUOI_DUNG, 'create', async ({ data }) => {
        createdData = data;
        return {
          MaNguoiDung: 99,
          ...data,
          MatKhau: data.MatKhau, // Giả lập DB trả về
        };
      });

      const user = await authService.registerUser({
        fullName: 'New Customer',
        email: 'newcustomer@test.com',
        password: 'Password123',
        soDienThoai: '0987654321',
      });

      assert.equal(user.MaNguoiDung, 99);
      assert.equal(user.Email, 'newcustomer@test.com');
      assert.equal(user.MatKhau, undefined); // Đã bị xóa
      assert.ok(createdData.MatKhau); // DB nhận mật khẩu đã băm
      assert.notEqual(createdData.MatKhau, 'Password123'); // Không lưu plain-text
    });
  });

  // =========================================================================
  // 2. authService.loginUser
  // =========================================================================
  describe('authService.loginUser()', () => {
    beforeEach(() => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);
    });

    it('TC-AUTH-LOG-01 [Branch: !user] throws error when email does not exist', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);

      await assert.rejects(
        () => authService.loginUser({
          email: 'notfound@test.com',
          password: 'Password123',
        }),
        { message: 'Email không tồn tại' }
      );
    });

    it('TC-AUTH-LOG-02 [Branch: user.isActive === false] throws error when account is locked', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 2,
        Email: 'locked@test.com',
        isActive: false,
      }));

      await assert.rejects(
        () => authService.loginUser({
          email: 'locked@test.com',
          password: 'Password123',
        }),
        { message: 'Tài khoản của bạn đã bị khóa' }
      );
    });

    it('TC-AUTH-LOG-03 [Branch: !isPasswordMatch] throws error when password is wrong', async () => {
      const hashedPassword = await bcrypt.hash('CorrectPassword', 10);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 3,
        Email: 'user@test.com',
        MatKhau: hashedPassword,
        isActive: true,
      }));

      await assert.rejects(
        () => authService.loginUser({
          email: 'user@test.com',
          password: 'WrongPassword',
        }),
        { message: 'Mật khẩu không chính xác' }
      );
    });

    it('TC-AUTH-LOG-04 [Branch: Success login] returns user without MatKhau and valid JWT', async () => {
      const hashedPassword = await bcrypt.hash('ValidPassword', 10);
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 5,
        Email: 'valid@test.com',
        HoTen: 'Valid User',
        MatKhau: hashedPassword,
        isActive: true,
      }));

      const { user, token } = await authService.loginUser({
        email: 'valid@test.com',
        password: 'ValidPassword',
      });

      assert.equal(user.MaNguoiDung, 5);
      assert.equal(user.MatKhau, undefined);
      assert.ok(token);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.userId, 5);
    });

    it('TC-AUTH-LOG-05 [Branch: Success Host login via unified portal] returns host user and token', async () => {
      const hashedPassword = await bcrypt.hash('HostPass123', 10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 10,
        Email: 'host@test.com',
        HoTen: 'Host User',
        MatKhau: hashedPassword,
        Quyen: 'chu_homestay',
        isActive: true,
      }));

      const { user, token, role } = await authService.loginUser({
        email: 'host@test.com',
        password: 'HostPass123',
      });

      assert.equal(user.MaChu, 10);
      assert.equal(role, 'chu_homestay');
      assert.equal(user.MatKhau, undefined);
      assert.ok(token);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.ownerId, 10);
      assert.equal(decoded.role, 'chu_homestay');
    });

    it('TC-AUTH-LOG-06 [Branch: Success Admin login via unified portal] returns admin user and token', async () => {
      const hashedPassword = await bcrypt.hash('AdminPass123', 10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 1,
        Email: 'admin@test.com',
        HoTen: 'Admin User',
        MatKhau: hashedPassword,
        Quyen: 'admin',
        isActive: true,
      }));

      const { user, token, role } = await authService.loginUser({
        email: 'admin@test.com',
        password: 'AdminPass123',
      });

      assert.equal(user.MaChu, 1);
      assert.equal(role, 'admin');
      assert.equal(user.MatKhau, undefined);
      assert.ok(token);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.ownerId, 1);
      assert.equal(decoded.role, 'admin');
    });
  });

  // =========================================================================
  // 3. ownerService.registerOwner & loginOwner
  // =========================================================================
  describe('ownerService.registerOwner()', () => {
    it('TC-OWN-REG-01 [Branch: existingOwner] throws error when owner email exists', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async (args) => {
        if (args.where.Email) return { MaChu: 1, Email: 'existing@owner.com' };
        return null;
      });

      await assert.rejects(
        () => ownerService.registerOwner({
          email: 'existing@owner.com',
          soCCCD: '001234567890',
          password: 'Password123',
        }),
        { message: 'Email đã tồn tại' }
      );
    });

    it('TC-OWN-REG-02 [Branch: existingCCCD] throws error when CCCD already exists', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async (args) => {
        if (args.where.Email) return null;
        if (args.where.SoCCCD) return { MaChu: 2, SoCCCD: '001234567890' };
        return null;
      });

      await assert.rejects(
        () => ownerService.registerOwner({
          email: 'new@owner.com',
          soCCCD: '001234567890',
          password: 'Password123',
        }),
        { message: 'Số CCCD đã tồn tại' }
      );
    });

    it('TC-OWN-REG-03 [Branch: Success owner creation] returns new owner with hashed password stripped', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      mockMethod(prisma.cHU_HOMESTAY, 'create', async ({ data }) => ({
        MaChu: 10,
        ...data,
      }));

      const newOwner = await ownerService.registerOwner({
        hoTen: 'Owner Minh',
        email: 'minh@owner.com',
        soCCCD: '998877665544',
        password: 'Password123',
      });

      assert.equal(newOwner.MaChu, 10);
      assert.equal(newOwner.Email, 'minh@owner.com');
      assert.equal(newOwner.MatKhau, undefined);
    });
  });

  describe('ownerService.loginOwner()', () => {
    it('TC-OWN-LOG-01 [Branch: !owner] throws error when owner email does not exist', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => ownerService.loginOwner({
          email: 'unknown@owner.com',
          password: 'Password123',
        }),
        { message: 'Email không tồn tại' }
      );
    });

    it('TC-OWN-LOG-02 [Branch: owner.isActive === false] throws error when owner account locked', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 1,
        Email: 'locked@owner.com',
        isActive: false,
      }));

      await assert.rejects(
        () => ownerService.loginOwner({
          email: 'locked@owner.com',
          password: 'Password123',
        }),
        { message: 'Tài khoản của bạn đã bị khóa' }
      );
    });

    it('TC-OWN-LOG-03 [Branch: !rawPassword] throws error when password is empty', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 1,
        Email: 'owner@test.com',
        isActive: true,
      }));

      await assert.rejects(
        () => ownerService.loginOwner({
          email: 'owner@test.com',
          password: '',
        }),
        { message: 'Mật khẩu không chính xác' }
      );
    });

    it('TC-OWN-LOG-04 [Branch: Success login] returns owner and token with ownerId & role', async () => {
      const hashedPassword = await bcrypt.hash('OwnerPass123', 10);
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 8,
        Email: 'admin_owner@test.com',
        MatKhau: hashedPassword,
        Quyen: 'admin',
        isActive: true,
      }));

      const { owner, token } = await ownerService.loginOwner({
        email: 'admin_owner@test.com',
        password: 'OwnerPass123',
      });

      assert.equal(owner.MaChu, 8);
      assert.equal(owner.MatKhau, undefined);
      assert.ok(token);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert.equal(decoded.ownerId, 8);
      assert.equal(decoded.role, 'admin');
    });
  });
});

