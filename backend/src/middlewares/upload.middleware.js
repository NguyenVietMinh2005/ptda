// backend/src/middlewares/upload.middleware.js
import multer from 'multer';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_FILES_COUNT = 5;
export const MAX_DIMENSION = 4096; // 4096px
export const MAX_TOTAL_PIXELS = 16 * 1024 * 1024; // 16 Megapixels = 16,777,216 pixels
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// 1. Cấu hình memoryStorage để lưu trữ file trong RAM dưới dạng Buffer
const storage = multer.memoryStorage();

// 2. Bộ lọc cơ bản ban đầu của Multer
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP!'), false);
  }
};

// 3. Khởi tạo instance multer
export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_COUNT,
  },
  fileFilter,
});

/**
 * Kiểm tra tính hợp lệ và an toàn sâu của một buffer ảnh:
 * - Kiểm tra Magic Bytes bằng file-type
 * - Kiểm tra kích thước tối đa (4096px) và tổng số pixel (16MP) bằng sharp
 * - Giải mã thực tế để phát hiện file corrupt hoặc bom giải nén
 *
 * @param {Buffer} buffer - Buffer nội dung file
 * @param {string} originalname - Tên file gốc
 * @returns {Promise<{ valid: boolean, mime?: string, width?: number, height?: number, error?: string }>}
 */
export async function validateImageBuffer(buffer, originalname = 'image') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { valid: false, error: `Tệp "${originalname}" rỗng hoặc không có dữ liệu buffer.` };
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, error: `Dung lượng tệp "${originalname}" vượt quá 5MB.` };
  }

  // 1. Xác minh Magic Bytes thực tế
  const typeResult = await fileTypeFromBuffer(buffer);
  if (!typeResult || !ALLOWED_MIME_TYPES.includes(typeResult.mime)) {
    return {
      valid: false,
      error: `Tệp "${originalname}" không phải là ảnh hợp lệ hoặc bị giả mạo định dạng (chỉ chấp nhận JPEG, PNG, WebP).`,
    };
  }

  // 2. Thẩm định kích thước và giải mã qua sharp
  try {
    const image = sharp(buffer, { limitInputPixels: MAX_TOTAL_PIXELS });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return {
        valid: false,
        error: `Không thể đọc thông số kích thước của ảnh "${originalname}".`,
      };
    }

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      return {
        valid: false,
        error: `Kích thước ảnh "${originalname}" (${metadata.width}x${metadata.height}) vượt quá giới hạn tối đa ${MAX_DIMENSION}x${MAX_DIMENSION}px.`,
      };
    }

    const totalPixels = metadata.width * metadata.height;
    if (totalPixels > MAX_TOTAL_PIXELS) {
      return {
        valid: false,
        error: `Tổng số pixel của ảnh "${originalname}" (${totalPixels}) vượt quá giới hạn 16 Megapixels.`,
      };
    }

    // Thực sự giải mã dữ liệu byte để phát hiện file corrupt / truncated
    await image.stats();

    return {
      valid: true,
      mime: typeResult.mime,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (err) {
    return {
      valid: false,
      error: `Tệp ảnh "${originalname}" bị hỏng dữ liệu hoặc không thể giải mã: ${err.message}`,
    };
  }
}

/**
 * Express Middleware thẩm định danh sách file ảnh tải lên trong req.files.
 */
export async function validateUploadedImages(req, res, next) {
  const files = req.files;

  // Nếu không có file nào được tải lên
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, message: 'Không có file ảnh nào được tải lên.' });
  }

  if (files.length > MAX_FILES_COUNT) {
    return res.status(400).json({
      success: false,
      message: `Số lượng ảnh vượt quá giới hạn (tối đa ${MAX_FILES_COUNT} ảnh trong một lần tải lên).`,
    });
  }

  for (const file of files) {
    const check = await validateImageBuffer(file.buffer, file.originalname);
    if (!check.valid) {
      return res.status(400).json({ success: false, message: check.error });
    }
    // Gán mimetype thực tế đã kiểm tra từ Magic Bytes
    file.validatedMime = check.mime;
    file.width = check.width;
    file.height = check.height;
  }

  next();
}

/**
 * Express Error Handler cho các lỗi do Multer sinh ra (vượt file size, vượt số lượng, v.v.)
 */
export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Dung lượng ảnh vượt quá giới hạn cho phép (tối đa 5MB/ảnh).' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, message: 'Số lượng ảnh vượt quá giới hạn cho phép (tối đa 5 ảnh).' });
    }
    return res.status(400).json({ success: false, message: `Lỗi tải lên: ${err.message}` });
  }

  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Lỗi không xác định khi tải file.' });
  }

  next();
}

export default upload;
