// backend/src/config/supabase.js
import { createClient } from '@supabase/supabase-js';

let customSupabaseClient = null;

/**
 * Cho phép thiết lập custom client (phục vụ Unit Test / Mocking).
 * @param {Object|null} client
 */
export function setSupabaseClient(client) {
  customSupabaseClient = client;
}

/**
 * Trả về Supabase Client được khởi tạo với Service Role Key.
 *
 * Yêu cầu an toàn:
 * - Service Role Key chỉ dùng ở Backend, tuyệt đối không xuất ra client/frontend.
 * - Fail-fast: Nếu thiếu biến môi trường, ném ngoại lệ rõ ràng, không fallback âm thầm sang Local.
 *
 * @param {Object} [overrideConfig] - Tùy chọn ghi đè URL hoặc Key (chủ yếu dùng cho test)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient(overrideConfig = {}) {
  if (customSupabaseClient) {
    return customSupabaseClient;
  }

  const supabaseUrl = overrideConfig.supabaseUrl || process.env.SUPABASE_URL;
  const serviceRoleKey = overrideConfig.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[SUPABASE_CONFIG_ERROR] Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. ' +
      'Vui lòng cấu hình đầy đủ trong biến môi trường Backend trước khi sử dụng Supabase Storage.'
    );
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('http')) {
      throw new Error('Protocol không hợp lệ');
    }
  } catch (err) {
    throw new Error('[SUPABASE_CONFIG_ERROR] SUPABASE_URL không phải là một URL hợp lệ.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Lấy hostname của Supabase Project hiện tại (dùng để xác thực URL trong Path Classifier).
 * @returns {string} Hostname chữ thường, ví dụ: 'xyzproject.supabase.co' (hoặc rỗng nếu chưa cấu hình)
 */
export function getSupabaseProjectHost() {
  const url = process.env.SUPABASE_URL;
  if (!url) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export default {
  getSupabaseClient,
  setSupabaseClient,
  getSupabaseProjectHost,
};

