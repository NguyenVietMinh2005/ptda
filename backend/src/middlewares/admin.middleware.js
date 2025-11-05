// src/middlewares/admin.middleware.js
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// Middleware này kiểm tra 2 điều:
// 1. Đã đăng nhập (giống 'protectOwner')
// 2. Phải có Quyen = 'admin'

export const protectAdmin = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const admin = await prisma.cHU_HOMESTAY.findUnique({
        where: { MaChu: decoded.ownerId },
      });

      // Kiểm tra 1: User có tồn tại không?
      if (!admin) {
        return res.status(401).json({ message: 'Người dùng không tồn tại.' });
      }

      // Kiểm tra 2: User có phải là admin không?
      if (admin.Quyen !== 'admin') {
        return res.status(403).json({ message: 'Không có quyền truy cập.' }); // 403 Forbidden
      }
      
      req.owner = admin; // Vẫn lưu là req.owner cho nhất quán
      next();
    } catch (error) {
      res.status(401).json({ message: 'Token không hợp lệ.' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Không tìm thấy token.' });
  }
};