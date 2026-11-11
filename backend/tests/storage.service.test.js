// backend/tests/storage.service.test.js
process.env.NODE_ENV = 'test';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  classifyAndValidateImagePath,
  uploadFile,
  uploadFiles,
  deleteFileFromStorage,
  deleteFilesFromStorage,
  pushToEmergencyBuffer,
  getEmergencyBuffer,
  clearEmergencyBuffer,
  getDroppedJobsCount,
  flushEmergencyBuffer,
  MAX_EMERGENCY_BUFFER_SIZE,
  getStorageDriver,
  validateStorageConfig,
} from '../src/services/storage.service.js';
import { setSupabaseClient } from '../src/config/supabase.js';
import { classifyStorageError, STORAGE_ERROR_TYPE } from '../src/services/storageCleanupQueue.service.js';

describe('Level 1: Storage Service & Path Classifier Unit Tests', () => {
  let testUploadsDir;
  const mockSupabaseHost = 'testproject.supabase.co';
  const mockSupabaseUrl = `https://${mockSupabaseHost}`;

  before(async () => {
    // Tạo thư mục uploads tạm thời phục vụ test
    testUploadsDir = path.join(os.tmpdir(), 'ptda-test-uploads-' + Date.now());
    await fs.promises.mkdir(testUploadsDir, { recursive: true });

    // Tạo file mẫu trong testUploadsDir
    await fs.promises.writeFile(path.join(testUploadsDir, 'sample.jpg'), 'sample image data');
  });

  after(async () => {
    try {
      await fs.promises.rm(testUploadsDir, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    clearEmergencyBuffer();
    setSupabaseClient(null);
  });

  // =========================================================================
  // 1. KIỂM THỬ PATH CLASSIFIER (10 KỊCH BẢN BẢO MẬT BẮT BUỘC)
  // =========================================================================
  describe('Path Classifier & Security Validation (10 Scenarios)', () => {
    it('TC-PATH-01: Chặn Path Traversal Local (uploads/../../etc/passwd và uploads/sub/../../file)', async () => {
      const res1 = await classifyAndValidateImagePath('uploads/../../etc/passwd', { uploadsDir: testUploadsDir });
      assert.equal(res1.isDeletable, false);
      assert.equal(res1.type, 'SECURITY_ALERT');

      const res2 = await classifyAndValidateImagePath('uploads/sub/../../secret.txt', { uploadsDir: testUploadsDir });
      assert.equal(res2.isDeletable, false);
      assert.equal(res2.type, 'SECURITY_ALERT');
    });

    it('TC-PATH-02: Chuẩn hóa Path Separator Windows (\\) và Linux (/)', async () => {
      // Windows backslash
      const resWin = await classifyAndValidateImagePath('uploads\\sample.jpg', { uploadsDir: testUploadsDir });
      assert.equal(resWin.isDeletable, true);
      assert.equal(resWin.type, 'LOCAL');
      assert.equal(resWin.filePath, 'uploads/sample.jpg');

      // Linux slash
      const resLinux = await classifyAndValidateImagePath('uploads/sample.jpg', { uploadsDir: testUploadsDir });
      assert.equal(resLinux.isDeletable, true);
      assert.equal(resLinux.type, 'LOCAL');
      assert.equal(resLinux.filePath, 'uploads/sample.jpg');
    });

    it('TC-PATH-03: Chặn Null Byte Injection (\\0) và Control Characters', async () => {
      const resNull = await classifyAndValidateImagePath('uploads/sample.jpg\0.png', { uploadsDir: testUploadsDir });
      assert.equal(resNull.isDeletable, false);
      assert.equal(resNull.type, 'SECURITY_ALERT');

      const resCtrl = await classifyAndValidateImagePath('uploads/sample\x1b.jpg', { uploadsDir: testUploadsDir });
      assert.equal(resCtrl.isDeletable, false);
      assert.equal(resCtrl.type, 'SECURITY_ALERT');
    });

    it('TC-PATH-04: Chống Symlink trỏ ra ngoài thư mục uploads', async () => {
      // Tạo một file bên ngoài uploadsDir
      const outsideFile = path.join(os.tmpdir(), 'outside-secret-' + Date.now() + '.txt');
      await fs.promises.writeFile(outsideFile, 'secret content');

      const symlinkPath = path.join(testUploadsDir, 'symlink_attack.jpg');
      try {
        await fs.promises.symlink(outsideFile, symlinkPath);

        const res = await classifyAndValidateImagePath('uploads/symlink_attack.jpg', { uploadsDir: testUploadsDir });
        assert.equal(res.isDeletable, false);
        assert.equal(res.type, 'SECURITY_ALERT');
        assert.match(res.error, /Symbolic Link/i);
      } catch (err) {
        // Trên một số môi trường Windows không bật Developer Mode, tạo symlink cần quyền admin
        // Trong trường hợp đó, test verify logic kiểm tra code path
        if (err.code !== 'EPERM') throw err;
      } finally {
        try { await fs.promises.unlink(symlinkPath); } catch {}
        try { await fs.promises.unlink(outsideFile); } catch {}
      }
    });

    it('TC-PATH-05: Từ chối URL Supabase sử dụng giao thức HTTP không an toàn', async () => {
      const httpUrl = `http://${mockSupabaseHost}/storage/v1/object/public/homestays/homestays/1/img.jpg`;
      const res = await classifyAndValidateImagePath(httpUrl, { supabaseHost: mockSupabaseHost });
      assert.equal(res.isDeletable, false);
      assert.equal(res.type, 'INSECURE_PROTOCOL');
    });

    it('TC-PATH-06: Từ chối URL Supabase sai origin hoặc sai bucket', async () => {
      // Sai origin
      const wrongHostUrl = 'https://malicious.supabase.co/storage/v1/object/public/homestays/homestays/1/img.jpg';
      const resHost = await classifyAndValidateImagePath(wrongHostUrl, { supabaseHost: mockSupabaseHost });
      assert.equal(resHost.isDeletable, false);
      assert.equal(resHost.type, 'EXTERNAL_URL');

      // Sai bucket
      const wrongBucketUrl = `https://${mockSupabaseHost}/storage/v1/object/public/other_bucket/homestays/1/img.jpg`;
      const resBucket = await classifyAndValidateImagePath(wrongBucketUrl, {
        supabaseHost: mockSupabaseHost,
        bucketName: 'homestays',
      });
      assert.equal(resBucket.isDeletable, false);
      assert.equal(resBucket.type, 'WRONG_BUCKET');
    });

    it('TC-PATH-07: Từ chối Object Key Supabase chứa segment . hoặc ..', async () => {
      const res1 = await classifyAndValidateImagePath('homestays/1/../secret.jpg');
      assert.equal(res1.isDeletable, false);
      assert.equal(res1.type, 'SECURITY_ALERT');

      const res2 = await classifyAndValidateImagePath('homestays/./sample.jpg');
      assert.equal(res2.isDeletable, false);
      assert.equal(res2.type, 'SECURITY_ALERT');
    });

    it('TC-PATH-08: Từ chối Object Key chứa dấu ngược \\ hoặc encoded slash %2F, %5C', async () => {
      const resBackslash = await classifyAndValidateImagePath('homestays/1\\evil.jpg');
      assert.equal(resBackslash.isDeletable, false);
      assert.equal(resBackslash.type, 'INVALID_KEY');

      const resEncodedSlash = await classifyAndValidateImagePath('homestays/1%2Fevil.jpg');
      assert.equal(resEncodedSlash.isDeletable, false);
      assert.equal(resEncodedSlash.type, 'INVALID_KEY');

      const resEncodedBackslash = await classifyAndValidateImagePath('homestays/1%5Cevil.jpg');
      assert.equal(resEncodedBackslash.isDeletable, false);
      assert.equal(resEncodedBackslash.type, 'INVALID_KEY');
    });

    it('TC-PATH-09: Xử lý an toàn URL Unsplash hoặc CDN bên ngoài (đánh dấu EXTERNAL_URL)', async () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80';
      const res = await classifyAndValidateImagePath(unsplashUrl, { supabaseHost: mockSupabaseHost });
      assert.equal(res.isDeletable, false);
      assert.equal(res.type, 'EXTERNAL_URL');
    });

    it('TC-PATH-10: Tên file đơn thuần không tồn tại phải trả về UNKNOWN (không tự tiện đoán LOCAL)', async () => {
      // File không tồn tại và không có tiền tố uploads/ -> Bắt buộc UNKNOWN
      const resUnknown = await classifyAndValidateImagePath('non_existent_file_xyz123.jpg', {
        uploadsDir: testUploadsDir,
      });
      assert.equal(resUnknown.type, 'UNKNOWN');
      assert.equal(resUnknown.isDeletable, false);

      // File thực sự tồn tại trong uploadsDir (sample.jpg đã tạo ở before()) -> Nhận diện LOCAL
      const resExisting = await classifyAndValidateImagePath('sample.jpg', {
        uploadsDir: testUploadsDir,
      });
      assert.equal(resExisting.type, 'LOCAL');
      assert.equal(resExisting.isDeletable, true);

      // Chuỗi rỗng hoặc rỗng sau trim -> UNKNOWN
      const resEmpty = await classifyAndValidateImagePath('   ');
      assert.equal(resEmpty.isDeletable, false);
      assert.equal(resEmpty.type, 'UNKNOWN');

      // Tệp không phải là ảnh (.txt, .sh, .exe) -> UNKNOWN
      const resNonImage = await classifyAndValidateImagePath('uploads/script.sh', {
        uploadsDir: testUploadsDir,
      });
      assert.equal(resNonImage.isDeletable, false);
      assert.equal(resNonImage.type, 'UNKNOWN');
    });

    it('TC-PATH-11: Từ chối đường dẫn tuyệt đối không hợp lệ (C:\\... hoặc /etc/...)', async () => {
      const resWinAbs = await classifyAndValidateImagePath('C:\\Windows\\System32\\cmd.exe', {
        uploadsDir: testUploadsDir,
      });
      assert.equal(resWinAbs.isDeletable, false);
      assert.equal(resWinAbs.type, 'SECURITY_ALERT');

      const resUnixAbs = await classifyAndValidateImagePath('/etc/shadow', {
        uploadsDir: testUploadsDir,
      });
      assert.equal(resUnixAbs.isDeletable, false);
      assert.equal(resUnixAbs.type, 'SECURITY_ALERT');
    });

    it('TC-PATH-12: Chống Symlink của thư mục cha trỏ ra ngoài uploads', async () => {
      // Tạo thư mục bên ngoài
      const outsideDir = path.join(os.tmpdir(), 'ptda-outside-dir-' + Date.now());
      await fs.promises.mkdir(outsideDir, { recursive: true });
      const targetFile = path.join(outsideDir, 'target.jpg');
      await fs.promises.writeFile(targetFile, 'content');

      const symlinkDir = path.join(testUploadsDir, 'sym_parent_dir');
      try {
        await fs.promises.symlink(outsideDir, symlinkDir, 'junction');

        const res = await classifyAndValidateImagePath('uploads/sym_parent_dir/target.jpg', {
          uploadsDir: testUploadsDir,
        });
        assert.equal(res.isDeletable, false);
        assert.equal(res.type, 'SECURITY_ALERT');
        assert.match(res.error, /thư mục cha|traversal/i);

        // Xác nhận file bên ngoài tuyệt đối không bị xóa khi gọi xóa
        const delRes = await deleteFileFromStorage('uploads/sym_parent_dir/target.jpg', 'local', {
          uploadsDir: testUploadsDir,
        });
        assert.equal(delRes.success, false);
        assert.equal(fs.existsSync(targetFile), true, 'File bên ngoài uploads không được phép bị xóa');
      } catch (err) {
        if (err.code !== 'EPERM') throw err;
      } finally {
        try { await fs.promises.unlink(symlinkDir); } catch {}
        try { await fs.promises.rm(outsideDir, { recursive: true, force: true }); } catch {}
      }
    });
  });

  // =========================================================================
  // 2. KIỂM THỬ UPLOAD FILE (LOCAL & SUPABASE MOCK)
  // =========================================================================
  describe('Storage Upload Operations', () => {
    it('TC-STOR-UP-01: Upload file trong chế độ Local thành công', async () => {
      const dummyFile = {
        buffer: Buffer.from('test image content local'),
        originalname: 'my-photo.jpg',
        mimetype: 'image/jpeg',
      };

      const result = await uploadFile(dummyFile, 10, {
        driver: 'local',
        uploadsDir: testUploadsDir,
      });

      assert.equal(result.driver, 'local');
      assert.equal(result.bucketName, 'local');
      assert.ok(result.path.startsWith('uploads/images-'));

      // Kiểm tra file thực tế đã được ghi trên đĩa
      const createdFilename = result.path.replace('uploads/', '');
      const fullPath = path.join(testUploadsDir, createdFilename);
      assert.ok(fs.existsSync(fullPath));
    });

    it('TC-STOR-UP-02: Upload file trong chế độ Supabase thành công và trả về Object Key', async () => {
      let uploadedKey = null;
      let uploadedBuffer = null;

      const mockSupabase = {
        storage: {
          from: (bucket) => ({
            upload: async (key, buffer, options) => {
              uploadedKey = key;
              uploadedBuffer = buffer;
              return { data: { path: key }, error: null };
            },
            getPublicUrl: (key) => ({
              data: { publicUrl: `${mockSupabaseUrl}/storage/v1/object/public/${bucket}/${key}` },
            }),
          }),
        },
      };

      const dummyFile = {
        buffer: Buffer.from('test image content supabase'),
        originalname: 'beach.png',
        mimetype: 'image/png',
      };

      const result = await uploadFile(dummyFile, 42, {
        driver: 'supabase',
        bucketName: 'homestays',
        supabaseClient: mockSupabase,
      });

      assert.equal(result.driver, 'supabase');
      assert.equal(result.bucketName, 'homestays');
      assert.ok(result.path.startsWith('homestays/42/'));
      assert.ok(result.path.endsWith('.png'));
      assert.ok(result.url.includes(`${mockSupabaseUrl}/storage/v1/object/public/homestays/`));
      assert.equal(uploadedKey, result.path);
    });

    it('TC-STOR-UP-03: Upload nhiều file – Tự động thu hồi/xóa file đã upload nếu file sau bị lỗi', async () => {
      const deletedKeys = [];
      let uploadCount = 0;

      const mockSupabase = {
        storage: {
          from: (bucket) => ({
            upload: async (key, buffer) => {
              uploadCount++;
              if (uploadCount === 2) {
                // File thứ 2 bị lỗi
                return { error: { message: 'Quota exceeded for storage' } };
              }
              return { data: { path: key }, error: null };
            },
            getPublicUrl: (key) => ({
              data: { publicUrl: `https://test.supabase.co/${key}` },
            }),
            remove: async (keys) => {
              deletedKeys.push(...keys);
              return { data: keys, error: null };
            },
          }),
        },
      };

      const files = [
        { buffer: Buffer.from('file 1'), originalname: 'file1.jpg', mimetype: 'image/jpeg' },
        { buffer: Buffer.from('file 2'), originalname: 'file2.jpg', mimetype: 'image/jpeg' },
      ];

      await assert.rejects(
        () => uploadFiles(files, 99, {
          driver: 'supabase',
          supabaseClient: mockSupabase,
          supabaseHost: 'test.supabase.co',
        }),
        /Quota exceeded for storage/
      );

      // File 1 đã upload thành công phải được dọn dẹp thu hồi ngay lập tức
      assert.equal(deletedKeys.length, 1);
      assert.ok(deletedKeys[0].startsWith('homestays/99/'));
    });
  });

  // =========================================================================
  // 3. KIỂM THỬ XÓA FILE STORAGE (LOCAL & SUPABASE MOCK)
  // =========================================================================
  describe('Storage Delete Operations', () => {
    it('TC-STOR-DEL-01: Xóa file Local thành công', async () => {
      const testFile = path.join(testUploadsDir, 'to-delete.jpg');
      await fs.promises.writeFile(testFile, 'dummy data');

      const res = await deleteFileFromStorage('uploads/to-delete.jpg', 'local', {
        uploadsDir: testUploadsDir,
      });

      assert.equal(res.success, true);
      assert.equal(fs.existsSync(testFile), false);
    });

    it('TC-STOR-DEL-02: Xóa file Local đã không tồn tại -> Idempotent success (alreadyDeleted: true)', async () => {
      const res = await deleteFileFromStorage('uploads/non-existent-12345.jpg', 'local', {
        uploadsDir: testUploadsDir,
      });

      assert.equal(res.success, true);
      assert.equal(res.alreadyDeleted, true);
    });

    it('TC-STOR-DEL-03: Xóa file Supabase thành công', async () => {
      let removedKey = null;
      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async (keys) => {
              removedKey = keys[0];
              return { data: keys, error: null };
            },
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/10/photo-123.jpg', 'homestays', {
        supabaseClient: mockSupabase,
      });

      assert.equal(res.success, true);
      assert.equal(removedKey, 'homestays/10/photo-123.jpg');
    });

    it('TC-STOR-DEL-04: Xóa URL Unsplash ngoại vi -> Bỏ qua an toàn (skipped: true)', async () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-sample?w=500';
      const res = await deleteFileFromStorage(unsplashUrl, 'homestays', {
        supabaseHost: mockSupabaseHost,
      });

      assert.equal(res.success, true);
      assert.equal(res.skipped, true);
      assert.equal(res.reason, 'EXTERNAL_URL');
    });
  });

  // =========================================================================
  // 4. KIỂM THỬ IN-MEMORY EMERGENCY BUFFER (KHI DB SẬP)
  // =========================================================================
  describe('In-Memory Emergency Ring Buffer', () => {
    it('TC-STOR-BUF-01: Tiếp nhận và lấy danh sách job trong buffer', () => {
      clearEmergencyBuffer();
      pushToEmergencyBuffer({
        filePath: 'homestays/1/emergency.jpg',
        bucketName: 'homestays',
        reason: 'UPLOAD_COMPENSATION',
      });

      const buffer = getEmergencyBuffer();
      assert.equal(buffer.length, 1);
      assert.equal(buffer[0].filePath, 'homestays/1/emergency.jpg');
      assert.equal(buffer[0].reason, 'UPLOAD_COMPENSATION');
    });

    it('TC-STOR-BUF-02: Quản lý tràn buffer – FIFO Eviction và ghi nhận droppedJobsCount', () => {
      clearEmergencyBuffer();

      // Đẩy 505 mục vào buffer (vượt quá MAX_EMERGENCY_BUFFER_SIZE = 500)
      for (let i = 0; i < MAX_EMERGENCY_BUFFER_SIZE + 5; i++) {
        pushToEmergencyBuffer({
          filePath: `homestays/1/overflow_${i}.jpg`,
          bucketName: 'homestays',
          reason: 'UPLOAD_COMPENSATION',
        });
      }

      const buffer = getEmergencyBuffer();
      assert.equal(buffer.length, MAX_EMERGENCY_BUFFER_SIZE);
      assert.equal(getDroppedJobsCount(), 5);

      // Mục cũ nhất (0 -> 4) đã bị loại bỏ, mục đầu tiên trong buffer hiện tại là mục 5
      assert.equal(buffer[0].filePath, 'homestays/1/overflow_5.jpg');
    });

    it('TC-STOR-BUF-03: Flush buffer thành công khi Database kết nối lại', async () => {
      clearEmergencyBuffer();
      pushToEmergencyBuffer({ filePath: 'homestays/1/flush1.jpg', bucketName: 'homestays' });
      pushToEmergencyBuffer({ filePath: 'homestays/1/flush2.jpg', bucketName: 'homestays' });

      const flushedItems = [];
      const fakeEnqueue = async (item) => {
        flushedItems.push(item);
        return item;
      };

      const count = await flushEmergencyBuffer(fakeEnqueue);
      assert.equal(count, 2);
      assert.equal(flushedItems.length, 2);
      assert.equal(getEmergencyBuffer().length, 0); // Buffer đã được dọn sạch sau khi flush
    });

    it('TC-STOR-BUF-04: Xử lý khi DB ngắt kết nối giữa chừng lúc flush – Giữ lại các job lỗi, không xóa toàn bộ buffer', async () => {
      clearEmergencyBuffer();

      // Đẩy 10 job vào buffer
      for (let i = 1; i <= 10; i++) {
        pushToEmergencyBuffer({
          filePath: `homestays/1/partial_job_${i}.jpg`,
          bucketName: 'homestays',
          reason: 'UPLOAD_COMPENSATION',
        });
      }
      assert.equal(getEmergencyBuffer().length, 10);

      // Giả lập: 5 job đầu enqueue thành công, từ job thứ 6 DB bị mất kết nối (ném Error)
      let attemptCount = 0;
      const partiallyFailingEnqueue = async (item) => {
        attemptCount++;
        if (attemptCount > 5) {
          throw new Error('Connection lost to PostgreSQL');
        }
        return item;
      };

      const flushedCount = await flushEmergencyBuffer(partiallyFailingEnqueue);
      assert.equal(flushedCount, 5); // Đúng 5 job đầu thành công

      // 5 job lỗi BẮT BUỘC PHẢI ĐƯỢC GIỮ LẠI trong buffer, không được bị xóa mất!
      const remaining = getEmergencyBuffer();
      assert.equal(remaining.length, 5);
      assert.equal(remaining[0].filePath, 'homestays/1/partial_job_6.jpg');
      assert.equal(remaining[4].filePath, 'homestays/1/partial_job_10.jpg');

      // Giả lập: Lần thử tiếp theo khi DB đã kết nối lại ổn định -> Flush 5 job còn lại thành công
      const healthyEnqueue = async (item) => item;
      const secondFlushedCount = await flushEmergencyBuffer(healthyEnqueue);
      assert.equal(secondFlushedCount, 5);
      assert.equal(getEmergencyBuffer().length, 0); // Toàn bộ buffer đã được dọn sạch
    });
  });

  // =========================================================================
  // 5. KIỂM THỬ TÍNH ĐỘC LẬP GIỮA LOCAL VÀ SUPABASE DRIVER
  // =========================================================================
  describe('Driver Independence & Zero Supabase Credentials in Local Mode', () => {
    it('TC-STOR-IND-01: Chạy Local Storage hoàn toàn không cần SUPABASE_URL hay SERVICE_ROLE_KEY', async () => {
      // Xóa biến môi trường Supabase trong ngữ cảnh test
      const oldUrl = process.env.SUPABASE_URL;
      const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        const dummyFile = {
          buffer: Buffer.from('local independent image'),
          originalname: 'local_ind.jpg',
          mimetype: 'image/jpeg',
        };

        // Upload local phải thành công 100% không throw lỗi config Supabase
        const uploadRes = await uploadFile(dummyFile, 77, {
          driver: 'local',
          uploadsDir: testUploadsDir,
        });
        assert.equal(uploadRes.driver, 'local');
        assert.ok(uploadRes.path.startsWith('uploads/images-'));

        // Xóa local phải thành công 100%
        const delRes = await deleteFileFromStorage(uploadRes.path, 'local', {
          uploadsDir: testUploadsDir,
        });
        assert.equal(delRes.success, true);
      } finally {
        if (oldUrl) process.env.SUPABASE_URL = oldUrl;
        if (oldKey) process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
      }
    });

    it('TC-STOR-IND-02: Khi chọn driver Supabase mà thiếu credentials -> Báo lỗi rõ ràng, không fallback ngầm', async () => {
      const oldUrl = process.env.SUPABASE_URL;
      const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        const dummyFile = {
          buffer: Buffer.from('supabase test image'),
          originalname: 'supa.jpg',
          mimetype: 'image/jpeg',
        };

        // Bắt buộc ném lỗi rõ ràng, không được tự động fallback sang local!
        await assert.rejects(
          () => uploadFile(dummyFile, 88, { driver: 'supabase' }),
          /\[SUPABASE_CONFIG_ERROR\]/
        );
      } finally {
        if (oldUrl) process.env.SUPABASE_URL = oldUrl;
        if (oldKey) process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
      }
    });
  });

  // =========================================================================
  // 6. KIỂM THỬ STORAGE SERVICE ADAPTER & ERROR CLASSIFICATION COMPATIBILITY
  // (ST-ADAPTER-01 -> ST-ADAPTER-05)
  // =========================================================================
  describe('Storage Service Adapter & Error Classification Compatibility', () => {
    it('ST-ADAPTER-01: Object NoSuchKey -> success: true, alreadyDeleted: true, không phát sinh FATAL', async () => {
      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async () => ({
              data: null,
              error: {
                name: 'NoSuchKey',
                message: 'The specified key does not exist on remote storage',
                statusCode: 404,
              },
            }),
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/1/not-found-image.jpg', 'homestays', {
        supabaseClient: mockSupabase,
      });

      assert.equal(res.success, true);
      assert.equal(res.alreadyDeleted, true);
      assert.equal(res.error, undefined);

      // Khi kết quả này chuyển đến Queue: Queue coi là hoàn tất thành công (không FATAL)
      const errorCategory = classifyStorageError(res);
      assert.notEqual(errorCategory, STORAGE_ERROR_TYPE.FATAL);
      assert.equal(errorCategory, STORAGE_ERROR_TYPE.ALREADY_DELETED);
    });

    it('ST-ADAPTER-02: Bucket NoSuchBucket -> success: false, giữ name, statusCode, error, Queue phân loại FATAL', async () => {
      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async () => ({
              data: null,
              error: {
                name: 'NoSuchBucket',
                message: 'Bucket not found',
                statusCode: 404,
              },
            }),
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/1/test-image.jpg', 'invalid-bucket', {
        supabaseClient: mockSupabase,
        bucketName: 'invalid-bucket',
      });

      assert.equal(res.success, false);
      assert.equal(res.alreadyDeleted, undefined);
      assert.equal(res.name, 'NoSuchBucket');
      assert.equal(res.statusCode, 404);
      assert.equal(res.error, 'Bucket not found');

      // Khi kết quả này chuyển đến Queue: Queue BẮT BUỘC phân loại là FATAL (chuyển FAILED ngay)
      const errorCategory = classifyStorageError(res);
      assert.equal(errorCategory, STORAGE_ERROR_TYPE.FATAL);
    });

    it('ST-ADAPTER-03: Generic HTTP 404 -> success: false, không trả alreadyDeleted: true, Queue phân loại TRANSIENT', async () => {
      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async () => ({
              data: null,
              error: {
                message: 'Not Found',
                statusCode: 404,
              },
            }),
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/1/generic-404.jpg', 'homestays', {
        supabaseClient: mockSupabase,
      });

      assert.equal(res.success, false);
      assert.equal(res.alreadyDeleted, undefined);
      assert.equal(res.statusCode, 404);
      assert.equal(res.error, 'Not Found');

      // Khi kết quả này chuyển đến Queue: Queue BẮT BUỘC phân loại là TRANSIENT (retry backoff)
      const errorCategory = classifyStorageError(res);
      assert.equal(errorCategory, STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ADAPTER-04: DNS ENOTFOUND -> success: false, giữ code ENOTFOUND, Queue phân loại TRANSIENT', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND testproject.supabase.co');
      dnsError.code = 'ENOTFOUND';

      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async () => {
              throw dnsError;
            },
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/1/dns-fail.jpg', 'homestays', {
        supabaseClient: mockSupabase,
      });

      assert.equal(res.success, false);
      assert.equal(res.alreadyDeleted, undefined);
      assert.equal(res.code, 'ENOTFOUND');
      assert.match(res.error, /ENOTFOUND/i);

      // Khi kết quả này chuyển đến Queue: Queue phân loại là TRANSIENT (retry backoff)
      const errorCategory = classifyStorageError(res);
      assert.equal(errorCategory, STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ADAPTER-05: HTTP 503 -> success: false, giữ statusCode 503 và error info, Queue phân loại TRANSIENT', async () => {
      const mockSupabase = {
        storage: {
          from: () => ({
            remove: async () => ({
              data: null,
              error: {
                message: 'Service Unavailable',
                statusCode: 503,
              },
            }),
          }),
        },
      };

      const res = await deleteFileFromStorage('homestays/1/server-busy.jpg', 'homestays', {
        supabaseClient: mockSupabase,
      });

      assert.equal(res.success, false);
      assert.equal(res.alreadyDeleted, undefined);
      assert.equal(res.statusCode, 503);
      assert.equal(res.error, 'Service Unavailable');

      // Khi kết quả này chuyển đến Queue: Queue phân loại là TRANSIENT (retry backoff)
      const errorCategory = classifyStorageError(res);
      assert.equal(errorCategory, STORAGE_ERROR_TYPE.TRANSIENT);
    });
  });

  // =========================================================================
  // 7. KIỂM THỬ PRODUCTION STORAGE DRIVER & FAIL-FAST VALIDATION (AUDIT-F01)
  // =========================================================================
  describe('7. Production Storage Driver & Fail-Fast Validation (AUDIT-F01)', () => {
    let savedNodeEnv;
    let savedDriver;
    let savedSupaUrl;
    let savedSupaKey;

    beforeEach(() => {
      savedNodeEnv = process.env.NODE_ENV;
      savedDriver = process.env.STORAGE_DRIVER;
      savedSupaUrl = process.env.SUPABASE_URL;
      savedSupaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    afterEach(() => {
      if (savedNodeEnv !== undefined) process.env.NODE_ENV = savedNodeEnv; else delete process.env.NODE_ENV;
      if (savedDriver !== undefined) process.env.STORAGE_DRIVER = savedDriver; else delete process.env.STORAGE_DRIVER;
      if (savedSupaUrl !== undefined) process.env.SUPABASE_URL = savedSupaUrl; else delete process.env.SUPABASE_URL;
      if (savedSupaKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedSupaKey; else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('TC-STOR-PROD-01: Local Development không khai báo driver -> Mặc định dùng local, hoạt động bình thường', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.STORAGE_DRIVER;

      const driver = getStorageDriver();
      assert.strictEqual(driver, 'local', 'Môi trường development mặc định sử dụng local driver');

      const configRes = validateStorageConfig();
      assert.strictEqual(configRes.driver, 'local');
      assert.strictEqual(configRes.valid, true);
    });

    it('TC-STOR-PROD-02: Production thiếu STORAGE_DRIVER -> Báo lỗi rõ ràng, không âm thầm dùng Local', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.STORAGE_DRIVER;

      assert.throws(
        () => getStorageDriver(),
        /\[STORAGE_CONFIG_ERROR\] Thiếu biến môi trường STORAGE_DRIVER trong môi trường production/
      );

      assert.throws(
        () => validateStorageConfig(),
        /\[STORAGE_CONFIG_ERROR\]/
      );
    });

    it('TC-STOR-PROD-03: Production cấu hình STORAGE_DRIVER=local -> Bị từ chối với lỗi cấu hình rõ ràng', async () => {
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_DRIVER = 'local';

      assert.throws(
        () => getStorageDriver(),
        /\[STORAGE_CONFIG_ERROR\] Cấu hình STORAGE_DRIVER='local' không được phép trong môi trường production/
      );

      // Thử uploadFile với options.driver = 'local' trong production cũng phải bị từ chối
      const dummyFile = {
        buffer: Buffer.from('test production local block'),
        originalname: 'block.jpg',
        mimetype: 'image/jpeg',
      };
      await assert.rejects(
        () => uploadFile(dummyFile, 99, { driver: 'local' }),
        /\[STORAGE_CONFIG_ERROR\] Không được phép sử dụng driver 'local' trong môi trường production/
      );
    });

    it('TC-STOR-PROD-04: Production Supabase thiếu URL -> Phát hiện cấu hình thiếu, báo lỗi rõ ràng', () => {
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_DRIVER = 'supabase';
      delete process.env.SUPABASE_URL;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key-test';

      assert.throws(
        () => getStorageDriver(),
        /\[SUPABASE_CONFIG_ERROR\] Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY/
      );

      assert.throws(
        () => validateStorageConfig(),
        /\[SUPABASE_CONFIG_ERROR\]/
      );
    });

    it('TC-STOR-PROD-05: Production Supabase thiếu Service Role Key -> Phát hiện cấu hình thiếu', () => {
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_DRIVER = 'supabase';
      process.env.SUPABASE_URL = 'https://validproject.supabase.co';
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      assert.throws(
        () => getStorageDriver(),
        /\[SUPABASE_CONFIG_ERROR\] Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY/
      );
    });

    it('TC-STOR-PROD-06: Production Supabase đủ cấu hình -> Chọn đúng Supabase driver và hợp lệ', () => {
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_DRIVER = 'supabase';
      process.env.SUPABASE_URL = 'https://validproject.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-valid-service-role-key-for-test';

      const driver = getStorageDriver();
      assert.strictEqual(driver, 'supabase');

      const configRes = validateStorageConfig();
      assert.strictEqual(configRes.driver, 'supabase');
      assert.strictEqual(configRes.valid, true);
    });

    it('TC-STOR-PROD-07: Credentials không hợp lệ (URL sai định dạng) -> Báo lỗi, không fallback về Local', () => {
      process.env.NODE_ENV = 'production';
      process.env.STORAGE_DRIVER = 'supabase';
      process.env.SUPABASE_URL = 'not-a-valid-url';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

      assert.throws(
        () => getStorageDriver(),
        /\[SUPABASE_CONFIG_ERROR\] SUPABASE_URL không phải là một URL hợp lệ/
      );
    });

    it('TC-STOR-PROD-08: Legacy /uploads/... -> Vẫn tương thích hoàn toàn khi hệ thống cấu hình Supabase', async () => {
      process.env.STORAGE_DRIVER = 'supabase';
      process.env.SUPABASE_URL = 'https://validproject.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';

      // Đường dẫn ảnh cũ trên local uploads
      const legacyPath = 'uploads/images-123456789-abcdef.jpg';
      const classification = await classifyAndValidateImagePath(legacyPath, {
        uploadsDir: testUploadsDir,
      });

      assert.strictEqual(classification.type, 'LOCAL', 'Ảnh cũ lưu /uploads/ vẫn phải được phân loại là LOCAL');
      assert.strictEqual(classification.isDeletable, true, 'Ảnh cũ vẫn phải xóa được bình thường khi cần dọn dẹp');
      assert.strictEqual(classification.bucketName, 'local');
    });
  });
});

