// backend/tests/homestay.admin.test.js
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as adminService from '../src/services/admin.service.js';
import * as homestayService from '../src/services/homestay.service.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('White-Box Testing: Homestay Moderation & Administration', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  // =========================================================================
  // 1. adminService.updateHomestayApproval
  // =========================================================================
  describe('adminService.updateHomestayApproval()', () => {
    it('TC-ADM-HS-01 [Branch: !validStatus] throws error for invalid status', async () => {
      await assert.rejects(
        () => adminService.updateHomestayApproval(1, 'TrangThaiLa'),
        { message: 'Trạng thái duyệt không hợp lệ. Chỉ chấp nhận: ChoDuyet, DaDuyet, TuChoi' }
      );
    });

    it('TC-ADM-HS-02 [Branch: !homestay] throws error when homestay does not exist', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => adminService.updateHomestayApproval(999, 'DaDuyet'),
        { message: 'Không tìm thấy homestay' }
      );
    });

    it('TC-ADM-HS-03 [Branch: Success DaDuyet] approves homestay', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        TrangThaiDuyet: 'ChoDuyet',
      }));

      mockMethod(prisma.hOMESTAY, 'update', async ({ where, data }) => ({
        ...where,
        ...data,
      }));

      const res = await adminService.updateHomestayApproval(1, 'DaDuyet');
      assert.equal(res.TrangThaiDuyet, 'DaDuyet');
    });

    it('TC-ADM-HS-04 [Branch: Success TuChoi] rejects homestay', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 2,
        TrangThaiDuyet: 'ChoDuyet',
      }));

      mockMethod(prisma.hOMESTAY, 'update', async ({ where, data }) => ({
        ...where,
        ...data,
      }));

      const res = await adminService.updateHomestayApproval(2, 'TuChoi');
      assert.equal(res.TrangThaiDuyet, 'TuChoi');
    });
  });

  // =========================================================================
  // 2. homestayService.deleteHomestay (Owner soft-delete)
  // =========================================================================
  describe('homestayService.deleteHomestay() (Owner Soft Delete)', () => {
    it('TC-OWN-DEL-01 [Branch: !homestay] throws error when homestay not found', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => homestayService.deleteHomestay(999, 1),
        { message: 'Không tìm thấy homestay' }
      );
    });

    it('TC-OWN-DEL-02 [Branch: homestay.MaChu !== ownerId] throws error when owner does not own homestay', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        MaChu: 88, // Chủ khác
        isActive: true,
      }));

      await assert.rejects(
        () => homestayService.deleteHomestay(1, 99),
        { message: 'Không có quyền xóa homestay này' }
      );
    });

    it('TC-OWN-DEL-03 [Branch: Success soft delete] updates isActive to false', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 1,
        MaChu: 10,
        isActive: true,
      }));

      let updatedData = null;
      mockMethod(prisma.hOMESTAY, 'update', async ({ where, data }) => {
        updatedData = data;
        return { ...where, ...data };
      });

      await homestayService.deleteHomestay(1, 10);
      assert.equal(updatedData.isActive, false);
    });
  });

  // =========================================================================
  // 3. adminService.deleteHomestay (Admin hard delete)
  // =========================================================================
  describe('adminService.deleteHomestay() (Admin Hard Delete)', () => {
    it('TC-ADM-DEL-01 [Branch: !homestay] throws error when homestay not found', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => adminService.deleteHomestay(999),
        { message: 'Không tìm thấy homestay' }
      );
    });

    it('TC-ADM-DEL-02 [Branch: Success delete] deletes homestay from DB', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 5,
        HINH_ANH: [],
      }));

      let deletedId = null;
      mockMethod(prisma.hOMESTAY, 'delete', async ({ where }) => {
        deletedId = where.MaHomestay;
        return { MaHomestay: deletedId };
      });

      await adminService.deleteHomestay(5);
      assert.equal(deletedId, 5);
    });
  });

  // =========================================================================
  // 4. adminService.updateUserStatus & updateOwnerStatus
  // =========================================================================
  describe('adminService User & Owner Ban/Unban Status', () => {
    it('TC-ADM-BAN-01 [Branch: !user] throws error when user not found', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => null);

      await assert.rejects(
        () => adminService.updateUserStatus(999, false),
        { message: 'Không tìm thấy người dùng' }
      );
    });

    it('TC-ADM-BAN-02 [Branch: Success ban user] sets isActive = false and removes MatKhau', async () => {
      mockMethod(prisma.nGUOI_DUNG, 'findUnique', async () => ({
        MaNguoiDung: 1,
        isActive: true,
      }));

      mockMethod(prisma.nGUOI_DUNG, 'update', async ({ where, data }) => ({
        ...where,
        ...data,
        MatKhau: 'hashed_password',
      }));

      const res = await adminService.updateUserStatus(1, false);
      assert.equal(res.isActive, false);
      assert.equal(res.MatKhau, undefined);
    });

    it('TC-ADM-BAN-03 [Branch: !owner] throws error when owner not found', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => adminService.updateOwnerStatus(999, false),
        { message: 'Không tìm thấy chủ homestay' }
      );
    });

    it('TC-ADM-BAN-04 [Branch: Success lock owner] sets isActive = false and removes MatKhau', async () => {
      mockMethod(prisma.cHU_HOMESTAY, 'findUnique', async () => ({
        MaChu: 1,
        isActive: true,
      }));

      mockMethod(prisma.cHU_HOMESTAY, 'update', async ({ where, data }) => ({
        ...where,
        ...data,
        MatKhau: 'hashed_password',
      }));

      const res = await adminService.updateOwnerStatus(1, false);
      assert.equal(res.isActive, false);
      assert.equal(res.MatKhau, undefined);
    });
  });
});

