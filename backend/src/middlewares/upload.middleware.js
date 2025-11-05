// src/middlewares/upload.middleware.js
import multer from 'multer';
import path from 'path';

// 1. Cấu hình nơi lưu trữ
const storage = multer.diskStorage({
  // 'destination': thư mục sẽ lưu file
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Lưu vào thư mục 'uploads'
  },
  // 'filename': tên file sẽ được lưu
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất: fieldname-timestamp.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// 2. Cấu hình lọc file (chỉ chấp nhận ảnh)
const fileFilter = (req, file, cb) => {
  // Kiểm tra đuôi file
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg'
  ) {
    cb(null, true); // Chấp nhận file
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (JPG, PNG)!'), false); // Từ chối file
  }
};

// 3. Khởi tạo multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // Giới hạn 5MB
  },
  fileFilter: fileFilter,
});

export default upload;