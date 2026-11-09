// backend/tests/review.service.test.js
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as homestayService from '../src/services/homestay.service.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';

describe('White-Box Testing: Review Service & Completion Conditions', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  // =========================================================================
  // 1. homestayService.createReview
  // =========================================================================
  describe('homestayService.createReview()', () => {
    it('TC-REV-01 [Branch: !homestayExists] throws error when homestay does not exist', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null);

      await assert.rejects(
        () => homestayService.createReview(1, 999, { soSao: 5, binhLuan: 'Rất tuyệt' }),
        { message: 'Không tìm thấy homestay' }
      );
    });

    it('TC-REV-02 [Branch: !completedBooking] throws error when customer has no completed booking', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1 }));
      // Khách chưa từng hoàn thành kỳ nghỉ tại đây (findFirst trả về null)
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null);

      await assert.rejects(
        () => homestayService.createReview(1, 1, { soSao: 5, binhLuan: 'Tuyệt' }),
        { message: 'Chỉ khách hàng đã hoàn thành kỳ nghỉ (trạng thái Đã hoàn thành) tại homestay này mới có thể gửi đánh giá.' }
      );
    });

    it('TC-REV-03 [Branch: existingReview (Update)] updates existing review if user already reviewed', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1 }));
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 50,
        TrangThai: 'DaHoanThanh',
      }));

      // Đã có review cũ
      mockMethod(prisma.dANH_GIA, 'findFirst', async () => ({
        MaDanhGia: 12,
        SoSao: 4,
        BinhLuan: 'Cũ',
      }));

      let updatePayload = null;
      mockMethod(prisma.dANH_GIA, 'update', async ({ where, data }) => {
        updatePayload = { where, data };
        return { MaDanhGia: 12, ...data };
      });

      const updated = await homestayService.createReview(1, 1, {
        soSao: 5,
        binhLuan: 'Đã nâng cấp đánh giá thành 5 sao!',
      });

      assert.equal(updated.MaDanhGia, 12);
      assert.equal(updatePayload.where.MaDanhGia, 12);
      assert.equal(updatePayload.data.SoSao, 5);
      assert.equal(updatePayload.data.BinhLuan, 'Đã nâng cấp đánh giá thành 5 sao!');
    });

    it('TC-REV-04 [Branch: !existingReview (Create)] creates brand new review for eligible customer', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 2 }));
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 60,
        TrangThai: 'DaHoanThanh',
      }));

      // Chưa có review cũ
      mockMethod(prisma.dANH_GIA, 'findFirst', async () => null);

      let createPayload = null;
      mockMethod(prisma.dANH_GIA, 'create', async ({ data }) => {
        createPayload = data;
        return { MaDanhGia: 15, ...data };
      });

      const review = await homestayService.createReview(10, 2, {
        soSao: 4,
        binhLuan: 'Phòng sạch sẽ, view núi rất đẹp.',
      });

      assert.equal(review.MaDanhGia, 15);
      assert.equal(createPayload.MaNguoiDung, 10);
      assert.equal(createPayload.MaHomestay, 2);
      assert.equal(createPayload.SoSao, 4);
    });
  });

  // =========================================================================
  // 2. homestayService.checkCanReview
  // =========================================================================
  describe('homestayService.checkCanReview()', () => {
    it('TC-CKREV-01 [Branch: !userId] returns canReview false when unauthenticated', async () => {
      const res = await homestayService.checkCanReview(null, 1);
      assert.equal(res.canReview, false);
      assert.equal(res.reason, 'Bạn cần đăng nhập để đánh giá');
    });

    it('TC-CKREV-02 [Branch: !completedBooking] returns canReview false when no DaHoanThanh booking', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => null);

      const res = await homestayService.checkCanReview(1, 1);
      assert.equal(res.canReview, false);
      assert.ok(res.reason.includes('Chỉ khách hàng đã hoàn thành kỳ nghỉ'));
    });

    it('TC-CKREV-03 [Branch: completedBooking exists] returns canReview true', async () => {
      mockMethod(prisma.dAT_PHONG, 'findFirst', async () => ({
        MaDatPhong: 10,
        TrangThai: 'DaHoanThanh',
      }));

      const res = await homestayService.checkCanReview(1, 1);
      assert.equal(res.canReview, true);
    });
  });
});

