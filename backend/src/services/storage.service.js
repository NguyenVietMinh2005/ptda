// backend/src/services/storage.service.js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getSupabaseClient, getSupabaseProjectHost } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục uploads mặc định (backend/uploads)
export const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
export const DEFAULT_SUPABASE_BUCKET = 'homestays';
export const MAX_EMERGENCY_BUFFER_SIZE = 500;

// In-Memory Ring Buffer khi Database ngắt kết nối
const inMemoryEmergencyBuffer = [];
let unhandledDroppedJobsCount = 0;

/**
 * Trả về driver lưu trữ hiện tại ('local' hoặc 'supabase').
 *
 * Quy tắc an toàn và Production Fail-Fast (AUDIT-F01):
 * 1. Khi NODE_ENV === 'production':
 *    - Bắt buộc phải có cấu hình STORAGE_DRIVER='supabase'.
 *    - Tuyệt đối KHÔNG tự động fallback sang 'local' khi thiếu biến STORAGE_DRIVER.
 *    - Tuyệt đối KHÔNG cho phép cấu hình STORAGE_DRIVER='local' trong production
 *      (loại trừ hoàn toàn nguy cơ mất dữ liệu ảnh trên filesystem tạm thời / ephemeral của Render Free).
 *    - Kiểm tra và xác thực sớm sự tồn tại của SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY.
 * 2. Khi NODE_ENV !== 'production' (development, test, hoặc chưa đặt):
 *    - Mặc định là 'local' nếu chưa cấu hình.
 *    - Cho phép cấu hình 'supabase' nếu nhà phát triển muốn test Supabase cục bộ.
 *
 * @returns {'local'|'supabase'}
 */
export function getStorageDriver() {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawDriver = process.env.STORAGE_DRIVER;

  if (isProduction) {
    if (!rawDriver || rawDriver.trim().length === 0) {
      throw new Error(
        '[STORAGE_CONFIG_ERROR] Thiếu biến môi trường STORAGE_DRIVER trong môi trường production. ' +
        "Bắt buộc cấu hình STORAGE_DRIVER='supabase' để đảm bảo an toàn dữ liệu ảnh trên Cloud Storage."
      );
    }
    const cleanDriver = rawDriver.toLowerCase().trim();
    if (cleanDriver !== 'supabase') {
      throw new Error(
        `[STORAGE_CONFIG_ERROR] Cấu hình STORAGE_DRIVER='${cleanDriver}' không được phép trong môi trường production. ` +
        "Chỉ chấp nhận STORAGE_DRIVER='supabase' (nguy cơ mất toàn bộ dữ liệu ảnh trên filesystem tạm thời nếu dùng local)."
      );
    }
    // Xác thực sớm credentials của Supabase (ném lỗi nếu thiếu URL hoặc Service Role Key)
    getSupabaseClient();
    return 'supabase';
  }

  const driver = (rawDriver || 'local').toLowerCase().trim();
  return driver === 'supabase' ? 'supabase' : 'local';
}

/**
 * Kiểm tra và xác thực sớm cấu hình lưu trữ Storage (Fail-Fast Verification).
 * Thường được gọi khi khởi động ứng dụng hoặc trước khi xử lý upload.
 *
 * @returns {{ driver: 'local'|'supabase', valid: boolean }}
 */
export function validateStorageConfig() {
  const driver = getStorageDriver();
  if (driver === 'supabase') {
    getSupabaseClient();
  }
  return { driver, valid: true };
}

/**
 * Phân loại và thẩm định tính an toàn của đường dẫn ảnh trước khi xóa.
 *
 * Tiêu chuẩn an toàn:
 * 1. Chống Path Traversal trên Local (dùng path.resolve và path.relative).
 * 2. Chống Symlink: Sử dụng lstat để từ chối symlink và realpath để xác minh tệp nằm trong uploads.
 * 3. Chống Null Byte Injection (\0) và ký tự điều khiển ASCII.
 * 4. Chống SSRF / Xóa nhầm tài nguyên ngoại vi: Chỉ xóa Supabase URL nếu khớp Hostname dự án và HTTPS.
 * 5. Chống traversal trên Object Key (từ chối segment '.' hoặc '..', encoded slash, ký tự ngược '\').
 * 6. Không đoán mò loại đường dẫn khi không đủ căn cứ.
 *
 * @param {string} rawPath - Chuỗi đường dẫn (URL, Object Key, hoặc Local Path)
 * @param {Object} [options={}] - { uploadsDir, supabaseUrl, bucketName }
 * @returns {Promise<{
 *   type: 'LOCAL'|'SUPABASE'|'EXTERNAL_URL'|'SECURITY_ALERT'|'INSECURE_PROTOCOL'|'WRONG_BUCKET'|'INVALID_KEY'|'UNKNOWN',
 *   isDeletable: boolean,
 *   bucketName?: string,
 *   filePath?: string,
 *   absolutePath?: string,
 *   error?: string,
 *   reason?: string
 * }>}
 */
export async function classifyAndValidateImagePath(rawPath, options = {}) {
  if (!rawPath || typeof rawPath !== 'string') {
    return { type: 'UNKNOWN', isDeletable: false, error: 'Đường dẫn rỗng hoặc không đúng kiểu chuỗi' };
  }

  const trimmed = rawPath.trim();
  if (trimmed.length === 0) {
    return { type: 'UNKNOWN', isDeletable: false, error: 'Đường dẫn rỗng' };
  }

  // 1. Chống Null Byte Injection và ký tự điều khiển ASCII
  if (trimmed.includes('\0') || /[\x00-\x1f\x7f]/.test(trimmed)) {
    return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Phát hiện null byte hoặc ký tự điều khiển' };
  }

  // 2. Kiểm tra nếu là URL (http:// hoặc https://)
  if (/^https?:\/\//i.test(trimmed)) {
    // Yêu cầu bắt buộc HTTPS cho Supabase Production
    if (trimmed.startsWith('http://')) {
      return { type: 'INSECURE_PROTOCOL', isDeletable: false, error: 'Từ chối giao thức HTTP không an toàn' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      return { type: 'UNKNOWN', isDeletable: false, error: 'URL không hợp lệ' };
    }

    const configuredHost = (
      options.supabaseHost ||
      getSupabaseProjectHost() ||
      (process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.toLowerCase() : '')
    );

    const parsedHost = parsedUrl.hostname.toLowerCase();

    // Nếu không khớp với Supabase Project cấu hình -> Coi là URL ngoại vi (Unsplash, CDN ngoài)
    if (!configuredHost || parsedHost !== configuredHost) {
      return {
        type: 'EXTERNAL_URL',
        isDeletable: false,
        url: trimmed,
        reason: 'URL ngoại vi không thuộc Supabase Project của hệ thống',
      };
    }

    // Bắt buộc URL phải có cấu trúc Supabase Storage: /storage/v1/object/public/:bucketName/:objectKey
    const storageRegex = /^\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/;
    const match = parsedUrl.pathname.match(storageRegex);

    if (!match) {
      return { type: 'UNKNOWN', isDeletable: false, error: 'Cấu trúc URL Supabase Storage không hợp lệ' };
    }

    const bucketName = match[1];
    const rawObjectKey = match[2];
    const expectedBucket = options.bucketName || DEFAULT_SUPABASE_BUCKET;

    if (bucketName !== expectedBucket) {
      return { type: 'WRONG_BUCKET', isDeletable: false, error: `Bucket '${bucketName}' không khớp với cấu hình` };
    }

    let decodedKey;
    try {
      decodedKey = decodeURIComponent(rawObjectKey);
    } catch {
      return { type: 'INVALID_KEY', isDeletable: false, error: 'Object Key không thể giải mã URI' };
    }

    // Kiểm tra ký tự bất thường trong Object Key (kiểm tra cả chuỗi thô lẫn chuỗi đã giải mã)
    const keyValidation = validateObjectKey(rawObjectKey, decodedKey);
    if (!keyValidation.valid) {
      return { type: keyValidation.type, isDeletable: false, error: keyValidation.error };
    }

    return {
      type: 'SUPABASE',
      isDeletable: true,
      bucketName,
      filePath: decodedKey,
    };
  }

  // 3. Kiểm tra nếu là Object Key Supabase thuần túy (bắt đầu bằng 'homestays/')
  if (trimmed.startsWith('homestays/')) {
    // Chặn encoded slash hoặc dấu gạch chéo ngược ngay trên chuỗi thô
    if (/%2f|%5c/i.test(trimmed) || trimmed.includes('\\')) {
      return { type: 'INVALID_KEY', isDeletable: false, error: 'Object Key chứa ký tự gạch chéo ngược hoặc encoded slash' };
    }

    let decodedKey;
    try {
      decodedKey = decodeURIComponent(trimmed);
    } catch {
      return { type: 'INVALID_KEY', isDeletable: false, error: 'Object Key không thể giải mã URI' };
    }

    const keyValidation = validateObjectKey(trimmed, decodedKey);
    if (!keyValidation.valid) {
      return { type: keyValidation.type, isDeletable: false, error: keyValidation.error };
    }

    return {
      type: 'SUPABASE',
      isDeletable: true,
      bucketName: options.bucketName || DEFAULT_SUPABASE_BUCKET,
      filePath: decodedKey,
    };
  }

  // 4. Kiểm tra nếu là ảnh Local
  const normalized = trimmed.replace(/\\/g, '/');

  // Chặn đường dẫn tuyệt đối không hợp lệ (ví dụ: C:\..., /var/..., \...)
  if (
    /^[a-zA-Z]:/i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('\\')
  ) {
    if (!normalized.startsWith('uploads/')) {
      return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Từ chối đường dẫn tuyệt đối không hợp lệ' };
    }
  }

  const isExplicitUploads = normalized.startsWith('uploads/');
  const isFlatFilename = !normalized.includes('/');

  // Chỉ chấp nhận nếu có tiền tố 'uploads/' HOẶC là tên file đơn thuần
  if (isExplicitUploads || isFlatFilename) {
    const filenameOnly = isExplicitUploads ? normalized.slice(8) : normalized;

    // 1. Kiểm tra ký tự bất thường hoặc traversal trong tên file TRƯỚC TIÊN
    if (
      filenameOnly.includes('..') ||
      filenameOnly.includes('/') ||
      filenameOnly.includes('\\') ||
      filenameOnly.includes('%2F') ||
      filenameOnly.includes('%2f')
    ) {
      return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Phát hiện ký tự traversal trong tên file local' };
    }

    const uploadsDir = path.resolve(options.uploadsDir || DEFAULT_UPLOADS_DIR);
    const resolvedPath = path.resolve(uploadsDir, filenameOnly);
    const relative = path.relative(uploadsDir, resolvedPath);

    // Chống Path Traversal bằng path.relative: Không được bắt đầu bằng .. và không phải absolute
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Đường dẫn nằm ngoài thư mục uploads' };
    }

    // 2. Bắt buộc phải có phần mở rộng ảnh hợp lệ (.jpg, .jpeg, .png, .webp)
    if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(filenameOnly)) {
      return { type: 'UNKNOWN', isDeletable: false, error: 'Định dạng tệp không phải là ảnh hợp lệ' };
    }

    // Nếu là tên file đơn thuần (không có tiền tố 'uploads/'), bắt buộc tệp phải THỰC SỰ TỒN TẠI trên đĩa
    // Tránh việc tự tiện phân loại một chuỗi bất kỳ thành LOCAL khi không có căn cứ
    if (isFlatFilename && !isExplicitUploads) {
      const fileExists = fs.existsSync(resolvedPath);
      if (!fileExists) {
        return { type: 'UNKNOWN', isDeletable: false, error: 'Tệp không tồn tại trong thư mục uploads và không có tiền tố uploads/' };
      }
    }

    // Kiểm tra Symlink của thư mục cha
    const parentDir = path.dirname(resolvedPath);
    try {
      const parentStats = await fs.promises.lstat(parentDir);
      if (parentStats.isSymbolicLink()) {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Thư mục cha là Symbolic Link, từ chối xóa vì lý do an toàn' };
      }

      const realParentDir = await fs.promises.realpath(parentDir);
      const realUploadsDir = await fs.promises.realpath(uploadsDir).catch(() => uploadsDir);
      const relParent = path.relative(realUploadsDir, realParentDir);

      if (relParent.startsWith('..') || path.isAbsolute(relParent)) {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Thư mục cha trỏ ra ngoài phạm vi thư mục uploads' };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: `Lỗi kiểm tra thư mục cha: ${err.message}` };
      }
    }

    // Kiểm tra Symlink của chính file nếu file đã tồn tại trên đĩa
    try {
      const stats = await fs.promises.lstat(resolvedPath);
      if (stats.isSymbolicLink()) {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Phát hiện Symbolic Link, từ chối xóa vì lý do an toàn' };
      }

      // Xác minh đường dẫn thực tế sau khi giải mã link
      const realPath = await fs.promises.realpath(resolvedPath);
      const realUploadsDir = await fs.promises.realpath(uploadsDir).catch(() => uploadsDir);
      const realRelative = path.relative(realUploadsDir, realPath);

      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: 'Đường dẫn thực tế của file nằm ngoài thư mục uploads' };
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        return { type: 'SECURITY_ALERT', isDeletable: false, error: `Lỗi kiểm tra tệp: ${err.message}` };
      }
      // Nếu file không tồn tại (ENOENT) nhưng có tiền tố uploads/ -> Vẫn cho phép type LOCAL để hỗ trợ xóa idempotent
    }

    return {
      type: 'LOCAL',
      isDeletable: true,
      bucketName: 'local',
      filePath: `uploads/${filenameOnly}`,
      absolutePath: resolvedPath,
    };
  }

  // 5. Không đủ căn cứ xác định -> UNKNOWN (không đoán mò)
  return { type: 'UNKNOWN', isDeletable: false, error: 'Không xác định được loại đường dẫn hợp lệ' };
}

/**
 * Kiểm tra tính hợp lệ của Supabase Object Key.
 * @param {string} rawKey - Chuỗi key thô trước khi decode
 * @param {string} [decodedKey] - Chuỗi key sau khi decode
 * @returns {{ valid: boolean, type?: string, error?: string }}
 */
function validateObjectKey(rawKey, decodedKey = rawKey) {
  const combined = `${rawKey || ''} ${decodedKey || ''}`;

  // Chặn dấu gạch chéo ngược, encoded slash, control chars
  if (
    combined.includes('\\') ||
    /%2f|%5c/i.test(combined)
  ) {
    return { valid: false, type: 'INVALID_KEY', error: 'Object Key chứa ký tự gạch chéo ngược hoặc encoded slash' };
  }

  // Chặn path segments '.' hoặc '..'
  const target = decodedKey || rawKey || '';
  const segments = target.split('/');
  for (const seg of segments) {
    if (seg === '.' || seg === '..') {
      return { valid: false, type: 'SECURITY_ALERT', error: 'Object Key chứa path segment không an toàn (. hoặc ..)' };
    }
  }

  return { valid: true };
}

/**
 * Tải một file lên hệ thống lưu trữ theo driver đã cấu hình.
 *
 * @param {Object} file - { buffer: Buffer, originalname: string, mimetype: string }
 * @param {number|string} homestayId
 * @param {Object} [options={}] - { driver, bucketName, uploadsDir, supabaseClient }
 * @returns {Promise<{ path: string, url: string|null, bucketName: string, driver: string }>}
 */
export async function uploadFile(file, homestayId, options = {}) {
  if (!file || !file.buffer) {
    throw new Error('[STORAGE_ERROR] Không tìm thấy buffer của file để tải lên');
  }

  const driver = options.driver || getStorageDriver();

  // Chặn trường hợp options.driver ép sang 'local' trong môi trường production (AUDIT-F01)
  if (process.env.NODE_ENV === 'production' && driver === 'local') {
    throw new Error(
      "[STORAGE_CONFIG_ERROR] Không được phép sử dụng driver 'local' trong môi trường production."
    );
  }

  const bucketName = options.bucketName || DEFAULT_SUPABASE_BUCKET;
  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const timestamp = Date.now();
  const uniqueId = crypto.randomUUID();

  // 1. Chế độ Supabase Storage
  if (driver === 'supabase') {
    const supabase = options.supabaseClient || getSupabaseClient();
    const objectKey = `homestays/${homestayId}/${timestamp}-${uniqueId}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(objectKey, file.buffer, {
        contentType: file.mimetype || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`[SUPABASE_UPLOAD_FAILED] ${uploadError.message}`);
    }

    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(objectKey);
    const publicUrl = publicData?.publicUrl || null;

    return {
      path: objectKey, // Lưu Object Key vào DB để bảo đảm tính di động
      url: publicUrl,
      bucketName,
      driver: 'supabase',
    };
  }

  // 2. Chế độ Local Storage
  const uploadsDir = path.resolve(options.uploadsDir || DEFAULT_UPLOADS_DIR);
  await fs.promises.mkdir(uploadsDir, { recursive: true });

  const filename = `images-${timestamp}-${uniqueId}${ext}`;
  const absolutePath = path.join(uploadsDir, filename);

  await fs.promises.writeFile(absolutePath, file.buffer);

  return {
    path: `uploads/${filename}`,
    url: null,
    bucketName: 'local',
    driver: 'local',
  };
}

let testHooks = null;
/**
 * Cho phép thiết lập hooks can thiệp phục vụ Unit Test.
 * @param {Object|null} hooks
 */
export function setTestStorageHooks(hooks = null) {
  if (process.env.NODE_ENV !== 'test') return;
  testHooks = hooks;
}

/**
 * Tải nhiều file lên Storage với cơ chế bù trừ nếu một file trong lô bị lỗi.
 *
 * @param {Array<Object>} files - Mảng các file có buffer
 * @param {number|string} homestayId
 * @param {Object} [options={}]
 * @returns {Promise<Array<{ path: string, url: string|null, bucketName: string, driver: string }>>}
 */
export async function uploadFiles(files, homestayId, options = {}) {
  if (testHooks?.uploadFiles) {
    return testHooks.uploadFiles(files, homestayId, options);
  }

  if (!files || !Array.isArray(files) || files.length === 0) {
    return [];
  }

  const uploadedResults = [];

  try {
    for (const file of files) {
      const result = await uploadFile(file, homestayId, options);
      uploadedResults.push(result);
    }
    return uploadedResults;
  } catch (err) {
    // NẾU CÓ BẤT KỲ FILE NÀO TRONG LÔ BỊ LỖI:
    // Tự động thu hồi/xóa các file đã upload thành công trước đó trong request này
    for (const uploaded of uploadedResults) {
      try {
        await deleteFileFromStorage(uploaded.path, uploaded.bucketName, options);
      } catch (cleanupErr) {
        console.error(
          `[STORAGE_ROLLBACK_WARN] Lỗi khi dọn dẹp file bù trừ ${uploaded.path}:`,
          cleanupErr.message
        );
      }
    }
    throw err;
  }
}

/**
 * Xóa một file khỏi hệ thống lưu trữ (hỗ trợ cả Local và Supabase).
 *
 * @param {string} rawPath - Chuỗi đường dẫn (URL, Object Key, hoặc Local Path)
 * @param {string} [bucketName=DEFAULT_SUPABASE_BUCKET]
 * @param {Object} [options={}] - { uploadsDir, supabaseClient }
 * @returns {Promise<{ success: boolean, alreadyDeleted?: boolean, skipped?: boolean, error?: string }>}
 */
export async function deleteFileFromStorage(rawPath, bucketName = DEFAULT_SUPABASE_BUCKET, options = {}) {
  if (testHooks?.deleteFileFromStorage) {
    return testHooks.deleteFileFromStorage(rawPath, bucketName, options);
  }

  const classification = await classifyAndValidateImagePath(rawPath, {
    ...options,
    bucketName,
  });

  if (!classification.isDeletable) {
    // Nếu là URL ngoại vi (như Unsplash): Coi là hoàn tất an toàn (không gửi lệnh xóa, không gây lỗi queue)
    if (classification.type === 'EXTERNAL_URL') {
      return { success: true, skipped: true, reason: 'EXTERNAL_URL' };
    }
    return {
      success: false,
      error: classification.error || 'Đường dẫn không hợp lệ hoặc không được phép xóa',
    };
  }

  // 1. Xóa ảnh trên Supabase Storage
  if (classification.type === 'SUPABASE') {
    const supabase = options.supabaseClient || getSupabaseClient();
    const targetBucket = classification.bucketName || bucketName;
    const targetKey = classification.filePath;

    try {
      const { error } = await supabase.storage.from(targetBucket).remove([targetKey]);

      if (error) {
        const msg = (error.message || '').toLowerCase();
        const isBucketError =
          error.name === 'NoSuchBucket' ||
          msg.includes('nosuchbucket') ||
          (msg.includes('bucket') && (msg.includes('not found') || msg.includes('does not exist') || msg.includes('invalid')));

        // Nếu là lỗi liên quan đến Bucket: Bắt buộc báo lỗi (không được nuốt thành idempotent success)
        if (isBucketError) {
          return {
            success: false,
            error: error.message,
            statusCode: error.statusCode || error.status || 404,
            name: error.name || 'NoSuchBucket',
            code: error.code,
          };
        }

        // Idempotent: Chỉ khi file/object cụ thể không tồn tại mới coi là đã xóa thành công
        const isObjectNotFound =
          error.name === 'NoSuchKey' ||
          msg.includes('nosuchkey') ||
          msg.includes('object not found') ||
          msg.includes('object does not exist') ||
          msg.includes('the specified key does not exist') ||
          msg.includes('file not found') ||
          msg.includes('file does not exist') ||
          msg.includes('the resource was not found on remote storage');

        if (isObjectNotFound) {
          return { success: true, alreadyDeleted: true };
        }

        return {
          success: false,
          error: error.message,
          statusCode: error.statusCode || error.status,
          name: error.name,
          code: error.code,
        };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        statusCode: err.statusCode || err.status,
        name: err.name,
        code: err.code,
      };
    }
  }

  // 2. Xóa ảnh trên Local File System
  if (classification.type === 'LOCAL') {
    const filePath = classification.absolutePath;
    try {
      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (err) {
      // Idempotent: Nếu file không tồn tại trên đĩa (ENOENT) -> Coi là đã xóa thành công
      if (err.code === 'ENOENT') {
        return { success: true, alreadyDeleted: true };
      }
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: 'Loại lưu trữ không được hỗ trợ' };
}

/**
 * Xóa nhiều file khỏi Storage.
 * @param {Array<string>} filePaths
 * @param {string} [bucketName]
 * @param {Object} [options]
 * @returns {Promise<{ total: number, succeeded: number, failed: number, results: Array<Object> }>}
 */
export async function deleteFilesFromStorage(filePaths, bucketName = DEFAULT_SUPABASE_BUCKET, options = {}) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  let succeeded = 0;
  let failed = 0;
  const results = [];

  for (const fp of filePaths) {
    const res = await deleteFileFromStorage(fp, bucketName, options);
    results.push({ filePath: fp, ...res });
    if (res.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return { total: filePaths.length, succeeded, failed, results };
}

// =============================================================================
// QUẢN TRỊ IN-MEMORY EMERGENCY BUFFER (KHI DATABASE SẬP)
// =============================================================================

/**
 * Thêm một mục vào In-Memory Emergency Buffer khi Database không khả dụng.
 * @param {Object} item - { filePath, bucketName, reason, homestayId }
 */
export function pushToEmergencyBuffer(item) {
  if (!item || !item.filePath) return;

  if (inMemoryEmergencyBuffer.length >= MAX_EMERGENCY_BUFFER_SIZE) {
    unhandledDroppedJobsCount++;
    const dropped = inMemoryEmergencyBuffer.shift(); // FIFO eviction

    console.error(
      JSON.stringify({
        level: 'CRITICAL',
        event: 'EMERGENCY_BUFFER_OVERFLOW',
        message: 'Bộ đệm bù trừ khẩn cấp đầy (500 mục). Không thể tiếp nhận thêm job.',
        droppedItem: dropped,
        totalDroppedCount: unhandledDroppedJobsCount,
        timestamp: new Date().toISOString(),
      })
    );
  }

  inMemoryEmergencyBuffer.push({
    ...item,
    createdAt: new Date(),
  });
}

/**
 * Trả về danh sách hiện tại của Emergency Buffer (phục vụ test và audit).
 */
export function getEmergencyBuffer() {
  return [...inMemoryEmergencyBuffer];
}

/**
 * Xóa trắng Emergency Buffer (dùng trong test).
 */
export function clearEmergencyBuffer() {
  inMemoryEmergencyBuffer.length = 0;
  unhandledDroppedJobsCount = 0;
}

/**
 * Số lượng job bị loại bỏ do tràn buffer.
 */
export function getDroppedJobsCount() {
  return unhandledDroppedJobsCount;
}

/**
 * Đồng bộ buffer vào PostgreSQL Queue khi database kết nối lại.
 *
 * Yêu cầu an toàn:
 * 1. Duyệt từng job độc lập: nếu DB mất kết nối giữa chừng (ví dụ 5 job đầu thành công, 5 job sau lỗi),
 *    các job thành công được loại khỏi Buffer, các job lỗi ĐƯỢC GIỮ LẠI để thử lại sau.
 * 2. Tuyệt đối không xóa toàn bộ Buffer nếu có lỗi.
 * 3. Chống enqueue trùng nhờ Partial Unique Index và ON CONFLICT DO NOTHING trong enqueueCleanupFn.
 *
 * @param {Function} enqueueCleanupFn - Hàm enqueueCleanup từ storageCleanupQueue.service.js
 * @param {Object} [client] - Prisma client
 * @returns {Promise<number>} Số job đã đồng bộ thành công
 */
export async function flushEmergencyBuffer(enqueueCleanupFn, client) {
  if (inMemoryEmergencyBuffer.length === 0) return 0;
  if (typeof enqueueCleanupFn !== 'function') return 0;

  const currentSnapshot = [...inMemoryEmergencyBuffer];
  let successfullyEnqueuedCount = 0;
  const remainingJobs = [];

  for (const item of currentSnapshot) {
    try {
      await enqueueCleanupFn(item, client);
      successfullyEnqueuedCount++;
    } catch (err) {
      console.error(
        `[EMERGENCY_FLUSH_ERROR] Thất bại khi đồng bộ job ${item.filePath} vào Queue:`,
        err.message
      );
      remainingJobs.push(item);
    }
  }

  // Cập nhật lại Buffer: Chỉ giữ lại các job chưa enqueue thành công
  inMemoryEmergencyBuffer.length = 0;
  inMemoryEmergencyBuffer.push(...remainingJobs);

  return successfullyEnqueuedCount;
}

export default {
  getStorageDriver,
  validateStorageConfig,
  uploadFile,
  uploadFiles,
  deleteFileFromStorage,
  deleteFilesFromStorage,
  classifyAndValidateImagePath,
  pushToEmergencyBuffer,
  getEmergencyBuffer,
  clearEmergencyBuffer,
  getDroppedJobsCount,
  flushEmergencyBuffer,
};
