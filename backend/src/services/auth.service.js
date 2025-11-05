// src/services/auth.service.js
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const registerUser = async (userData) => {
  // 1. Kiểm tra email
  // Sửa 'prisma.user' thành 'prisma.nGUOI_DUNG'
  const existingUser = await prisma.nGUOI_DUNG.findUnique({
    where: { Email: userData.email }, // userData.email là dữ liệu từ JSON body
  });

  if (existingUser) {
    throw new Error('Email đã tồn tại');
  }

  // 2. Băm mật khẩu
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  // 3. Tạo user - Ánh xạ tới đúng tên trường trong schema
  // Sửa 'prisma.user' thành 'prisma.nGUOI_DUNG'
  const user = await prisma.nGUOI_DUNG.create({
    data: {
      // Ánh xạ 'fullName' từ body sang 'HoTen' của database
      HoTen: userData.fullName, 
      
      // Ánh xạ 'email' từ body sang 'Email' của database
      Email: userData.email,    
      
      // Ánh xạ 'password' từ body sang 'MatKhau' của database
      MatKhau: hashedPassword, 
      SoDienThoai: userData.soDienThoai,
      // Model NGUOI_DUNG không có trường 'isActive', 
      // nên chúng ta bỏ dòng 'isActive: false' đi.
    },
  });

  // 4. Xóa mật khẩu trước khi trả về
  // Đảm bảo xóa đúng trường 'MatKhau'
  delete user.MatKhau; 
  
  return user;
};
// Thêm hàm loginUser
export const loginUser = async (userData) => {
  // 1. Tìm người dùng bằng email
  const user = await prisma.nGUOI_DUNG.findUnique({
    where: { Email: userData.email },
  });

  if (!user) {
    throw new Error('Email không tồn tại');
  }
  if (user.isActive === false) {
    throw new Error('Tài khoản của bạn đã bị khóa'); // Lỗi mới
  }
  // 2. So sánh mật khẩu
  const isPasswordMatch = await bcrypt.compare(userData.password, user.MatKhau);

  if (!isPasswordMatch) {
    throw new Error('Mật khẩu không chính xác');
  }

  // 3. Tạo Token (JWT)
  // Lấy 'MaNguoiDung' để định danh user trong token
  const token = jwt.sign(
    { userId: user.MaNguoiDung }, // payload
    process.env.JWT_SECRET,        // secret key
    { expiresIn: '5h' }           // Hết hạn sau 5 giờ
  );

  // 4. Xóa mật khẩu và trả về
  delete user.MatKhau;
  return { user, token };
};