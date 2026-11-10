// server.js
import 'dotenv/config'; // Tải biến môi trường (thay cho require('dotenv').config())
import express from 'express';
import path from 'path'; 
import { fileURLToPath } from 'url'; 
import cors from 'cors';

import prisma from './config/prisma.js';
import adminRoute from './routes/admin.route.js';
import homestayRoute from './routes/homestay.route.js';
import ownerRoute from './routes/owner.route.js';
import authRoute from './routes/auth.route.js'; 
import bookingRoute from './routes/booking.route.js';
import complaintRoute from './routes/complaint.route.js';

import { deleteFileFromStorage, validateStorageConfig } from './services/storage.service.js';
import {
  startCleanupWorker,
  setQueueShutdownFlag,
  getActiveQueueExecutionsCount,
  DEFAULT_BATCH_SIZE,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_STORAGE_WAIT_TIMEOUT_MS,
  MAX_DRAIN_ITERATIONS,
} from './services/storageCleanupQueue.service.js';

// --- Cấu hình đường dẫn cho ES Modules ---
// Cần 2 dòng này để lấy __dirname (đường dẫn thư mục hiện tại)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Kết thúc cấu hình đường dẫn ---

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình Background Storage Cleanup Worker từ biến môi trường
const BATCH_SIZE = parseInt(process.env.STORAGE_CLEANUP_BATCH_SIZE, 10) || DEFAULT_BATCH_SIZE;
const POLL_INTERVAL_MS = parseInt(process.env.STORAGE_CLEANUP_POLL_INTERVAL_MS, 10) || DEFAULT_POLL_INTERVAL_MS;
const STORAGE_WAIT_TIMEOUT_MS = parseInt(process.env.STORAGE_WAIT_TIMEOUT_MS, 10) || DEFAULT_STORAGE_WAIT_TIMEOUT_MS;
const STALE_LOCK_TIMEOUT_MS = parseInt(process.env.STORAGE_CLEANUP_STALE_LOCK_MS, 10) || DEFAULT_LOCK_TIMEOUT_MS;
const MAX_DRAIN = parseInt(process.env.STORAGE_CLEANUP_MAX_DRAIN, 10) || MAX_DRAIN_ITERATIONS;
const IS_WORKER_ENABLED = process.env.STORAGE_CLEANUP_WORKER_ENABLED !== 'false';

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 20000;
export const MIN_SHUTDOWN_TIMEOUT_MS = 5000;
export const MAX_SHUTDOWN_TIMEOUT_MS = 300000;

/**
 * Parse và validate nghiêm ngặt STORAGE_CLEANUP_SHUTDOWN_TIMEOUT_MS từ biến môi trường.
 * Quy tắc:
 * 1. Chỉ chấp nhận chuỗi số nguyên hợp lệ /^\d+$/.
 * 2. Không chấp nhận số âm, số thập phân, chuỗi chứa ký tự thừa (5000abc), chuỗi rỗng.
 * 3. Giới hạn hợp lệ: MIN_SHUTDOWN_TIMEOUT_MS (5.000ms) <= parsed <= MAX_SHUTDOWN_TIMEOUT_MS (300.000ms).
 * 4. Mọi giá trị không hợp lệ hoặc vượt ngưỡng đều phải fallback về defaultVal (mặc định 20.000ms).
 *
 * @param {string|number|undefined|null} val
 * @param {number} [defaultVal=DEFAULT_SHUTDOWN_TIMEOUT_MS]
 * @param {number} [minVal=MIN_SHUTDOWN_TIMEOUT_MS]
 * @param {number} [maxVal=MAX_SHUTDOWN_TIMEOUT_MS]
 * @returns {number}
 */
export function parseShutdownTimeoutMs(
  val,
  defaultVal = DEFAULT_SHUTDOWN_TIMEOUT_MS,
  minVal = MIN_SHUTDOWN_TIMEOUT_MS,
  maxVal = MAX_SHUTDOWN_TIMEOUT_MS
) {
  if (val === undefined || val === null || val === '') {
    return defaultVal;
  }
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    return defaultVal;
  }
  const parsed = Number(str);
  if (!Number.isSafeInteger(parsed) || parsed < minVal || parsed > maxVal) {
    return defaultVal;
  }
  return parsed;
}

export const SHUTDOWN_TIMEOUT_MS = parseShutdownTimeoutMs(process.env.STORAGE_CLEANUP_SHUTDOWN_TIMEOUT_MS);

/**
 * Phân bổ ngân sách thời gian shutdown (Timeout Budget) có Safety Buffer 15%.
 * Tỷ lệ chuẩn:
 * - Worker: 40%
 * - HTTP: 20%
 * - Queue: 15%
 * - Prisma: 10%
 * - Buffer an toàn: 15% (dự phòng trước khi hard timeout kích hoạt)
 *
 * @param {number|string} [totalTimeoutMs=SHUTDOWN_TIMEOUT_MS]
 * @returns {{ TOTAL_MS: number, WORKER_MS: number, HTTP_MS: number, QUEUE_MS: number, PRISMA_MS: number, BUFFER_MS: number }}
 */
export function calculateTimeoutBudget(totalTimeoutMs = SHUTDOWN_TIMEOUT_MS) {
  const total = parseShutdownTimeoutMs(totalTimeoutMs);
  const workerMs = Math.floor(total * 0.40);
  const httpMs = Math.floor(total * 0.20);
  const queueMs = Math.floor(total * 0.15);
  const prismaMs = Math.floor(total * 0.10);
  const bufferMs = total - (workerMs + httpMs + queueMs + prismaMs);

  return {
    TOTAL_MS: total,
    WORKER_MS: workerMs,
    HTTP_MS: httpMs,
    QUEUE_MS: queueMs,
    PRISMA_MS: prismaMs,
    BUFFER_MS: bufferMs,
  };
}

export const TIMEOUT_BUDGET = calculateTimeoutBudget(SHUTDOWN_TIMEOUT_MS);

// Quản lý trạng thái Server, Worker và Shutdown
let server = null;
let worker = null;
let isShuttingDown = false;

/**
 * Khởi động Background Worker với cơ chế xử lý lỗi an toàn.
 * Nếu worker khởi động thất bại (ví dụ ném ngoại lệ), bắt lỗi, ghi log WORKER_STARTUP_FAILED,
 * giữ worker = null để server tiếp tục phục vụ các yêu cầu HTTP bình thường.
 *
 * @param {Function} [workerFactory=startCleanupWorker]
 * @param {Function} [storageDeleteFn=deleteFileFromStorage]
 * @returns {Object|null}
 */
export function initWorker(workerFactory = startCleanupWorker, storageDeleteFn = deleteFileFromStorage) {
  if (!IS_WORKER_ENABLED) {
    console.log('[STORAGE_CLEANUP_WORKER] Background Worker bị vô hiệu hóa qua cấu hình STORAGE_CLEANUP_WORKER_ENABLED=false.');
    worker = null;
    return null;
  }
  try {
    worker = workerFactory(storageDeleteFn, {
      batchSize: BATCH_SIZE,
      intervalMs: POLL_INTERVAL_MS,
      staleTimeoutMs: STALE_LOCK_TIMEOUT_MS,
      storageWaitTimeoutMs: STORAGE_WAIT_TIMEOUT_MS,
      maxDrainIterations: MAX_DRAIN,
    }, prisma);
    console.log(`[STORAGE_CLEANUP_WORKER] Background Worker đã khởi chạy thành công (Poll: ${POLL_INTERVAL_MS}ms, Batch: ${BATCH_SIZE}, DrainMax: ${MAX_DRAIN}).`);
    return worker;
  } catch (workerErr) {
    worker = null;
    console.error(JSON.stringify({
      level: 'ERROR',
      event: 'WORKER_STARTUP_FAILED',
      message: `Khởi động Background Worker thất bại: ${workerErr.message}. Background cleanup tự động sẽ KHÔNG hoạt động trong phiên này. Các job PENDING được bảo toàn an toàn trong Database.`,
      timestamp: new Date().toISOString(),
    }));
    return null;
  }
}

/**
 * Reset trạng thái server và shutdown phục vụ Unit Test.
 */
export function resetServerTestState() {
  if (process.env.NODE_ENV !== 'test') return;
  isShuttingDown = false;
  worker = null;
}

// Middleware
app.use(cors());
app.use(express.json());

// --- Thêm Static File Server ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Chuyển tiếp /homestays/* sang Supabase Storage CDN nếu có cấu hình
app.get('/homestays/*', (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl) {
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    const objectPath = req.path.replace(/^\/+/, '');
    return res.redirect(302, `${cleanUrl}/storage/v1/object/public/homestays/${objectPath}`);
  }
  res.status(404).json({ message: 'Hình ảnh không tìm thấy.' });
});

app.use('/api/admin', adminRoute);

// Routes
app.get('/', (req, res) => {
  res.send('Chào mừng đến với Homestay API!');
});

// Gắn route API
app.use('/api/auth', authRoute);
app.use('/api/homestays', homestayRoute);
app.use('/api/owner', ownerRoute);
app.use('/api/bookings', bookingRoute);
app.use('/api/complaints', complaintRoute);

// =============================================================================
// QUY TRÌNH GRACEFUL SHUTDOWN (SIGTERM / SIGINT / SERVER_ERROR)
// =============================================================================
export async function handleGracefulShutdown(signal, options = {}) {
  if (isShuttingDown) {
    console.log(`[SHUTDOWN] Tín hiệu ${signal} bị bỏ qua vì quá trình shutdown đã bắt đầu.`);
    return;
  }
  isShuttingDown = true;
  console.log(`[SHUTDOWN] Nhận tín hiệu ${signal}. Bắt đầu quy trình Graceful Shutdown...`);

  // Cho phép inject dependency phục vụ kiểm thử đơn vị độc lập
  const dbClient = options.prismaClient || prisma;
  const exitFn = options.exitFn || process.exit;

  const hardTimeoutMs = options.forceTimeoutMs !== undefined
    ? options.forceTimeoutMs
    : (options.shutdownTimeoutMs !== undefined
        ? parseShutdownTimeoutMs(options.shutdownTimeoutMs)
        : SHUTDOWN_TIMEOUT_MS);
  const budget = options.timeoutBudget || calculateTimeoutBudget(hardTimeoutMs);

  // Hard timeout fail-safe: Nếu shutdown vượt quá hardTimeoutMs (mặc định 20s)
  // Buộc dừng process (process.exit(1)) để tránh treo container trên Render/Docker.
  // Timer được giữ referenced (không unref) để đảm bảo bộ đếm fail-safe vẫn thực thi ngay cả khi
  // event loop không còn I/O handles nào khác đang hoạt động (ví dụ: bị treo ở một Promise chưa resolve).
  // Tất cả các nhánh thoát hợp lệ của handleGracefulShutdown đều gọi clearTimeout(forceExitTimer).
  // Lưu ý kỹ thuật: Nếu Event Loop bị block đồng bộ (CPU loop), timer trong tiến trình không thể kích hoạt.
  const forceExitTimer = setTimeout(() => {
    console.error(JSON.stringify({
      level: 'CRITICAL',
      event: 'SHUTDOWN_TIMEOUT_EXCEEDED',
      message: `Quá trình Graceful Shutdown vượt quá ${hardTimeoutMs}ms. Buộc dừng process (process.exit(1)).`,
      activeQueueExecutions: getActiveQueueExecutionsCount(),
      timestamp: new Date().toISOString(),
    }));
    // KHÔNG gọi prisma.$disconnect() khi timeout cưỡng bức vì các truy vấn DB có thể vẫn đang chạy
    exitFn(1);
  }, hardTimeoutMs);

  if (typeof options.onTimerCreated === 'function') {
    options.onTimerCreated(forceExitTimer);
  }

  let workerTimedOut = false;
  let httpTimedOut = false;
  let httpCloseError = null;

  try {
    // -------------------------------------------------------------------------
    // Giai đoạn A – Ngăn công việc mới
    // -------------------------------------------------------------------------
    setQueueShutdownFlag(true);
    console.log('[SHUTDOWN] [Phase A] Đã bật cờ Queue Shutdown. Ngăn Worker nhận batch mới và chặn các lệnh processQueue mới.');

    // -------------------------------------------------------------------------
    // Giai đoạn B – Dừng Worker
    // -------------------------------------------------------------------------
    const activeWorker = options.worker !== undefined ? options.worker : worker;
    if (activeWorker && typeof activeWorker.stop === 'function') {
      const workerTimeoutMs = budget.WORKER_MS;
      console.log(`[SHUTDOWN] [Phase B] Đang dừng Background Worker (Ngân sách timeout: ${workerTimeoutMs}ms)...`);

      const stopResult = await activeWorker.stop({ timeoutMs: workerTimeoutMs });
      if (stopResult?.timedOut || !stopResult?.stopped) {
        workerTimedOut = true;
        console.warn(JSON.stringify({
          level: 'WARN',
          event: 'WORKER_STOP_TIMEOUT',
          message: `Worker không thể dừng hoàn tất trong ${workerTimeoutMs}ms. Vẫn còn tác vụ đang chạy hoặc storage timeout.`,
          timestamp: new Date().toISOString(),
        }));
      } else {
        console.log('[SHUTDOWN] [Phase B] Background Worker đã dừng an toàn.');
      }
    } else {
      console.log('[SHUTDOWN] [Phase B] Worker không hoạt động hoặc chưa được khởi tạo.');
    }

    // -------------------------------------------------------------------------
    // Giai đoạn C – Đóng HTTP Server
    // -------------------------------------------------------------------------
    const activeServer = options.server !== undefined ? options.server : server;
    if (!activeServer || !activeServer.listening) {
      // Phân biệt rõ: Server chưa từng listening (ví dụ: EADDRINUSE) hoặc đã đóng trước đó
      console.log('[SHUTDOWN] [Phase C] HTTP Server chưa từng lắng nghe (listening=false) hoặc đã đóng. Bỏ qua server.close().');
    } else {
      console.log('[SHUTDOWN] [Phase C] Đang đóng HTTP Server, ngừng tiếp nhận kết nối mới...');
      const httpCloseTimeoutMs = budget.HTTP_MS;
      let httpCloseTimer;

      const httpClosePromise = new Promise((resolve) => {
        activeServer.close((err) => {
          if (err) {
            httpCloseError = err;
            console.error('[SHUTDOWN] [Phase C] Lỗi khi đóng HTTP Server:', err.message);
            resolve({ closed: false, error: err });
          } else {
            console.log('[SHUTDOWN] [Phase C] HTTP Server đã đóng tiếp nhận request và kết nối mới thành công.');
            resolve({ closed: true });
          }
        });

        // Đóng ngay các keep-alive connections rảnh rỗi (idle sockets)
        if (typeof activeServer.closeIdleConnections === 'function') {
          activeServer.closeIdleConnections();
        }
      });

      const httpTimeoutPromise = new Promise((resolve) => {
        httpCloseTimer = setTimeout(() => {
          resolve({ closed: false, timedOut: true });
        }, httpCloseTimeoutMs);
      });

      const httpResult = await Promise.race([httpClosePromise, httpTimeoutPromise]);
      clearTimeout(httpCloseTimer);

      if (httpResult.timedOut) {
        httpTimedOut = true;
        console.warn(JSON.stringify({
          level: 'WARN',
          event: 'HTTP_SERVER_CLOSE_TIMEOUT',
          message: `HTTP Server đóng vượt quá ${httpCloseTimeoutMs}ms. Buộc đóng tất cả kết nối còn lại.`,
          timestamp: new Date().toISOString(),
        }));
        if (typeof activeServer.closeAllConnections === 'function') {
          activeServer.closeAllConnections();
        }
      }
    }

    // -------------------------------------------------------------------------
    // Giai đoạn D – Kiểm tra Queue và Ngắt Prisma Client
    // -------------------------------------------------------------------------
    console.log('[SHUTDOWN] [Phase D] Kiểm tra active Queue executions trước khi ngắt Prisma...');
    const maxQueueWaitMs = budget.QUEUE_MS;
    const pollStart = Date.now();
    while (getActiveQueueExecutionsCount() > 0 && (Date.now() - pollStart < maxQueueWaitMs)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const remainingExecutions = getActiveQueueExecutionsCount();

    // Điều kiện bảo vệ nghiêm ngặt: Nếu Worker timeout, Queue còn tồn đọng, HTTP timeout hoặc HTTP đóng có lỗi
    // -> BỎ QUA ngắt Prisma, ghi log CRITICAL và thoát exit code 1
    if (workerTimedOut || remainingExecutions > 0 || httpTimedOut || httpCloseError) {
      console.error(JSON.stringify({
        level: 'CRITICAL',
        event: 'INCOMPLETE_SHUTDOWN',
        message: 'Vẫn còn tác vụ chưa hoàn tất hoàn toàn hoặc đóng kết nối thất bại (Worker timeout, Queue dở dang, HTTP timeout/error). Bỏ qua prisma.$disconnect() để tránh lỗi và thoát với mã 1.',
        activeQueueExecutions: remainingExecutions,
        workerTimedOut,
        httpTimedOut,
        httpCloseError: httpCloseError ? httpCloseError.message : null,
        timestamp: new Date().toISOString(),
      }));
      clearTimeout(forceExitTimer);
      exitFn(1);
      return;
    }

    // Nếu mọi tác vụ trước đó hoàn tất sạch sẽ: Ngắt Prisma Client có bảo vệ Timeout
    console.log('[SHUTDOWN] [Phase D] Bắt đầu ngắt kết nối Prisma Client...');
    const prismaTimeoutMs = budget.PRISMA_MS;
    let prismaTimer;
    const prismaTimeoutPromise = new Promise((_, reject) => {
      prismaTimer = setTimeout(() => {
        reject(new Error(`PRISMA_DISCONNECT_TIMEOUT: Quá thời gian chờ ngắt kết nối (${prismaTimeoutMs}ms)`));
      }, prismaTimeoutMs);
    });

    try {
      await Promise.race([
        dbClient.$disconnect(),
        prismaTimeoutPromise,
      ]);
      clearTimeout(prismaTimer);
      console.log('[SHUTDOWN] [Phase D] Prisma Client đã ngắt kết nối an toàn.');
    } catch (dbErr) {
      clearTimeout(prismaTimer);
      console.error(JSON.stringify({
        level: 'CRITICAL',
        event: 'PRISMA_DISCONNECT_FAILED',
        message: `Ngắt kết nối Prisma Client thất bại: ${dbErr.message}`,
        stack: dbErr.stack,
        timestamp: new Date().toISOString(),
      }));
      clearTimeout(forceExitTimer);
      exitFn(1);
      return;
    }

    clearTimeout(forceExitTimer);

    if (signal === 'SERVER_ERROR') {
      console.log('[SHUTDOWN] Đã dọn dẹp tài nguyên sau lỗi khởi động HTTP Server.');
      exitFn(1);
    } else {
      console.log('[SHUTDOWN] Quá trình Graceful Shutdown hoàn tất thành công.');
      exitFn(0);
    }
  } catch (shutdownErr) {
    console.error(JSON.stringify({
      level: 'CRITICAL',
      event: 'SHUTDOWN_UNHANDLED_ERROR',
      message: `Lỗi không xác định trong quá trình Graceful Shutdown: ${shutdownErr.message}`,
      stack: shutdownErr.stack,
      timestamp: new Date().toISOString(),
    }));
    clearTimeout(forceExitTimer);
    exitFn(1);
  }
}

// Đăng ký lắng nghe tín hiệu SIGTERM và SIGINT duy nhất một lần
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// Lắng nghe server (chỉ tự động lắng nghe khi không phải môi trường test)
if (process.env.NODE_ENV !== 'test') {
  // Xác thực cấu hình Storage trong môi trường Production (Fail-Fast: AUDIT-F01)
  if (process.env.NODE_ENV === 'production') {
    try {
      validateStorageConfig();
      console.log('[STORAGE_CONFIG] Xác thực cấu hình Storage Production (Supabase) thành công.');
    } catch (cfgErr) {
      console.error(`[STORAGE_CONFIG_CRITICAL] ${cfgErr.message}`);
      process.exit(1);
    }
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://localhost:${PORT} và http://127.0.0.1:${PORT}`);
    initWorker();
  });

  // Lắng nghe lỗi khởi động HTTP Server (ví dụ: EADDRINUSE)
  server.on('error', (err) => {
    console.error(`[SERVER_ERROR] Lỗi HTTP Server: ${err.message}`);
    if (!isShuttingDown) {
      handleGracefulShutdown('SERVER_ERROR');
    }
  });
}

export { app, server };
export default app;
