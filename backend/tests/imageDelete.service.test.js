// backend/tests/imageDelete.service.test.js
process.env.NODE_ENV = 'test';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as homestayService from '../src/services/homestay.service.js';
import * as adminService from '../src/services/admin.service.js';
import * as storageService from '../src/services/storage.service.js';
import * as queueService from '../src/services/storageCleanupQueue.service.js';
import * as homestayController from '../src/controllers/homestay.controller.js';
import { protectOwner } from '../src/middlewares/owner.middleware.js';
import { protectAdmin } from '../src/middlewares/admin.middleware.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('Level 1 & 2: Image Deletion & Storage Cleanup Queue Integration (Bước 3)', () => {
  afterEach(() => {
    restoreAllMocks();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    queueService.setTestProcessQueueHook(null);
  });

  // =========================================================================
  // PHẦN 1: API & SERVICE XÓA MỘT ẢNH RIÊNG LẺ (DEL-IMG-01 -> DEL-IMG-10)
  // =========================================================================
  describe('Phần 1: API Xóa một ảnh riêng lẻ (deleteImage)', () => {
    it('DEL-IMG-01: Host xóa ảnh thuộc Homestay của mình -> Thành công, enqueue DELETE_IMAGE và trigger queue', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 101,
        MaHomestay: 1,
        HinhAnh: 'uploads/photo_101.jpg',
      }));

      let enqueuedItem = null;
      queueService.setTestEnqueueHook(async (item) => {
        enqueuedItem = item;
        return [item];
      });

      let deletedImageId = null;
      mockMethod(prisma.hINH_ANH, 'delete', async ({ where }) => {
        deletedImageId = where.MaAnh;
        return { MaAnh: deletedImageId };
      });

      let queueTriggered = false;
      queueService.setTestProcessQueueHook(async () => {
        queueTriggered = true;
        return { processed: 1, succeeded: 1, failed: 0 };
      });

      const res = await homestayService.deleteImage(1, 10, 101);
      assert.equal(res.success, true);
      assert.equal(deletedImageId, 101);
      assert.equal(enqueuedItem.filePath, 'uploads/photo_101.jpg');
      assert.equal(enqueuedItem.bucketName, 'local');
      assert.equal(enqueuedItem.reason, 'DELETE_IMAGE');
      assert.equal(queueTriggered, true);
    });

    it('DEL-IMG-02: Host xóa ảnh của Homestay người khác -> Ném lỗi và Controller trả HTTP 403', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 99 })); // Thuộc chủ 99

      await assert.rejects(
        () => homestayService.deleteImage(1, 10, 101), // Gọi bởi chủ 10
        /Không có quyền xóa ảnh của homestay này/i
      );

      // Kiểm thử phản hồi Controller
      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { params: { id: '1', imageId: '101' }, owner: { MaChu: 10 } };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await homestayController.deleteImage(mockReq, mockRes);
      assert.equal(statusCode, 403);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /Không có quyền/i);
    });

    it('DEL-IMG-03: Image ID không tồn tại -> Ném lỗi và Controller trả HTTP 404', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => null); // Không tìm thấy ảnh

      await assert.rejects(
        () => homestayService.deleteImage(1, 10, 999),
        /Không tìm thấy ảnh/i
      );

      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { params: { id: '1', imageId: '999' }, owner: { MaChu: 10 } };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await homestayController.deleteImage(mockReq, mockRes);
      assert.equal(statusCode, 404);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /Không tìm thấy ảnh/i);
    });

    it('DEL-IMG-04: Homestay ID không tồn tại -> Ném lỗi và Controller trả HTTP 404', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => null); // Không tìm thấy homestay

      await assert.rejects(
        () => homestayService.deleteImage(999, 10, 101),
        /Không tìm thấy homestay/i
      );

      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { params: { id: '999', imageId: '101' }, owner: { MaChu: 10 } };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await homestayController.deleteImage(mockReq, mockRes);
      assert.equal(statusCode, 404);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /Không tìm thấy homestay/i);
    });

    it('DEL-IMG-05: Ảnh không thuộc Homestay truyền vào -> Ném lỗi và Controller trả HTTP 400', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 101,
        MaHomestay: 2, // Thuộc Homestay 2, không phải 1
        HinhAnh: 'uploads/photo_101.jpg',
      }));

      await assert.rejects(
        () => homestayService.deleteImage(1, 10, 101),
        /Ảnh không thuộc homestay này/i
      );

      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { params: { id: '1', imageId: '101' }, owner: { MaChu: 10 } };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await homestayController.deleteImage(mockReq, mockRes);
      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /Ảnh không thuộc homestay này/i);
    });

    it('DEL-IMG-06: DB delete thất bại -> Transaction rollback và ném lỗi', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 101,
        MaHomestay: 1,
        HinhAnh: 'uploads/photo_101.jpg',
      }));

      // Enqueue thành công để tiến đến bước DB delete
      queueService.setTestEnqueueHook(async (item) => [item]);

      // Mô phỏng DB delete lỗi
      mockMethod(prisma.hINH_ANH, 'delete', async () => {
        throw new Error('Database foreign key or disk error');
      });

      await assert.rejects(
        () => homestayService.deleteImage(1, 10, 101),
        /Database foreign key or disk error/i
      );
    });

    it('DEL-IMG-07: Enqueue thất bại -> Transaction rollback và không xóa DB', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 101,
        MaHomestay: 1,
        HinhAnh: 'uploads/photo_101.jpg',
      }));

      queueService.setTestEnqueueHook(async () => {
        throw new Error('Queue table locked or network error');
      });

      let deleteCalled = false;
      mockMethod(prisma.hINH_ANH, 'delete', async () => {
        deleteCalled = true;
      });

      await assert.rejects(
        () => homestayService.deleteImage(1, 10, 101),
        /Queue table locked or network error/i
      );

      assert.equal(deleteCalled, false);
    });

    it('DEL-IMG-08: Storage xóa thất bại sau commit -> Job vẫn bảo toàn trong Queue để retry', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 101,
        MaHomestay: 1,
        HinhAnh: 'homestays/1/photo.jpg',
      }));
      mockMethod(prisma.hINH_ANH, 'delete', async () => ({ MaAnh: 101 }));

      let enqueuedItem = null;
      queueService.setTestEnqueueHook(async (item) => {
        enqueuedItem = item;
        return [item];
      });

      // Storage xóa ném lỗi
      queueService.setTestProcessQueueHook(async () => {
        throw new Error('Storage service 503 Unavailable');
      });

      // Gọi deleteImage: DB vẫn commit thành công và không bị ảnh hưởng bởi lỗi processQueue ngầm
      const res = await homestayService.deleteImage(1, 10, 101);
      assert.equal(res.success, true);
      assert.equal(enqueuedItem.filePath, 'homestays/1/photo.jpg');
      assert.equal(enqueuedItem.reason, 'DELETE_IMAGE');
    });

    it('DEL-IMG-09: Host chưa đăng nhập (không có token) -> protectOwner trả về 401', async () => {
      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { headers: {} };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await protectOwner(mockReq, mockRes, () => {});
      assert.equal(statusCode, 401);
      assert.match(jsonPayload.message, /Không tìm thấy token/i);
    });

    it('DEL-IMG-10: Người dùng không có quyền Host (tài khoản khóa hoặc không phải host) -> Trả về 401/403', async () => {
      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { headers: { authorization: 'Bearer invalid_or_non_owner_token' } };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await protectOwner(mockReq, mockRes, () => {});
      assert.ok(statusCode === 401 || statusCode === 403);
    });
  });

  // =========================================================================
  // PHẦN 2: ADMIN HARD-DELETE HOMESTAY (ADMIN-DEL-01 -> ADMIN-DEL-06)
  // =========================================================================
  describe('Phần 2: Admin Hard-Delete Homestay (adminService.deleteHomestay)', () => {
    it('ADMIN-DEL-01: Admin xóa Homestay có nhiều ảnh -> Tất cả ảnh được enqueue với DELETE_HOMESTAY', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 10,
        HINH_ANH: [
          { MaAnh: 1, HinhAnh: 'uploads/photo_1.jpg' },
          { MaAnh: 2, HinhAnh: 'homestays/10/photo_2.jpg' },
          { MaAnh: 3, HinhAnh: 'uploads/photo_3.png' },
        ],
      }));

      let enqueuedItems = null;
      queueService.setTestEnqueueHook(async (items) => {
        enqueuedItems = items;
        return items;
      });

      let deletedHomestayId = null;
      mockMethod(prisma.hOMESTAY, 'delete', async ({ where }) => {
        deletedHomestayId = where.MaHomestay;
        return { MaHomestay: deletedHomestayId };
      });

      let queueTriggered = false;
      queueService.setTestProcessQueueHook(async () => {
        queueTriggered = true;
        return { processed: 3, succeeded: 3, failed: 0 };
      });

      await adminService.deleteHomestay(10);
      assert.equal(deletedHomestayId, 10);
      assert.equal(enqueuedItems.length, 3);
      assert.equal(enqueuedItems[0].filePath, 'uploads/photo_1.jpg');
      assert.equal(enqueuedItems[0].bucketName, 'local');
      assert.equal(enqueuedItems[0].reason, 'DELETE_HOMESTAY');
      assert.equal(enqueuedItems[1].filePath, 'homestays/10/photo_2.jpg');
      assert.equal(enqueuedItems[1].bucketName, 'homestays');
      assert.equal(enqueuedItems[1].reason, 'DELETE_HOMESTAY');
      assert.equal(queueTriggered, true);
    });

    it('ADMIN-DEL-02: Homestay không có ảnh -> Xóa thành công mà không lỗi enqueue', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 11,
        HINH_ANH: [],
      }));

      let enqueueCalled = false;
      queueService.setTestEnqueueHook(async () => {
        enqueueCalled = true;
      });

      let deletedHomestayId = null;
      mockMethod(prisma.hOMESTAY, 'delete', async ({ where }) => {
        deletedHomestayId = where.MaHomestay;
        return { MaHomestay: deletedHomestayId };
      });

      await adminService.deleteHomestay(11);
      assert.equal(deletedHomestayId, 11);
      assert.equal(enqueueCalled, false);
    });

    it('ADMIN-DEL-03: Một thao tác DB thất bại -> Rollback toàn bộ transaction', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 12,
        HINH_ANH: [{ MaAnh: 1, HinhAnh: 'uploads/photo_1.jpg' }],
      }));

      queueService.setTestEnqueueHook(async (items) => items);

      // Homestay delete ném lỗi do ràng buộc foreign key
      mockMethod(prisma.hOMESTAY, 'delete', async () => {
        throw new Error('Foreign key violation on active bookings');
      });

      await assert.rejects(
        () => adminService.deleteHomestay(12),
        /Foreign key violation on active bookings/i
      );
    });

    it('ADMIN-DEL-04: Enqueue một ảnh thất bại -> Transaction rollback, không xóa Homestay', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 13,
        HINH_ANH: [{ MaAnh: 1, HinhAnh: 'uploads/photo_1.jpg' }],
      }));

      queueService.setTestEnqueueHook(async () => {
        throw new Error('Storage queue insert failure');
      });

      let deleteHomestayCalled = false;
      mockMethod(prisma.hOMESTAY, 'delete', async () => {
        deleteHomestayCalled = true;
      });

      await assert.rejects(
        () => adminService.deleteHomestay(13),
        /Storage queue insert failure/i
      );

      assert.equal(deleteHomestayCalled, false);
    });

    it('ADMIN-DEL-05: Storage xóa ảnh thất bại sau commit -> Job còn trong Queue để retry', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 14,
        HINH_ANH: [{ MaAnh: 1, HinhAnh: 'uploads/photo_1.jpg' }],
      }));

      let enqueuedJobs = null;
      queueService.setTestEnqueueHook(async (items) => {
        enqueuedJobs = items;
        return items;
      });
      mockMethod(prisma.hOMESTAY, 'delete', async () => ({ MaHomestay: 14 }));

      // processQueue gặp lỗi network
      queueService.setTestProcessQueueHook(async () => {
        throw new Error('Supabase network down');
      });

      await adminService.deleteHomestay(14);
      assert.equal(enqueuedJobs.length, 1);
      assert.equal(enqueuedJobs[0].filePath, 'uploads/photo_1.jpg');
    });

    it('ADMIN-DEL-06: Người không phải Admin gọi API -> Bị từ chối bởi protectAdmin (HTTP 401/403)', async () => {
      let statusCode = null;
      let jsonPayload = null;
      const mockReq = { headers: {} };
      const mockRes = {
        status: (code) => {
          statusCode = code;
          return { json: (p) => { jsonPayload = p; } };
        },
      };

      await protectAdmin(mockReq, mockRes, () => {});
      assert.equal(statusCode, 401);
      assert.match(jsonPayload.message, /Không tìm thấy token/i);
    });
  });

  // =========================================================================
  // PHẦN 3: HOST SOFT-DELETE HOMESTAY (SOFT-DEL-01 -> SOFT-DEL-04)
  // =========================================================================
  describe('Phần 3: Host Soft-Delete Homestay (homestayService.deleteHomestay)', () => {
    it('SOFT-DEL-01: Host soft-delete Homestay có ảnh -> Cập nhật isActive=false, ảnh trong DB vẫn tồn tại', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 20,
        MaChu: 5,
        isActive: true,
      }));

      let updatedData = null;
      mockMethod(prisma.hOMESTAY, 'update', async ({ where, data }) => {
        updatedData = data;
        return { MaHomestay: where.MaHomestay, ...data };
      });

      let imageDeleteCalled = false;
      mockMethod(prisma.hINH_ANH, 'delete', async () => { imageDeleteCalled = true; });
      mockMethod(prisma.hINH_ANH, 'deleteMany', async () => { imageDeleteCalled = true; });

      await homestayService.deleteHomestay(20, 5);

      assert.equal(updatedData.isActive, false);
      assert.equal(imageDeleteCalled, false, 'Tuyệt đối không xóa bản ghi ảnh trong DB');
    });

    it('SOFT-DEL-02: Kiểm tra Queue sau soft-delete -> Không phát sinh bất kỳ job nào', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 21,
        MaChu: 5,
        isActive: true,
      }));
      mockMethod(prisma.hOMESTAY, 'update', async () => ({ MaHomestay: 21, isActive: false }));

      let enqueueCalled = false;
      queueService.setTestEnqueueHook(async () => {
        enqueueCalled = true;
      });

      await homestayService.deleteHomestay(21, 5);
      assert.equal(enqueueCalled, false, 'Tuyệt đối không enqueue bất kỳ job nào khi soft-delete');
    });

    it('SOFT-DEL-03: Kiểm tra Storage vật lý -> Không bị gọi lệnh xóa file Local hoặc Supabase', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 22,
        MaChu: 5,
        isActive: true,
      }));
      mockMethod(prisma.hOMESTAY, 'update', async () => ({ MaHomestay: 22, isActive: false }));

      let storageDeleteCalled = false;
      storageService.setTestStorageHooks({
        deleteFileFromStorage: async () => {
          storageDeleteCalled = true;
          return { success: true };
        },
      });

      await homestayService.deleteHomestay(22, 5);
      assert.equal(storageDeleteCalled, false, 'Tuyệt đối không xóa file vật lý trên Storage');
    });

    it('SOFT-DEL-04: Host không sở hữu Homestay -> Ném lỗi và từ chối xóa', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 23,
        MaChu: 99, // Thuộc chủ 99
        isActive: true,
      }));

      await assert.rejects(
        () => homestayService.deleteHomestay(23, 5), // Host 5 gọi
        /Không có quyền xóa homestay này/i
      );
    });
  });

  // =========================================================================
  // PHẦN 4: XÁC MINH ẢNH HỖN HỢP & TEST HOOKS AN TOÀN (Yêu cầu xác minh Bước 3)
  // =========================================================================
  describe('Phần 4: Xác minh ảnh hỗn hợp & Test Hook Isolation', () => {
    it('TC-MIXED-01: Admin hard-delete Homestay có đủ 4 loại ảnh -> Chỉ Local và Supabase được enqueue', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({
        MaHomestay: 30,
        HINH_ANH: [
          { MaAnh: 1, HinhAnh: 'uploads/local_clean.jpg' },                     // Local
          { MaAnh: 2, HinhAnh: 'homestays/30/supabase_clean.jpg' },             // Supabase
          { MaAnh: 3, HinhAnh: 'https://images.unsplash.com/photo-1560448204' }, // External Unsplash
          { MaAnh: 4, HinhAnh: 'uploads/../../etc/passwd' },                    // Security Alert / Path Traversal
        ],
      }));

      let enqueuedJobs = [];
      queueService.setTestEnqueueHook(async (items) => {
        enqueuedJobs = items;
        return items;
      });

      let deletedHomestayId = null;
      mockMethod(prisma.hOMESTAY, 'delete', async ({ where }) => {
        deletedHomestayId = where.MaHomestay;
        return { MaHomestay: deletedHomestayId };
      });

      let processTriggered = false;
      queueService.setTestProcessQueueHook(async () => {
        processTriggered = true;
        return { processed: 2, succeeded: 2, failed: 0 };
      });

      await adminService.deleteHomestay(30);

      // 1. Homestay được xóa thành công trong DB (cascade xóa cả 4 ảnh trong bảng HINH_ANH)
      assert.equal(deletedHomestayId, 30);

      // 2. Chỉ có 2 ảnh hợp lệ (Local và Supabase) được đưa vào Cleanup Queue
      assert.equal(enqueuedJobs.length, 2, 'Chỉ 2 ảnh Local và Supabase được enqueue');

      const localJob = enqueuedJobs.find((j) => j.bucketName === 'local');
      assert.ok(localJob);
      assert.equal(localJob.filePath, 'uploads/local_clean.jpg');
      assert.equal(localJob.reason, 'DELETE_HOMESTAY');

      const supabaseJob = enqueuedJobs.find((j) => j.bucketName === 'homestays');
      assert.ok(supabaseJob);
      assert.equal(supabaseJob.filePath, 'homestays/30/supabase_clean.jpg');
      assert.equal(supabaseJob.reason, 'DELETE_HOMESTAY');

      // 3. Unsplash và Path Traversal tuyệt đối không xuất hiện trong Queue
      assert.equal(enqueuedJobs.some((j) => j.filePath.includes('unsplash')), false);
      assert.equal(enqueuedJobs.some((j) => j.filePath.includes('passwd')), false);

      // 4. Queue được kích hoạt sau khi transaction commit
      assert.equal(processTriggered, true);
    });

    it('TC-MIXED-02: Host xóa ảnh ngoại vi Unsplash -> DB xóa thành công, không gọi xóa Storage và không enqueue', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 31, MaChu: 7 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 55,
        MaHomestay: 31,
        HinhAnh: 'https://images.unsplash.com/photo-hotel-room-view',
      }));

      let enqueueCalled = false;
      queueService.setTestEnqueueHook(async () => {
        enqueueCalled = true;
      });

      let dbDeletedImageId = null;
      mockMethod(prisma.hINH_ANH, 'delete', async ({ where }) => {
        dbDeletedImageId = where.MaAnh;
        return { MaAnh: dbDeletedImageId };
      });

      let processCalled = false;
      queueService.setTestProcessQueueHook(async () => {
        processCalled = true;
      });

      const res = await homestayService.deleteImage(31, 7, 55);

      assert.equal(res.success, true);
      assert.equal(dbDeletedImageId, 55, 'Bản ghi DB vẫn được xóa khỏi HINH_ANH');
      assert.equal(enqueueCalled, false, 'Không enqueue job cho URL ngoại vi');
      assert.equal(processCalled, false, 'Không trigger xóa Storage');
    });

    it('TC-MIXED-03: Host xóa ảnh chứa ký tự điều khiển/Path Traversal -> DB xóa thành công, không xóa Storage', async () => {
      mockTransaction();
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 32, MaChu: 7 }));
      mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
        MaAnh: 56,
        MaHomestay: 32,
        HinhAnh: 'uploads/subdir/../../../windows/system32/cmd.exe',
      }));

      let enqueueCalled = false;
      queueService.setTestEnqueueHook(async () => {
        enqueueCalled = true;
      });

      let dbDeletedImageId = null;
      mockMethod(prisma.hINH_ANH, 'delete', async ({ where }) => {
        dbDeletedImageId = where.MaAnh;
        return { MaAnh: dbDeletedImageId };
      });

      const res = await homestayService.deleteImage(32, 7, 56);

      assert.equal(res.success, true);
      assert.equal(dbDeletedImageId, 56);
      assert.equal(enqueueCalled, false, 'Chặn không đưa file nguy hiểm vào Queue xóa');
    });

    it('TC-HOOK-01: Test hooks cô lập tuyệt đối – Chỉ cho phép thiết lập khi NODE_ENV=test', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        // 1. Trong môi trường test: Hook hoạt động bình thường
        process.env.NODE_ENV = 'test';
        let enqueueHookExecuted = false;
        queueService.setTestEnqueueHook(async () => {
          enqueueHookExecuted = true;
          return [{ id: 999 }];
        });
        const res = await queueService.enqueueCleanup({ filePath: 'test.jpg' });
        assert.equal(enqueueHookExecuted, true);
        assert.equal(res[0].id, 999);

        let storageHookExecuted = false;
        storageService.setTestStorageHooks({
          uploadFiles: async () => {
            storageHookExecuted = true;
            return [{ url: 'mock_url' }];
          }
        });
        const uploadRes = await storageService.uploadFiles([], 1);
        assert.equal(storageHookExecuted, true);

        // Reset hook về null
        queueService.setTestEnqueueHook(null);
        queueService.setTestProcessQueueHook(null);
        storageService.setTestStorageHooks(null);

        // 2. Trong môi trường development: Không thể thiết lập hook (bị bỏ qua)
        process.env.NODE_ENV = 'development';
        let devHookCalled = false;
        queueService.setTestEnqueueHook(() => { devHookCalled = true; });
        queueService.setTestProcessQueueHook(() => { devHookCalled = true; });
        storageService.setTestStorageHooks({ uploadFiles: () => { devHookCalled = true; } });

        const devUploadRes = await storageService.uploadFiles([], 1);
        assert.deepEqual(devUploadRes, []);
        assert.equal(devHookCalled, false, 'dev hook không được thiết lập');

        // 3. Trong môi trường production: Không thể thiết lập hook (bị bỏ qua)
        process.env.NODE_ENV = 'production';
        let prodHookCalled = false;
        queueService.setTestEnqueueHook(() => { prodHookCalled = true; });
        queueService.setTestProcessQueueHook(() => { prodHookCalled = true; });
        storageService.setTestStorageHooks({ uploadFiles: () => { prodHookCalled = true; } });

        const prodUploadRes = await storageService.uploadFiles([], 1);
        assert.deepEqual(prodUploadRes, []);
        assert.equal(prodHookCalled, false, 'prod hook không được thiết lập');

        // 4. Khi NODE_ENV không xác định (undefined): Không thể thiết lập hook
        delete process.env.NODE_ENV;
        let undefinedHookCalled = false;
        queueService.setTestEnqueueHook(() => { undefinedHookCalled = true; });
        queueService.setTestProcessQueueHook(() => { undefinedHookCalled = true; });
        storageService.setTestStorageHooks({ uploadFiles: () => { undefinedHookCalled = true; } });

        const undefUploadRes = await storageService.uploadFiles([], 1);
        assert.deepEqual(undefUploadRes, []);
        assert.equal(undefinedHookCalled, false, 'undefined hook không được thiết lập');
      } finally {
        process.env.NODE_ENV = originalEnv || 'test';
        queueService.setTestEnqueueHook(null);
        queueService.setTestProcessQueueHook(null);
        storageService.setTestStorageHooks(null);
      }
    });

    it('TC-HOOK-02: Đảm bảo hook được reset sạch sau mỗi test, không rò rỉ trạng thái', async () => {
      // Khi reset về null trong môi trường test
      process.env.NODE_ENV = 'test';
      queueService.setTestEnqueueHook(null);
      queueService.setTestProcessQueueHook(null);
      storageService.setTestStorageHooks(null);

      // Thử gọi uploadFiles([], 1) không có hook -> trả về [] mặc định
      const res = await storageService.uploadFiles([], 1);
      assert.deepEqual(res, []);
      assert.equal(process.env.NODE_ENV, 'test');
    });
  });
});
