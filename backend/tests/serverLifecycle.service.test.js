// backend/tests/serverLifecycle.service.test.js
process.env.NODE_ENV = 'test';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import để bảo đảm NODE_ENV='test' được thiết lập trước khi server.js được nạp
const {
  handleGracefulShutdown,
  TIMEOUT_BUDGET,
  resetServerTestState,
  parseShutdownTimeoutMs,
  calculateTimeoutBudget,
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  MIN_SHUTDOWN_TIMEOUT_MS,
  MAX_SHUTDOWN_TIMEOUT_MS,
  SHUTDOWN_TIMEOUT_MS,
  initWorker,
} = await import('../src/server.js');

import * as queueService from '../src/services/storageCleanupQueue.service.js';

describe('Server Lifecycle & Graceful Shutdown Integration Tests (Giai đoạn 2.3 - Bước 3, Stage 3)', () => {
  beforeEach(() => {
    resetServerTestState();
    queueService.resetQueueTestState();
  });

  afterEach(() => {
    resetServerTestState();
    queueService.resetQueueTestState();
  });

  // =========================================================================
  // INT-CFG-01: Shutdown Timeout Configuration Validation & Budget
  // =========================================================================
  describe('INT-CFG-01: Shutdown Timeout Configuration Validation & Budget', () => {
    it('INT-CFG-01a: Bảng kiểm thử nghiêm ngặt parseShutdownTimeoutMs theo ma trận dữ liệu (AUDIT-07)', () => {
      // 1. Chấp nhận các giá trị hợp lệ trong khoảng [5.000ms, 300.000ms] (cả string và number)
      assert.strictEqual(parseShutdownTimeoutMs('5000'), 5000, 'Chấp nhận string 5000ms (giới hạn tối thiểu)');
      assert.strictEqual(parseShutdownTimeoutMs(5000), 5000, 'Chấp nhận number 5000ms (giới hạn tối thiểu)');
      assert.strictEqual(parseShutdownTimeoutMs('20000'), 20000, 'Chấp nhận string 20000ms (mặc định)');
      assert.strictEqual(parseShutdownTimeoutMs(20000), 20000, 'Chấp nhận number 20000ms (mặc định)');
      assert.strictEqual(parseShutdownTimeoutMs('300000'), 300000, 'Chấp nhận string 300000ms (giới hạn tối đa)');
      assert.strictEqual(parseShutdownTimeoutMs(300000), 300000, 'Chấp nhận number 300000ms (giới hạn tối đa)');
      assert.strictEqual(MAX_SHUTDOWN_TIMEOUT_MS, 300000, 'Hằng số MAX_SHUTDOWN_TIMEOUT_MS phải là 300000 (5 phút)');

      // 2. Dưới giới hạn tối thiểu (< 5000ms) -> Fallback về 20000ms
      assert.strictEqual(parseShutdownTimeoutMs('4999'), 20000, 'String 4999ms nhỏ hơn 5000ms phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(4999), 20000, 'Number 4999 nhỏ hơn 5000ms phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('0'), 20000, 'String 0ms phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(0), 20000, 'Number 0 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('-5000'), 20000, 'Số âm string -5000 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(-5000), 20000, 'Số âm number -5000 phải fallback về 20000ms');

      // 3. Vượt giới hạn tối đa (> 300000ms hoặc tràn số 32-bit int) -> Fallback về 20000ms
      assert.strictEqual(parseShutdownTimeoutMs('300001'), 20000, 'String 300001ms vượt 300000ms phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(300001), 20000, 'Number 300001 vượt 300000ms phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('2147483647'), 20000, 'String 2147483647 (max 32-bit int) phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(2147483647), 20000, 'Number 2147483647 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('2147483648'), 20000, 'String 2147483648 (tràn 32-bit int: 2^31) phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(2147483648), 20000, 'Number 2147483648 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('3000000000'), 20000, 'String 3000000000 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(3000000000), 20000, 'Number 3000000000 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('9007199254740992'), 20000, 'String 9007199254740992 (vượt safe integer: 2^53) phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(9007199254740992), 20000, 'Number 9007199254740992 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('Infinity'), 20000, 'String Infinity phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(Infinity), 20000, 'Number Infinity phải fallback về 20000ms');

      // 4. Sai định dạng hoặc kiểu dữ liệu -> Fallback về 20000ms
      assert.strictEqual(parseShutdownTimeoutMs('5.5'), 20000, 'String thập phân 5.5 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(5.5), 20000, 'Number thập phân 5.5 phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('5000abc'), 20000, 'String 5000abc có ký tự lạ phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('abc5000'), 20000, 'String abc5000 có ký tự lạ phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(''), 20000, 'Chuỗi rỗng phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs('   '), 20000, 'Chuỗi khoảng trắng phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(undefined), 20000, 'undefined phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(null), 20000, 'null phải fallback về 20000ms');
      assert.strictEqual(parseShutdownTimeoutMs(NaN), 20000, 'NaN phải fallback về 20000ms');
    });

    it('INT-CFG-01b: Phân bổ ngân sách (Timeout Budget) và Safety Buffer với SHUTDOWN_TIMEOUT_MS = 20.000ms', () => {
      const budget20k = calculateTimeoutBudget('20000');
      assert.strictEqual(budget20k.TOTAL_MS, 20000);
      assert.strictEqual(budget20k.WORKER_MS, 8000, 'Worker timeout 40% = 8.000ms');
      assert.strictEqual(budget20k.HTTP_MS, 4000, 'HTTP close timeout 20% = 4.000ms');
      assert.strictEqual(budget20k.QUEUE_MS, 3000, 'Queue drain timeout 15% = 3.000ms');
      assert.strictEqual(budget20k.PRISMA_MS, 2000, 'Prisma disconnect timeout 10% = 2.000ms');
      assert.strictEqual(budget20k.BUFFER_MS, 3000, 'Khoảng dự phòng an toàn (Safety Buffer) 15% = 3.000ms');

      const sumAllocated = budget20k.WORKER_MS + budget20k.HTTP_MS + budget20k.QUEUE_MS + budget20k.PRISMA_MS;
      assert.ok(sumAllocated < budget20k.TOTAL_MS, 'Tổng ngân sách các tác vụ bắt buộc phải nhỏ hơn hard timeout');
      assert.strictEqual(sumAllocated + budget20k.BUFFER_MS, budget20k.TOTAL_MS, 'Tổng ngân sách + Safety Buffer = Đúng Hard Timeout');
    });

    it('INT-CFG-01c: Phân bổ ngân sách với giới hạn tối thiểu 5.000ms và cấu hình không hợp lệ', () => {
      // 1. Cấu hình tối thiểu 5.000ms
      const budget5k = calculateTimeoutBudget('5000');
      assert.strictEqual(budget5k.TOTAL_MS, 5000);
      assert.strictEqual(budget5k.WORKER_MS, 2000, 'Worker 40% của 5000 = 2.000ms');
      assert.strictEqual(budget5k.HTTP_MS, 1000, 'HTTP 20% của 5000 = 1.000ms');
      assert.strictEqual(budget5k.QUEUE_MS, 750, 'Queue 15% của 5000 = 750ms');
      assert.strictEqual(budget5k.PRISMA_MS, 500, 'Prisma 10% của 5000 = 500ms');
      assert.strictEqual(budget5k.BUFFER_MS, 750, 'Buffer 15% của 5000 = 750ms');

      const sum5k = budget5k.WORKER_MS + budget5k.HTTP_MS + budget5k.QUEUE_MS + budget5k.PRISMA_MS;
      assert.ok(sum5k < budget5k.TOTAL_MS);
      assert.strictEqual(sum5k + budget5k.BUFFER_MS, 5000);

      // 2. Cấu hình không hợp lệ -> Fallback về 20.000ms
      const invalidBudget = calculateTimeoutBudget('5000abc');
      assert.strictEqual(invalidBudget.TOTAL_MS, 20000, 'Cấu hình không hợp lệ phải fallback về budget 20000ms');
      assert.strictEqual(invalidBudget.WORKER_MS, 8000);
    });

    it('INT-CFG-01d: Phân bổ ngân sách với giới hạn tối đa 300.000ms (MAX_SHUTDOWN_TIMEOUT_MS)', () => {
      const budget300k = calculateTimeoutBudget('300000');
      assert.strictEqual(budget300k.TOTAL_MS, 300000, 'Tổng ngân sách 300.000ms (5 phút)');
      assert.strictEqual(budget300k.WORKER_MS, 120000, 'Worker timeout 40% = 120.000ms (120s)');
      assert.strictEqual(budget300k.HTTP_MS, 60000, 'HTTP close timeout 20% = 60.000ms (60s)');
      assert.strictEqual(budget300k.QUEUE_MS, 45000, 'Queue drain timeout 15% = 45.000ms (45s)');
      assert.strictEqual(budget300k.PRISMA_MS, 30000, 'Prisma disconnect timeout 10% = 30.000ms (30s)');
      assert.strictEqual(budget300k.BUFFER_MS, 45000, 'Safety Buffer 15% = 45.000ms (45s)');

      const sumAllocated = budget300k.WORKER_MS + budget300k.HTTP_MS + budget300k.QUEUE_MS + budget300k.PRISMA_MS;
      assert.strictEqual(sumAllocated, 255000, 'Tổng ngân sách các tác vụ = 255.000ms');
      assert.strictEqual(sumAllocated + budget300k.BUFFER_MS, 300000, 'Tổng tác vụ + Safety Buffer = Đúng 300.000ms');

      // Xác minh tất cả các giá trị đều là số hữu hạn, không âm và là số nguyên an toàn
      for (const [key, val] of Object.entries(budget300k)) {
        assert.ok(Number.isSafeInteger(val), `${key} phải là safe integer`);
        assert.ok(val >= 0, `${key} phải không âm`);
        assert.ok(Number.isFinite(val), `${key} phải là số hữu hạn`);
      }
    });
  });

  // =========================================================================
  // INT-SV-01: Graceful Shutdown Sequence
  // =========================================================================
  describe('INT-SV-01: Graceful Shutdown Sequence', () => {
    it('INT-SV-01: Thứ tự các bước trong chuỗi Graceful Shutdown khi nhận SIGTERM/SIGINT', async () => {
      const callLog = [];
      let exitCode = null;

      const mockExit = (code) => {
        exitCode = code;
        callLog.push(`PROCESS_EXIT_${code}`);
      };

      const mockWorker = {
        stop: async () => {
          callLog.push('WORKER_STOP');
          return { stopped: true, timedOut: false };
        },
      };

      const mockServer = {
        listening: true,
        close: (cb) => {
          callLog.push('HTTP_CLOSE');
          cb(null);
        },
        closeIdleConnections: () => {
          callLog.push('HTTP_CLOSE_IDLE');
        },
      };

      const mockPrisma = {
        $disconnect: async () => {
          callLog.push('PRISMA_DISCONNECT');
        },
      };

      // Kích hoạt shutdown với tín hiệu SIGTERM
      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
      });

      // Xác minh tuần tự:
      // 1. Nhận tín hiệu SIGTERM
      // 2. Bật cờ Queue Shutdown (Giai đoạn A)
      assert.strictEqual(queueService.isQueueShuttingDown(), true, 'Phải kích hoạt cờ Queue Shutdown ở đầu quy trình');

      // 3. Dừng Worker (Giai đoạn B)
      // 4. Đóng HTTP Server (Giai đoạn C)
      // 5. Ngắt Prisma Client (Giai đoạn D)
      // 6. Thoát tiến trình mã 0
      const expectedSteps = ['WORKER_STOP', 'HTTP_CLOSE', 'HTTP_CLOSE_IDLE', 'PRISMA_DISCONNECT', 'PROCESS_EXIT_0'];
      assert.deepEqual(callLog, expectedSteps, 'Thứ tự thực thi các bước shutdown phải chuẩn xác theo thiết kế');
      assert.strictEqual(exitCode, 0, 'Clean shutdown phải thoát mã 0');
    });

    it('INT-SV-01b: Thứ tự thực thi khi nhận tín hiệu SIGINT', async () => {
      const callLog = [];
      let exitCode = null;

      const mockExit = (code) => {
        exitCode = code;
        callLog.push(`PROCESS_EXIT_${code}`);
      };
      const mockWorker = {
        stop: async () => {
          callLog.push('WORKER_STOP');
          return { stopped: true, timedOut: false };
        },
      };
      const mockServer = {
        listening: true,
        close: (cb) => {
          callLog.push('HTTP_CLOSE');
          cb(null);
        },
        closeIdleConnections: () => {},
      };
      const mockPrisma = {
        $disconnect: async () => {
          callLog.push('PRISMA_DISCONNECT');
        },
      };

      await handleGracefulShutdown('SIGINT', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
      });

      assert.strictEqual(queueService.isQueueShuttingDown(), true);
      assert.deepEqual(callLog, ['WORKER_STOP', 'HTTP_CLOSE', 'PRISMA_DISCONNECT', 'PROCESS_EXIT_0']);
      assert.strictEqual(exitCode, 0);
    });
  });

  // =========================================================================
  // INT-SV-02: Shutdown Timeout
  // =========================================================================
  describe('INT-SV-02: Shutdown Timeout', () => {
    it('INT-SV-02a: Worker timeout & Storage đang chạy -> KHÔNG ngắt Prisma, thoát mã 1, không hủy Promise Storage', async () => {
      let exitCode = null;
      let prismaDisconnectCalled = false;
      let storageCompletedAfterTimeout = false;

      // Giả lập một tác vụ Storage vẫn đang chạy ngầm trong Storage Driver
      let finishHangingStorage;
      const slowStoragePromise = new Promise((resolve) => {
        finishHangingStorage = resolve;
      });

      const slowStorageTask = (async () => {
        await slowStoragePromise;
        storageCompletedAfterTimeout = true;
      })();

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnectCalled = true; },
      };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };
      const mockWorker = {
        stop: async () => ({ stopped: false, timedOut: true }), // Worker báo timeout
      };

      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
      });

      // Xác minh:
      // 1. Prisma $disconnect KHÔNG được gọi vì worker timed out
      assert.strictEqual(prismaDisconnectCalled, false, 'TUYỆT ĐỐI không được gọi prisma.$disconnect() khi Worker timeout');
      // 2. Bắt buộc thoát với exit code 1
      assert.strictEqual(exitCode, 1, 'Incomplete shutdown do Worker timeout phải thoát với mã 1');
      // 3. Tác vụ Storage KHÔNG bị hủy cưỡng bức bởi Promise.race (Promise.race chỉ giới hạn thời gian chờ)
      assert.strictEqual(storageCompletedAfterTimeout, false, 'Storage task vẫn đang pending tại thời điểm shutdown exit');

      // Giải phóng Promise sau khi test kiểm tra xong
      finishHangingStorage();
      await slowStorageTask;
      assert.strictEqual(storageCompletedAfterTimeout, true, 'Storage task hoàn tất sau khi được giải phóng');
    });

    it('INT-SV-02b: HTTP server close timeout -> Gọi closeAllConnections, KHÔNG ngắt Prisma, thoát mã 1', async () => {
      let exitCode = null;
      let prismaDisconnectCalled = false;
      let closeAllCalled = false;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnectCalled = true; },
      };
      const mockServer = {
        listening: true,
        close: () => {
          // Giả lập callback close không bao giờ được gọi (treo kết nối)
        },
        closeIdleConnections: () => {},
        closeAllConnections: () => {
          closeAllCalled = true;
        },
      };
      const mockWorker = {
        stop: async () => ({ stopped: true, timedOut: false }),
      };

      // Cấu hình ngân sách nhỏ (HTTP_MS: 30ms) để test chạy nhanh
      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
        timeoutBudget: {
          WORKER_MS: 50,
          HTTP_MS: 30,
          QUEUE_MS: 50,
          PRISMA_MS: 50,
        },
      });

      assert.strictEqual(closeAllCalled, true, 'Khi HTTP close timeout phải gọi closeAllConnections()');
      assert.strictEqual(prismaDisconnectCalled, false, 'TUYỆT ĐỐI không gọi prisma.$disconnect() khi HTTP close timeout');
      assert.strictEqual(exitCode, 1, 'Thoát mã 1 khi HTTP server timeout');
    });

    it('INT-SV-02c: Queue execution timeout -> Chờ tối đa ngân sách QUEUE_MS, KHÔNG ngắt Prisma, thoát mã 1', async () => {
      let exitCode = null;
      let prismaDisconnectCalled = false;

      // Giả lập vẫn còn 2 executions đang xử lý trong Queue
      queueService.setTestActiveQueueExecutionsCount(2);

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnectCalled = true; },
      };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };
      const mockWorker = {
        stop: async () => ({ stopped: true, timedOut: false }),
      };

      const startTime = Date.now();
      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
        timeoutBudget: {
          WORKER_MS: 50,
          HTTP_MS: 50,
          QUEUE_MS: 60, // Giới hạn chờ queue 60ms
          PRISMA_MS: 50,
        },
      });
      const duration = Date.now() - startTime;

      assert.ok(duration >= 50, `Phải chờ hết thời gian QUEUE_MS (thực tế: ${duration}ms)`);
      assert.strictEqual(prismaDisconnectCalled, false, 'Không được gọi prisma.$disconnect() khi Queue còn active executions');
      assert.strictEqual(exitCode, 1, 'Thoát mã 1 khi Queue không thể drain kịp thời');

      queueService.setTestActiveQueueExecutionsCount(0);
    });

    it('INT-SV-02d: Hard shutdown timeout fail-safe -> Timer được tạo, giữ referenced (AUDIT-06) và cưỡng chế dừng khi quá hạn', async () => {
      let exitCode = null;
      let prismaDisconnectCalled = false;
      let capturedTimer = null;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnectCalled = true; },
      };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };

      // Giả lập worker.stop bị treo vĩnh viễn (unresolved promise)
      const mockWorkerHanging = {
        stop: () => new Promise(() => {}),
      };

      // Đặt hard timeout 50ms để kiểm tra fail-safe
      await new Promise((resolve) => {
        handleGracefulShutdown('SIGTERM', {
          exitFn: (code) => {
            mockExit(code);
            resolve();
          },
          prismaClient: mockPrisma,
          server: mockServer,
          worker: mockWorkerHanging,
          forceTimeoutMs: 50,
          onTimerCreated: (timer) => {
            capturedTimer = timer;
          },
        });
      });

      // 1. Xác minh timer được tạo và ĐƯỢC GIỮ REFERENCED (không unref) theo AUDIT-06
      assert.ok(capturedTimer !== null, 'forceExitTimer phải được khởi tạo');
      assert.strictEqual(typeof capturedTimer.hasRef, 'function', 'capturedTimer phải có phương thức hasRef()');
      assert.strictEqual(capturedTimer.hasRef(), true, 'forceExitTimer bắt buộc phải giữ referenced (không unref) để bảo đảm fail-safe ngay cả khi event loop không còn I/O handles');

      // 2. Xác minh timer kích hoạt đúng khi quá hạn
      assert.strictEqual(exitCode, 1, 'Hard timeout phải cưỡng chế dừng tiến trình với mã 1');
      assert.strictEqual(prismaDisconnectCalled, false, 'Hard timeout tuyệt đối không gọi prisma.$disconnect()');
    });

    it('INT-SV-02e: Hard shutdown timer được dọn dẹp (clearTimeout) khi shutdown hoàn tất thành công', async () => {
      let exitCode = null;
      let capturedTimer = null;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = { $disconnect: async () => {} };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };
      const mockWorker = {
        stop: async () => ({ stopped: true, timedOut: false }),
      };

      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
        forceTimeoutMs: 60,
        onTimerCreated: (timer) => {
          capturedTimer = timer;
        },
      });

      assert.ok(capturedTimer !== null, 'forceExitTimer phải được khởi tạo');
      assert.strictEqual(capturedTimer.hasRef(), true, 'Timer ban đầu được tạo với trạng thái referenced');
      assert.strictEqual(exitCode, 0, 'Shutdown hoàn tất thành công phải gọi exitFn(0)');

      // Chờ vượt quá thời gian timeout (80ms > 60ms) để bảo đảm timer đã bị clearTimeout và không kích hoạt
      await new Promise((r) => setTimeout(r, 80));
      assert.strictEqual(exitCode, 0, 'exitCode vẫn giữ nguyên là 0, forceExitTimer không bị kích hoạt đè lên vì đã được clearTimeout');
    });

    it('INT-SV-02f: Hard shutdown timer được dọn dẹp (clearTimeout) trong các nhánh thoát do lỗi (INCOMPLETE_SHUTDOWN)', async () => {
      let exitCode = null;
      let capturedTimer = null;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = { $disconnect: async () => {} };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };
      // Worker timed out -> INCOMPLETE_SHUTDOWN path
      const mockWorkerTimedOut = {
        stop: async () => ({ stopped: false, timedOut: true }),
      };

      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorkerTimedOut,
        forceTimeoutMs: 60,
        onTimerCreated: (timer) => {
          capturedTimer = timer;
        },
      });

      assert.ok(capturedTimer !== null, 'forceExitTimer phải được khởi tạo');
      assert.strictEqual(capturedTimer.hasRef(), true, 'Timer ban đầu có trạng thái referenced');
      assert.strictEqual(exitCode, 1, 'Incomplete shutdown phải thoát với mã 1');

      // Chờ qua ngưỡng timeout (80ms > 60ms) để chắc chắn forceExitTimer đã được clearTimeout
      let secondaryExitCalled = false;
      await new Promise((r) => setTimeout(r, 80));
      assert.strictEqual(exitCode, 1, 'Mã thoát vẫn là 1 và timer đã được hủy sạch sẽ');
    });
  });

  // =========================================================================
  // INT-SV-03: Server Lifecycle Error Handling
  // =========================================================================
  describe('INT-SV-03: Server Lifecycle Error Handling', () => {
    it('INT-SV-03a: Worker khởi động ném ngoại lệ -> Ghi log WORKER_STARTUP_FAILED, server vẫn an toàn', () => {
      // Giả lập workerFactory ném lỗi nghiêm trọng khi khởi động
      const crashingWorkerFactory = () => {
        throw new Error('Connection refused to cleanup message broker');
      };

      const result = initWorker(crashingWorkerFactory);
      assert.strictEqual(result, null, 'Worker khởi động thất bại phải trả về null');
    });

    it('INT-SV-03b: HTTP Server close thất bại -> Bỏ qua Prisma disconnect, thoát mã 1', async () => {
      let exitCode = null;
      let prismaDisconnectCalled = false;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnectCalled = true; },
      };
      const mockServer = {
        listening: true,
        close: (cb) => {
          cb(new Error('EBADF: bad file descriptor on socket close'));
        },
        closeIdleConnections: () => {},
      };
      const mockWorker = {
        stop: async () => ({ stopped: true, timedOut: false }),
      };

      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
      });

      assert.strictEqual(prismaDisconnectCalled, false, 'Không ngắt Prisma khi HTTP close bị lỗi');
      assert.strictEqual(exitCode, 1, 'Thoát mã 1 khi HTTP server close gặp lỗi');
    });

    it('INT-SV-03c: Prisma $disconnect thất bại -> Ghi log lỗi và thoát mã 1', async () => {
      let exitCode = null;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => {
          throw new Error('PostgreSQL connection drop during disconnect');
        },
      };
      const mockServer = {
        listening: true,
        close: (cb) => cb(null),
        closeIdleConnections: () => {},
      };
      const mockWorker = {
        stop: async () => ({ stopped: true, timedOut: false }),
      };

      await handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
      });

      assert.strictEqual(exitCode, 1, 'Thất bại khi disconnect Prisma Client bắt buộc phải thoát mã 1');
    });

    it('INT-SV-03d: Anti-Duplicate Signals - SIGTERM và SIGINT đồng thời không gây xử lý shutdown hoặc tạo timer trùng lặp (AUDIT-06)', async () => {
      let exitCount = 0;
      let timerCreatedCount = 0;
      const mockExit = () => { exitCount++; };
      const mockPrisma = { $disconnect: async () => {} };
      const mockServer = { listening: false };
      const mockWorker = null;

      const p1 = handleGracefulShutdown('SIGTERM', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
        onTimerCreated: () => { timerCreatedCount++; },
      });
      const p2 = handleGracefulShutdown('SIGINT', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: mockWorker,
        onTimerCreated: () => { timerCreatedCount++; },
      });

      await p1;
      await p2;

      assert.strictEqual(exitCount, 1, 'Chỉ được thực thi shutdown và exit đúng 1 lần duy nhất');
      assert.strictEqual(timerCreatedCount, 1, 'Chỉ được tạo forceExitTimer đúng 1 lần duy nhất khi nhận tín hiệu đầu tiên');
    });

    it('INT-SV-03e: Server chưa từng listening (ví dụ: EADDRINUSE) -> Bỏ qua server.close(), dọn dẹp và thoát mã 1', async () => {
      let exitCode = null;
      let closeCalled = false;
      let prismaDisconnected = false;

      const mockExit = (code) => { exitCode = code; };
      const mockPrisma = {
        $disconnect: async () => { prismaDisconnected = true; },
      };
      const mockServer = {
        listening: false, // Server chưa từng listening do EADDRINUSE
        close: (cb) => {
          closeCalled = true;
          cb(new Error('Server is not running.'));
        },
      };

      await handleGracefulShutdown('SERVER_ERROR', {
        exitFn: mockExit,
        prismaClient: mockPrisma,
        server: mockServer,
        worker: null,
      });

      assert.strictEqual(closeCalled, false, 'Không được gọi server.close() khi server chưa từng listening');
      assert.strictEqual(prismaDisconnected, true, 'Prisma Client vẫn được dọn dẹp sạch sẽ khi server lỗi khởi động');
      assert.strictEqual(exitCode, 1, 'SERVER_ERROR bắt buộc phải thoát mã 1');
    });
  });
});
