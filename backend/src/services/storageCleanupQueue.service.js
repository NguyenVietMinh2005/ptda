// backend/src/services/storageCleanupQueue.service.js
import crypto from 'node:crypto';
import prisma from '../config/prisma.js';

export const QUEUE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const STORAGE_ERROR_TYPE = {
  ALREADY_DELETED: 'ALREADY_DELETED', // File đã không còn (404/NoSuchKey/NotFound) -> Idempotent success
  FATAL: 'FATAL',                     // Lỗi cấu hình/phân quyền vĩnh viễn -> Không retry
  TRANSIENT: 'TRANSIENT',             // Lỗi mạng/5xx/429 tạm thời -> Retry với backoff
};

export const DEFAULT_BUCKET = 'homestays';
export const DEFAULT_MAX_RETRIES = 5;
export const DEFAULT_LOCK_TIMEOUT_MS = 300 * 1000; // 5 phút (300.000 ms)
export const DEFAULT_BATCH_SIZE = 5;
export const DEFAULT_STORAGE_WAIT_TIMEOUT_MS = 5000; // 5.000 ms (thời gian tối đa client chờ Storage)
export const DEFAULT_POLL_INTERVAL_MS = 60000; // 60.000 ms (60 giây)
export const MAX_DRAIN_ITERATIONS = 5; // Tối đa 5 đợt drain liên tiếp
export const BASE_RETRY_DELAY_MS = 15 * 1000;          // 15 giây
export const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;       // 1 giờ

// ============================================================================
// THEO DÕI TIẾN TRÌNH QUEUE EXECUTION & ĐIỀU PHỐI SHUTDOWN
// ============================================================================
// LƯU Ý KIẾN TRÚC QUAN TRỌNG:
// activeQueueExecutionsCount đếm số lời gọi processQueue() đang thực thi ở tầng ứng dụng
// (bao gồm cả Worker định kỳ và API controllers).
// Khi activeQueueExecutionsCount === 0:
// - ĐỒNG NGHĨA VỚI: Không còn thao tác truy vấn Database/Prisma nào đang chạy trong Queue.
// - KHÔNG ĐỒNG NGHĨA VỚI: Mọi socket TCP/HTTP phía Storage đã đóng hoàn toàn trên mạng.
//   (Nếu Storage timeout xảy ra, gói tin có thể vẫn đang được Supabase xử lý ngầm).
// ============================================================================
let activeQueueExecutionsCount = 0;
let isQueueShuttingDownFlag = false;

export function getActiveQueueExecutionsCount() {
  return activeQueueExecutionsCount;
}

export function isQueueShuttingDown() {
  return isQueueShuttingDownFlag;
}

export function setQueueShutdownFlag(val = true) {
  isQueueShuttingDownFlag = Boolean(val);
}

/**
 * Thiết lập số lượng active executions phục vụ test (chỉ dùng trong test).
 * @param {number} count
 */
export function setTestActiveQueueExecutionsCount(count) {
  if (process.env.NODE_ENV !== 'test') return;
  activeQueueExecutionsCount = count;
}

/**
 * Reset trạng thái test hook và shutdown flag (chỉ dùng trong test).
 */
export function resetQueueTestState() {
  if (process.env.NODE_ENV !== 'test') return;
  testEnqueueHook = null;
  testProcessQueueHook = null;
  isQueueShuttingDownFlag = false;
  activeQueueExecutionsCount = 0;
}

/**
 * Tính toán thời điểm retry tiếp theo theo Exponential Backoff có kèm Jitter ngẫu nhiên.
 * Công thức: delay = min(baseDelay * 2^(retryCount), maxDelay) + jitter
 *
 * @param {number} retryCount - Số lần đã thử thất bại
 * @param {number} [baseDelayMs=BASE_RETRY_DELAY_MS]
 * @param {number} [maxDelayMs=MAX_RETRY_DELAY_MS]
 * @returns {Date}
 */
export function calculateNextRetryAt(retryCount, baseDelayMs = BASE_RETRY_DELAY_MS, maxDelayMs = MAX_RETRY_DELAY_MS) {
  const expFactor = Math.pow(2, Math.max(0, retryCount));
  const rawDelay = baseDelayMs * expFactor;
  const cappedDelay = Math.min(rawDelay, maxDelayMs);
  // Jitter từ 0% đến 20% của cappedDelay để tránh xung đột chu kỳ hàng loạt
  const jitter = Math.floor(Math.random() * (cappedDelay * 0.2));
  return new Date(Date.now() + cappedDelay + jitter);
}

/**
 * Phân loại lỗi Storage để quyết định chiến lược xử lý:
 * - FATAL: Lỗi cấu hình/quyền không thể phục hồi (sai bucket, bucket không tồn tại, API key sai, 401/403) -> FAILED ngay.
 * - ALREADY_DELETED: Chỉ khi có bằng chứng CỤ THỂ object/file không tồn tại -> Hoàn tất idempotent (COMPLETED).
 * - TRANSIENT: Lỗi mạng, timeout, 5xx, 429, DNS ENOTFOUND, Gateway/Route 404, Generic 404, lỗi không xác định -> Retry backoff (PENDING).
 *
 * @param {any} errOrResult - Đối tượng lỗi hoặc kết quả trả về từ storageDeleteFn
 * @returns {string} Thuộc STORAGE_ERROR_TYPE
 */
export function classifyStorageError(errOrResult) {
  if (!errOrResult) return STORAGE_ERROR_TYPE.TRANSIENT;

  const rawMessage = (
    errOrResult.message ||
    errOrResult.error?.message ||
    errOrResult.error ||
    (typeof errOrResult === 'string' ? errOrResult : '')
  );
  const message = String(rawMessage).toLowerCase();

  const statusCode = Number(
    errOrResult.status ||
    errOrResult.statusCode ||
    errOrResult.error?.status ||
    errOrResult.error?.statusCode ||
    0
  );

  const rawName =
    errOrResult.name ||
    errOrResult.code ||
    errOrResult.error?.name ||
    errOrResult.error?.code ||
    '';
  const errorName = String(rawName).toLowerCase();

  // =========================================================================
  // ƯU TIÊN 1 – FATAL (Kiểm tra lỗi cấu hình, quyền, và Bucket TRƯỚC HẾT)
  // Tuyệt đối không để các từ khóa '404' hay 'not found' ghi đè kết quả FATAL.
  // =========================================================================
  if (errOrResult.isFatal === true || errOrResult.error?.isFatal === true) {
    return STORAGE_ERROR_TYPE.FATAL;
  }

  // 1.1. Lỗi liên quan đến Bucket (sai bucket, bucket không tồn tại, bucket 404)
  const isBucketError =
    errorName === 'nosuchbucket' ||
    message.includes('nosuchbucket') ||
    message.includes('invalid bucket') ||
    message.includes('bucket not found') ||
    message.includes('bucket does not exist') ||
    (message.includes('bucket') && (
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('not exist') ||
      message.includes('invalid') ||
      statusCode === 404
    ));

  if (isBucketError) {
    return STORAGE_ERROR_TYPE.FATAL;
  }

  // 1.2. Lỗi liên quan đến API Key / Credentials / Auth (401 hoặc từ khóa auth)
  const isAuthError =
    statusCode === 401 ||
    message.includes('invalid api key') ||
    message.includes('invalid credentials') ||
    message.includes('unauthorized') ||
    (message.includes('api key') && (message.includes('invalid') || message.includes('not found') || message.includes('expired'))) ||
    (message.includes('jwt') && (message.includes('invalid') || message.includes('expired') || message.includes('malformed')));

  if (isAuthError) {
    return STORAGE_ERROR_TYPE.FATAL;
  }

  // 1.3. Lỗi liên quan đến Phân quyền (Permission / Forbidden 403)
  const isPermissionError =
    statusCode === 403 ||
    message.includes('permission denied') ||
    message.includes('forbidden') ||
    message.includes('access denied');

  if (isPermissionError) {
    return STORAGE_ERROR_TYPE.FATAL;
  }

  // 1.4. Lỗi cấu hình Project hoặc đường dẫn bất thường
  const isConfigOrMalformedError =
    message.includes('invalid project') ||
    message.includes('project not found') ||
    message.includes('invalid key') ||
    message.includes('invalid path') ||
    message.includes('malformed') ||
    message.includes('security_alert');

  if (isConfigOrMalformedError) {
    return STORAGE_ERROR_TYPE.FATAL;
  }

  // =========================================================================
  // ƯU TIÊN 2 – ALREADY_DELETED (Chỉ khi có bằng chứng CỤ THỂ object không tồn tại)
  // Yêu cầu:
  // - Không sử dụng HTTP 404 đơn lẻ làm điều kiện đủ.
  // - Không sử dụng message.includes('404') làm điều kiện đủ.
  // - Không sử dụng message.includes('not found') chung chung làm điều kiện đủ.
  // - Không nhận nhầm DNS ENOTFOUND, Route 404, Gateway 404, Project 404.
  // =========================================================================
  const isInfrastructureOrDnsError =
    errorName === 'enotfound' ||
    message.includes('enotfound') ||
    message.includes('getaddrinfo') ||
    message.includes('route') ||
    message.includes('gateway') ||
    message.includes('endpoint') ||
    message.includes('upstream') ||
    message.includes('cloudflare');

  if (!isInfrastructureOrDnsError) {
    const isObjectSpecificNotFound =
      errorName === 'nosuchkey' ||
      message.includes('nosuchkey') ||
      message.includes('object not found') ||
      message.includes('object does not exist') ||
      message.includes('the specified key does not exist') ||
      message.includes('file not found') ||
      message.includes('file does not exist') ||
      message.includes('the resource was not found on remote storage') ||
      errOrResult.alreadyDeleted === true ||
      errOrResult.code === 'ENOENT';

    if (isObjectSpecificNotFound) {
      return STORAGE_ERROR_TYPE.ALREADY_DELETED;
    }
  }

  // =========================================================================
  // ƯU TIÊN 3 – TRANSIENT (Mọi lỗi tạm thời hoặc lỗi không đủ căn cứ xác định)
  // Bao gồm: ETIMEDOUT, ECONNRESET, ENOTFOUND, 429, 5xx, generic 404, lỗi không xác định
  // =========================================================================
  return STORAGE_ERROR_TYPE.TRANSIENT;
}

let testEnqueueHook = null;
/**
 * Cho phép thiết lập hook can thiệp phục vụ Unit Test.
 * @param {Function|null} hook
 */
export function setTestEnqueueHook(hook = null) {
  if (process.env.NODE_ENV !== 'test') return;
  testEnqueueHook = hook;
}

/**
 * Đưa tác vụ dọn dẹp vào hàng đợi một cách an toàn và nguyên tử.
 *
 * Chiến lược:
 * 1. Nếu client hỗ trợ raw SQL (PostgreSQL), ưu tiên:
 *    INSERT INTO ... ON CONFLICT ("filePath", "bucketName") WHERE status IN ('PENDING', 'PROCESSING') DO NOTHING RETURNING *
 *    -> Giải pháp này không ném ngoại lệ khi có conflict, do đó KHÔNG làm hỏng trạng thái PostgreSQL transaction.
 * 2. Fallback: Kiểm tra findFirst() cho bản ghi active trước, sau đó create().
 *
 * @param {Object|Array<Object>} items - { filePath, bucketName?, reason, maxRetries? }
 * @param {Object} [client=prisma] - Prisma client hoặc Transaction client (tx)
 * @returns {Promise<Array<Object>>}
 */
export async function enqueueCleanup(items, client = prisma) {
  if (testEnqueueHook) {
    return testEnqueueHook(items, client);
  }

  if (!items) return [];
  const rawList = Array.isArray(items) ? items : [items];
  const validItems = rawList.filter((item) => item && typeof item.filePath === 'string' && item.filePath.trim().length > 0);

  if (validItems.length === 0) return [];

  const createdJobs = [];
  const now = new Date();

  for (const item of validItems) {
    const cleanPath = item.filePath.trim();
    const bucket = item.bucketName || DEFAULT_BUCKET;
    const reason = item.reason || 'DELETE_UNSPECIFIED';
    const maxRetries = item.maxRetries || DEFAULT_MAX_RETRIES;

    // 1. Thử dùng PostgreSQL ON CONFLICT DO NOTHING nếu client hỗ trợ $queryRaw (an toàn trong transaction)
    if (typeof client.$queryRaw === 'function') {
      try {
        const rows = await client.$queryRaw`
          INSERT INTO "STORAGE_CLEANUP_QUEUE" (
            "filePath", "bucketName", "reason", "status", "retryCount", "maxRetries", "nextRetryAt", "created_at", "updated_at"
          )
          VALUES (
            ${cleanPath}, ${bucket}, ${reason}, 'PENDING', 0, ${maxRetries}, ${now}, ${now}, ${now}
          )
          ON CONFLICT ("filePath", "bucketName") WHERE status IN ('PENDING', 'PROCESSING')
          DO NOTHING
          RETURNING *;
        `;

        if (Array.isArray(rows) && rows.length > 0) {
          createdJobs.push(rows[0]);
          continue;
        }

        // Nếu 0 rows được trả về do conflict, query lại bản ghi active hiện tại (transaction vẫn hoàn toàn nguyên vẹn)
        const existing = await client.sTORAGE_CLEANUP_QUEUE.findFirst({
          where: {
            filePath: cleanPath,
            bucketName: bucket,
            status: { in: [QUEUE_STATUS.PENDING, QUEUE_STATUS.PROCESSING] },
          },
        });
        if (existing) {
          createdJobs.push(existing);
          continue;
        }
      } catch {
        // Fallback sang Prisma Client tiêu chuẩn nếu môi trường mock/test không hỗ trợ queryRaw
      }
    }

    // 2. Fallback tiêu chuẩn qua Prisma Client
    const existing = await client.sTORAGE_CLEANUP_QUEUE.findFirst({
      where: {
        filePath: cleanPath,
        bucketName: bucket,
        status: { in: [QUEUE_STATUS.PENDING, QUEUE_STATUS.PROCESSING] },
      },
    });

    if (existing) {
      createdJobs.push(existing);
      continue;
    }

    try {
      const job = await client.sTORAGE_CLEANUP_QUEUE.create({
        data: {
          filePath: cleanPath,
          bucketName: bucket,
          reason: reason,
          status: QUEUE_STATUS.PENDING,
          retryCount: 0,
          maxRetries: maxRetries,
          nextRetryAt: now,
        },
      });
      createdJobs.push(job);
    } catch (err) {
      // Trường hợp race condition trong mock/Prisma client: lấy lại job active do request đồng thời vừa tạo
      const concurrentJob = await client.sTORAGE_CLEANUP_QUEUE.findFirst({
        where: {
          filePath: cleanPath,
          bucketName: bucket,
          status: { in: [QUEUE_STATUS.PENDING, QUEUE_STATUS.PROCESSING] },
        },
      });
      if (concurrentJob) {
        createdJobs.push(concurrentJob);
      } else {
        throw err;
      }
    }
  }

  return createdJobs;
}

/**
 * Nhận (claim) các tác vụ cần dọn dẹp một cách nguyên tử kèm Fencing Token (`lockToken`).
 *
 * NGUYÊN TẮC:
 * - CHỈ claim các job có status = 'PENDING', retryCount < maxRetries và nextRetryAt <= now.
 * - TUYỆT ĐỐI KHÔNG claim trực tiếp các job 'PROCESSING' đã hết hạn lock (các job này thuộc trách nhiệm DUY NHẤT của resetStaleProcessingJobs).
 * - Mỗi lần claim cấp một UUID `lockToken` mới.
 * - Chỉ trả về các job claim thành công.
 *
 * @param {number} [limit=10]
 * @param {Object} [client=prisma]
 * @returns {Promise<Array<Object>>} Danh sách job đã claim (mỗi job có lockToken duy nhất)
 */
export async function claimJobs(limit = 10, client = prisma) {
  const now = new Date();

  // 1. Ưu tiên PostgreSQL FOR UPDATE SKIP LOCKED
  if (typeof client.$queryRaw === 'function' && typeof client.$transaction === 'function') {
    try {
      const rows = await client.$transaction(async (tx) => {
        return await tx.$queryRaw`
          WITH candidate AS (
            SELECT id FROM "STORAGE_CLEANUP_QUEUE"
            WHERE status = 'PENDING'
              AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ${now})
              AND "retryCount" < "maxRetries"
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          UPDATE "STORAGE_CLEANUP_QUEUE" q
          SET status = 'PROCESSING',
              "lockedAt" = ${now},
              "lockToken" = gen_random_uuid()::text,
              updated_at = ${now}
          FROM candidate
          WHERE q.id = candidate.id
          RETURNING q.*;
        `;
      });
      if (Array.isArray(rows) && rows.length > 0) {
        return rows;
      }
    } catch {
      // Fallback sang Prisma updateMany nếu raw query không khả dụng
    }
  }

  // 2. Fallback: Khóa nguyên tử qua Prisma Client có điều kiện PENDING kèm lockToken
  const candidates = await client.sTORAGE_CLEANUP_QUEUE.findMany({
    where: {
      status: QUEUE_STATUS.PENDING,
      retryCount: { lt: DEFAULT_MAX_RETRIES },
      OR: [
        { nextRetryAt: null },
        { nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { created_at: 'asc' },
    take: limit,
  });

  if (!candidates || candidates.length === 0) return [];

  // Lọc nghiêm ngặt: Đảm bảo retryCount < maxRetries của từng job (đồng bộ với điều kiện raw SQL)
  const validCandidates = candidates.filter(
    (job) => typeof job.maxRetries !== 'number' || job.retryCount < job.maxRetries
  );

  if (validCandidates.length === 0) return [];

  const claimed = [];
  for (const job of validCandidates) {
    const token = crypto.randomUUID();

    // Điều kiện nguyên tử: Chỉ claim nếu job vẫn còn PENDING
    const result = await client.sTORAGE_CLEANUP_QUEUE.updateMany({
      where: {
        id: job.id,
        status: QUEUE_STATUS.PENDING,
      },
      data: {
        status: QUEUE_STATUS.PROCESSING,
        lockedAt: now,
        lockToken: token,
      },
    });

    if (result && result.count === 1) {
      claimed.push({
        ...job,
        status: QUEUE_STATUS.PROCESSING,
        lockedAt: now,
        lockToken: token,
      });
    }
  }

  return claimed;
}

/**
 * Đánh dấu job hoàn thành với kiểm tra BẮT BUỘC Fencing Token (`lockToken`).
 *
 * Yêu cầu nghiêm ngặt:
 * 1. `lockToken` bắt buộc phải là chuỗi không rỗng. Không có token, null, undefined -> TỪ CHỐI NGAY.
 * 2. Cập nhật chỉ thành công khi `id`, `status: 'PROCESSING'` và `lockToken` cùng khớp chính xác.
 * 3. Xóa `lockToken` và `lockedAt` khi hoàn tất.
 *
 * @param {number} id
 * @param {string} lockToken - BẮT BUỘC
 * @param {Object} [client=prisma]
 * @returns {Promise<boolean>}
 */
export async function completeJob(id, lockToken, client = prisma) {
  if (!id || typeof lockToken !== 'string' || lockToken.trim().length === 0) {
    return false;
  }

  const cleanToken = lockToken.trim();

  const result = await client.sTORAGE_CLEANUP_QUEUE.updateMany({
    where: {
      id,
      status: QUEUE_STATUS.PROCESSING,
      lockToken: cleanToken,
    },
    data: {
      status: QUEUE_STATUS.COMPLETED,
      lastError: null,
      lockedAt: null,
      lockToken: null,
    },
  });

  return Boolean(result && result.count === 1);
}

/**
 * Xử lý khi thao tác Storage thất bại với kiểm tra BẮT BUỘC Fencing Token (`lockToken`).
 *
 * Yêu cầu nghiêm ngặt:
 * 1. `lockToken` bắt buộc phải là chuỗi không rỗng. Không có token, null, undefined -> TỪ CHỐI NGAY (trả về null).
 * 2. Cập nhật chỉ thực hiện khi `id`, `status: 'PROCESSING'` và `lockToken` cùng khớp chính xác.
 * 3. Tăng `retryCount` đúng 1.
 * 4. Nếu `isFatal` hoặc `retryCount >= maxRetries` -> chuyển `FAILED`. Ngược lại -> chuyển `PENDING` kèm backoff.
 * 5. Xóa `lockToken` và `lockedAt` sau khi chuyển trạng thái.
 *
 * @param {number} id
 * @param {string|Error} errorMessage
 * @param {Object} [options={}] - { isFatal?: boolean }
 * @param {string} lockToken - BẮT BUỘC
 * @param {Object} [client=prisma]
 * @returns {Promise<Object|null>}
 */
export async function failJob(id, errorMessage, options = {}, lockToken, client = prisma) {
  if (!id || typeof lockToken !== 'string' || lockToken.trim().length === 0) {
    return null;
  }

  const cleanToken = lockToken.trim();
  const isFatal = Boolean(options.isFatal);

  const current = await client.sTORAGE_CLEANUP_QUEUE.findFirst({
    where: {
      id,
      status: QUEUE_STATUS.PROCESSING,
      lockToken: cleanToken,
    },
  });

  if (!current) {
    // Không tìm thấy hoặc lockToken không khớp (worker đã mất quyền sở hữu)
    return null;
  }

  const nextRetryCount = current.retryCount + 1;
  const isMaxReached = nextRetryCount >= current.maxRetries;
  const shouldFail = isFatal || isMaxReached;

  const nextStatus = shouldFail ? QUEUE_STATUS.FAILED : QUEUE_STATUS.PENDING;
  const nextRetryAt = shouldFail ? null : calculateNextRetryAt(nextRetryCount);
  const formattedError = errorMessage ? String(errorMessage.message || errorMessage).slice(0, 1000) : 'Lỗi không xác định';

  const result = await client.sTORAGE_CLEANUP_QUEUE.updateMany({
    where: {
      id,
      status: QUEUE_STATUS.PROCESSING,
      lockToken: cleanToken,
    },
    data: {
      status: nextStatus,
      retryCount: nextRetryCount,
      nextRetryAt: nextRetryAt,
      lastError: formattedError,
      lockedAt: null,
      lockToken: null,
    },
  });

  if (result && result.count === 1) {
    return {
      ...current,
      status: nextStatus,
      retryCount: nextRetryCount,
      nextRetryAt,
      lastError: formattedError,
      lockToken: null,
    };
  }

  return null;
}

/**
 * Phục hồi các job PROCESSING bị treo (do worker crash hoặc timeout quá thời gian lock).
 * ĐÂY LÀ CƠ CHẾ DUY NHẤT XỬ LÝ JOB PROCESSING STALE TRONG TOÀN HỆ THỐNG.
 *
 * Quy tắc phục hồi nguyên tử:
 * 1. Với job có retryCount + 1 >= maxRetries:
 *    - Tăng retryCount đúng 1.
 *    - Chuyển sang FAILED.
 *    - Xóa lockedAt và lockToken.
 * 2. Với job có retryCount + 1 < maxRetries:
 *    - Tăng retryCount đúng 1.
 *    - Chuyển về PENDING.
 *    - Tính nextRetryAt với Exponential Backoff.
 *    - Xóa lockedAt và lockToken.
 *
 * Kiểm tra điều kiện nguyên tử: Chỉ cập nhật khi job VẪN ĐANG Ở 'PROCESSING' VÀ 'lockedAt < staleThreshold'.
 * Không bao giờ cướp lock còn hiệu lực và không tăng retry hai lần.
 *
 * @param {number} [staleTimeoutMs=DEFAULT_LOCK_TIMEOUT_MS] - Mặc định 10 phút
 * @param {Object} [client=prisma]
 * @returns {Promise<{ recovered: number, failed: number }>}
 */
export async function resetStaleProcessingJobs(staleTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS, client = prisma) {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - staleTimeoutMs);

  // Tìm các job stale đang ở PROCESSING quá hạn khóa
  const staleCandidates = await client.sTORAGE_CLEANUP_QUEUE.findMany({
    where: {
      status: QUEUE_STATUS.PROCESSING,
      lockedAt: { lt: staleThreshold },
    },
    orderBy: { created_at: 'asc' },
  });

  if (!staleCandidates || staleCandidates.length === 0) {
    return { recovered: 0, failed: 0 };
  }

  let recoveredCount = 0;
  let failedCount = 0;

  for (const job of staleCandidates) {
    const nextRetry = job.retryCount + 1;
    const isExhausted = nextRetry >= job.maxRetries;

    if (isExhausted) {
      // 1. Quá ngưỡng retry -> Chuyển sang FAILED nguyên tử kèm tăng retryCount đúng 1
      const failRes = await client.sTORAGE_CLEANUP_QUEUE.updateMany({
        where: {
          id: job.id,
          status: QUEUE_STATUS.PROCESSING,
          lockedAt: { lt: staleThreshold },
        },
        data: {
          status: QUEUE_STATUS.FAILED,
          retryCount: nextRetry,
          lastError: 'Job bị treo quá thời gian khóa (lock timeout) và đã đạt ngưỡng retry tối đa',
          lockedAt: null,
          lockToken: null,
        },
      });

      if (failRes && failRes.count === 1) {
        failedCount++;
      }
    } else {
      // 2. Còn lượt retry -> Chuyển về PENDING nguyên tử kèm tăng retryCount đúng 1 và backoff
      const nextRetryAt = calculateNextRetryAt(nextRetry);

      const updateRes = await client.sTORAGE_CLEANUP_QUEUE.updateMany({
        where: {
          id: job.id,
          status: QUEUE_STATUS.PROCESSING,
          lockedAt: { lt: staleThreshold },
        },
        data: {
          status: QUEUE_STATUS.PENDING,
          retryCount: nextRetry,
          nextRetryAt: nextRetryAt,
          lastError: 'Job bị treo quá thời gian khóa; tự động phục hồi về PENDING',
          lockedAt: null,
          lockToken: null,
        },
      });

      if (updateRes && updateRes.count === 1) {
        recoveredCount++;
      }
    }
  }

  return {
    recovered: recoveredCount,
    failed: failedCount,
  };
}

let testProcessQueueHook = null;
/**
 * Cho phép thiết lập hook processQueue can thiệp phục vụ Unit Test.
 * @param {Function|null} hook
 */
export function setTestProcessQueueHook(hook = null) {
  if (process.env.NODE_ENV !== 'test') return;
  testProcessQueueHook = hook;
}

/**
 * Quét và thực thi 1 đợt dọn dẹp hàng đợi với Fencing Token và Idempotent error handling.
 *
 * @param {Function} storageDeleteFn - async (filePath, bucketName) => { success: boolean, error?: any }
 * @param {number} [batchSize=DEFAULT_BATCH_SIZE]
 * @param {Object} [client=prisma]
 * @param {Object} [options={}] - { storageWaitTimeoutMs?: number, shouldStop?: Function }
 * @returns {Promise<{ processed: number, succeeded: number, failed: number }>}
 */
export async function processQueue(storageDeleteFn, batchSize = DEFAULT_BATCH_SIZE, client = prisma, options = {}) {
  if (testProcessQueueHook) {
    return testProcessQueueHook(storageDeleteFn, batchSize, client, options);
  }

  if (typeof storageDeleteFn !== 'function') {
    throw new Error('storageDeleteFn bắt buộc phải là một hàm (function).');
  }

  const shouldStopFn = () => isQueueShuttingDown() || Boolean(options?.shouldStop && options.shouldStop());

  // Nếu hệ thống đang trong quá trình shutdown hoặc worker đang dừng, không nhận thêm batch mới
  if (shouldStopFn()) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  activeQueueExecutionsCount++;
  try {
    const jobs = await claimJobs(batchSize, client);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      // Nếu nhận tín hiệu shutdown hoặc worker stopping giữa chừng:
      // Ngừng xử lý các job tiếp theo và hoàn trả nguyên tử các job chưa kịp chạy về PENDING
      if (shouldStopFn()) {
        const unhandledJobs = jobs.slice(i);
        for (const unhandled of unhandledJobs) {
          try {
            await client.sTORAGE_CLEANUP_QUEUE.updateMany({
              where: {
                id: unhandled.id,
                lockToken: unhandled.lockToken,
                status: QUEUE_STATUS.PROCESSING,
              },
              data: {
                status: QUEUE_STATUS.PENDING,
                lockedAt: null,
                lockToken: null,
              },
            });
          } catch (err) {
            console.error(
              `[QUEUE_SHUTDOWN_WARN] Lỗi khi hoàn trả job #${unhandled.id} về PENDING:`,
              err.message
            );
          }
        }
        break;
      }

      // Thiết lập timeout chờ cho Promise Storage (STORAGE_WAIT_TIMEOUT_MS)
      // LƯU Ý KỸ THUẬT: Đây là thời gian tối đa client chấp nhận CHỜ phản hồi.
      // Nó KHÔNG bảo đảm gói tin HTTP DELETE phía Supabase đã bị hủy trên mạng.
      const waitTimeoutMs = options?.storageWaitTimeoutMs || DEFAULT_STORAGE_WAIT_TIMEOUT_MS;
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error(`STORAGE_WAIT_TIMEOUT: Vượt quá thời gian chờ ${waitTimeoutMs}ms`);
          err.isTimeout = true;
          reject(err);
        }, waitTimeoutMs);
      });

      try {
        let result;
        try {
          result = await Promise.race([
            storageDeleteFn(job.filePath, job.bucketName),
            timeoutPromise,
          ]);
        } finally {
          clearTimeout(timeoutId);
        }

        if (result && result.success === false) {
          const errorCategory = classifyStorageError(result);

          if (errorCategory === STORAGE_ERROR_TYPE.ALREADY_DELETED) {
            // File đã không còn trên Storage -> Coi là hoàn tất (Idempotent Success)
            const ok = await completeJob(job.id, job.lockToken, client);
            if (ok) succeeded++;
          } else if (errorCategory === STORAGE_ERROR_TYPE.FATAL) {
            // Lỗi vĩnh viễn -> Đánh dấu FAILED ngay, không retry
            await failJob(job.id, result.error, { isFatal: true }, job.lockToken, client);
            failed++;
          } else {
            // Lỗi tạm thời -> Retry với Exponential Backoff
            await failJob(job.id, result.error, { isFatal: false }, job.lockToken, client);
            failed++;
          }
        } else {
          // Chỉ đánh dấu COMPLETED khi nhận được kết quả xác nhận thành công từ Storage
          const ok = await completeJob(job.id, job.lockToken, client);
          if (ok) succeeded++;
        }
      } catch (err) {
        const errorCategory = classifyStorageError(err);

        if (errorCategory === STORAGE_ERROR_TYPE.ALREADY_DELETED) {
          const ok = await completeJob(job.id, job.lockToken, client);
          if (ok) succeeded++;
        } else if (errorCategory === STORAGE_ERROR_TYPE.FATAL) {
          await failJob(job.id, err.message, { isFatal: true }, job.lockToken, client);
          failed++;
        } else {
          // Lỗi tạm thời (bao gồm cả STORAGE_WAIT_TIMEOUT) -> retry theo exponential backoff
          await failJob(job.id, err.message, { isFatal: false }, job.lockToken, client);
          failed++;
        }
      }
    }

    return { processed: jobs.length, succeeded, failed };
  } finally {
    activeQueueExecutionsCount--;
  }
}

/**
 * Khởi động background worker chạy định kỳ với hỗ trợ Drain-Fast và Graceful Stop.
 *
 * @param {Function} storageDeleteFn
 * @param {Object|number} [optionsOrInterval=DEFAULT_POLL_INTERVAL_MS] - Object options hoặc intervalMs (backward-compat)
 * @param {Object} [client=prisma]
 * @returns {{ stop: Function, triggerNow: Function, isEnabled: boolean, isRunning: Function, isStopping: Function, getActiveTickPromise: Function }}
 */
export function startCleanupWorker(storageDeleteFn, optionsOrInterval = DEFAULT_POLL_INTERVAL_MS, client = prisma) {
  const isEnabled = process.env.STORAGE_CLEANUP_WORKER_ENABLED !== 'false';
  if (!isEnabled) {
    console.log('[STORAGE_CLEANUP_WORKER] Worker bị vô hiệu hóa qua cấu hình STORAGE_CLEANUP_WORKER_ENABLED=false.');
    return {
      stop: () => Promise.resolve({ stopped: true, timedOut: false }),
      triggerNow: async () => ({ processed: 0, succeeded: 0, failed: 0 }),
      isEnabled: false,
      isRunning: () => false,
      isStopping: () => false,
      getActiveTickPromise: () => null,
    };
  }

  const options = typeof optionsOrInterval === 'number'
    ? { intervalMs: optionsOrInterval }
    : (optionsOrInterval || {});

  const intervalMs = options.intervalMs || DEFAULT_POLL_INTERVAL_MS;
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const staleTimeoutMs = options.staleTimeoutMs || DEFAULT_LOCK_TIMEOUT_MS;
  const storageWaitTimeoutMs = options.storageWaitTimeoutMs || DEFAULT_STORAGE_WAIT_TIMEOUT_MS;
  const maxDrainIterations = options.maxDrainIterations || MAX_DRAIN_ITERATIONS;

  let isRunning = false;
  let isStopping = false;
  let timer = null;
  let activeTickPromise = null;

  const shouldStopFn = () => isStopping || isQueueShuttingDown();

  const runTick = () => {
    // Chống hai tick chạy chồng lấn và không chạy khi worker đang dừng hoặc queue đang shutdown
    if (isRunning || shouldStopFn()) {
      return activeTickPromise || Promise.resolve({ processed: 0, succeeded: 0, failed: 0 });
    }

    isRunning = true;
    activeTickPromise = (async () => {
      try {
        // 1. Phục hồi các job PROCESSING bị treo (stale lock recovery)
        await resetStaleProcessingJobs(staleTimeoutMs, client).catch((err) => {
          console.error('[STORAGE_CLEANUP_WORKER] Lỗi khi phục hồi job treo:', err.message);
        });

        // 2. Chế độ Drain-Fast: Lặp tối đa maxDrainIterations nếu batch đầy
        let drainLoops = 0;
        const totalResult = { processed: 0, succeeded: 0, failed: 0 };
        while (!shouldStopFn() && drainLoops < maxDrainIterations) {
          drainLoops++;
          const res = await processQueue(storageDeleteFn, batchSize, client, {
            storageWaitTimeoutMs,
            shouldStop: shouldStopFn,
          });
          if (res) {
            totalResult.processed += res.processed;
            totalResult.succeeded += res.succeeded;
            totalResult.failed += res.failed;
          }
          // Nếu số job claim được < batchSize, queue đã cạn hoặc không có thêm job -> Dừng drain
          if (!res || res.processed < batchSize) {
            break;
          }
        }
        return totalResult;
      } catch (err) {
        console.error('[STORAGE_CLEANUP_WORKER] Lỗi chu kỳ dọn dẹp:', err.message);
        return { processed: 0, succeeded: 0, failed: 0 };
      } finally {
        isRunning = false;
        activeTickPromise = null;
      }
    })();

    return activeTickPromise;
  };

  // Initial Tick khi Worker khởi động
  runTick();

  // Polling định kỳ: KHÔNG gán đè activeTickPromise khi runTick() trả về
  timer = setInterval(() => {
    if (!shouldStopFn()) {
      runTick();
    }
  }, intervalMs);

  return {
    stop: async (stopOptions = {}) => {
      isStopping = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      const timeoutMs = stopOptions?.timeoutMs || 20000;
      if (activeTickPromise && isRunning) {
        let stopTimeoutId;
        let didTimeout = false;
        const stopTimeoutPromise = new Promise((resolve) => {
          stopTimeoutId = setTimeout(() => {
            didTimeout = true;
            resolve();
          }, timeoutMs);
        });

        try {
          await Promise.race([activeTickPromise, stopTimeoutPromise]);
        } finally {
          clearTimeout(stopTimeoutId);
        }

        if (didTimeout && isRunning) {
          return { stopped: false, timedOut: true };
        }
      }

      return { stopped: true, timedOut: false };
    },
    triggerNow: () => {
      if (shouldStopFn()) {
        return Promise.resolve({ processed: 0, succeeded: 0, failed: 0 });
      }
      return runTick();
    },
    isEnabled: true,
    isRunning: () => isRunning,
    isStopping: () => isStopping,
    getActiveTickPromise: () => activeTickPromise,
  };
}
