// backend/tests/cleanupWorker.integration.test.js
process.env.NODE_ENV = 'test';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import prisma from '../src/config/prisma.js';
import * as homestayService from '../src/services/homestay.service.js';
import * as storageService from '../src/services/storage.service.js';
import * as queueService from '../src/services/storageCleanupQueue.service.js';
import { mockMethod, mockTransaction, restoreAllMocks } from './helpers/mockPrisma.js';

describe('Giai đoạn 2.3 - Bước 3: Integration Tests (Nhóm A - Queue & Storage Service)', () => {
  beforeEach(() => {
    restoreAllMocks();
    queueService.resetQueueTestState();
    storageService.clearEmergencyBuffer();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    queueService.setTestProcessQueueHook(null);
  });

  afterEach(() => {
    restoreAllMocks();
    queueService.resetQueueTestState();
    storageService.clearEmergencyBuffer();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    queueService.setTestProcessQueueHook(null);
  });

  // =========================================================================
  // INT-QS-01: Upload ảnh thành công và Upload Compensation flow
  // =========================================================================
  it('INT-QS-01a: Upload ảnh thành công qua homestayService.uploadImages -> Lưu DB HINH_ANH', async () => {
    mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));

    storageService.setTestStorageHooks({
      uploadFiles: async () => [
        { path: 'uploads/photo_success_1.jpg', bucketName: 'local', driver: 'local' },
        { path: 'uploads/photo_success_2.jpg', bucketName: 'local', driver: 'local' },
      ],
    });

    let createdEntries = null;
    mockMethod(prisma.hINH_ANH, 'createMany', async ({ data }) => {
      createdEntries = data;
      return { count: data.length };
    });

    const fakeFiles = [
      { buffer: Buffer.from('fake1'), originalname: '1.jpg', mimetype: 'image/jpeg' },
      { buffer: Buffer.from('fake2'), originalname: '2.jpg', mimetype: 'image/jpeg' },
    ];

    const result = await homestayService.uploadImages(1, 10, fakeFiles);

    assert.equal(result.length, 2);
    assert.equal(createdEntries.length, 2);
    assert.equal(createdEntries[0].HinhAnh, 'uploads/photo_success_1.jpg');
    assert.equal(createdEntries[1].HinhAnh, 'uploads/photo_success_2.jpg');
  });

  it('INT-QS-01b: DB insert thất bại -> Kích hoạt xóa bù (Compensation); nếu xóa trực tiếp lỗi -> Enqueue Queue', async () => {
    mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));

    storageService.setTestStorageHooks({
      uploadFiles: async () => [
        { path: 'uploads/orphan_photo.jpg', bucketName: 'local', driver: 'local' },
      ],
      deleteFileFromStorage: async () => {
        // Giả lập xóa bù trực tiếp thất bại để kích hoạt fallback enqueue
        throw new Error('Connection timeout while deleting orphaned file');
      },
    });

    mockMethod(prisma.hINH_ANH, 'createMany', async () => {
      throw new Error('Database connection lost during batch insert');
    });

    let enqueuedCompensation = null;
    queueService.setTestEnqueueHook(async (item) => {
      enqueuedCompensation = item;
      return [item];
    });

    const fakeFiles = [{ buffer: Buffer.from('fake'), originalname: 'test.jpg', mimetype: 'image/jpeg' }];

    await assert.rejects(
      () => homestayService.uploadImages(1, 10, fakeFiles),
      /Database connection lost during batch insert/i
    );

    assert.ok(enqueuedCompensation !== null, 'Phải kích hoạt enqueue cleanup bù trừ khi xóa trực tiếp thất bại');
    assert.equal(enqueuedCompensation.filePath, 'uploads/orphan_photo.jpg');
    assert.equal(enqueuedCompensation.reason, 'UPLOAD_COMPENSATION');
  });

  // =========================================================================
  // INT-QS-02: Xóa ảnh thành công và job chuyển COMPLETED
  // =========================================================================
  it('INT-QS-02: Xóa ảnh qua API -> Enqueue Queue -> Worker claim -> Storage xóa thành công -> Job COMPLETED', async () => {
    mockTransaction();
    mockMethod(prisma.hOMESTAY, 'findUnique', async () => ({ MaHomestay: 1, MaChu: 10 }));
    mockMethod(prisma.hINH_ANH, 'findUnique', async () => ({
      MaAnh: 101,
      MaHomestay: 1,
      HinhAnh: 'uploads/photo_101.jpg',
    }));
    mockMethod(prisma.hINH_ANH, 'delete', async () => ({ MaAnh: 101 }));

    // Mô phỏng cơ sở dữ liệu Queue trong bộ nhớ
    const inMemoryQueue = [];

    // Mock PostgreSQL raw SQL ($queryRaw) cho enqueueCleanup và claimJobs
    mockMethod(prisma, '$queryRaw', async (strings, ...values) => {
      const sql = Array.isArray(strings)
        ? strings.join('?')
        : (typeof strings === 'object' && strings?.sql ? strings.sql : String(strings || ''));
      const rawValues = Array.isArray(strings) ? values : (strings?.values || values || []);

      // 1. Mô phỏng: INSERT INTO "STORAGE_CLEANUP_QUEUE" ... ON CONFLICT DO NOTHING RETURNING *
      if (sql.includes('INSERT INTO "STORAGE_CLEANUP_QUEUE"')) {
        const [filePath, bucketName, reason, maxRetries, nextRetryAt, createdAt, updatedAt] = rawValues;
        const cleanPath = typeof filePath === 'string' ? filePath.trim() : filePath;
        const bucket = bucketName || 'local';
        const activeJob = inMemoryQueue.find(
          (j) => j.filePath === cleanPath &&
                 j.bucketName === bucket &&
                 [queueService.QUEUE_STATUS.PENDING, queueService.QUEUE_STATUS.PROCESSING].includes(j.status)
        );
        if (activeJob) {
          return []; // ON CONFLICT DO NOTHING -> 0 rows returned
        }
        const record = {
          id: inMemoryQueue.length + 1,
          filePath: cleanPath,
          bucketName: bucket,
          reason: reason || 'DELETE_IMAGE',
          status: queueService.QUEUE_STATUS.PENDING,
          retryCount: 0,
          maxRetries: typeof maxRetries === 'number' ? maxRetries : 5,
          lockToken: null,
          lockedAt: null,
          nextRetryAt: nextRetryAt || new Date(),
          created_at: createdAt || new Date(),
          updated_at: updatedAt || new Date(),
        };
        inMemoryQueue.push(record);
        return [record];
      }

      // 2. Mô phỏng: WITH candidate AS (...) UPDATE ... RETURNING q.* (FOR UPDATE SKIP LOCKED)
      if (sql.includes('WITH candidate AS') || sql.includes('FOR UPDATE SKIP LOCKED')) {
        const now = new Date();
        const candidates = inMemoryQueue.filter(
          (j) => j.status === queueService.QUEUE_STATUS.PENDING &&
                 (!j.nextRetryAt || j.nextRetryAt <= now) &&
                 j.retryCount < j.maxRetries
        );
        const limit = typeof rawValues[1] === 'number' ? rawValues[1] : 5;
        const claimed = candidates.slice(0, limit);
        for (const job of claimed) {
          job.status = queueService.QUEUE_STATUS.PROCESSING;
          job.lockedAt = new Date();
          job.lockToken = crypto.randomUUID();
          job.updated_at = new Date();
        }
        return claimed;
      }

      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      if (where?.id) {
        return inMemoryQueue.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
      }
      if (where?.filePath) {
        return inMemoryQueue.find((j) => j.filePath === where.filePath && (where.status?.in ? where.status.in.includes(j.status) : j.status === where.status)) || null;
      }
      return null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'create', async ({ data }) => {
      const record = {
        id: inMemoryQueue.length + 1,
        filePath: data.filePath,
        bucketName: data.bucketName || 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: data.nextRetryAt || new Date(),
        reason: data.reason,
      };
      inMemoryQueue.push(record);
      return record;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        return inMemoryQueue.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
      }
      return inMemoryQueue;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const j of inMemoryQueue) {
        const idMatch = where.id ? j.id === where.id : true;
        const statusMatch = where.status ? j.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? j.lockToken === where.lockToken : true;

        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(j, data);
          count++;
        }
      }
      return { count };
    });

    // 1. Chặn processQueue tự động chạy ngầm trong deleteImage để kiểm tra trạng thái PENDING trước
    let autoTriggerCalled = false;
    queueService.setTestProcessQueueHook(async () => {
      autoTriggerCalled = true;
      return { processed: 0, succeeded: 0, failed: 0 };
    });

    // Host gọi xóa ảnh qua homestayService.deleteImage
    await homestayService.deleteImage(1, 10, 101);

    assert.equal(inMemoryQueue.length, 1);
    assert.equal(inMemoryQueue[0].status, queueService.QUEUE_STATUS.PENDING);
    assert.equal(inMemoryQueue[0].filePath, 'uploads/photo_101.jpg');
    assert.equal(autoTriggerCalled, true, 'deleteImage phải kích hoạt processQueue sau commit');

    // 2. Gỡ hook để Background Worker / processQueue xử lý job thực sự
    queueService.setTestProcessQueueHook(null);

    let storageDeleted = false;
    const fakeStorageDelete = async (filePath) => {
      if (filePath === 'uploads/photo_101.jpg') {
        storageDeleted = true;
        return { success: true };
      }
      return { success: false };
    };

    const processResult = await queueService.processQueue(fakeStorageDelete, 5, prisma);

    assert.equal(processResult.processed, 1);
    assert.equal(processResult.succeeded, 1);
    assert.equal(storageDeleted, true);
    assert.equal(inMemoryQueue[0].status, queueService.QUEUE_STATUS.COMPLETED);
    assert.equal(inMemoryQueue[0].lockToken, null);
  });

  // =========================================================================
  // INT-QS-03: Storage xóa thất bại và job được retry
  // =========================================================================
  it('INT-QS-03: Storage xóa gặp lỗi TRANSIENT -> Job giữ PENDING, tăng retryCount, tính backoff', async () => {
    mockTransaction();
    const mockJob = {
      id: 201,
      filePath: 'homestays/1/net_fail.jpg',
      bucketName: 'homestays',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: new Date(Date.now() - 1000),
    };

    let updatedJob = { ...mockJob };

    // Mock PostgreSQL raw SQL ($queryRaw) cho claimJobs
    mockMethod(prisma, '$queryRaw', async (strings, ...values) => {
      const sql = Array.isArray(strings)
        ? strings.join('?')
        : (typeof strings === 'object' && strings?.sql ? strings.sql : String(strings || ''));
      if (sql.includes('WITH candidate AS') || sql.includes('FOR UPDATE SKIP LOCKED')) {
        const now = new Date();
        if (
          updatedJob.status === queueService.QUEUE_STATUS.PENDING &&
          (!updatedJob.nextRetryAt || updatedJob.nextRetryAt <= now) &&
          updatedJob.retryCount < updatedJob.maxRetries
        ) {
          updatedJob.status = queueService.QUEUE_STATUS.PROCESSING;
          updatedJob.lockedAt = new Date();
          updatedJob.lockToken = crypto.randomUUID();
          updatedJob.updated_at = new Date();
          return [{ ...updatedJob }];
        }
        return [];
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      if (where?.id === updatedJob.id) {
        if (where.lockToken && where.lockToken !== updatedJob.lockToken) return null;
        return updatedJob;
      }
      return null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        return updatedJob.status === queueService.QUEUE_STATUS.PENDING ? [updatedJob] : [];
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      if (where.id === updatedJob.id || where.id?.in?.includes(updatedJob.id)) {
        Object.assign(updatedJob, data);
        return { count: 1 };
      }
      return { count: 0 };
    });

    // Giả lập lỗi mạng tạm thời (ETIMEDOUT / 503)
    const transientStorageDelete = async () => {
      throw new Error('ETIMEDOUT: Connection reset by peer');
    };

    const res = await queueService.processQueue(transientStorageDelete, 5, prisma);

    assert.equal(res.processed, 1);
    assert.equal(res.failed, 1);
    assert.equal(updatedJob.status, queueService.QUEUE_STATUS.PENDING);
    assert.equal(updatedJob.retryCount, 1, 'retryCount phải tăng lên 1');
    assert.ok(updatedJob.nextRetryAt > new Date(), 'nextRetryAt phải nằm trong tương lai');
    assert.equal(updatedJob.lockToken, null, 'lockToken phải được giải phóng để chờ retry');
  });

  // =========================================================================
  // INT-QS-04: Storage trả về lỗi file không tồn tại nhưng được xử lý idempotent
  // =========================================================================
  it('INT-QS-04: File Storage không tồn tại (404/NoSuchKey) -> Phân loại ALREADY_DELETED -> Chuyển COMPLETED idempotent', async () => {
    const mockJob = {
      id: 301,
      filePath: 'homestays/1/already_deleted.jpg',
      bucketName: 'homestays',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 1,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: new Date(Date.now() - 1000),
    };

    let updatedJob = { ...mockJob };

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      if (where?.id === updatedJob.id) return updatedJob;
      return null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        return updatedJob.status === queueService.QUEUE_STATUS.PENDING ? [updatedJob] : [];
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
      Object.assign(updatedJob, data);
      return { count: 1 };
    });

    // Giả lập storage trả về lỗi object-specific không tồn tại (NoSuchKey / 404)
    const notFoundStorageDelete = async () => {
      return {
        success: false,
        error: 'NoSuchKey: The specified key does not exist on storage',
        name: 'NoSuchKey',
        statusCode: 404,
      };
    };

    const res = await queueService.processQueue(notFoundStorageDelete, 5, prisma);

    assert.equal(res.processed, 1);
    assert.equal(res.succeeded, 1, 'Lỗi NoSuchKey phải được tính là thành công idempotent');
    assert.equal(updatedJob.status, queueService.QUEUE_STATUS.COMPLETED);
    assert.equal(updatedJob.lockToken, null);
  });

  // =========================================================================
  // INT-QS-05: Job vượt quá số lần retry và chuyển FAILED
  // =========================================================================
  it('INT-QS-05: Job có retryCount = 4 (max = 5) gặp lỗi tiếp -> Chuyển FAILED, không được claim lại', async () => {
    const exhaustedJob = {
      id: 401,
      filePath: 'homestays/1/permanently_failing.jpg',
      bucketName: 'homestays',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 4, // Lần thử thứ 5 sẽ đạt maxRetries
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: new Date(Date.now() - 1000),
    };

    let jobInDb = { ...exhaustedJob };

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      if (where?.id === jobInDb.id) {
        if (where.lockToken && where.lockToken !== jobInDb.lockToken) return null;
        return jobInDb;
      }
      return null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        return jobInDb.status === queueService.QUEUE_STATUS.PENDING ? [jobInDb] : [];
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
      Object.assign(jobInDb, data);
      return { count: 1 };
    });

    const failingStorageDelete = async () => {
      throw new Error('500 Internal Storage Failure');
    };

    const res = await queueService.processQueue(failingStorageDelete, 5, prisma);

    assert.equal(res.processed, 1);
    assert.equal(res.failed, 1);
    assert.equal(jobInDb.status, queueService.QUEUE_STATUS.FAILED, 'Job phải chuyển sang trạng thái FAILED');

    // Xác minh chu kỳ tiếp theo: claimJobs không bao giờ claim job FAILED
    const nextClaimed = await queueService.claimJobs(5, prisma);
    assert.equal(nextClaimed.length, 0, 'Job FAILED không được claim lại');
  });

  // =========================================================================
  // INT-QS-06: Hai Worker cùng xử lý Queue không claim trùng một job
  // (Mô phỏng Concurrency bằng In-Memory Atomic Lock Guard)
  // =========================================================================
  it('INT-QS-06: [Mock Concurrency] Hai Worker claim đồng thời không nhận trùng một job', async () => {
    const queueDb = [
      { id: 501, filePath: 'job_1.jpg', status: queueService.QUEUE_STATUS.PENDING, retryCount: 0, lockToken: null, lockedAt: null, nextRetryAt: null },
      { id: 502, filePath: 'job_2.jpg', status: queueService.QUEUE_STATUS.PENDING, retryCount: 0, lockToken: null, lockedAt: null, nextRetryAt: null },
    ];

    // Mô phỏng client Prisma có cơ chế FOR UPDATE SKIP LOCKED của PostgreSQL
    const inFlightLock = new Set();
    const createMockClient = () => {
      const client = {
        $queryRaw: async () => {
          const available = queueDb.filter(
            (j) => j.status === queueService.QUEUE_STATUS.PENDING && !inFlightLock.has(j.id)
          );
          if (available.length === 0) return [];
          const job = available[0];
          inFlightLock.add(job.id);
          job.status = queueService.QUEUE_STATUS.PROCESSING;
          job.lockToken = crypto.randomUUID();
          job.lockedAt = new Date();
          return [job];
        },
        $transaction: async (fn) => fn(client),
        sTORAGE_CLEANUP_QUEUE: {
          findMany: async ({ where, take }) => {
            const matched = queueDb.filter((j) => j.status === where.status && j.retryCount < 5);
            return typeof take === 'number' ? matched.slice(0, take) : matched;
          },
          updateMany: async ({ where, data }) => {
            const target = queueDb.find((j) => j.id === where.id && j.status === where.status);
            if (target) {
              Object.assign(target, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      };
      return client;
    };

    const mockClient1 = createMockClient();
    const mockClient2 = createMockClient();

    // Hai Worker đồng thời gọi claimJobs(1)
    const [claimWorker1, claimWorker2] = await Promise.all([
      queueService.claimJobs(1, mockClient1),
      queueService.claimJobs(1, mockClient2),
    ]);

    assert.equal(claimWorker1.length, 1);
    assert.equal(claimWorker2.length, 1);
    assert.notEqual(claimWorker1[0].id, claimWorker2[0].id, 'Hai worker phải nhận hai job hoàn toàn khác nhau');
    assert.notEqual(claimWorker1[0].lockToken, claimWorker2[0].lockToken, 'Lock token của hai worker phải độc lập');
    assert.equal(queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PROCESSING).length, 2);
  });

  // =========================================================================
  // INT-QS-07: Fencing token ngăn Worker cũ cập nhật job đã bị Worker khác claim lại
  // =========================================================================
  it('INT-QS-07: Fencing Token - Worker A chậm trễ bị Worker B claim lại -> Worker A bị từ chối cập nhật', async () => {
    const targetJob = {
      id: 701,
      filePath: 'homestays/1/race_condition.jpg',
      status: queueService.QUEUE_STATUS.PROCESSING,
      lockToken: 'token_worker_B', // Worker B đã reclaim thành công
      lockedAt: new Date(),
    };

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      // Chỉ cho phép cập nhật nếu đúng ID, status PROCESSING và khớp lockToken
      if (where.id === targetJob.id && where.status === queueService.QUEUE_STATUS.PROCESSING && where.lockToken === targetJob.lockToken) {
        Object.assign(targetJob, data);
        return { count: 1 };
      }
      return { count: 0 }; // Token không khớp -> 0 bản ghi được cập nhật
    });

    // Worker A (giữ token cũ token_worker_A) cố gắng hoàn tất job
    const workerAResult = await queueService.completeJob(701, 'token_worker_A', prisma);

    assert.equal(workerAResult, false, 'completeJob với stale token phải trả về false');
    assert.equal(targetJob.lockToken, 'token_worker_B', 'Lock token của Worker B không bị ghi đè');
    assert.equal(targetJob.status, queueService.QUEUE_STATUS.PROCESSING, 'Trạng thái job không bị chuyển COMPLETED bởi Worker cũ');

    // Worker B (giữ token hợp lệ token_worker_B) hoàn tất job
    const workerBResult = await queueService.completeJob(701, 'token_worker_B', prisma);

    assert.equal(workerBResult, true, 'completeJob với token hợp lệ phải trả về true');
    assert.equal(targetJob.status, queueService.QUEUE_STATUS.COMPLETED);
    assert.equal(targetJob.lockToken, null);
  });
});

// =============================================================================
// GIAI ĐOẠN 2.3 - BƯỚC 3: NHÓM B - WORKER LIFECYCLE INTEGRATION TESTS
// INT-WK-01 -> INT-WK-07
// =============================================================================
describe('Giai đoạn 2.3 - Bước 3: Integration Tests (Nhóm B - Worker Lifecycle)', () => {
  let createdWorkers = [];

  beforeEach(() => {
    restoreAllMocks();
    mockMethod(prisma, '$queryRaw', async () => {
      throw new Error('Raw query fallback in unit test');
    });
    queueService.resetQueueTestState();
    storageService.clearEmergencyBuffer();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    queueService.setTestProcessQueueHook(null);
    delete process.env.STORAGE_CLEANUP_WORKER_ENABLED;
    createdWorkers = [];
  });

  afterEach(async () => {
    for (const w of createdWorkers) {
      try {
        await w.stop({ timeoutMs: 100 });
      } catch {}
    }
    createdWorkers = [];
    restoreAllMocks();
    delete process.env.STORAGE_CLEANUP_WORKER_ENABLED;
    queueService.resetQueueTestState();
    storageService.clearEmergencyBuffer();
    storageService.setTestStorageHooks(null);
    queueService.setTestEnqueueHook(null);
    queueService.setTestProcessQueueHook(null);
  });

  // =========================================================================
  // INT-WK-01: Worker Startup
  // =========================================================================
  it('INT-WK-01: Worker Startup - Khởi động Worker, kích hoạt Initial Tick và hỗ trợ cờ tắt bật WORKER_ENABLED', async () => {
    let findManyCalls = 0;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => {
      findManyCalls++;
      return [];
    });

    // 1. Khởi động Worker bình thường (ENABLED = true mặc định)
    let storageCalls = 0;
    const worker = queueService.startCleanupWorker(
      async () => {
        storageCalls++;
        return { success: true };
      },
      { intervalMs: 60000 }
    );
    createdWorkers.push(worker);

    assert.strictEqual(worker.isEnabled, true, 'Worker phải ở trạng thái enabled mặc định');
    const initialPromise = worker.getActiveTickPromise();
    assert.ok(initialPromise !== null, 'Initial tick phải được kích hoạt ngay lập tức khi worker khởi động');

    await initialPromise;
    assert.ok(findManyCalls >= 1, 'Initial tick phải thực hiện quét db');
    assert.strictEqual(storageCalls, 0, 'Queue rỗng không được gọi storage');

    const stopRes = await worker.stop({ timeoutMs: 200 });
    assert.strictEqual(stopRes.stopped, true);

    // 2. Khởi động Worker khi STORAGE_CLEANUP_WORKER_ENABLED = 'false'
    process.env.STORAGE_CLEANUP_WORKER_ENABLED = 'false';
    const disabledWorker = queueService.startCleanupWorker(
      async () => ({ success: true }),
      { intervalMs: 60000 }
    );
    createdWorkers.push(disabledWorker);

    assert.strictEqual(disabledWorker.isEnabled, false, 'Worker phải trả về isEnabled = false khi bị vô hiệu hóa');
    assert.strictEqual(disabledWorker.getActiveTickPromise(), null, 'Disabled worker không được khởi chạy initial tick');
    assert.strictEqual(disabledWorker.isRunning(), false);
    assert.strictEqual(disabledWorker.isStopping(), false);

    const triggerRes = await disabledWorker.triggerNow();
    assert.deepEqual(triggerRes, { processed: 0, succeeded: 0, failed: 0 });

    const disabledStopRes = await disabledWorker.stop();
    assert.strictEqual(disabledStopRes.stopped, true);
    assert.strictEqual(disabledStopRes.timedOut, false);
  });

  // =========================================================================
  // INT-WK-02: Polling Execution
  // =========================================================================
  it('INT-WK-02: Polling Execution - Định kỳ quét và xử lý job tự động; chịu lỗi DB không làm sập worker', async () => {
    const queueDb = [];
    const storageCalls = [];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
    });

    let dbFailOnce = false;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (dbFailOnce) {
        dbFailOnce = false;
        throw new Error('Database connection reset during polling');
      }
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING && j.retryCount < 5);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id ? item.id === where.id : true;
        const statusMatch = where.status ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          count++;
        }
      }
      return { count };
    });

    // Bắt đầu worker với interval ngắn (25ms)
    const worker = queueService.startCleanupWorker(
      async (filePath) => {
        storageCalls.push(filePath);
        return { success: true };
      },
      { intervalMs: 25, batchSize: 2 }
    );
    createdWorkers.push(worker);

    // Chờ initial tick chạy xong khi queue còn rỗng
    await worker.getActiveTickPromise();
    assert.strictEqual(storageCalls.length, 0, 'Queue rỗng -> Không gọi Storage');

    // 1. Thêm job vào queue, xác minh polling timer tự động pick up
    queueDb.push({
      id: 201,
      filePath: 'homestays/1/poll_job_1.jpg',
      bucketName: 'local',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: null,
      created_at: new Date(),
    });

    // Chờ polling timer quét và xử lý job (tối đa 400ms)
    const startPoll = Date.now();
    while (queueDb[0].status === queueService.QUEUE_STATUS.PENDING && Date.now() - startPoll < 400) {
      await new Promise((r) => setTimeout(r, 10));
    }

    assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED);
    assert.ok(storageCalls.includes('homestays/1/poll_job_1.jpg'));

    // 2. Kích hoạt lỗi DB ở tick tiếp theo -> Worker không bị crash, tick kế tiếp vẫn xử lý bình thường
    dbFailOnce = true;

    queueDb.push({
      id: 202,
      filePath: 'homestays/1/poll_job_2_after_err.jpg',
      bucketName: 'local',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: null,
      created_at: new Date(),
    });

    const startPoll2 = Date.now();
    while (queueDb[1].status === queueService.QUEUE_STATUS.PENDING && Date.now() - startPoll2 < 500) {
      await new Promise((r) => setTimeout(r, 15));
    }

    assert.strictEqual(queueDb[1].status, queueService.QUEUE_STATUS.COMPLETED, 'Job 2 phải hoàn thành ở chu kỳ sau khi DB hồi phục');
    assert.ok(storageCalls.includes('homestays/1/poll_job_2_after_err.jpg'));

    await worker.stop({ timeoutMs: 200 });
  });

  // =========================================================================
  // INT-WK-03: Trigger Now
  // =========================================================================
  it('INT-WK-03: Trigger Now - Kích hoạt dọn dẹp tức thời khi idle, tái sử dụng promise khi bận và từ chối khi đã dừng', async () => {
    const queueDb = [];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id ? item.id === where.id : true;
        const statusMatch = where.status ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          count++;
        }
      }
      return { count };
    });

    let storageGateResolve;
    const slowStoragePromise = new Promise((r) => {
      storageGateResolve = r;
    });
    let gateReachedResolve;
    const gateReachedPromise = new Promise((r) => {
      gateReachedResolve = r;
    });
    let gateActive = false;
    const storageCalls = [];

    const worker = queueService.startCleanupWorker(
      async (filePath) => {
        storageCalls.push(filePath);
        if (gateActive) {
          gateReachedResolve();
          await slowStoragePromise;
        }
        return { success: true };
      },
      { intervalMs: 60000, batchSize: 1 } // Interval 60s để timer không tự động kích hoạt
    );
    createdWorkers.push(worker);

    // Chờ initial tick hoàn tất khi queue rỗng
    await worker.getActiveTickPromise();

    // 1. Thêm job vào queue và gọi triggerNow() khi Worker đang idle -> Xử lý ngay lập tức
    queueDb.push({
      id: 301,
      filePath: 'homestays/1/immediate_trigger.jpg',
      bucketName: 'local',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: null,
    });

    const triggerResult = await worker.triggerNow();
    assert.strictEqual(triggerResult.processed, 1);
    assert.strictEqual(triggerResult.succeeded, 1);
    assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED);

    // 2. Thêm job mới và kích hoạt tick chạy chậm có gate
    queueDb.push({
      id: 302,
      filePath: 'homestays/1/slow_job.jpg',
      bucketName: 'local',
      status: queueService.QUEUE_STATUS.PENDING,
      retryCount: 0,
      maxRetries: 5,
      lockToken: null,
      lockedAt: null,
      nextRetryAt: null,
    });

    gateActive = true;
    const tick1Promise = worker.triggerNow();

    // Chờ chắc chắn tick1 đã chạy vào gate
    await gateReachedPromise;
    assert.strictEqual(worker.isRunning(), true);

    // Gọi triggerNow() khi Worker đang xử lý tick
    const tick2Promise = worker.triggerNow();
    assert.strictEqual(tick2Promise, tick1Promise, 'triggerNow() khi bận phải trả về chính Promise của tick hiện tại');

    // Mở gate để tick hoàn tất
    storageGateResolve();
    await tick1Promise;
    assert.strictEqual(queueDb[1].status, queueService.QUEUE_STATUS.COMPLETED);

    // 3. Dừng worker và gọi triggerNow() khi đã dừng -> Trả về ngay processed 0
    await worker.stop({ timeoutMs: 200 });
    assert.strictEqual(worker.isStopping(), true);

    const postStopResult = await worker.triggerNow();
    assert.deepEqual(postStopResult, { processed: 0, succeeded: 0, failed: 0 });
  });

  // =========================================================================
  // INT-WK-04: Prevent Overlapping Ticks
  // =========================================================================
  it('INT-WK-04: Prevent Overlapping Ticks - Khóa chống chạy chồng lấn và ngăn ngừa race condition claim job', async () => {
    let claimCount = 0;
    const queueDb = [
      {
        id: 401,
        filePath: 'homestays/1/concurrency_check.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    ];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        claimCount++;
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id ? item.id === where.id : true;
        const statusMatch = where.status ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          count++;
        }
      }
      return { count };
    });

    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    let releaseStorage;
    const storagePausePromise = new Promise((resolve) => {
      releaseStorage = resolve;
    });

    let worker = null;
    try {
      // Start worker với interval ngắn 20ms
      worker = queueService.startCleanupWorker(
        async () => {
          if (notifyStorageStarted) {
            notifyStorageStarted();
            notifyStorageStarted = null;
          }
          await storagePausePromise;
          return { success: true };
        },
        { intervalMs: 20, batchSize: 1 }
      );
      createdWorkers.push(worker);

      // Chờ tín hiệu xác nhận worker đã bắt đầu tick và đang chờ tại storagePausePromise
      await storageStartedPromise;
      assert.strictEqual(worker.isRunning(), true);

      const firstActivePromise = worker.getActiveTickPromise();
      assert.ok(firstActivePromise !== null);

      // Trong khi tick 1 đang chạy, gọi đồng thời triggerNow() và để interval 20ms tự kích hoạt
      const triggerPromise = worker.triggerNow();
      await new Promise((r) => setTimeout(r, 35)); // Để timer tick 20ms thử chạy

      // Cả triggerPromise lẫn activeTickPromise hiện tại phải là CÙNG 1 Promise của tick 1
      assert.strictEqual(triggerPromise, firstActivePromise, 'triggerNow() không được tạo Promise riêng khi tick đang chạy');
      assert.strictEqual(worker.getActiveTickPromise(), firstActivePromise, 'Timer không được ghi đè activeTickPromise');

      // Giải phóng Storage để tick hoàn tất
      releaseStorage();
      await firstActivePromise;

      // Xác minh job được xử lý xong và không bị claim trùng lặp
      assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED);
      assert.strictEqual(queueDb[0].lockToken, null);

      await worker.stop({ timeoutMs: 200 });
    } finally {
      if (releaseStorage) {
        releaseStorage();
      }
    }
  });

  // =========================================================================
  // INT-WK-05: Stop Worker
  // =========================================================================
  it('INT-WK-05: Stop Worker - Dừng an toàn (graceful stop), hủy timer, chờ tick hiện tại và bảo đảm tính idempotent', async () => {
    let tickCompleted = false;

    const queueDb = [
      {
        id: 501,
        filePath: 'homestays/1/stop_test.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    ];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id ? item.id === where.id : true;
        const statusMatch = where.status ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          count++;
        }
      }
      return { count };
    });

    let releaseStorage;
    const slowStorage = new Promise((r) => {
      releaseStorage = r;
    });

    let storageStartedResolve;
    const storageStartedPromise = new Promise((r) => {
      storageStartedResolve = r;
    });

    const worker = queueService.startCleanupWorker(
      async () => {
        storageStartedResolve();
        await slowStorage;
        tickCompleted = true;
        return { success: true };
      },
      { intervalMs: 20, batchSize: 1 }
    );
    createdWorkers.push(worker);

    // Chờ storage bắt đầu thực thi và tạm dừng tại slowStorage
    await storageStartedPromise;
    assert.strictEqual(worker.isRunning(), true);

    // Gọi stop() trong khi tick đang chạy
    const stopPromise = worker.stop({ timeoutMs: 500 });
    assert.strictEqual(worker.isStopping(), true, 'Worker phải chuyển sang isStopping = true ngay khi gọi stop');

    // Giải phóng storage để tick hoàn thành
    releaseStorage();
    const stopRes = await stopPromise;

    assert.deepEqual(stopRes, { stopped: true, timedOut: false });
    assert.strictEqual(tickCompleted, true, 'Tick đang chạy phải được chờ hoàn tất');
    assert.strictEqual(worker.isRunning(), false);
    assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED);

    // Gọi stop() nhiều lần tiếp theo (Idempotency)
    const stopRes2 = await worker.stop({ timeoutMs: 200 });
    assert.deepEqual(stopRes2, { stopped: true, timedOut: false });

    const stopRes3 = await worker.stop();
    assert.deepEqual(stopRes3, { stopped: true, timedOut: false });
  });

  // =========================================================================
  // INT-WK-06: Shutdown During Queue Processing
  // =========================================================================
  it('INT-WK-06: Shutdown During Queue Processing - Dừng giữa batch: bảo toàn job đã xong, hoàn trả nguyên tử job chưa chạy về PENDING và bảo vệ bằng Fencing Token', async () => {
    const queueDb = [
      {
        id: 601,
        filePath: 'homestays/1/batch_job_1.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
      {
        id: 602,
        filePath: 'homestays/1/batch_job_2.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
      {
        id: 603,
        filePath: 'homestays/1/batch_job_3.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    ];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id && (where.lockToken ? j.lockToken === where.lockToken : true)) || null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    let capturedLockTokenJob2 = null;

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id ? item.id === where.id : true;
        const statusMatch = where.status ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          if (item.id === 602 && item.lockToken) {
            capturedLockTokenJob2 = item.lockToken;
          }
          count++;
        }
      }
      return { count };
    });

    let workerRef = null;
    const worker = queueService.startCleanupWorker(
      async (filePath) => {
        if (filePath === 'homestays/1/batch_job_1.jpg') {
          // Khi job 1 hoàn thành thành công trong storage, phát tín hiệu dừng worker
          // để job 2 và job 3 gặp shouldStopFn() = true khi tới lượt
          workerRef.stop({ timeoutMs: 1000 });
          return { success: true };
        }
        return { success: true };
      },
      { intervalMs: 60000, batchSize: 3 }
    );
    workerRef = worker;
    createdWorkers.push(worker);

    // Chờ worker xử lý xong đợt dọn dẹp và dừng lại
    await worker.getActiveTickPromise();
    await worker.stop({ timeoutMs: 500 });

    // 1. Job 1 đã chạy xong trước khi stop -> Giữ nguyên COMPLETED
    assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED);
    assert.strictEqual(queueDb[0].lockToken, null);

    // 2. Job 2 và Job 3 bị dừng giữa chừng -> Được hoàn trả nguyên tử về PENDING kèm xóa lockToken
    assert.strictEqual(queueDb[1].status, queueService.QUEUE_STATUS.PENDING, 'Job 2 phải được hoàn trả về PENDING');
    assert.strictEqual(queueDb[1].lockToken, null, 'Job 2 phải bị xóa lockToken');
    assert.strictEqual(queueDb[1].lockedAt, null);

    assert.strictEqual(queueDb[2].status, queueService.QUEUE_STATUS.PENDING, 'Job 3 phải được hoàn trả về PENDING');
    assert.strictEqual(queueDb[2].lockToken, null, 'Job 3 phải bị xóa lockToken');
    assert.strictEqual(queueDb[2].lockedAt, null);

    // 3. Fencing Token: Giả lập tiến trình cũ cố tình cập nhật Job 2 bằng captured lockToken cũ
    assert.ok(capturedLockTokenJob2 !== null, 'Phải có token đã được cấp khi claim Job 2');
    const staleUpdateResult = await queueService.completeJob(602, capturedLockTokenJob2, prisma);
    assert.strictEqual(staleUpdateResult, false, 'completeJob với stale token sau khi job đã hoàn trả phải bị từ chối');
    assert.strictEqual(queueDb[1].status, queueService.QUEUE_STATUS.PENDING, 'Job 2 vẫn giữ nguyên trạng thái PENDING');
  });

  // =========================================================================
  // INT-WK-07: Worker Stop Timeout & Cleanup Resilience
  // =========================================================================
  it('INT-WK-07: Worker Stop Timeout - Báo timeout chính xác khi storage bị treo và không làm nghẽn tiến trình Node.js', async () => {
    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    let unblockStorageFn;
    let isStorageUnblocked = false;
    const hangingStoragePromise = new Promise((resolve) => {
      unblockStorageFn = resolve;
    });

    // Hàm giải phóng idempotent: gọi nhiều lần an toàn, không ném lỗi
    const safeUnblockStorage = () => {
      if (!isStorageUnblocked) {
        isStorageUnblocked = true;
        if (typeof unblockStorageFn === 'function') {
          unblockStorageFn();
        }
      }
    };

    let isStorageSettled = false;
    hangingStoragePromise.finally(() => {
      isStorageSettled = true;
    });

    const queueDb = [
      {
        id: 701,
        filePath: 'homestays/1/hanging_file.jpg',
        bucketName: 'local',
        status: queueService.QUEUE_STATUS.PENDING,
        retryCount: 0,
        maxRetries: 5,
        lockToken: null,
        lockedAt: null,
        nextRetryAt: null,
      },
    ];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
      return queueDb.find((j) => j.id === where.id) || null;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where, take }) => {
      if (where?.status === queueService.QUEUE_STATUS.PENDING) {
        const matches = queueDb.filter((j) => j.status === queueService.QUEUE_STATUS.PENDING);
        return typeof take === 'number' ? matches.slice(0, take) : matches;
      }
      return [];
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      let count = 0;
      for (const item of queueDb) {
        const idMatch = where.id !== undefined ? item.id === where.id : true;
        const statusMatch = where.status !== undefined ? item.status === where.status : true;
        const tokenMatch = where.lockToken !== undefined ? item.lockToken === where.lockToken : true;
        if (idMatch && statusMatch && tokenMatch) {
          Object.assign(item, data);
          count++;
        }
      }
      return { count };
    });

    let storageCallCount = 0;
    let worker = null;
    let startupTimeoutId = null;
    let testError = null;

    try {
      worker = queueService.startCleanupWorker(
        async (filePath, bucket) => {
          storageCallCount++;
          notifyStorageStarted({ filePath, bucket });
          await hangingStoragePromise;
          return { success: true };
        },
        { intervalMs: 60000, batchSize: 1, storageWaitTimeoutMs: 60000 }
      );
      createdWorkers.push(worker);

      // Đồng bộ: Chờ worker thực sự bắt đầu gọi Storage request (tối đa 3000ms có timeout guard rõ ràng)
      const startupTimeoutPromise = new Promise((_, reject) => {
        startupTimeoutId = setTimeout(() => {
          reject(new Error('TIMEOUT_WAITING_FOR_STORAGE_START: Worker không bắt đầu gọi Storage trong thời hạn 3000ms'));
        }, 3000);
      });

      const callInfo = await Promise.race([storageStartedPromise, startupTimeoutPromise]).finally(() => {
        if (startupTimeoutId) {
          clearTimeout(startupTimeoutId);
          startupTimeoutId = null;
        }
      });

      // 1. Xác minh Worker thực sự bắt đầu xử lý job trước khi gọi stop
      assert.strictEqual(storageCallCount, 1, 'Storage delete function phải được gọi chính xác 1 lần');
      assert.strictEqual(callInfo.filePath, 'homestays/1/hanging_file.jpg');
      assert.strictEqual(worker.isRunning(), true, 'Worker phải đang ở trạng thái chạy (isRunning = true)');
      assert.strictEqual(isStorageSettled, false, 'Storage Promise phải đang ở trạng thái pending');

      const stopTimeoutMs = 50;
      const startTime = Date.now();
      // Gọi stop() với timeout ngắn 50ms trong khi storage đang bị treo vô hạn
      const stopRes = await worker.stop({ timeoutMs: stopTimeoutMs });
      const duration = Date.now() - startTime;

      // 2. Xác minh kết quả timeout
      assert.strictEqual(stopRes.stopped, false, 'Không được báo stopped = true khi quá thời gian chờ');
      assert.strictEqual(stopRes.timedOut, true, 'Bắt buộc phải trả về timedOut = true');
      assert.strictEqual(worker.isStopping(), true, 'Worker phải chuyển trạng thái isStopping = true');
      assert.strictEqual(worker.isRunning(), true, 'Worker vẫn đang chạy tác vụ dở dang khi bị stop timeout');
      assert.ok(
        duration >= stopTimeoutMs - 15 && duration < 1000,
        `Thời gian stop (${duration}ms) phải xấp xỉ timeoutMs (${stopTimeoutMs}ms)`
      );

      // 3. Xác minh Promise Storage KHÔNG bị hủy, vẫn đang pending tại thời điểm stop timed out
      assert.strictEqual(isStorageSettled, false, 'Storage request vẫn đang pending, không bị tự động cancel hay settle');

      // 4. Xác minh Worker không nhận tick mới sau khi stop
      const extraTickPromise = worker.triggerNow();
      const extraTickResult = await extraTickPromise;
      assert.deepStrictEqual(
        extraTickResult,
        { processed: 0, succeeded: 0, failed: 0 },
        'Worker đang stopping phải từ chối kích hoạt tick mới'
      );

      // GHI CHÚ KỸ THUẬT:
      // JavaScript Promise không thể bị hủy cưỡng bức (force cancel) từ bên ngoài nếu không có AbortController.
      // Việc worker.stop() trả về { stopped: false, timedOut: true } cho phép caller (như Graceful Shutdown)
      // không bị treo vô hạn và có thể tiến hành bước tiếp theo (ví dụ cưỡng chế exit tiến trình).

      // 5. Giải phóng Promise treo để hoàn tất tick hiện tại một cách sạch sẽ và không rò rỉ tài nguyên
      const activeTickPromise = worker.getActiveTickPromise();
      safeUnblockStorage();

      if (activeTickPromise) {
        await activeTickPromise;
      }

      assert.strictEqual(isStorageSettled, true, 'Storage Promise đã được giải phóng');
      assert.strictEqual(worker.isRunning(), false, 'Sau khi tick dở dang hoàn tất, worker.isRunning() phải về false');
      assert.strictEqual(queueDb[0].status, queueService.QUEUE_STATUS.COMPLETED, 'Job đã được đánh dấu COMPLETED sau khi unblock');
    } catch (err) {
      testError = err;
      throw err;
    } finally {
      // =======================================================================
      // CLEANUP RESILIENCE: Bảo đảm giải phóng tài nguyên kể cả khi assertion thất bại
      // =======================================================================
      // 1. Dọn dẹp timer do test tự tạo nếu chưa được clear
      if (startupTimeoutId) {
        clearTimeout(startupTimeoutId);
        startupTimeoutId = null;
      }

      // 2. Bắt buộc gọi unblockStorage() TRƯỚC để giải phóng Storage Promise (idempotent)
      safeUnblockStorage();

      // 3. Nếu worker tồn tại và có activeTickPromise, chờ Promise đó kết thúc có Timeout Guard
      if (worker) {
        const activeTick = worker.getActiveTickPromise?.();
        if (activeTick) {
          let cleanupTimeoutId = null;
          const cleanupTimeoutPromise = new Promise((resolve) => {
            cleanupTimeoutId = setTimeout(resolve, 2000);
          });
          try {
            await Promise.race([activeTick, cleanupTimeoutPromise]);
          } catch (cleanupErr) {
            // Không để lỗi cleanup che mất AssertionError ban đầu
            if (!testError) {
              console.error('[INT-WK-07_CLEANUP_WARN]', cleanupErr.message);
            }
          } finally {
            if (cleanupTimeoutId) {
              clearTimeout(cleanupTimeoutId);
              cleanupTimeoutId = null;
            }
          }
        }

        // 4. Dừng worker nếu worker đã được tạo
        try {
          await worker.stop({ timeoutMs: 200 });
        } catch (stopErr) {
          if (!testError) {
            console.error('[INT-WK-07_CLEANUP_WARN]', stopErr.message);
          }
        }
      }
    }
  });
});
