// backend/tests/upload.middleware.test.js
process.env.NODE_ENV = 'test';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import multer from 'multer';
import prisma from '../src/config/prisma.js';
import * as homestayService from '../src/services/homestay.service.js';
import * as storageService from '../src/services/storage.service.js';
import * as queueService from '../src/services/storageCleanupQueue.service.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';
import {
  validateImageBuffer,
  validateUploadedImages,
  handleMulterError,
  MAX_FILE_SIZE,
} from '../src/middlewares/upload.middleware.js';

describe('Level 1: Upload Middleware & Safety Validation Unit Tests', () => {
  afterEach(() => {
    restoreAllMocks();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    storageService.clearEmergencyBuffer();
  });
  // Helper tạo buffer ảnh hợp lệ qua sharp
  async function createTestImageBuffer(format = 'jpeg', width = 200, height = 200) {
    const pipeline = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 120, g: 180, b: 240 },
      },
    });

    if (format === 'png') return pipeline.png().toBuffer();
    if (format === 'webp') return pipeline.webp().toBuffer();
    return pipeline.jpeg().toBuffer();
  }

  // =========================================================================
  // 1. KIỂM THỬ MAGIC BYTES & ĐỊNH DẠNG ẢNH
  // =========================================================================
  describe('Magic Bytes & Format Validation', () => {
    it('TC-VAL-FMT-01: Chấp nhận ảnh JPEG hợp lệ qua Magic Bytes', async () => {
      const buf = await createTestImageBuffer('jpeg', 300, 200);
      const res = await validateImageBuffer(buf, 'photo.jpg');

      assert.equal(res.valid, true);
      assert.equal(res.mime, 'image/jpeg');
      assert.equal(res.width, 300);
      assert.equal(res.height, 200);
    });

    it('TC-VAL-FMT-02: Chấp nhận ảnh PNG hợp lệ qua Magic Bytes', async () => {
      const buf = await createTestImageBuffer('png', 150, 150);
      const res = await validateImageBuffer(buf, 'logo.png');

      assert.equal(res.valid, true);
      assert.equal(res.mime, 'image/png');
      assert.equal(res.width, 150);
      assert.equal(res.height, 150);
    });

    it('TC-VAL-FMT-03: Chấp nhận ảnh WebP hợp lệ qua Magic Bytes', async () => {
      const buf = await createTestImageBuffer('webp', 400, 300);
      const res = await validateImageBuffer(buf, 'banner.webp');

      assert.equal(res.valid, true);
      assert.equal(res.mime, 'image/webp');
      assert.equal(res.width, 400);
      assert.equal(res.height, 300);
    });

    it('TC-VAL-FMT-04: Từ chối file văn bản giả mạo đuôi ảnh .jpg (Extension Spoofing)', async () => {
      const fakeBuffer = Buffer.from('<?php echo "evil script"; ?>', 'utf8');
      const res = await validateImageBuffer(fakeBuffer, 'malicious.jpg');

      assert.equal(res.valid, false);
      assert.match(res.error, /không phải là ảnh hợp lệ hoặc bị giả mạo/i);
    });

    it('TC-VAL-FMT-05: Từ chối file rỗng (Zero-byte buffer)', async () => {
      const res = await validateImageBuffer(Buffer.alloc(0), 'empty.png');
      assert.equal(res.valid, false);
      assert.match(res.error, /rỗng/i);
    });

    it('TC-VAL-FMT-06: Từ chối file không phải ảnh (PDF header %PDF)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 dummy pdf header and content', 'utf8');
      const res = await validateImageBuffer(pdfBuffer, 'document.jpg');

      assert.equal(res.valid, false);
      assert.match(res.error, /không phải là ảnh hợp lệ/i);
    });
  });

  // =========================================================================
  // 2. KIỂM THỬ KÍCH THƯỚC, ĐỘ PHÂN GIẢI & GIẢI MÃ SHARP
  // =========================================================================
  describe('Dimensions, Resolution & Decoding Verification', () => {
    it('TC-VAL-DIM-01: Từ chối ảnh có chiều rộng vượt quá 4096px', async () => {
      const largeBuf = await createTestImageBuffer('jpeg', 4097, 100);
      const res = await validateImageBuffer(largeBuf, 'wide.jpg');

      assert.equal(res.valid, false);
      assert.match(res.error, /vượt quá giới hạn tối đa 4096x4096px/i);
    });

    it('TC-VAL-DIM-02: Từ chối ảnh có chiều cao vượt quá 4096px', async () => {
      const tallBuf = await createTestImageBuffer('png', 100, 4097);
      const res = await validateImageBuffer(tallBuf, 'tall.png');

      assert.equal(res.valid, false);
      assert.match(res.error, /vượt quá giới hạn tối đa 4096x4096px/i);
    });

    it('TC-VAL-DIM-03: Chấp nhận ảnh có kích thước tối đa 4096x4096px hợp lệ', async () => {
      const maxBuf = await createTestImageBuffer('jpeg', 4096, 4096);
      const res = await validateImageBuffer(maxBuf, 'max.jpg');

      assert.equal(res.valid, true);
      assert.equal(res.width, 4096);
      assert.equal(res.height, 4096);
    });

    it('TC-VAL-DEC-01: Phát hiện và từ chối tệp ảnh bị hỏng dữ liệu (Corrupt bytes)', async () => {
      // Bắt đầu bằng JPEG magic bytes (\xFF\xD8\xFF) nhưng phần sau bị cắt vụn hoặc chứa dữ liệu hỏng
      const corruptBuf = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]),
        Buffer.from('corrupted and truncated image binary stream with invalid Huffman tables'),
      ]);

      const res = await validateImageBuffer(corruptBuf, 'corrupt.jpg');
      assert.equal(res.valid, false);
      // Có thể bị chặn ở bước Magic Bytes hoặc bước Sharp decode
      assert.ok(res.error.length > 0);
    });
  });

  // =========================================================================
  // 3. KIỂM THỬ MIDDLEWARE EXPRESS validateUploadedImages & handleMulterError
  // =========================================================================
  describe('Express Middleware Integration Flow', () => {
    it('TC-VAL-MID-01: Trả về HTTP 400 khi req.files rỗng hoặc không có file', async () => {
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      await validateUploadedImages({ files: [] }, mockRes, () => {});
      assert.equal(statusCode, 400);
      assert.match(jsonPayload.message, /Không có file ảnh nào/i);
    });

    it('TC-VAL-MID-02: Trả về HTTP 400 khi số lượng ảnh vượt quá 5 file', async () => {
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      const sixFiles = Array.from({ length: 6 }, (_, i) => ({
        buffer: Buffer.from('test'),
        originalname: `img_${i}.jpg`,
      }));

      await validateUploadedImages({ files: sixFiles }, mockRes, () => {});
      assert.equal(statusCode, 400);
      assert.match(jsonPayload.message, /tối đa 5 ảnh/i);
    });

    it('TC-VAL-MID-03: Chấp nhận danh sách 3 ảnh hợp lệ và gán metadata vào req.files', async () => {
      const validFiles = [
        { buffer: await createTestImageBuffer('jpeg', 100, 100), originalname: 'a.jpg' },
        { buffer: await createTestImageBuffer('png', 120, 120), originalname: 'b.png' },
        { buffer: await createTestImageBuffer('webp', 150, 150), originalname: 'c.webp' },
      ];

      let nextCalled = false;
      const mockReq = { files: validFiles };
      const mockRes = {
        status: () => ({ json: () => {} }),
      };

      await validateUploadedImages(mockReq, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(mockReq.files[0].validatedMime, 'image/jpeg');
      assert.equal(mockReq.files[1].validatedMime, 'image/png');
      assert.equal(mockReq.files[2].validatedMime, 'image/webp');
    });

    it('TC-VAL-MID-04: Từ chối toàn bộ request nếu có 1 file bị lỗi trong mảng', async () => {
      const mixedFiles = [
        { buffer: await createTestImageBuffer('jpeg', 100, 100), originalname: 'good.jpg' },
        { buffer: Buffer.from('bad text file'), originalname: 'bad.jpg' },
      ];

      let statusCode = null;
      let jsonPayload = null;
      let nextCalled = false;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      await validateUploadedImages({ files: mixedFiles }, mockRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(statusCode, 400);
      assert.match(jsonPayload.message, /bad\.jpg/i);
    });

    it('TC-VAL-ERR-01: handleMulterError xử lý lỗi LIMIT_FILE_SIZE trả về 400 thân thiện', () => {
      const multerErr = new multer.MulterError('LIMIT_FILE_SIZE');
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      handleMulterError(multerErr, {}, mockRes, () => {});
      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /vượt quá giới hạn cho phép \(tối đa 5MB\/ảnh\)/i);
    });

    it('TC-VAL-ERR-02: handleMulterError xử lý lỗi LIMIT_FILE_COUNT trả về 400 thân thiện', () => {
      const multerErr = new multer.MulterError('LIMIT_FILE_COUNT');
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      handleMulterError(multerErr, {}, mockRes, () => {});
      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /tối đa 5 ảnh/i);
    });

    it('TC-VAL-ERR-03: handleMulterError xử lý lỗi fileFilter (sai phần mở rộng) trả về 400 và success: false', () => {
      const extErr = new Error('Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP!');
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      handleMulterError(extErr, {}, mockRes, () => {});
      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /Chỉ chấp nhận file ảnh định dạng/i);
    });

    it('TC-VAL-MID-05: validateUploadedImages trả về HTTP 400 với success: false khi ảnh không hợp lệ', async () => {
      let statusCode = null;
      let jsonPayload = null;

      const mockRes = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };

      const badFile = { buffer: Buffer.from('not an image'), originalname: 'test.jpg' };
      await validateUploadedImages({ files: [badFile] }, mockRes, () => {});

      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.success, false);
      assert.match(jsonPayload.message, /không phải là ảnh hợp lệ hoặc bị giả mạo định dạng/i);
    });
  });

  // =========================================================================
  // 4. KIỂM THỬ BÙ TRỪ & KHẮC PHỤC LỖI KHI GHI DATABASE THẤT BẠI (Compensation Flow)
  // =========================================================================
  describe('Upload Compensation & Emergency Fallback Flow', () => {
    it('TC-UPL-COMP-01: Ghi database thành công -> Trả về danh sách bản ghi ảnh', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      storageService.setTestStorageHooks({
        uploadFiles: async () => [
          { path: 'uploads/photo_1.jpg', bucketName: 'local' },
          { path: 'uploads/photo_2.jpg', bucketName: 'local' },
        ],
      });
      mockMethod(prisma.hINH_ANH, 'createMany', async ({ data }) => ({ count: data.length }));

      const dummyFiles = [
        { buffer: Buffer.from('img1'), originalname: 'p1.jpg' },
        { buffer: Buffer.from('img2'), originalname: 'p2.jpg' },
      ];

      const res = await homestayService.uploadImages(1, 10, dummyFiles);
      assert.equal(res.length, 2);
      assert.equal(res[0].HinhAnh, 'uploads/photo_1.jpg');
      assert.equal(res[1].HinhAnh, 'uploads/photo_2.jpg');
    });

    it('TC-UPL-COMP-02: DB createMany ném lỗi -> Tự động gọi deleteFileFromStorage bù trừ', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      const deletedPaths = [];
      storageService.setTestStorageHooks({
        uploadFiles: async () => [
          { path: 'uploads/comp_1.jpg', bucketName: 'local' },
          { path: 'uploads/comp_2.jpg', bucketName: 'local' },
        ],
        deleteFileFromStorage: async (filePath) => {
          deletedPaths.push(filePath);
          return { success: true };
        },
      });
      mockMethod(prisma.hINH_ANH, 'createMany', async () => {
        throw new Error('Database write error: disk full');
      });

      const dummyFiles = [
        { buffer: Buffer.from('img1'), originalname: 'p1.jpg' },
        { buffer: Buffer.from('img2'), originalname: 'p2.jpg' },
      ];

      await assert.rejects(
        () => homestayService.uploadImages(1, 10, dummyFiles),
        /Database write error: disk full/i
      );

      assert.equal(deletedPaths.length, 2);
      assert.ok(deletedPaths.includes('uploads/comp_1.jpg'));
      assert.ok(deletedPaths.includes('uploads/comp_2.jpg'));
    });

    it('TC-UPL-COMP-03: Xóa bù trừ trực tiếp thất bại -> Tự động đưa vào Queue dọn dẹp', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      storageService.setTestStorageHooks({
        uploadFiles: async () => [
          { path: 'homestays/1/storage_fail.jpg', bucketName: 'homestays' },
        ],
        deleteFileFromStorage: async () => {
          throw new Error('Storage service connection timeout');
        },
      });
      mockMethod(prisma.hINH_ANH, 'createMany', async () => {
        throw new Error('Prisma database constraint error');
      });

      // Queue service tiếp nhận
      const enqueuedJobs = [];
      queueService.setTestEnqueueHook(async (item) => {
        enqueuedJobs.push(item);
        return [item];
      });

      const dummyFiles = [{ buffer: Buffer.from('img'), originalname: 'p.jpg' }];

      await assert.rejects(
        () => homestayService.uploadImages(1, 10, dummyFiles),
        /Prisma database constraint error/i
      );

      assert.equal(enqueuedJobs.length, 1);
      assert.equal(enqueuedJobs[0].filePath, 'homestays/1/storage_fail.jpg');
      assert.equal(enqueuedJobs[0].reason, 'UPLOAD_COMPENSATION');
    });

    it('TC-UPL-COMP-04: Cả xóa bù trừ và Queue đều thất bại -> Đưa vào In-Memory Emergency Buffer', async () => {
      mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
      storageService.setTestStorageHooks({
        uploadFiles: async () => [
          { path: 'homestays/1/catastrophic.jpg', bucketName: 'homestays' },
        ],
        deleteFileFromStorage: async () => {
          return { success: false, error: 'Network is unreachable' };
        },
      });
      mockMethod(prisma.hINH_ANH, 'createMany', async () => {
        throw new Error('Total DB outage');
      });

      // enqueueCleanup ném ngoại lệ do DB sập
      queueService.setTestEnqueueHook(async () => {
        throw new Error('Can not connect to PostgreSQL database');
      });

      const dummyFiles = [{ buffer: Buffer.from('img'), originalname: 'p.jpg' }];

      await assert.rejects(
        () => homestayService.uploadImages(1, 10, dummyFiles),
        /Total DB outage/i
      );

      const bufferItems = storageService.getEmergencyBuffer();
      assert.equal(bufferItems.length, 1);
      assert.equal(bufferItems[0].filePath, 'homestays/1/catastrophic.jpg');
      assert.equal(bufferItems[0].reason, 'UPLOAD_COMPENSATION');
      assert.equal(bufferItems[0].homestayId, 1);
    });
  });
});

