// src/utils/apiConfig.js
/**
 * Cấu hình tập trung địa chỉ Backend API và tài nguyên tĩnh
 * Hỗ trợ các biến môi trường VITE_API_URL, VITE_API_BASE_URL, VITE_SUPABASE_URL khi triển khai Vercel
 * Tự động dự phòng về http://localhost:3000 khi chạy môi trường local
 */

export const BACKEND_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000'
).replace(/\/+$/, '');

export const API_BASE_URL = `${BACKEND_URL}/api`;

export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');

/**
 * Trả về URL đầy đủ cho đường dẫn ảnh được lưu trong thư mục uploads của Backend hoặc Supabase Storage
 * @param {string} imagePath - Đường dẫn tương đối (ví dụ: 'uploads/image-123.jpg' hoặc 'homestays/1/123.jpg') hoặc URL tuyệt đối
 * @param {string} fallbackImage - Ảnh mặc định nếu imagePath rỗng
 */
export const getFullImageUrl = (
  imagePath,
  fallbackImage = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80'
) => {
  if (!imagePath) return fallbackImage;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;

  // Nếu là Object Key Supabase và frontend đã được cấu hình SUPABASE_URL
  if (SUPABASE_URL && cleanPath.startsWith('homestays/')) {
    return `${SUPABASE_URL}/storage/v1/object/public/homestays/${cleanPath}`;
  }

  return `${BACKEND_URL}/${cleanPath}`;
};

export default {
  BACKEND_URL,
  API_BASE_URL,
  SUPABASE_URL,
  getFullImageUrl,
};
