// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

export const protect = async (req, res, next) => {
  let token;

  // 1. Lấy token từ header
  // Client sẽ gửi token trong header 'Authorization' với dạng 'Bearer <token>'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1]; // Tách lấy phần token

      // 2. Giải mã token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Lấy thông tin người dùng từ token (trừ mật khẩu)
      // Chúng ta đã lưu 'userId' (là 'MaNguoiDung') vào token lúc login
      const currentUser = await prisma.nGUOI_DUNG.findUnique({
        where: { MaNguoiDung: decoded.userId },
        select: {
          MaNguoiDung: true,
          HoTen: true,
          Email: true,
          isActive: true,
          // Thêm các trường khác bạn muốn, trừ 'MatKhau'
        },
      });

      if (!currentUser) {
        return res.status(401).json({ message: 'Người dùng không tồn tại.' });
      }

      if (currentUser.isActive === false) {
        return res.status(403).json({ message: 'Tài khoản đã bị khóa.' });
      }

      // 4. Gắn thông tin user vào đối tượng 'req'
      req.user = currentUser;

      // Đi tiếp đến controller
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Không tìm thấy token, yêu cầu bị từ chối.' });
  }
};