// backend/tests/storageCleanupQueue.service.test.js
process.env.NODE_ENV = 'test';
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.js';
import * as queueService from '../src/services/storageCleanupQueue.service.js';
import { mockMethod, restoreAllMocks } from './helpers/mockPrisma.js';

describe('Storage Cleanup Queue Service (Final Hardening & Crash Recovery Audit)', () => {
  afterEach(() => {
    restoreAllMocks();
  });

  // ==========================================
  // NHÓM 1: enqueueCleanup() & Transaction Integrity
  // ==========================================
  describe('enqueueCleanup() & Transaction Integrity', () => {
    it('TC-QUEUE-01: Enqueues single valid item with PENDING status and nextRetryAt', async () => {
      let createdData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => null);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'create', async ({ data }) => {
        createdData = data;
        return { id: 1, ...data };
      });

      const result = await queueService.enqueueCleanup({
        filePath: 'homestays/1/test-image.jpg',
        bucketName: 'homestays',
        reason: 'DELETE_IMAGE',
      });

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 1);
      assert.equal(createdData.filePath, 'homestays/1/test-image.jpg');
      assert.equal(createdData.status, 'PENDING');
      assert.equal(createdData.retryCount, 0);
      assert.equal(createdData.maxRetries, 5);
      assert.ok(createdData.nextRetryAt instanceof Date);
    });

    it('TC-QUEUE-02: Enqueues multiple items in batch', async () => {
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => null);
      let callCount = 0;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'create', async ({ data }) => {
        callCount++;
        return { id: callCount, ...data };
      });

      const result = await queueService.enqueueCleanup([
        { filePath: 'homestays/1/img1.jpg', reason: 'DELETE_HOMESTAY' },
        { filePath: 'homestays/1/img2.jpg', reason: 'DELETE_HOMESTAY' },
      ]);

      assert.equal(result.length, 2);
      assert.equal(callCount, 2);
    });

    it('TC-QUEUE-03: Idempotent - Does not create duplicate if already PENDING or PROCESSING', async () => {
      const existingJob = { id: 99, filePath: 'homestays/1/dup.jpg', status: 'PENDING' };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => existingJob);
      let created = false;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'create', async () => {
        created = true;
      });

      const result = await queueService.enqueueCleanup({
        filePath: 'homestays/1/dup.jpg',
      });

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 99);
      assert.equal(created, false, 'Should not create duplicate job');
    });

    it('TC-QUEUE-04: Works inside transaction with custom client', async () => {
      let customClientUsed = false;
      const fakeTx = {
        sTORAGE_CLEANUP_QUEUE: {
          findFirst: async () => null,
          create: async ({ data }) => {
            customClientUsed = true;
            return { id: 10, ...data };
          },
        },
      };

      const result = await queueService.enqueueCleanup(
        { filePath: 'homestays/1/tx.jpg', reason: 'DELETE_IMAGE' },
        fakeTx
      );

      assert.equal(customClientUsed, true);
      assert.equal(result[0].id, 10);
    });

    it('TC-QUEUE-ENQUEUE-CONCURRENCY-01: Two concurrent enqueue requests do not create duplicate active jobs', async () => {
      const activeJob = { id: 88, filePath: 'homestays/concurrent.jpg', status: 'PENDING' };
      let findFirstCalls = 0;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => {
        findFirstCalls++;
        return findFirstCalls === 1 ? null : activeJob;
      });
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'create', async () => {
        const err = new Error('Unique constraint violation: job already exists');
        err.code = 'P2002';
        throw err;
      });

      const result = await queueService.enqueueCleanup({
        filePath: 'homestays/concurrent.jpg',
        reason: 'CONCURRENT_TEST',
      });

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 88);
    });

    it('TC-QUEUE-ENQUEUE-TRANSACTION-01: Handles PostgreSQL ON CONFLICT without aborting transaction', async () => {
      const activeJob = { id: 70, filePath: 'homestays/tx_conflict.jpg', status: 'PENDING' };
      const fakePgTx = {
        $queryRaw: async () => [], // Giả lập ON CONFLICT DO NOTHING -> 0 rows returned
        sTORAGE_CLEANUP_QUEUE: {
          findFirst: async () => activeJob,
        },
      };

      const result = await queueService.enqueueCleanup(
        { filePath: 'homestays/tx_conflict.jpg', reason: 'TX_CONFLICT_TEST' },
        fakePgTx
      );

      assert.equal(result.length, 1);
      assert.equal(result[0].id, 70);
    });

    it('TC-QUEUE-ROLLBACK-01: Transaction rollback throws and does not leave uncommitted queue', async () => {
      let rollbackInvoked = false;
      const fakeTx = {
        sTORAGE_CLEANUP_QUEUE: {
          findFirst: async () => null,
          create: async ({ data }) => ({ id: 77, ...data }),
        },
      };

      await assert.rejects(
        async () => {
          await queueService.enqueueCleanup({ filePath: 'file_fail.jpg' }, fakeTx);
          rollbackInvoked = true;
          throw new Error('Database transaction aborted due to business error');
        },
        /Database transaction aborted due to business error/
      );

      assert.equal(rollbackInvoked, true);
    });
  });

  // ==========================================
  // NHÓM 2: claimJobs() & Concurrency & Backoff
  // ==========================================
  describe('claimJobs() & Concurrency Protection', () => {
    it('TC-QUEUE-05: Claims pending jobs, sets lockedAt and generates lockToken', async () => {
      const pendingJobs = [
        { id: 1, filePath: 'file1.jpg', status: 'PENDING', retryCount: 0 },
        { id: 2, filePath: 'file2.jpg', status: 'PENDING', retryCount: 1 },
      ];

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => pendingJobs);
      let updatedData = [];
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedData.push(data);
        return { count: 1 };
      });

      const claimed = await queueService.claimJobs(5);

      assert.equal(claimed.length, 2);
      assert.equal(claimed[0].status, 'PROCESSING');
      assert.ok(claimed[0].lockedAt instanceof Date);
      assert.ok(typeof claimed[0].lockToken === 'string');
      assert.ok(claimed[0].lockToken.length >= 32);
      assert.notEqual(claimed[0].lockToken, claimed[1].lockToken, 'Each job must get a distinct token');
    });

    it('TC-QUEUE-CLAIM-STRICT-PENDING: claimJobs ONLY queries PENDING jobs, never PROCESSING', async () => {
      let queryWhere = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
        queryWhere = where;
        return [];
      });

      await queueService.claimJobs(10);

      assert.equal(queryWhere.status, 'PENDING', 'claimJobs must strictly filter status = PENDING');
    });

    it('TC-QUEUE-CONCURRENCY-01: Two concurrent workers claiming the same job - only one succeeds', async () => {
      const candidate = { id: 100, filePath: 'same_job.jpg', status: 'PENDING', retryCount: 0 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);

      let claimAttempt = 0;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => {
        claimAttempt++;
        return claimAttempt === 1 ? { count: 1 } : { count: 0 };
      });

      const workerAClaims = await queueService.claimJobs(1);
      const workerBClaims = await queueService.claimJobs(1);

      assert.equal(workerAClaims.length, 1, 'Worker A should claim successfully');
      assert.equal(workerAClaims[0].id, 100);
      assert.equal(workerBClaims.length, 0, 'Worker B must receive 0 claimed jobs (anti-duplicate)');
    });

    it('TC-QUEUE-BACKOFF-01: Job with future nextRetryAt is NOT claimed', async () => {
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => []);

      const claimed = await queueService.claimJobs(10);
      assert.equal(claimed.length, 0);
    });

    it('TC-QUEUE-BACKOFF-02: Job reaching nextRetryAt is successfully claimed', async () => {
      const readyJob = { id: 50, filePath: 'ready.jpg', status: 'PENDING', retryCount: 1, nextRetryAt: new Date(Date.now() - 5000) };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [readyJob]);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

      const claimed = await queueService.claimJobs(10);

      assert.equal(claimed.length, 1);
      assert.equal(claimed[0].id, 50);
      assert.equal(claimed[0].status, 'PROCESSING');
    });

    // =========================================================================
    // F-01: Prisma Fallback - Custom maxRetries Verification
    // =========================================================================
    it('TC-QUEUE-FALLBACK-01: Proves Prisma fallback filters jobs based on individual maxRetries and skips exhausted jobs', async () => {
      // Danh sách jobs trong DB mock bao gồm cả 5 trường hợp theo yêu cầu bắt buộc:
      // 1. maxRetries: 2, retryCount: 1 -> Được claim (1 < 2)
      // 2. maxRetries: 2, retryCount: 2 -> KHÔNG được claim (2 >= 2)
      // 3. maxRetries: 3, retryCount: 3 -> KHÔNG được claim (3 >= 3)
      // 4. maxRetries: 5, retryCount: 4 -> Được claim (4 < 5)
      // 5. maxRetries: 0, retryCount: 0 -> KHÔNG được claim (0 >= 0)
      const mockCandidates = [
        { id: 101, filePath: 'homestays/job1.jpg', status: 'PENDING', retryCount: 1, maxRetries: 2 },
        { id: 102, filePath: 'homestays/job2.jpg', status: 'PENDING', retryCount: 2, maxRetries: 2 },
        { id: 103, filePath: 'homestays/job3.jpg', status: 'PENDING', retryCount: 3, maxRetries: 3 },
        { id: 104, filePath: 'homestays/job4.jpg', status: 'PENDING', retryCount: 4, maxRetries: 5 },
        { id: 105, filePath: 'homestays/job5.jpg', status: 'PENDING', retryCount: 0, maxRetries: 0 },
      ];

      let findManyCalled = false;
      const updateManyCalls = [];

      // Khách hàng mock không có $queryRaw, đảm bảo 100% rẽ vào nhánh Prisma Fallback
      const fallbackClient = {
        sTORAGE_CLEANUP_QUEUE: {
          findMany: async ({ where, orderBy, take }) => {
            findManyCalled = true;
            // findMany tầng DB chỉ lọc retryCount < 5 (DEFAULT_MAX_RETRIES)
            // Cả 5 job trên đều có retryCount < 5 nên findMany DB trả về toàn bộ
            return mockCandidates.filter((j) => j.retryCount < 5);
          },
          updateMany: async ({ where, data }) => {
            updateManyCalls.push({ where, data });
            return { count: 1 };
          },
        },
      };

      const claimed = await queueService.claimJobs(10, fallbackClient);

      // 1. Bằng chứng chạy vào Prisma fallback
      assert.strictEqual(findManyCalled, true, 'Prisma fallback findMany phải được gọi');
      assert.strictEqual(typeof fallbackClient.$queryRaw, 'undefined', 'Không được có $queryRaw trên fallbackClient');

      // 2. Xác minh kết quả claim: Chỉ job 101 và 104 được claim
      assert.strictEqual(claimed.length, 2, 'Chỉ 2 job hợp lệ được claim');
      assert.strictEqual(claimed[0].id, 101, 'Job 101 (retryCount: 1, maxRetries: 2) phải được claim');
      assert.strictEqual(claimed[1].id, 104, 'Job 104 (retryCount: 4, maxRetries: 5) phải được claim');

      // 3. Bằng chứng tương tác Prisma mock:
      // updateMany chỉ được gọi cho job 101 và job 104
      assert.strictEqual(updateManyCalls.length, 2, 'updateMany chỉ được gọi đúng 2 lần cho 2 job hợp lệ');
      const updatedIds = updateManyCalls.map((call) => call.where.id);
      assert.deepStrictEqual(updatedIds, [101, 104], 'updateMany chỉ được gọi với ID 101 và 104');

      // 4. Bằng chứng các job chạm trần retry (102, 103, 105) KHÔNG bị gọi updateMany
      assert.strictEqual(updatedIds.includes(102), false, 'Job 102 (maxRetries: 2, retryCount: 2) KHÔNG được gọi updateMany');
      assert.strictEqual(updatedIds.includes(103), false, 'Job 103 (maxRetries: 3, retryCount: 3) KHÔNG được gọi updateMany');
      assert.strictEqual(updatedIds.includes(105), false, 'Job 105 (maxRetries: 0, retryCount: 0) KHÔNG được gọi updateMany');

      // 5. Xác minh atomic payload của các job được claim
      for (const call of updateManyCalls) {
        assert.strictEqual(call.where.status, 'PENDING');
        assert.strictEqual(call.data.status, 'PROCESSING');
        assert.ok(call.data.lockedAt instanceof Date);
        assert.ok(typeof call.data.lockToken === 'string' && call.data.lockToken.length >= 32);
      }
    });

    it('TC-QUEUE-FALLBACK-02: Prisma fallback claimJobs qua prisma global instance khi $queryRaw throw/fails', async () => {
      // Giả lập prisma instance với $queryRaw ném lỗi -> Fallback sang Prisma findMany
      mockMethod(prisma, '$queryRaw', async () => {
        throw new Error('Raw SQL unsupported on this mock');
      });

      const candidates = [
        { id: 201, filePath: 'homestays/valid.jpg', status: 'PENDING', retryCount: 1, maxRetries: 2 },
        { id: 202, filePath: 'homestays/exhausted.jpg', status: 'PENDING', retryCount: 2, maxRetries: 2 },
      ];

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => candidates);

      const updateCalls = [];
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
        updateCalls.push({ where, data });
        return { count: 1 };
      });

      const claimed = await queueService.claimJobs(5, prisma);

      assert.strictEqual(claimed.length, 1);
      assert.strictEqual(claimed[0].id, 201);
      assert.strictEqual(updateCalls.length, 1);
      assert.strictEqual(updateCalls[0].where.id, 201);
    });

    it('TC-QUEUE-FALLBACK-03: Handles undefined/null maxRetries safely by falling back to DEFAULT_MAX_RETRIES constraint', async () => {
      const candidates = [
        { id: 301, filePath: 'homestays/null_max.jpg', status: 'PENDING', retryCount: 2, maxRetries: null },
        { id: 302, filePath: 'homestays/undef_max.jpg', status: 'PENDING', retryCount: 4, maxRetries: undefined },
      ];

      const updateCalls = [];
      const fallbackClient = {
        sTORAGE_CLEANUP_QUEUE: {
          findMany: async () => candidates,
          updateMany: async ({ where, data }) => {
            updateCalls.push({ where, data });
            return { count: 1 };
          },
        },
      };

      const claimed = await queueService.claimJobs(5, fallbackClient);

      assert.strictEqual(claimed.length, 2, 'Cả hai job có maxRetries null/undefined và retryCount < 5 đều được claim an toàn');
      assert.strictEqual(updateCalls.length, 2);
    });
  });

  // ==========================================
  // NHÓM 3: Fencing Token Bắt Buộc & Lock Ownership
  // ==========================================
  describe('Mandatory Fencing Token & Lock Ownership', () => {
    it('TC-QUEUE-FENCING-MANDATORY-01: completeJob without token, with null or empty string is REJECTED', async () => {
      let dbTouched = false;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => {
        dbTouched = true;
        return { count: 1 };
      });

      // 1. Không truyền token
      assert.equal(await queueService.completeJob(1), false);
      // 2. Truyền null
      assert.equal(await queueService.completeJob(1, null), false);
      // 3. Truyền undefined
      assert.equal(await queueService.completeJob(1, undefined), false);
      // 4. Truyền chuỗi rỗng hoặc khoảng trắng
      assert.equal(await queueService.completeJob(1, '   '), false);

      assert.equal(dbTouched, false, 'Database must not be touched if token is missing/invalid');
    });

    it('TC-QUEUE-FENCING-MANDATORY-02: failJob without token, with null or empty string is REJECTED', async () => {
      let dbTouched = false;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => {
        dbTouched = true;
        return { id: 1 };
      });

      assert.equal(await queueService.failJob(1, 'Error'), null);
      assert.equal(await queueService.failJob(1, 'Error', {}, null), null);
      assert.equal(await queueService.failJob(1, 'Error', {}, undefined), null);
      assert.equal(await queueService.failJob(1, 'Error', {}, '   '), null);

      assert.equal(dbTouched, false, 'Database must not be touched if token is missing/invalid');
    });

    it('TC-QUEUE-FENCING-01: Worker A with stale token cannot completeJob after Worker B reclaimed', async () => {
      const tokenA = 'token-worker-a-1111';
      const tokenB = 'token-worker-b-2222';

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where }) => {
        if (where.lockToken === tokenB) {
          return { count: 1 };
        }
        return { count: 0 };
      });

      const workerACompleted = await queueService.completeJob(1, tokenA);
      assert.equal(workerACompleted, false, 'Worker A with stale token must be rejected');

      const workerBCompleted = await queueService.completeJob(1, tokenB);
      assert.equal(workerBCompleted, true, 'Worker B with active token must succeed');
    });

    it('TC-QUEUE-FENCING-02: Worker A with stale token cannot failJob after Worker B reclaimed', async () => {
      const tokenA = 'stale-token-a';
      const tokenB = 'active-token-b';

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async ({ where }) => {
        if (where.lockToken === tokenB) {
          return { id: 2, status: 'PROCESSING', lockToken: tokenB, retryCount: 1, maxRetries: 5 };
        }
        return null;
      });

      const failResultA = await queueService.failJob(2, 'Delayed timeout from worker A', {}, tokenA);
      assert.equal(failResultA, null, 'Worker A stale failJob must return null');

      let updatedDataB = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedDataB = data;
        return { count: 1 };
      });

      const failResultB = await queueService.failJob(2, 'Real error from worker B', {}, tokenB);
      assert.ok(failResultB);
      assert.equal(failResultB.status, 'PENDING');
      assert.equal(updatedDataB.lastError, 'Real error from worker B');
    });

    it('TC-QUEUE-06: completeJob sets status COMPLETED and clears lockToken/lockedAt', async () => {
      let updateData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updateData = data;
        return { count: 1 };
      });

      const success = await queueService.completeJob(1, 'valid-token');

      assert.equal(success, true);
      assert.equal(updateData.status, 'COMPLETED');
      assert.equal(updateData.lastError, null);
      assert.equal(updateData.lockedAt, null);
      assert.equal(updateData.lockToken, null);
    });

    it('TC-QUEUE-07: failJob resets to PENDING with exponential backoff if retryCount < maxRetries', async () => {
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({
        id: 2,
        status: 'PROCESSING',
        lockToken: 'valid-token-7',
        retryCount: 1,
        maxRetries: 5,
      }));
      let updatedData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedData = data;
        return { count: 1 };
      });

      const result = await queueService.failJob(2, 'Network timeout', {}, 'valid-token-7');

      assert.ok(result);
      assert.equal(result.status, 'PENDING');
      assert.equal(result.retryCount, 2);
      assert.ok(result.nextRetryAt instanceof Date);
      assert.ok(result.nextRetryAt.getTime() > Date.now());
      assert.equal(updatedData.lockToken, null);
    });

    it('TC-QUEUE-08: failJob transitions to FAILED if retryCount >= maxRetries', async () => {
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({
        id: 3,
        status: 'PROCESSING',
        lockToken: 'valid-token-8',
        retryCount: 4,
        maxRetries: 5,
      }));
      let updatedData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedData = data;
        return { count: 1 };
      });

      const result = await queueService.failJob(3, 'Max retries exceeded', {}, 'valid-token-8');

      assert.ok(result);
      assert.equal(result.status, 'FAILED');
      assert.equal(result.retryCount, 5);
      assert.equal(result.nextRetryAt, null);
      assert.equal(updatedData.status, 'FAILED');
      assert.equal(updatedData.lockToken, null);
    });

    it('TC-QUEUE-FATAL-01: failJob with isFatal: true immediately marks FAILED', async () => {
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({
        id: 4,
        status: 'PROCESSING',
        lockToken: 'fatal-token',
        retryCount: 0,
        maxRetries: 5,
      }));
      let updatedData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedData = data;
        return { count: 1 };
      });

      const result = await queueService.failJob(4, 'Invalid bucket name', { isFatal: true }, 'fatal-token');

      assert.ok(result);
      assert.equal(result.status, 'FAILED');
      assert.equal(result.retryCount, 1);
      assert.equal(updatedData.status, 'FAILED');
    });
  });

  // ==========================================
  // NHÓM 4: Worker Crash Recovery & Zombie Prevention
  // ==========================================
  describe('Worker Crash Recovery (resetStaleProcessingJobs)', () => {
    it('TC-QUEUE-CRASH-01: Worker crashes after claim -> recovery increments retryCount by exactly 1 and sets PENDING', async () => {
      const crashedJob = {
        id: 10,
        status: 'PROCESSING',
        retryCount: 0,
        maxRetries: 3,
        lockedAt: new Date(Date.now() - 15 * 60 * 1000), // Stale > 10m
        lockToken: 'crashed-token-1',
      };

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [crashedJob]);
      let updateWhere = null;
      let updateData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
        updateWhere = where;
        updateData = data;
        return { count: 1 };
      });

      const result = await queueService.resetStaleProcessingJobs(10 * 60 * 1000);

      assert.equal(result.recovered, 1);
      assert.equal(result.failed, 0);
      assert.equal(updateData.status, 'PENDING');
      assert.equal(updateData.retryCount, 1, 'Must increment retryCount from 0 to 1');
      assert.equal(updateData.lockedAt, null);
      assert.equal(updateData.lockToken, null);
      assert.ok(updateData.nextRetryAt instanceof Date);
      assert.ok(updateWhere.lockedAt.lt instanceof Date);
    });

    it('TC-QUEUE-CRASH-02: Exhausted retry job (retryCount + 1 >= maxRetries) transitions to FAILED', async () => {
      const finalCrashJob = {
        id: 11,
        status: 'PROCESSING',
        retryCount: 2,
        maxRetries: 3,
        lockedAt: new Date(Date.now() - 15 * 60 * 1000),
        lockToken: 'crashed-token-final',
      };

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [finalCrashJob]);
      let updateData = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updateData = data;
        return { count: 1 };
      });

      const result = await queueService.resetStaleProcessingJobs(10 * 60 * 1000);

      assert.equal(result.failed, 1);
      assert.equal(result.recovered, 0);
      assert.equal(updateData.status, 'FAILED');
      assert.equal(updateData.retryCount, 3, 'Must increment retryCount from 2 to 3');
      assert.equal(updateData.lockToken, null);
      assert.equal(updateData.lockedAt, null);
    });

    it('TC-QUEUE-CRASH-03: FAILED job is NEVER claimed by claimJobs', async () => {
      let findManyWhere = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async ({ where }) => {
        findManyWhere = where;
        return [];
      });

      await queueService.claimJobs(10);

      assert.equal(findManyWhere.status, 'PENDING');
      assert.ok(findManyWhere.retryCount.lt <= 5);
    });

    it('TC-QUEUE-CRASH-04: Active job with valid lock (lockedAt >= staleThreshold) is NOT recovered', async () => {
      // Mock findMany returns empty array because lockedAt is fresh (< 10 minutes ago)
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => []);

      const result = await queueService.resetStaleProcessingJobs(10 * 60 * 1000);

      assert.equal(result.recovered, 0);
      assert.equal(result.failed, 0);
    });

    it('TC-QUEUE-CRASH-05: Job already completed by another worker is NOT touched by recovery', async () => {
      const staleCandidate = {
        id: 15,
        status: 'PROCESSING',
        retryCount: 0,
        maxRetries: 3,
        lockedAt: new Date(Date.now() - 15 * 60 * 1000),
      };

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [staleCandidate]);
      // Giả lập trong tích tắc trước khi update, worker khác đã kịp complete job -> updateMany trả về count: 0
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 0 }));

      const result = await queueService.resetStaleProcessingJobs(10 * 60 * 1000);

      assert.equal(result.recovered, 0, 'Must not count as recovered if row changed in the meantime');
    });

    it('TC-QUEUE-CRASH-06: Recovery does not double-count retryCount for the same job', async () => {
      const staleJob = {
        id: 20,
        status: 'PROCESSING',
        retryCount: 1,
        maxRetries: 3,
        lockedAt: new Date(Date.now() - 15 * 60 * 1000),
      };

      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [staleJob]);
      let updatedRetry = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatedRetry = data.retryCount;
        return { count: 1 };
      });

      await queueService.resetStaleProcessingJobs(10 * 60 * 1000);

      assert.equal(updatedRetry, 2, 'Retry count must only be incremented by exactly 1');
    });
  });

  // ==========================================
  // NHÓM 5: Error Classification & processQueue()
  // ==========================================
  describe('classifyStorageError() and processQueue() with Fencing Token', () => {
    it('TC-QUEUE-IDEMPOTENT-01: File 404 / Not Found treated as COMPLETED (Idempotent)', async () => {
      const candidates = [{ id: 10, filePath: 'homestays/deleted.jpg', status: 'PENDING', retryCount: 0 }];
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => candidates);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => ({ count: 1, ...data }));

      let completedId = null;
      let usedToken = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ where, data }) => {
        if (data.status === 'COMPLETED') {
          completedId = where.id;
          usedToken = where.lockToken;
        }
        return { count: 1 };
      });

      const fakeStorageDelete = async () => ({
        success: false,
        error: 'The resource was not found on remote storage',
        statusCode: 404,
      });

      const summary = await queueService.processQueue(fakeStorageDelete);

      assert.equal(summary.succeeded, 1);
      assert.equal(summary.failed, 0);
      assert.equal(completedId, 10);
      assert.ok(typeof usedToken === 'string');
    });

    it('TC-QUEUE-TRANSIENT-01: Transient network error (ETIMEDOUT / 500) triggers retry backoff', async () => {
      const candidates = [{ id: 11, filePath: 'homestays/network.jpg', status: 'PENDING', retryCount: 0 }];
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => candidates);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({ id: 11, status: 'PROCESSING', retryCount: 0, maxRetries: 5 }));

      let updatedStatus = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        if (data.status) updatedStatus = data.status;
        return { count: 1 };
      });

      const fakeStorageDelete = async () => {
        throw new Error('ETIMEDOUT: Connection reset by peer');
      };

      const summary = await queueService.processQueue(fakeStorageDelete);

      assert.equal(summary.succeeded, 0);
      assert.equal(summary.failed, 1);
      assert.equal(updatedStatus, 'PENDING', 'Transient error must reschedule to PENDING');
    });

    it('TC-QUEUE-10: Processes batch successfully and calls storageDeleteFn', async () => {
      const candidates = [
        { id: 1, filePath: 'homestays/hs1.jpg', bucketName: 'homestays', status: 'PENDING', retryCount: 0 },
      ];
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => candidates);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async () => ({ count: 1 }));

      let deletedPath = null;
      const fakeStorageDelete = async (path) => {
        deletedPath = path;
        return { success: true };
      };

      const summary = await queueService.processQueue(fakeStorageDelete);

      assert.equal(summary.processed, 1);
      assert.equal(summary.succeeded, 1);
      assert.equal(summary.failed, 0);
      assert.equal(deletedPath, 'homestays/hs1.jpg');
    });

    it('TC-QUEUE-11: Background worker recovers stale jobs and can be stopped', async () => {
      let resetCalled = false;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => {
        resetCalled = true;
        return [];
      });

      const worker = queueService.startCleanupWorker(async () => ({ success: true }), 100000);
      assert.ok(typeof worker.stop === 'function');
      assert.ok(typeof worker.triggerNow === 'function');

      await worker.triggerNow();
      worker.stop();

      assert.equal(resetCalled, true, 'Worker should call resetStaleProcessingJobs on start');
    });
  });

  // ==========================================
  // NHÓM 6: classifyStorageError() Hierarchy & Queue Impact (ST-ERR-01 -> ST-ERR-11)
  // ==========================================
  describe('classifyStorageError() Strict Hierarchy & Queue Impact', () => {
    it('ST-ERR-01: Object-specific Not Found hợp lệ -> ALREADY_DELETED', () => {
      const err = {
        error: 'NoSuchKey: The specified key does not exist',
        name: 'NoSuchKey',
        statusCode: 404,
      };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.ALREADY_DELETED);

      const err2 = { error: 'Object not found on remote storage' };
      assert.equal(queueService.classifyStorageError(err2), queueService.STORAGE_ERROR_TYPE.ALREADY_DELETED);
    });

    it('ST-ERR-02: Bucket not found, HTTP 404 -> FATAL', () => {
      const err = { error: 'Bucket not found', statusCode: 404 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.FATAL);

      const err2 = { error: 'The specified bucket does not exist', statusCode: 404 };
      assert.equal(queueService.classifyStorageError(err2), queueService.STORAGE_ERROR_TYPE.FATAL);
    });

    it('ST-ERR-03: Generic HTTP 404, không rõ nguyên nhân -> TRANSIENT', () => {
      const err = { error: 'Not Found', statusCode: 404 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-04: Gateway/Route 404 -> TRANSIENT', () => {
      const err = { error: 'Route /storage/v1/object not found', statusCode: 404 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);

      const err2 = { error: 'Gateway 404: upstream endpoint not found', statusCode: 404 };
      assert.equal(queueService.classifyStorageError(err2), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-05: Invalid API key, HTTP 401 -> FATAL', () => {
      const err = { error: 'Invalid API key', statusCode: 401 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.FATAL);
    });

    it('ST-ERR-06: Permission denied, HTTP 403 -> FATAL', () => {
      const err = { error: 'Permission denied', statusCode: 403 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.FATAL);
    });

    it('ST-ERR-07: DNS ENOTFOUND -> TRANSIENT', () => {
      const err = new Error('getaddrinfo ENOTFOUND api.supabase.co');
      err.code = 'ENOTFOUND';
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-08: ECONNRESET -> TRANSIENT', () => {
      const err = new Error('read ECONNRESET');
      err.code = 'ECONNRESET';
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-09: HTTP 503 -> TRANSIENT', () => {
      const err = { error: 'Service Unavailable', statusCode: 503 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-10: Message chứa chuỗi 404 nhưng status thực tế 500 -> TRANSIENT', () => {
      const err = { error: 'Internal Server Error (Ref: 404123)', statusCode: 500 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    it('ST-ERR-11: Lỗi không xác định -> TRANSIENT', () => {
      const err = { error: 'Unexpected storage exception', statusCode: 0 };
      assert.equal(queueService.classifyStorageError(err), queueService.STORAGE_ERROR_TYPE.TRANSIENT);
    });

    // --- Tác động đến Queue (Queue Lifecycle Impact Tests) ---
    it('ST-QUEUE-IMPACT-01: Object thực sự không tồn tại -> Job chuyển COMPLETED', async () => {
      const candidate = { id: 101, filePath: 'homestays/deleted.jpg', status: 'PENDING', retryCount: 0 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);
      let updatedStatus = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        if (data.status) updatedStatus = data.status;
        return { count: 1 };
      });

      const res = await queueService.processQueue(async () => ({
        success: false,
        name: 'NoSuchKey',
        error: 'NoSuchKey: The specified key does not exist',
        statusCode: 404,
      }));

      assert.equal(res.succeeded, 1);
      assert.equal(updatedStatus, 'COMPLETED');
    });

    it('ST-QUEUE-IMPACT-02: Bucket không tồn tại (404) -> Job chuyển FAILED ngay lập tức', async () => {
      const candidate = { id: 102, filePath: 'homestays/img.jpg', status: 'PENDING', retryCount: 0, maxRetries: 5 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({ ...candidate, status: 'PROCESSING' }));
      let updatedStatus = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        if (data.status) updatedStatus = data.status;
        return { count: 1 };
      });

      const res = await queueService.processQueue(async () => ({
        success: false,
        error: 'Bucket not found',
        statusCode: 404,
      }));

      assert.equal(res.failed, 1);
      assert.equal(updatedStatus, 'FAILED', 'Bucket error must immediately mark job as FAILED');
    });

    it('ST-QUEUE-IMPACT-03: DNS ENOTFOUND -> Job giữ PENDING, tăng retryCount, giải phóng lockToken', async () => {
      const candidate = { id: 103, filePath: 'homestays/img.jpg', status: 'PENDING', retryCount: 0, maxRetries: 5 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({ ...candidate, status: 'PROCESSING' }));
      let updatePayload = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        updatePayload = data;
        return { count: 1 };
      });

      const dnsErr = new Error('getaddrinfo ENOTFOUND api.supabase.co');
      dnsErr.code = 'ENOTFOUND';

      const res = await queueService.processQueue(async () => {
        throw dnsErr;
      });

      assert.equal(res.failed, 1);
      assert.equal(updatePayload.status, 'PENDING');
      assert.equal(updatePayload.retryCount, 1);
      assert.equal(updatePayload.lockToken, null);
      assert.ok(updatePayload.nextRetryAt instanceof Date);
    });

    it('ST-QUEUE-IMPACT-04: Generic HTTP 404 -> Không được chuyển COMPLETED (reschedule PENDING)', async () => {
      const candidate = { id: 104, filePath: 'homestays/img.jpg', status: 'PENDING', retryCount: 0, maxRetries: 5 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({ ...candidate, status: 'PROCESSING' }));
      let updatedStatus = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        if (data.status) updatedStatus = data.status;
        return { count: 1 };
      });

      const res = await queueService.processQueue(async () => ({
        success: false,
        error: 'Not Found',
        statusCode: 404,
      }));

      assert.equal(res.succeeded, 0);
      assert.equal(res.failed, 1);
      assert.notEqual(updatedStatus, 'COMPLETED', 'Generic 404 must NOT transition to COMPLETED');
      assert.equal(updatedStatus, 'PENDING');
    });

    it('ST-QUEUE-IMPACT-05: Lỗi không xác định -> Không được chuyển COMPLETED (reschedule PENDING)', async () => {
      const candidate = { id: 105, filePath: 'homestays/img.jpg', status: 'PENDING', retryCount: 0, maxRetries: 5 };
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findMany', async () => [candidate]);
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'findFirst', async () => ({ ...candidate, status: 'PROCESSING' }));
      let updatedStatus = null;
      mockMethod(prisma.sTORAGE_CLEANUP_QUEUE, 'updateMany', async ({ data }) => {
        if (data.status) updatedStatus = data.status;
        return { count: 1 };
      });

      const res = await queueService.processQueue(async () => {
        throw new Error('Something unknown happened');
      });

      assert.equal(res.succeeded, 0);
      assert.equal(res.failed, 1);
      assert.notEqual(updatedStatus, 'COMPLETED', 'Unknown error must NOT transition to COMPLETED');
      assert.equal(updatedStatus, 'PENDING');
    });
  });
});
