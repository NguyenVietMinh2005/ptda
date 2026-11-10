// backend/tests/cleanupWorker.service.test.js
process.env.NODE_ENV = 'test';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as queueService from '../src/services/storageCleanupQueue.service.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';

describe('Background Cleanup Worker Lifecycle & Graceful Stop (Bước 1 Fixes)', () => {
  let createdWorkers = [];

  beforeEach(() => {
    queueService.resetQueueTestState();
    createdWorkers = [];
  });

  afterEach(async () => {
    restoreAllMocks();
    for (const w of createdWorkers) {
      try {
        await w.stop({ timeoutMs: 100 });
      } catch {}
    }
    queueService.resetQueueTestState();
  });

  // CW-01: Initial Tick được kích hoạt ngay khi Worker khởi động
  it('CW-01: Initial Tick - Tick được kích hoạt ngay khi khởi động', async () => {
    let tickExecuted = false;
    let staleRecovered = false;

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => {
      staleRecovered = true;
      return [];
    });

    const fakeStorageDelete = async () => {
      tickExecuted = true;
      return { success: true };
    };

    const worker = queueService.startCleanupWorker(fakeStorageDelete, { intervalMs: 60000 });
    createdWorkers.push(worker);

    // Initial tick đã được kích hoạt ngầm
    assert.ok(worker.getActiveTickPromise() !== null || staleRecovered === true);
    await worker.getActiveTickPromise();

    assert.equal(staleRecovered, true, 'Initial tick phải gọi resetStaleProcessingJobs ngay');
    const stopRes = await worker.stop();
    assert.equal(stopRes.stopped, true);
  });

  // CW-02: Timer kích hoạt khi tick đang chạy - Không ghi đè Promise của tick cũ
  it('CW-02: Timer kích hoạt khi tick đang chạy - Không ghi đè Promise của tick cũ', async () => {
    let finishStorage;
    const slowStoragePromise = new Promise((resolve) => {
      finishStorage = resolve;
    });

    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [
      { id: 10, filePath: 'slow.jpg', status: 'PENDING', retryCount: 0 },
    ]);
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    const fakeStorageDelete = async () => {
      if (notifyStorageStarted) {
        notifyStorageStarted();
        notifyStorageStarted = null;
      }
      await slowStoragePromise;
      return { success: true };
    };

    let worker = null;
    try {
      worker = queueService.startCleanupWorker(fakeStorageDelete, { intervalMs: 30 });
      createdWorkers.push(worker);

      // Chờ tín hiệu xác nhận tick đã bắt đầu và đang chờ tại slowStoragePromise
      await storageStartedPromise;

      const originalTickPromise = worker.getActiveTickPromise();
      assert.ok(originalTickPromise !== null, 'Phải có active tick promise');

      // Chờ 50ms để setInterval kích hoạt lại trong lúc tick đầu tiên vẫn đang chạy
      await new Promise((r) => setTimeout(r, 50));

      // Xác minh Promise của tick ban đầu KHÔNG bị ghi đè
      const currentPromise = worker.getActiveTickPromise();
      assert.strictEqual(
        currentPromise,
        originalTickPromise,
        'Active tick promise không được phép bị ghi đè bởi timer tick mới'
      );

      // Cho phép tick ban đầu kết thúc
      finishStorage();
      await worker.stop({ timeoutMs: 500 });
    } finally {
      if (finishStorage) {
        finishStorage();
      }
    }
  });

  // CW-03: Stop khi tick đang chạy - Không nhận batch mới
  it('CW-03: Stop khi tick đang chạy - Không nhận batch mới', async () => {
    let claimCalls = 0;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      if (where?.status === 'PENDING') {
        claimCalls++;
        return claimCalls === 1
          ? [{ id: 101, filePath: 'h1.jpg', status: 'PENDING', retryCount: 0 }]
          : [];
      }
      return [];
    });
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    let resolveStorage;
    const storageGatePromise = new Promise((r) => {
      resolveStorage = r;
    });

    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    const fakeStorageDelete = async () => {
      if (notifyStorageStarted) {
        notifyStorageStarted();
        notifyStorageStarted = null;
      }
      await storageGatePromise;
      return { success: true };
    };

    let worker = null;
    try {
      worker = queueService.startCleanupWorker(fakeStorageDelete, {
        intervalMs: 10000,
        batchSize: 1,
      });
      createdWorkers.push(worker);

      // Chờ tín hiệu xác nhận tick khởi động và bắt đầu gọi storage
      await storageStartedPromise;
      assert.equal(worker.isRunning(), true);

      // Gọi stop() trong khi tick đang xử lý job
      const stopPromise = worker.stop({ timeoutMs: 1000 });
      assert.equal(worker.isStopping(), true);

      // Giải phóng storage delete
      resolveStorage();
      const stopRes = await stopPromise;

      assert.equal(stopRes.stopped, true);
      assert.equal(stopRes.timedOut, false);
      assert.equal(worker.isRunning(), false);
    } finally {
      if (resolveStorage) {
        resolveStorage();
      }
    }
  });

  // CW-04: Stop giữa Drain-Fast - Dừng sau batch/job hiện tại
  it('CW-04: Stop giữa Drain-Fast - Dừng sau batch/job hiện tại', async () => {
    let batchesProcessed = 0;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => {
      // Luôn trả về 2 jobs để kích hoạt drain-fast nếu chưa dừng
      return [
        { id: 201 + batchesProcessed * 2, filePath: 'd1.jpg', status: 'PENDING', retryCount: 0 },
        { id: 202 + batchesProcessed * 2, filePath: 'd2.jpg', status: 'PENDING', retryCount: 0 },
      ];
    });
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    let worker;
    const fakeStorageDelete = async () => {
      // Khi đang xử lý batch đầu tiên, phát tín hiệu stop worker
      if (batchesProcessed === 0) {
        worker.stop({ timeoutMs: 1000 });
      }
      return { success: true };
    };

    worker = queueService.startCleanupWorker(fakeStorageDelete, {
      intervalMs: 10000,
      batchSize: 2,
      maxDrainIterations: 5,
    });
    createdWorkers.push(worker);

    const stopRes = await worker.stop({ timeoutMs: 1000 });
    assert.equal(stopRes.stopped, true);
    assert.equal(worker.isRunning(), false);
  });

  // CW-05: Stop khi Storage đang chờ - Chờ đúng giới hạn đã cấu hình
  it('CW-05: Stop khi Storage đang chờ - Chờ đúng giới hạn đã cấu hình', async () => {
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [
      { id: 301, filePath: 'slow.jpg', status: 'PENDING', retryCount: 0 },
    ]);
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    let completeStorage;
    const storageDelayPromise = new Promise((resolve) => {
      completeStorage = resolve;
    });

    const fakeStorageDelete = async () => {
      if (notifyStorageStarted) {
        notifyStorageStarted();
        notifyStorageStarted = null;
      }
      await storageDelayPromise;
      return { success: true };
    };

    let worker = null;
    try {
      worker = queueService.startCleanupWorker(fakeStorageDelete, {
        intervalMs: 10000,
        batchSize: 1,
        storageWaitTimeoutMs: 500,
      });
      createdWorkers.push(worker);

      // Chờ xác nhận storage đã thực sự bắt đầu
      await storageStartedPromise;
      assert.equal(worker.isRunning(), true);

      // Stop với timeout 500ms; đồng thời giải phóng storage trong lúc stop đang chờ
      const stopPromise = worker.stop({ timeoutMs: 500 });
      completeStorage();
      const stopRes = await stopPromise;

      assert.equal(stopRes.stopped, true);
      assert.equal(stopRes.timedOut, false);
      assert.equal(worker.isRunning(), false);
    } finally {
      if (completeStorage) {
        completeStorage();
      }
    }
  });

  // CW-06: Stop vượt timeout - Báo timeout, không báo đã dừng
  it('CW-06: Stop vượt timeout - Báo timeout, không báo đã dừng', async () => {
    let notifyStorageStarted;
    const storageStartedPromise = new Promise((resolve) => {
      notifyStorageStarted = resolve;
    });

    let unblockStorageFn;
    let isStorageUnblocked = false;
    const storageHangPromise = new Promise((resolve) => {
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
    storageHangPromise.finally(() => {
      isStorageSettled = true;
    });

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [
      { id: 401, filePath: 'hang.jpg', status: 'PENDING', retryCount: 0 },
    ]);
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    let storageCallCount = 0;
    const fakeStorageDelete = async (filePath, bucket) => {
      storageCallCount++;
      notifyStorageStarted({ filePath, bucket });
      await storageHangPromise;
      return { success: true };
    };

    let worker = null;
    let startupTimeoutId = null;
    let testError = null;

    try {
      worker = queueService.startCleanupWorker(fakeStorageDelete, {
        intervalMs: 10000,
        batchSize: 1,
        storageWaitTimeoutMs: 5000,
      });
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

      // 1. Xác minh Worker thực sự bắt đầu gọi Storage và Storage đang pending
      assert.equal(storageCallCount, 1, 'Storage delete function phải được gọi chính xác 1 lần');
      assert.equal(callInfo.filePath, 'hang.jpg');
      assert.equal(worker.isRunning(), true, 'Worker phải đang chạy (isRunning = true)');
      assert.equal(isStorageSettled, false, 'Storage request phải đang pending');

      // 2. Gọi stop() với timeout ngắn 30ms trong khi storage vẫn đang bị treo vô hạn
      const stopRes = await worker.stop({ timeoutMs: 30 });

      // 3. Xác minh kết quả timeout
      assert.equal(stopRes.stopped, false, 'Khi vượt timeout không được báo đã dừng hoàn toàn');
      assert.equal(stopRes.timedOut, true, 'Phải báo timedOut = true rõ ràng');
      assert.equal(worker.isStopping(), true, 'Worker phải chuyển sang isStopping = true');
      assert.equal(worker.isRunning(), true, 'Worker vẫn đang chạy tác vụ dở dang khi bị stop timeout');
      assert.equal(isStorageSettled, false, 'Storage Promise chưa bị tự ý cancel hay settle');

      // 4. Giải phóng Storage Promise và chờ active tick hoàn tất
      const activeTickPromise = worker.getActiveTickPromise?.();
      safeUnblockStorage();

      if (activeTickPromise) {
        await activeTickPromise;
      }

      assert.equal(isStorageSettled, true, 'Storage Promise đã được giải phóng');
      assert.equal(worker.isRunning(), false, 'Sau khi tick dở dang hoàn tất, worker.isRunning() phải về false');
    } catch (err) {
      testError = err;
      throw err;
    } finally {
      // =======================================================================
      // CLEANUP RESILIENCE: Bảo đảm giải phóng tài nguyên kể cả khi assertion thất bại
      // =======================================================================
      // 1. Clear timeout guard do test tự tạo nếu chưa được clear
      if (startupTimeoutId) {
        clearTimeout(startupTimeoutId);
        startupTimeoutId = null;
      }

      // 2. Bắt buộc gọi safeUnblockStorage() TRƯỚC để giải phóng Storage Promise (idempotent)
      safeUnblockStorage();

      // 3. Nếu worker tồn tại và có activeTickPromise, chờ Promise đó kết thúc có Timeout Guard (2000ms)
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
            if (!testError) {
              console.error('[CW-06_CLEANUP_WARN]', cleanupErr.message);
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
            console.error('[CW-06_CLEANUP_WARN]', stopErr.message);
          }
        }
      }
    }
  });

  // CW-07: Stop nhiều lần - Không gây lỗi hoặc xử lý trùng
  it('CW-07: Stop nhiều lần - Không gây lỗi hoặc xử lý trùng', async () => {
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => []);

    const worker = queueService.startCleanupWorker(async () => ({ success: true }), {
      intervalMs: 10000,
    });
    createdWorkers.push(worker);

    // Gọi stop 3 lần đồng thời
    const [res1, res2, res3] = await Promise.all([
      worker.stop(),
      worker.stop(),
      worker.stop(),
    ]);

    assert.equal(res1.stopped, true);
    assert.equal(res2.stopped, true);
    assert.equal(res3.stopped, true);
    assert.equal(worker.isRunning(), false);
  });

  // CW-08: TriggerNow sau stop - Không tạo tick mới
  it('CW-08: TriggerNow sau stop - Không tạo tick mới', async () => {
    let executionCount = 0;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => []);

    const fakeStorageDelete = async () => {
      executionCount++;
      return { success: true };
    };

    const worker = queueService.startCleanupWorker(fakeStorageDelete, { intervalMs: 10000 });
    createdWorkers.push(worker);

    await worker.stop();
    assert.equal(worker.isStopping(), true);

    const initialCount = executionCount;
    // Gọi triggerNow sau khi đã stop
    const res = await worker.triggerNow();

    assert.equal(res.processed, 0);
    assert.equal(executionCount, initialCount, 'Không được tạo thêm công việc sau khi stop');
    assert.equal(worker.isRunning(), false);
  });

  // CW-09: Hoàn trả job chưa xử lý - Chỉ cập nhật job đúng lockToken
  it('CW-09: Hoàn trả job chưa xử lý - Chỉ cập nhật job đúng lockToken', async () => {
    const candidateJobs = [
      { id: 501, filePath: 'job1.jpg', status: 'PENDING', retryCount: 0 },
      { id: 502, filePath: 'job2.jpg', status: 'PENDING', retryCount: 0 },
      { id: 503, filePath: 'job3.jpg', status: 'PENDING', retryCount: 0 },
    ];

    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => candidateJobs);

    const updatedToPending = [];
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
      if (data.status === 'PENDING') {
        updatedToPending.push({ where, data });
      }
      return { count: 1 };
    });

    let processedCount = 0;
    let shouldStopTrigger = false;

    const fakeStorageDelete = async () => {
      processedCount++;
      // Sau khi xử lý job đầu tiên, kích hoạt stop
      if (processedCount === 1) {
        shouldStopTrigger = true;
      }
      return { success: true };
    };

    const summary = await queueService.processQueue(fakeStorageDelete, 3, prisma, {
      shouldStop: () => shouldStopTrigger,
    });

    assert.equal(summary.succeeded, 1, 'Chỉ 1 job đầu tiên được xử lý thành công');
    assert.equal(updatedToPending.length, 2, '2 job còn lại phải được hoàn trả về PENDING');

    // Xác minh điều kiện an toàn: phải có id, lockToken và status: 'PROCESSING'
    for (const update of updatedToPending) {
      assert.ok(update.where.id === 502 || update.where.id === 503);
      assert.ok(typeof update.where.lockToken === 'string');
      assert.equal(update.where.status, 'PROCESSING');
      assert.equal(update.data.status, 'PENDING');
      assert.equal(update.data.lockedAt, null);
      assert.equal(update.data.lockToken, null);
    }
  });

  // CW-10: Exception trong tick - Tracking và trạng thái được giải phóng đúng
  it('CW-10: Exception trong tick - Tracking và trạng thái được giải phóng đúng', async () => {
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => {
      throw new Error('Database connection reset during tick');
    });

    let worker = null;
    let timeoutId = null;
    let testError = null;

    try {
      worker = queueService.startCleanupWorker(async () => ({ success: true }), {
        intervalMs: 10000,
      });
      createdWorkers.push(worker);

      // Lấy tham chiếu Promise của initial tick đang chạy
      const initialTickPromise = worker.getActiveTickPromise();

      // Kiểm tra Promise null: Worker bắt buộc phải có activeTickPromise ngay sau khi start
      assert.ok(
        initialTickPromise !== null,
        'Worker phải có activeTickPromise ngay sau khi khởi động (Initial Tick bắt buộc phải đang chạy)'
      );

      // Đồng bộ xác định: Chờ initial tick hoàn tất xử lý exception và chạy xong khối finally
      // Bổ sung timeout guard 3000ms để ngăn chặn test bị treo vô hạn
      const timeoutGuardPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('TIMEOUT_WAITING_FOR_TICK: Initial tick không kết thúc trong thời hạn 3000ms'));
        }, 3000);
      });

      // Chờ tick hoàn tất hoặc timeout guard.
      // Nếu initialTickPromise reject ngoài dự kiến, test sẽ thất bại ngay với lỗi gốc (không nuốt lỗi).
      await Promise.race([initialTickPromise, timeoutGuardPromise]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      });

      // Xác minh activeQueueExecutionsCount không bị treo và isRunning được giải phóng về false
      assert.equal(queueService.getActiveQueueExecutionsCount(), 0, 'activeQueueExecutionsCount phải được giảm về 0 sau exception');
      assert.equal(worker.isRunning(), false, 'worker.isRunning() phải về false sau khi tick kết thúc');

      // Dừng worker sạch sẽ
      const stopRes = await worker.stop();
      assert.equal(stopRes.stopped, true, 'Worker phải dừng thành công sau khi tick đã kết thúc');
    } catch (err) {
      testError = err;
      throw err;
    } finally {
      // Dọn dẹp an toàn trong mọi trường hợp (kể cả khi assertion thất bại)
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (worker) {
        try {
          await worker.stop({ timeoutMs: 200 });
        } catch (stopErr) {
          if (!testError) {
            console.error('[CW-10_CLEANUP_WARN]', stopErr.message);
          }
        }
      }
    }
  });

  // CW-11: Drain-Fast - Dừng đúng maxDrainIterations
  it('CW-11: Drain-Fast - Dừng đúng maxDrainIterations', async () => {
    let drainBatchesClaimed = 0;
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
      // Chỉ đếm các lần claim job có where.status === 'PENDING'
      if (where?.status === 'PENDING') {
        drainBatchesClaimed++;
        return [
          { id: 601 + drainBatchesClaimed * 2, filePath: 'b1.jpg', status: 'PENDING', retryCount: 0 },
          { id: 602 + drainBatchesClaimed * 2, filePath: 'b2.jpg', status: 'PENDING', retryCount: 0 },
        ];
      }
      return [];
    });
    mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

    const worker = queueService.startCleanupWorker(async () => ({ success: true }), {
      intervalMs: 60000,
      batchSize: 2,
      maxDrainIterations: 3, // Giới hạn tối đa 3 đợt
    });
    createdWorkers.push(worker);

    // Chờ drain hoàn tất đợt initial tick
    await worker.getActiveTickPromise();

    // Xác minh drain dừng chính xác ở 3 đợt lặp
    assert.equal(drainBatchesClaimed, 3, 'Phải dừng đúng tại maxDrainIterations = 3');

    await worker.stop();
  });

  // CW-12: Worker không được bật - Không tạo timer hoặc Initial Tick
  it('CW-12: Worker không được bật - Không tạo timer hoặc Initial Tick', async () => {
    const originalEnv = process.env.STORAGE_CLEANUP_WORKER_ENABLED;
    try {
      process.env.STORAGE_CLEANUP_WORKER_ENABLED = 'false';

      let executionAttempted = false;
      const fakeStorageDelete = async () => {
        executionAttempted = true;
        return { success: true };
      };

      const worker = queueService.startCleanupWorker(fakeStorageDelete, { intervalMs: 100 });
      assert.equal(worker.isEnabled, false);
      assert.equal(worker.isRunning(), false);
      assert.equal(worker.isStopping(), false);

      await new Promise((r) => setTimeout(r, 150));
      assert.equal(executionAttempted, false, 'Không được chạy tick nào khi worker bị disable');

      const stopRes = await worker.stop();
      assert.equal(stopRes.stopped, true);
    } finally {
      process.env.STORAGE_CLEANUP_WORKER_ENABLED = originalEnv;
    }
  });
});
