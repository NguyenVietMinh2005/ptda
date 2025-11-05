// server.js
import 'dotenv/config'; // Tải biến môi trường (thay cho require('dotenv').config())
import express from 'express';
import path from 'path'; // <-- 1. Import 'path'
import { fileURLToPath } from 'url'; // <-- 2. Import 'fileURLToPath' (cần cho ES Modules)
import adminRoute from './routes/admin.route.js';
import cors from 'cors';

import homestayRoute from './routes/homestay.route.js';
import ownerRoute from './routes/owner.route.js';
// Import route (lưu ý đường dẫn và đuôi .js)
import authRoute from './routes/auth.route.js'; 
import bookingRoute from './routes/booking.route.js';
import complaintRoute from './routes/complaint.route.js';

// --- Cấu hình đường dẫn cho ES Modules ---
// Cần 2 dòng này để lấy __dirname (đường dẫn thư mục hiện tại)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// --- Kết thúc cấu hình đường dẫn ---

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- Thêm Static File Server ---
// 'path.join(__dirname, '../uploads')' sẽ tạo đường dẫn tuyệt đối
// đến thư mục 'uploads' của bạn (vì 'uploads' nằm ngoài 'src')
// '/uploads': Đây là tiền tố URL. 
// Bất cứ request nào đến /uploads, Express sẽ tìm file trong thư mục 'uploads'
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/admin', adminRoute);

// Routes
app.get('/', (req, res) => {
  res.send('Chào mừng đến với Homestay API!');
});

// Gắn route API
app.use('/api/auth', authRoute);
app.use('/api/homestays', homestayRoute);

// Gắn route API cho Chủ Homestay
app.use('/api/owner', ownerRoute);

// Gắn route API cho Quản lý Đơn đặt
app.use('/api/bookings', bookingRoute);

app.use('/api/complaints', complaintRoute);

// Lắng nghe server
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});